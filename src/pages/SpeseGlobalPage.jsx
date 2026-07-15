import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { estraiFattura } from '../lib/fileExtractor'
import SpeseForm from '../components/SpeseForm'
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Building2,
  ArrowRight,
  Clock,
  RefreshCw,
  X,
  Receipt
} from 'lucide-react'

// Helper per formattare la dimensione del file
const formatSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default function SpeseGlobalPage() {
  const { user } = useAuth()
  const [condomini, setCondomini] = useState([])
  const [loadingCondomini, setLoadingCondomini] = useState(true)
  
  // Coda di elaborazione fatture
  const [queue, setQueue] = useState([])
  const [activeQueueId, setActiveQueueId] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  
  const fileInputRef = useRef()

  // 1. Carica i condomini dell'amministratore all'avvio
  useEffect(() => {
    const fetchCondomini = async () => {
      try {
        const { data, error } = await supabase
          .from('condomini')
          .select('*')
          .order('nome', { ascending: true })
        if (error) throw error
        setCondomini(data || [])
      } catch (err) {
        console.error('Errore caricamento condomini:', err)
      } finally {
        setLoadingCondomini(false)
      }
    }
    fetchCondomini()
  }, [])

  // 2. Helper per recuperare i dettagli di un condominio selezionato
  const fetchCondominioDati = async (condoId) => {
    if (!condoId) return { tabelle: [], unita: [], documenti: [], esercizi: [] }
    try {
      const [resEsercizi, resUnita, resTabelle, resDocumenti] = await Promise.all([
        supabase.from('esercizi').select('*').eq('condominio_id', condoId).order('anno', { ascending: false }),
        supabase.from('unita').select('id, numero, piano, tipo').eq('condominio_id', condoId),
        supabase.from('tabelle_millesimali').select('*, millesimi_unita(*)').eq('condominio_id', condoId),
        supabase.from('documenti_condominio').select('*').eq('condominio_id', condoId)
      ])
      return {
        esercizi: resEsercizi.data || [],
        unita: resUnita.data || [],
        tabelle: resTabelle.data || [],
        documenti: resDocumenti.data || []
      }
    } catch (err) {
      console.error('Errore caricamento dettagli condominio:', err)
      return { tabelle: [], unita: [], documenti: [], esercizi: [] }
    }
  }

  // 3. Algoritmo di matching del condominio
  const matchCondominio = (datiEstratti, condominiList) => {
    if (!datiEstratti || !condominiList || condominiList.length === 0) return null

    // Pulisci il codice fiscale per confronto esatto (solo cifre)
    const cfEstratto = String(datiEstratti.condominio_destinatario_codice_fiscale || '').replace(/\D/g, '')
    if (cfEstratto) {
      const trovatoCF = condominiList.find(c => {
        const cfCondo = String(c.codice_fiscale || '').replace(/\D/g, '')
        return cfCondo && cfCondo === cfEstratto
      })
      if (trovatoCF) return trovatoCF.id
    }

    // Matching fuzzy sul nome del condominio
    const nomeEstratto = String(datiEstratti.condominio_destinatario_nome || '').trim().toLowerCase()
    if (nomeEstratto && nomeEstratto.length > 3) {
      const paroleChiave = nomeEstratto
        .replace(/condominio/g, '')
        .split(/[\s,.-]+/)
        .filter(w => w.length > 2)
      
      if (paroleChiave.length > 0) {
        const trovatoNome = condominiList.find(c => {
          const nomeCondo = String(c.nome || '').toLowerCase()
          return paroleChiave.some(p => nomeCondo.includes(p))
        })
        if (trovatoNome) return trovatoNome.id
      }
    }

    // Matching sull'indirizzo
    const indirizzoEstratto = String(datiEstratti.condominio_destinatario_indirizzo || '').trim().toLowerCase()
    if (indirizzoEstratto && indirizzoEstratto.length > 5) {
      const trovatoInd = condominiList.find(c => {
        const indCondo = String(c.indirizzo || '').toLowerCase()
        return indCondo && (indirizzoEstratto.includes(indCondo) || indCondo.includes(indirizzoEstratto))
      })
      if (trovatoInd) return trovatoInd.id
    }

    return null
  }

  // 4. Sequencer di elaborazione sequenziale AI
  useEffect(() => {
    const runQueue = async () => {
      if (processing) return
      
      const nextItem = queue.find(item => item.status === 'idle')
      if (!nextItem) return

      setProcessing(true)

      // Aggiorna stato in elaborazione
      setQueue(prev => prev.map(item => item.id === nextItem.id ? { ...item, status: 'analyzing' } : item))

      try {
        const estratto = await estraiFattura(nextItem.file)
        
        // Cerca corrispondenza condominio
        const matchedCondoId = matchCondominio(estratto, condomini)
        
        // Recupera dati del condominio (esercizi, unità, tabelle millesimali) se identificato
        let condoDati = { esercizi: [], unita: [], tabelle: [], documenti: [] }
        let selectedEsercizioId = null
        
        if (matchedCondoId) {
          condoDati = await fetchCondominioDati(matchedCondoId)
          const aperto = condoDati.esercizi.find(e => e.stato === 'aperto') || condoDati.esercizi[0]
          selectedEsercizioId = aperto?.id || null
        }

        setQueue(prev => prev.map(item => {
          if (item.id === nextItem.id) {
            return {
              ...item,
              status: 'ready',
              extractedData: estratto,
              condominioId: matchedCondoId,
              esercizioId: selectedEsercizioId,
              esercizi: condoDati.esercizi,
              unita: condoDati.unita,
              tabelle: condoDati.tabelle,
              documenti: condoDati.documenti
            }
          }
          return item
        }))
        
        // Imposta automaticamente come attivo se nessun altro elemento è selezionato
        setActiveQueueId(prev => prev === null ? nextItem.id : prev)
      } catch (err) {
        console.error('Errore estrazione AI per:', nextItem.file.name, err)
        setQueue(prev => prev.map(item => 
          item.id === nextItem.id 
            ? { ...item, status: 'error', errorMsg: err.message || 'Errore di estrazione dati AI' } 
            : item
        ))
      } finally {
        setProcessing(false)
      }
    }

    runQueue()
  }, [queue, processing, condomini])

  // 5. Gestione caricamento file
  const handleFilesAdded = (fileList) => {
    const files = Array.from(fileList)
    if (files.length === 0) return

    // Limite 10 file totali in coda
    const spazioDisponibile = 10 - queue.length
    if (spazioDisponibile <= 0) {
      alert('La coda è piena. Gestisci o rimuovi le fatture presenti prima di caricarne altre (Max 10).')
      return
    }

    const filesDaCaricare = files.slice(0, spazioDisponibile)
    if (files.length > spazioDisponibile) {
      alert(`Puoi aggiungere solo fino a ${spazioDisponibile} fatture contemporaneamente. Alcuni file sono stati esclusi.`)
    }

    const nuoviElementi = filesDaCaricare
      .filter(file => {
        // Rilevamento duplicati locali in sessione (stesso nome e dimensione)
        const esiste = queue.some(q => q.file.name === file.name && q.file.size === file.size)
        if (esiste) {
          console.warn(`File ignorato (duplicato in sessione): ${file.name}`)
          return false
        }
        return true
      })
      .map(file => ({
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        status: 'idle',
        errorMsg: null,
        extractedData: null,
        condominioId: null,
        esercizioId: null,
        esercizi: [],
        unita: [],
        tabelle: [],
        documenti: []
      }))

    if (nuoviElementi.length > 0) {
      setQueue(prev => [...prev, ...nuoviElementi])
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) handleFilesAdded(e.dataTransfer.files)
  }

  const handleFileInput = (e) => {
    if (e.target.files) handleFilesAdded(e.target.files)
  }

  // 6. Cambiamenti condominio / esercizio selezionati dall'utente
  const handleCondominioChange = async (itemId, condoId) => {
    setQueue(prev => prev.map(item => item.id === itemId ? { ...item, status: 'updating_data' } : item))
    
    const condoDati = await fetchCondominioDati(condoId)
    const aperto = condoDati.esercizi.find(e => e.stato === 'aperto') || condoDati.esercizi[0]

    setQueue(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          status: 'ready',
          condominioId: condoId,
          esercizioId: aperto?.id || null,
          esercizi: condoDati.esercizi,
          unita: condoDati.unita,
          tabelle: condoDati.tabelle,
          documenti: condoDati.documenti
        }
      }
      return item
    }))
  }

  const handleEsercizioChange = (itemId, esId) => {
    setQueue(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, esercizioId: esId }
      }
      return item
    }))
  }

  const rimuoviDallaCoda = (itemId, e) => {
    e.stopPropagation()
    setQueue(prev => prev.filter(item => item.id !== itemId))
    if (activeQueueId === itemId) {
      setActiveQueueId(null)
    }
  }

  // 7. Salvataggio effettivo
  const handleSaveSpesaGlobale = async (itemId, payload, ripartizioni, fileCaricato, aiDatiEstratti) => {
    const item = queue.find(q => q.id === itemId)
    if (!item) return

    try {
      // a. Crea spesa
      const { data: nuovaSpesa, error: spesaErr } = await supabase
        .from('spese')
        .insert([{
          condominio_id: item.condominioId,
          esercizio_id: item.esercizioId,
          descrizione: payload.descrizione,
          importo: payload.importo,
          data_spesa: payload.data_spesa,
          categoria: payload.categoria,
          tipo_lavoro: payload.tipo_lavoro,
          criterio: payload.criterio,
          tabella_millesimale_id: payload.tabella_millesimale_id,
          percentuale_millesimi: payload.percentuale_millesimi,
          fornitore: payload.fornitore,
          numero_fattura: payload.numero_fattura,
          note: payload.note,
          suggerimento_ai: payload.suggerimento_ai,
          criterio_override: payload.criterio_override
        }])
        .select()
        .single()
        
      if (spesaErr) throw spesaErr
      const spesaId = nuovaSpesa.id

      // b. Salva ripartizioni
      const righeRipartizioni = ripartizioni.map(r => ({
        spesa_id: spesaId,
        unita_id: r.unita_id,
        importo: r.importo,
        millesimi_usati: r.millesimi_usati || null,
        override_manuale: r.override_manuale || false,
        importo_override: r.importo_override || null
      }))

      const { error: ripErr } = await supabase.from('ripartizioni').insert(righeRipartizioni)
      if (ripErr) throw ripErr

      // c. Salva allegato fattura
      if (fileCaricato && spesaId) {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        const path = `${currentUser.id}/${item.condominioId}/${Date.now()}_${fileCaricato.name}`
        const { error: storageErr } = await supabase.storage
          .from('fatture')
          .upload(path, fileCaricato, { contentType: fileCaricato.type })
        if (storageErr) throw storageErr

        // Cerca fornitore_id
        let fornitoreId = null
        try {
          const { data: fornitoriList } = await supabase
            .from('fornitori')
            .select('id, ragione_sociale, partita_iva, codice_fiscale')
          
          if (fornitoriList && fornitoriList.length > 0) {
            const pIvaClean = (aiDatiEstratti?.partita_iva_fornitore || '').replace(/\s+/g, '')
            if (pIvaClean) {
              const trovato = fornitoriList.find(f => f.partita_iva === pIvaClean || f.codice_fiscale === pIvaClean)
              if (trovato) fornitoreId = trovato.id
            } else {
              const nomeClean = (payload.fornitore || '').trim().toLowerCase()
              const trovato = fornitoriList.find(f => f.ragione_sociale.toLowerCase() === nomeClean)
              if (trovato) fornitoreId = trovato.id
            }
          }
        } catch (fornErr) {
          console.error('Errore ricerca fornitore:', fornErr)
        }

        // Crea record in fatture_fornitori
        const datiFattura = {
          condominio_id: item.condominioId,
          user_id: currentUser.id,
          spesa_id: spesaId,
          fornitore: payload.fornitore || 'Fornitore sconosciuto',
          fornitore_id: fornitoreId,
          numero_fattura: payload.numero_fattura || null,
          data_fattura: payload.data_spesa,
          data_scadenza: aiDatiEstratti?.data_scadenza || payload.data_spesa,
          importo_totale: payload.importo,
          importo_iva: aiDatiEstratti?.importo_iva || 0,
          importo_netto: aiDatiEstratti?.importo_netto || (payload.importo - (aiDatiEstratti?.importo_iva || 0)),
          descrizione: payload.descrizione || '',
          categoria: payload.categoria || 'altro',
          stato: 'attesa',
          pdf_url: path,
          ai_dati_estratti: aiDatiEstratti,
          imponibile_ritenuta: aiDatiEstratti?.imponibile_ritenuta || 0.00,
          aliquota_ritenuta_percentuale: aiDatiEstratti?.aliquota_ritenuta_percentuale || 0.00,
          importo_ritenuta: aiDatiEstratti?.importo_ritenuta || 0.00,
          ritenuta_acconto: aiDatiEstratti?.importo_ritenuta || 0.00,
          codice_tributo_f24: aiDatiEstratti?.codice_tributo_f24 || null,
          data_pagamento: null,
        }

        const { error: invoiceErr } = await supabase.from('fatture_fornitori').insert(datiFattura)
        if (invoiceErr) throw invoiceErr
      }

      // Segna come salvato
      setQueue(prev => prev.map(q => q.id === itemId ? { ...q, status: 'saved' } : q))
      
      // Passa alla fattura pronta successiva
      const rinvioPronta = queue.find(q => q.id !== itemId && q.status === 'ready')
      if (rinvioPronta) {
        setActiveQueueId(rinvioPronta.id)
      } else {
        setActiveQueueId(null)
      }
      
      alert('Spesa salvata ed associata correttamente!')
    } catch (err) {
      console.error('Errore durante il salvataggio:', err)
      alert('Errore durante il salvataggio: ' + err.message)
    }
  }

  // Seleziona elemento attivo nella coda
  const activeItem = queue.find(q => q.id === activeQueueId)

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', fontFamily: 'Sora, sans-serif' }}>
      
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 6px', color: 'var(--text-primary)', fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Receipt size={28} style={{ color: 'var(--accent)' }} /> Inserimento Rapido Spese (AI)
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
          Trascina qui le fatture. L'intelligenza artificiale le analizzerà una alla volta e tenterà di abbinarle al condominio corretto.
        </p>
      </div>

      {/* Main Container */}
      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* LATO SINISTRO: Coda e Dropzone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border-color)'}`,
              borderRadius: 12,
              padding: '24px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'rgba(37,99,235,0.08)' : 'var(--card-bg)',
              color: 'var(--text-secondary)',
              transition: 'all 0.2s',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.xls,.csv,.txt"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
            <UploadCloud size={32} style={{ margin: '0 auto 10px', color: 'var(--text-muted)' }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              Rilascia fatture qui
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Supporta fino a 10 PDF o immagini contemporaneamente
            </div>
          </div>

          {/* Lista in Coda */}
          <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border-color)', padding: 16 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Coda Elaborazione</span>
              <span style={{ fontSize: 11, background: 'var(--app-bg)', padding: '2px 8px', borderRadius: 10, color: 'var(--text-muted)' }}>
                {queue.length} / 10
              </span>
            </h3>

            {queue.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                Nessuna fattura caricata in coda
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
                {queue.map((item) => {
                  const isActive = item.id === activeQueueId
                  const matchedCondo = condomini.find(c => c.id === item.condominioId)
                  
                  return (
                    <div
                      key={item.id}
                      onClick={() => item.status !== 'analyzing' && setActiveQueueId(item.id)}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: isActive ? 'rgba(37,99,235,0.06)' : 'var(--app-bg)',
                        border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-color)'}`,
                        cursor: item.status === 'analyzing' ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                        position: 'relative'
                      }}
                    >
                      {/* Elimina file */}
                      <button
                        onClick={(e) => rimuoviDallaCoda(item.id, e)}
                        style={{
                          position: 'absolute', top: 8, right: 8, background: 'transparent',
                          border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                          padding: 2, borderRadius: '50%'
                        }}
                        title="Rimuovi"
                      >
                        <X size={14} />
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, paddingRight: 20 }}>
                        <FileText size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{
                          color: 'var(--text-primary)', fontSize: 12, fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }} title={item.file.name}>
                          {item.file.name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {formatSize(item.file.size)}
                        </span>
                        
                        {/* Stati */}
                        {item.status === 'idle' && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={11} /> In coda
                          </span>
                        )}
                        {item.status === 'analyzing' && (
                          <span style={{ fontSize: 10, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Loader2 size={11} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Analisi AI...
                          </span>
                        )}
                        {item.status === 'ready' && (
                          <span style={{ fontSize: 10, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ArrowRight size={11} /> Da confermare
                          </span>
                        )}
                        {item.status === 'updating_data' && (
                          <span style={{ fontSize: 10, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Loader2 size={11} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Aggiornamento...
                          </span>
                        )}
                        {item.status === 'saved' && (
                          <span style={{ fontSize: 10, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={11} /> Salvato
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span style={{ fontSize: 10, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={11} /> Errore
                          </span>
                        )}
                      </div>

                      {/* Condominio Matchato */}
                      {item.status === 'ready' && (
                        <div style={{
                          marginTop: 6, fontSize: 10, background: matchedCondo ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                          color: matchedCondo ? '#10b981' : '#ef4444', borderRadius: 4, padding: '2px 6px',
                          display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          <Building2 size={10} />
                          <span>{matchedCondo ? `Abbinato: ${matchedCondo.nome}` : 'Condominio non rilevato'}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* LATO DESTRO: Dettaglio e Validazione SpesaForm */}
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border-color)', padding: 24, minHeight: '500px' }}>
          
          {loadingCondomini ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-muted)' }}>
              <Loader2 size={36} className="spin" style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
              <span>Inizializzazione caricamento...</span>
            </div>
          ) : !activeItem ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-muted)' }}>
              <Receipt size={48} style={{ color: 'var(--border-color)', marginBottom: 16 }} />
              <h3 style={{ margin: '0 0 6px', color: 'var(--text-secondary)', fontSize: 16, fontWeight: 600 }}>Nessuna fattura selezionata</h3>
              <p style={{ margin: 0, fontSize: 13 }}>Seleziona una fattura "Da confermare" dalla coda di sinistra per completare l'inserimento.</p>
            </div>
          ) : activeItem.status === 'analyzing' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-muted)' }}>
              <Loader2 size={36} className="spin" style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)', marginBottom: 12 }} />
              <h3 style={{ margin: '0 0 6px', color: 'var(--text-secondary)', fontSize: 16, fontWeight: 600 }}>Analisi AI in corso...</h3>
              <p style={{ margin: 0, fontSize: 13 }}>Gemini sta leggendo il PDF/Immagine della fattura di "{activeItem.file.name}".</p>
            </div>
          ) : activeItem.status === 'error' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-muted)' }}>
              <AlertTriangle size={48} style={{ color: '#ef4444', marginBottom: 16 }} />
              <h3 style={{ margin: '0 0 6px', color: '#ef4444', fontSize: 16, fontWeight: 600 }}>Elaborazione Fallita</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13 }}>Si è verificato un errore durante l'estrazione: {activeItem.errorMsg}</p>
              <button
                onClick={() => setQueue(prev => prev.map(q => q.id === activeItem.id ? { ...q, status: 'idle' } : q))}
                style={{
                  background: 'var(--app-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)',
                  borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <RefreshCw size={14} /> Riprova analisi
              </button>
            </div>
          ) : activeItem.status === 'saved' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#10b981' }}>
              <CheckCircle2 size={48} style={{ marginBottom: 16 }} />
              <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600 }}>Spesa Salvata con Successo!</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>I dati di questa fattura sono stati registrati nella contabilità del condominio.</p>
            </div>
          ) : (
            <div>
              {/* Selezione e abbinamento Condominio / Esercizio */}
              <div style={{
                background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 12,
                padding: 16, marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16
              }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
                    Condominio Destinatario
                  </label>
                  <select
                    value={activeItem.condominioId || ''}
                    onChange={(e) => handleCondominioChange(activeItem.id, e.target.value)}
                    style={{
                      width: '100%', background: 'var(--card-bg)', color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 10px',
                      fontSize: 13, fontFamily: 'Sora, sans-serif'
                    }}
                  >
                    <option value="">-- Seleziona condominio --</option>
                    {condomini.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                  {!activeItem.condominioId && (
                    <div style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={10} /> Seleziona un condominio per procedere
                    </div>
                  )}
                  {activeItem.condominioId && !activeItem.extractedData?.condominio_destinatario_nome && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 4 }}>
                      Condominio non rilevato in fattura, abbinamento manuale.
                    </div>
                  )}
                  {activeItem.condominioId && activeItem.extractedData?.condominio_destinatario_nome && (
                    <div style={{ color: '#10b981', fontSize: 10, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={10} /> Rilevato in fattura: "{activeItem.extractedData.condominio_destinatario_nome}"
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
                    Esercizio Contabile
                  </label>
                  <select
                    value={activeItem.esercizioId || ''}
                    onChange={(e) => handleEsercizioChange(activeItem.id, e.target.value)}
                    disabled={!activeItem.condominioId || activeItem.esercizi.length === 0}
                    style={{
                      width: '100%', background: 'var(--card-bg)', color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 10px',
                      fontSize: 13, fontFamily: 'Sora, sans-serif',
                      opacity: !activeItem.condominioId || activeItem.esercizi.length === 0 ? 0.6 : 1
                    }}
                  >
                    {!activeItem.condominioId ? (
                      <option value="">Scegli prima il condominio</option>
                    ) : activeItem.esercizi.length === 0 ? (
                      <option value="">Nessun esercizio presente</option>
                    ) : (
                      activeItem.esercizi.map(es => (
                        <option key={es.id} value={es.id}>
                          {es.anno} {es.tipo === 'straordinario' ? 'straordinaria' : 'ordinaria'} ({es.stato})
                        </option>
                      ))
                    )}
                  </select>
                  {activeItem.condominioId && activeItem.esercizi.length === 0 && (
                    <div style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={10} /> Configura almeno un esercizio in contabilità per questo condominio.
                    </div>
                  )}
                </div>
              </div>

              {/* Form dettagli spesa */}
              {activeItem.condominioId && activeItem.esercizioId ? (
                <SpeseForm
                  key={`${activeItem.id}_${activeItem.condominioId}_${activeItem.esercizioId}`}
                  esercizioId={activeItem.esercizioId}
                  condominioId={activeItem.condominioId}
                  tabelle={activeItem.tabelle}
                  unita={activeItem.unita}
                  documenti={activeItem.documenti}
                  fromFattura={true}
                  prefillData={null}
                  initialFile={activeItem.file}
                  initialAiDatiEstratti={activeItem.extractedData}
                  onSave={(payload, ripartizioni, file, ai) => handleSaveSpesaGlobale(activeItem.id, payload, ripartizioni, file, ai)}
                  onCancel={() => setActiveQueueId(null)}
                />
              ) : (
                <div style={{ border: '2px dashed var(--border-color)', borderRadius: 12, padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Building2 size={36} style={{ margin: '0 auto 12px', color: 'var(--border-color)' }} />
                  <p style={{ margin: 0, fontSize: 13 }}>Abbina la fattura a un condominio ed esercizio validi per caricare il modulo di ripartizione.</p>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  )
}
