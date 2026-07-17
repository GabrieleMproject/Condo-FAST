// src/pages/PostboxPage.jsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../hooks/usePlan'
import SpeseForm from '../components/SpeseForm'
import SubentroValidator from '../components/SubentroValidator'
import { toast } from 'react-hot-toast'
import PlanGate from '../components/PlanGate'
import {
  UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2,
  Building2, ArrowRight, Clock, RefreshCw, X, Receipt, Eye,
  Inbox, User, Mail, MessageSquare, Trash2, Check, ExternalLink
} from 'lucide-react'

// Helper per formattare la dimensione del file
const formatSize = (bytes) => {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Helper per formattare la data
const formattaData = (d) => {
  if (!d) return ''
  return new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function PostboxPage() {
  const { user } = useAuth()
  const { profile } = usePlan()
  
  const [condomini, setCondomini] = useState([])
  const [loadingCondomini, setLoadingCondomini] = useState(true)
  
  // Coda di elaborazione persistente
  const [queue, setQueue] = useState([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  
  // Stati di tab attivi
  const [activeTab, setActiveTab] = useState('spese') // 'spese', 'subentri', 'messaggi'
  
  // Stati ID attivi per tab
  const [activeSpesaId, setActiveSpesaId] = useState(null)
  const [activeSubentroId, setActiveSubentroId] = useState(null)
  const [activeMessaggioId, setActiveMessaggioId] = useState(null)
  
  // Stati di processo
  const [saving, setSaving] = useState(false)
  const [activeFileUrl, setActiveFileUrl] = useState(null)
  const [loadingFileUrl, setLoadingFileUrl] = useState(false)
  const [showZoomModal, setShowZoomModal] = useState(false)

  // 1. Carica i condomini all'avvio
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

  // 2. Caricamento Coda da Database
  const fetchQueue = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('inbox_documenti')
        .select('*')
        .in('stato', ['nuovo', 'rilevato', 'da_smistare', 'elaborato'])
        .order('data_ricezione', { ascending: false })
      
      if (error) throw error

      const uniqueCondoIds = [...new Set((data || []).map(doc => doc.condominio_id).filter(Boolean))]
      const cacheMap = new Map()
      
      await Promise.all(uniqueCondoIds.map(async (cid) => {
        const d = await fetchCondominioDati(cid)
        cacheMap.set(cid, d)
      }))
      
      const mapped = (data || []).map((doc) => {
        const condoDati = doc.condominio_id
          ? cacheMap.get(doc.condominio_id) || { esercizi: [], unita: [], tabelle: [], documenti: [] }
          : { esercizi: [], unita: [], tabelle: [], documenti: [] }

        const aperto = condoDati.esercizi.find(e => e.stato === 'aperto') || condoDati.esercizi[0]
        const selectedEsercizioId = aperto?.id || null
        
        return {
          id: doc.id,
          file_path: doc.file_path,
          file_name: doc.file_name,
          email_mittente: doc.email_mittente,
          email_oggetto: doc.email_oggetto,
          email_corpo: doc.email_corpo,
          data_ricezione: doc.data_ricezione,
          tipo: doc.tipo || 'spesa',
          stato: doc.stato,
          extractedData: doc.dati_estratti,
          condominioId: doc.condominio_id,
          esercizioId: selectedEsercizioId,
          esercizi: condoDati.esercizi,
          unita: condoDati.unita,
          tabelle: condoDati.tabelle,
          documenti: condoDati.documenti,
          profilo: profile
        }
      })
      
      setQueue(mapped)
      
      // Imposta gli ID attivi per tab se non presenti
      const spese = mapped.filter(q => q.tipo === 'spesa' && q.stato !== 'inserito')
      if (spese.length > 0 && !activeSpesaId) setActiveSpesaId(spese[0].id)

      const subentri = mapped.filter(q => q.tipo === 'subentro' && q.stato !== 'conguagliato')
      if (subentri.length > 0 && !activeSubentroId) setActiveSubentroId(subentri[0].id)

      const messaggi = mapped.filter(q => q.tipo === 'messaggio' && q.stato !== 'elaborato')
      if (messaggi.length > 0 && !activeMessaggioId) setActiveMessaggioId(messaggi[0].id)

    } catch (err) {
      console.error('Errore recupero coda inbox:', err)
    } finally {
      setLoadingQueue(false)
    }
  }

  // 3. Inizializza Realtime Listener per la coda
  useEffect(() => {
    if (!user) return
    fetchQueue()
    
    const channel = supabase
      .channel('inbox_global_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inbox_documenti'
      }, () => {
        fetchQueue()
      })
      .subscribe()
      
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, profile])

  // Helper per caricare i dettagli del condominio
  const fetchCondominioDati = async (condoId) => {
    if (!condoId) return { tabelle: [], unita: [], documenti: [], esercizi: [] }
    try {
      const [resEsercizi, resUnita, resTabelle, resDocumenti] = await Promise.all([
        supabase.from('esercizi').select('*').eq('condominio_id', condoId).order('anno', { ascending: false }),
        supabase.from('unita').select('id, numero, scala, piano, tipo').eq('condominio_id', condoId),
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

  // 4. Carica Signed URL del PDF quando cambia l'elemento attivo
  const getActiveItem = () => {
    if (activeTab === 'spese') return queue.find(q => q.id === activeSpesaId)
    if (activeTab === 'subentri') return queue.find(q => q.id === activeSubentroId)
    return queue.find(q => q.id === activeMessaggioId)
  }
  
  const activeItem = getActiveItem()

  useEffect(() => {
    if (!activeItem || !activeItem.file_path) {
      setActiveFileUrl(null)
      return
    }

    const getSignedUrl = async () => {
      setLoadingFileUrl(true)
      try {
        const { data, error } = await supabase.storage
          .from('inbox-ricezione')
          .createSignedUrl(activeItem.file_path, 900)
        
        if (!error && data?.signedUrl) {
          setActiveFileUrl(data.signedUrl)
        }
      } catch (err) {
        console.error('Errore recupero Signed URL:', err)
      } finally {
        setLoadingFileUrl(false)
      }
    }
    getSignedUrl()
  }, [activeSpesaId, activeSubentroId, activeMessaggioId, activeTab, queue])

  // Cestina / Ignora
  const handleIgnoraDocumento = async (doc) => {
    if (!confirm('Sei sicuro di voler ignorare e cestinare questa comunicazione?')) return
    try {
      const { error: dbErr } = await supabase
        .from('inbox_documenti')
        .update({ stato: 'scartato' })
        .eq('id', doc.id)
      if (dbErr) throw dbErr

      if (doc.file_path) {
        await supabase.storage.from('inbox-ricezione').remove([doc.file_path])
      }

      toast.success('Comunicazione cestinata con successo.')
      fetchQueue()
    } catch (err) {
      console.error(err)
      toast.error('Errore durante la cancellazione.')
    }
  }

  // Segna come lavorato (per Messaggi)
  const handleLavoratoMessaggio = async (docId) => {
    try {
      const { error } = await supabase
        .from('inbox_documenti')
        .update({ stato: 'elaborato' })
        .eq('id', docId)
      if (error) throw error
      toast.success('Comunicazione contrassegnata come lavorata.')
      fetchQueue()
    } catch (err) {
      console.error(err)
      toast.error('Errore nell\'aggiornamento dello stato.')
    }
  }

  // Salvataggio Spesa
  const handleSaveSpesa = async (spesaPayload) => {
    setSaving(true)
    try {
      const { data: spesa, error: spesaErr } = await supabase
        .from('spese')
        .insert([{
          condominio_id: activeItem.condominioId,
          esercizio_id: activeItem.esercizioId,
          descrizione: spesaPayload.descrizione,
          importo: spesaPayload.importo,
          data_spesa: spesaPayload.data_spesa,
          fornitore_nome: spesaPayload.fornitore_nome || null,
          categoria: spesaPayload.categoria || 'altro',
          criterio: spesaPayload.criterio || 'millesimi'
        }])
        .select()
        .single()

      if (spesaErr) throw spesaErr

      // Salva le ripartizioni
      if (spesaPayload.ripartizioni && spesaPayload.ripartizioni.length > 0) {
        const rips = spesaPayload.ripartizioni.map(r => ({
          spesa_id: spesa.id,
          unita_id: r.unita_id,
          importo: r.importo,
          millesimi_usati: r.millesimi_usati || 0,
          override_manuale: r.override_manuale || false,
          importo_override: r.importo_override || null
        }))
        const { error: ripErr } = await supabase.from('ripartizioni').insert(rips)
        if (ripErr) throw ripErr
      }

      // Sposta il file in documenti condominio definitivi
      if (activeItem.file_path) {
        const cleanName = activeItem.file_name.replace(/\s+/g, '_')
        const newPath = `${activeItem.condominioId}/${Date.now()}_${cleanName}`
        
        const { error: copyErr } = await supabase.storage
          .from('documenti-condominio')
          .copy(activeItem.file_path, newPath)
        
        if (!copyErr) {
          await supabase.from('documenti_condominio').insert([{
            condominio_id: activeItem.condominioId,
            nome: activeItem.file_name,
            tipo: 'fattura',
            pdf_url: newPath,
            data_documento: spesaPayload.data_spesa
          }])
          await supabase.storage.from('inbox-ricezione').remove([activeItem.file_path])
        }
      }

      // Aggiorna lo stato in Postbox
      await supabase
        .from('inbox_documenti')
        .update({ stato: 'inserito', spesa_id: spesa.id })
        .eq('id', activeItem.id)

      toast.success('Spesa inserita e ripartita correttamente!')
      fetchQueue()
    } catch (err) {
      console.error(err)
      toast.error("Errore durante l'inserimento della spesa.")
    } finally {
      setSaving(false)
    }
  }

  // Filtra la coda in base al tab attivo
  const queueSpese = queue.filter(q => q.tipo === 'spesa' && q.stato !== 'inserito')
  const queueSubentri = queue.filter(q => q.tipo === 'subentro' && q.stato !== 'conguagliato')
  const queueMessaggi = queue.filter(q => q.tipo === 'messaggio' && q.stato !== 'elaborato')

  const getActiveQueue = () => {
    if (activeTab === 'spese') return queueSpese
    if (activeTab === 'subentri') return queueSubentri
    return queueMessaggi
  }

  const activeQueueList = getActiveQueue()

  return (
    <PlanGate feature="postbox_studio">
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: 'var(--app-bg)' }}>
      
      {/* Tab in testa */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--card-bg)', padding: '0 24px' }}>
        <button 
          onClick={() => setActiveTab('spese')}
          style={{ 
            padding: '16px 20px', background: 'transparent', border: 'none',
            borderBottom: activeTab === 'spese' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'spese' ? '#2563eb' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
          }}
        >
          <Receipt size={16} /> Spese & Fatture
          {queueSpese.length > 0 && (
            <span style={{ fontSize: 11, background: '#ef4444', color: '#fff', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
              {queueSpese.length}
            </span>
          )}
        </button>

        <button 
          onClick={() => setActiveTab('subentri')}
          style={{ 
            padding: '16px 20px', background: 'transparent', border: 'none',
            borderBottom: activeTab === 'subentri' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'subentri' ? '#2563eb' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
          }}
        >
          <User size={16} /> Anagrafiche & Subentri
          {queueSubentri.length > 0 && (
            <span style={{ fontSize: 11, background: '#2563eb', color: '#fff', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
              {queueSubentri.length}
            </span>
          )}
        </button>

        <button 
          onClick={() => setActiveTab('messaggi')}
          style={{ 
            padding: '16px 20px', background: 'transparent', border: 'none',
            borderBottom: activeTab === 'messaggi' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'messaggi' ? '#2563eb' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
          }}
        >
          <MessageSquare size={16} /> Messaggi & Segnalazioni
          {queueMessaggi.length > 0 && (
            <span style={{ fontSize: 11, background: '#10b981', color: '#fff', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
              {queueMessaggi.length}
            </span>
          )}
        </button>
      </div>

      {/* Corpo principale diviso (Lista a sinistra, Convalida a destra) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Lista Documenti (Sinistra) */}
        <div style={{ width: 340, borderRight: '1px solid var(--border-color)', background: 'var(--card-bg)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {loadingQueue ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 20, alignItems: 'center', color: 'var(--text-muted)' }}>
              <Loader2 className="animate-spin" size={24} />
              <span style={{ fontSize: 13 }}>Caricamento Postbox...</span>
            </div>
          ) : activeQueueList.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 20, color: 'var(--text-muted)', gap: 8 }}>
              <Inbox size={32} style={{ opacity: 0.5 }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Coda Postbox vuota</span>
              <span style={{ fontSize: 11, textAlign: 'center' }}>Tutte le email sono state elaborate correttamente.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {activeQueueList.map((doc) => {
                const isSelected = (activeTab === 'spese' && doc.id === activeSpesaId) || 
                                   (activeTab === 'subentri' && doc.id === activeSubentroId) || 
                                   (activeTab === 'messaggi' && doc.id === activeMessaggioId)
                
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      if (activeTab === 'spese') setActiveSpesaId(doc.id)
                      else if (activeTab === 'subentri') setActiveSubentroId(doc.id)
                      else setActiveMessaggioId(doc.id)
                    }}
                    style={{
                      padding: '16px 20px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer',
                      background: isSelected ? 'var(--border-color)' : 'transparent',
                      transition: 'background 0.2s', borderLeft: isSelected ? '4px solid #2563eb' : '4px solid transparent'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} /> {formattaData(doc.data_ricezione)}
                      </span>
                      {doc.stato === 'elaborato' && doc.tipo === 'subentro' && (
                        <span style={{ fontSize: 10, background: '#eab308', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Fase B</span>
                      )}
                    </div>
                    
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
                      {doc.email_oggetto || doc.file_name || 'Comunicazione senza oggetto'}
                    </div>
                    
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Da: {doc.email_mittente || 'Mittente sconosciuto'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Dettaglio/Convalida (Destra) */}
        <div style={{ flex: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!activeItem ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', gap: 8 }}>
              <Inbox size={40} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: 14 }}>Seleziona un elemento dalla lista per visualizzarlo</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              
              {/* Sezione Convalida */}
              <div style={{ flex: 1, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                
                {/* Banner Mittente / Informazioni Mail */}
                <div style={{ padding: '16px 24px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>EMAIL RICEVUTA</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>
                      <strong>Oggetto:</strong> {activeItem.email_oggetto || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                      <strong>Da:</strong> {activeItem.email_mittente || '—'}
                    </div>
                    {activeItem.file_path && (
                      <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <FileText size={12} /> Allegato: <span style={{ fontWeight: 600 }}>{activeItem.file_name}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {activeItem.file_path && (
                      <button 
                        onClick={() => setShowZoomModal(true)}
                        style={{ 
                          padding: '8px 14px', background: '#2563eb', border: 'none', color: '#fff', 
                          borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, 
                          fontSize: 12, fontWeight: 600, boxShadow: '0 2px 4px rgba(37,99,235,0.2)' 
                        }}
                      >
                        <Eye size={14} /> Visualizza Documento
                      </button>
                    )}
                    <button 
                      onClick={() => handleIgnoraDocumento(activeItem)}
                      style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--border-color)', color: '#ef4444', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}
                    >
                      <Trash2 size={14} /> Cestina
                    </button>
                  </div>
                </div>

                {/* Switch form in base alla tipologia */}
                {activeTab === 'spese' && (
                  <div style={{ padding: '24px 0' }}>
                    <SpeseForm
                      initialData={activeItem.extractedData}
                      condomini={condomini}
                      esercizi={activeItem.esercizi}
                      unita={activeItem.unita}
                      tabelle={activeItem.tabelle}
                      documenti={activeItem.documenti}
                      condominioId={activeItem.condominioId}
                      esercizioId={activeItem.esercizioId}
                      loading={saving}
                      onSubmit={handleSaveSpesa}
                    />
                  </div>
                )}

                {activeTab === 'subentri' && (
                  <div style={{ padding: '24px 0', flex: 1 }}>
                    <SubentroValidator
                      item={activeItem}
                      condomini={condomini}
                      onComplete={fetchQueue}
                      onCancel={() => handleIgnoraDocumento(activeItem)}
                    />
                  </div>
                )}

                {activeTab === 'messaggi' && (
                  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ padding: 20, background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12 }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                        Testo del messaggio
                      </div>
                      <div 
                        style={{ 
                          fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', 
                          fontFamily: 'inherit', lineHeight: 1.5, maxHeight: '40vh', overflowY: 'auto', 
                          padding: 12, background: 'var(--app-bg)', borderRadius: 8, border: '1px solid var(--border-color)' 
                        }}
                      >
                        {activeItem.email_corpo || 'Nessun testo nel corpo del messaggio.'}
                      </div>
                    </div>

                    {activeItem.extractedData?.sintesi_richiesta && (
                      <div style={{ padding: 16, background: 'rgba(37, 99, 235, 0.05)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', marginBottom: 4 }}>Analisi Intelligente AI</div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                          <strong>Sintesi:</strong> {activeItem.extractedData.sintesi_richiesta}
                        </div>
                        {activeItem.extractedData.categoria_messaggio && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            Categoria: <span style={{ textTransform: 'uppercase', fontWeight: 600, background: 'var(--border-color)', padding: '1px 6px', borderRadius: 4 }}>{activeItem.extractedData.categoria_messaggio.replace('_', ' ')}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                      <button 
                        onClick={() => handleLavoratoMessaggio(activeItem.id)}
                        style={{ flex: 1, padding: 12, background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600 }}
                      >
                        <Check size={16} /> Segna come Lavorato
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>

      </div>

      {/* Modale Zoom Anteprima Schermo Intero */}
      {showZoomModal && activeFileUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '90vw', height: '90vh', background: 'var(--app-bg)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>{activeItem?.file_name}</span>
              <button 
                onClick={() => setShowZoomModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ flex: 1, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {activeItem?.file_name?.toLowerCase().endsWith('.pdf') ? (
                <iframe src={activeFileUrl} style={{ width: '100%', height: '100%', border: 'none' }} />
              ) : (
                <img src={activeFileUrl} alt="Zoom" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
    </PlanGate>
  )
}
