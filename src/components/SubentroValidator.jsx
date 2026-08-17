// src/components/SubentroValidator.jsx
import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePersone } from '../hooks/usePersone'
import { useComunicazioni } from '../hooks/useComunicazioni'
import { exportModuloAutocertificazionePdf } from '../lib/exportPdf'
import { toast } from 'react-hot-toast'
import { 
  CheckCircle2, AlertTriangle, ArrowRight, User, Mail, 
  Phone, Home, Calendar, Shield, Save, Download, FileText
} from 'lucide-react'

export default function SubentroValidator({ item, condomini, onComplete, onCancel }) {
  const { assegnaPersona } = usePersone()
  const { inviaComunicazione } = useComunicazioni()
  
  // Dati estratti dall'AI (fallback su campi vuoti)
  const datiAI = item?.extractedData?.nuovo_condomino || {}
  const uscenteAI = item?.extractedData?.condomino_uscente || {}
  const unitaAI = item?.extractedData?.unita || {}
  const dataDecorrenzaAI = item?.extractedData?.data_decorrenza || ''

  // Stato Fase A: Anagrafica ed associazione
  const [nome, setNome] = useState(datiAI.nome || '')
  const [cognome, setCognome] = useState(datiAI.cognome || '')
  const [cf, setCf] = useState(datiAI.codice_fiscale || '')
  const [email, setEmail] = useState(datiAI.email || '')
  const [telefono, setTelefono] = useState(datiAI.telefono || '')
  const [residenza, setResidenza] = useState(datiAI.indirizzo_residenza || '')
  const [ruolo, setRuolo] = useState(datiAI.ruolo || 'proprietario')
  
  const [scala, setScala] = useState(unitaAI.scala || '')
  const [piano, setPiano] = useState(unitaAI.piano || '')
  const [interno, setInterno] = useState(unitaAI.interno || '')
  const [dataSubentro, setDataSubentro] = useState(dataDecorrenzaAI || new Date().toISOString().split('T')[0])

  // Stato UI ed abbinamenti
  const [selectedUnitaId, setSelectedUnitaId] = useState('')
  const [personaUscenteId, setPersonaUscenteId] = useState('')
  const [personaEntranteId, setPersonaEntranteId] = useState('')
  const [condominioId, setCondominioId] = useState(item?.condominioId || '')
  const [loading, setLoading] = useState(false)
  const [fase, setFase] = useState(item?.stato === 'elaborato' ? 'B' : 'A') // 'A' = Anagrafica/Associazione, 'B' = Contabilità
  
  // Dati caricati per il condominio selezionato
  const [unitaList, setUnitaList] = useState([])
  const [occupantiAttivi, setOccupantiAttivi] = useState([])

  // Stato Fase B: Riconciliazione Finanziaria
  const [accolloSpese, setAccolloSpese] = useState('attendi') // 'attendi', 'manuale'
  const [saldoManuale, setSaldoManuale] = useState('0.00')
  const [destinatarioSaldo, setDestinatarioSaldo] = useState('entrante') // 'entrante', 'uscente' (separato)
  const [dovutoVecchio, setDovutoVecchio] = useState(0)
  const [pagatoVecchio, setPagatoVecchio] = useState(0)
  const [conguaglioVecchio, setConguaglioVecchio] = useState(0)
  const [isEsercizioAperto, setIsEsercizioAperto] = useState(true)

  // 1. Rilevamento unità condominio al cambio condominioId
  useEffect(() => {
    if (!condominioId) return
    const fetchUnita = async () => {
      const { data, error } = await supabase
        .from('unita')
        .select(`
          id, numero, scala, piano, tipo,
          catasto_foglio, catasto_particella, catasto_subalterno, catasto_categoria, catasto_rendita, mq,
          occupanti_unita (
            id, ruolo, attivo,
            persona: persone (id, nome, cognome, codice_fiscale, email, telefono, indirizzo, citta)
          )
        `)
        .eq('condominio_id', condominioId)

      if (!error && data) {
        setUnitaList(data)
        
        // Cerca di fare il matching automatico dell'unità basandoci su interno/scala dell'AI
        if (interno) {
          const match = data.find(u => 
            String(u.numero).toLowerCase() === String(interno).toLowerCase() &&
            (!scala || String(u.scala).toLowerCase() === String(scala).toLowerCase())
          )
          if (match) {
            setSelectedUnitaId(match.id)
          }
        }
      }
    }
    fetchUnita()
  }, [condominioId, interno, scala])

  // Aggiorna la lista degli occupanti dell'unità selezionata
  useEffect(() => {
    if (!selectedUnitaId || unitaList.length === 0) {
      setOccupantiAttivi([])
      return
    }
    const unit = unitaList.find(u => u.id === selectedUnitaId)
    if (unit && unit.occupanti_unita) {
      if (item?.stato === 'elaborato') {
        // Fase B (già elaborato Fase A)
        const entrante = unit.occupanti_unita.find(o => o.attivo && o.ruolo === ruolo)
        if (entrante) {
          setPersonaEntranteId(entrante.persona.id)
        }
        const uscente = unit.occupanti_unita.find(o => !o.attivo && o.ruolo === ruolo)
        if (uscente) {
          setPersonaUscenteId(uscente.persona.id)
        }
      } else {
        // Fase A
        const attivi = unit.occupanti_unita.filter(o => o.attivo && o.ruolo === ruolo)
        setOccupantiAttivi(attivi)
        if (attivi.length > 0) {
          setPersonaUscenteId(attivi[0].persona.id)
        }
      }
    }
  }, [selectedUnitaId, unitaList, ruolo, item])

  // Calcola i saldi della Fase B
  const calcolaSituazioneContabile = async () => {
    if (!selectedUnitaId) return
    setLoading(true)
    try {
      // 1. Recupera l'esercizio attivo per il condominio
      const { data: esercizi, error: esErr } = await supabase
        .from('esercizi')
        .select('id')
        .eq('condominio_id', condominioId)
        .eq('stato', 'aperto')
        .limit(1)

      if (esErr || !esercizi || esercizi.length === 0) {
        setIsEsercizioAperto(false)
        setLoading(false)
        return
      }
      setIsEsercizioAperto(true)
      const esercizioId = esercizi[0].id

      // 2. Recupera le rate scadute fino alla data del subentro
      const { data: rateUnita, error: rateErr } = await supabase
        .from('rate_unita')
        .select(`
          dovuto, pagato,
          rate!inner(data_scadenza)
        `)
        .eq('unita_id', selectedUnitaId)
        .eq('rate.esercizio_id', esercizioId)
        .lte('rate.data_scadenza', dataSubentro)

      if (rateErr) throw rateErr

      const totDovuto = (rateUnita || []).reduce((acc, r) => acc + Number(r.dovuto || 0), 0)
      const totPagato = (rateUnita || []).reduce((acc, r) => acc + Number(r.pagato || 0), 0)
      
      setDovutoVecchio(totDovuto)
      setPagatoVecchio(totPagato)
      setConguaglioVecchio(totDovuto - totPagato)
    } catch (err) {
      console.error('[SubentroValidator] Errore calcolo saldi:', err)
      toast.error('Errore durante il recupero dei saldi contabili.')
    } finally {
      setLoading(false)
    }
  }

  // Esegui calcolo saldi quando si passa alla Fase B o quando cambia l'unità/data
  useEffect(() => {
    if (fase === 'B' && selectedUnitaId) {
      calcolaSituazioneContabile()
    }
  }, [fase, selectedUnitaId, dataSubentro])

  // FASE A: Salvataggio dell'anagrafica del nuovo condomino ed associazione
  const handleSalvaAnagrafica = async (e) => {
    e.preventDefault()
    if (!selectedUnitaId) {
      toast.error("Seleziona l'unità immobiliare interessata.")
      return
    }
    
    setLoading(true)
    try {
      // 1. Crea o aggiorna la persona nel database
      let personaId = null
      
      // Controlla se esiste già una persona con lo stesso CF o email
      const { data: esistente } = await supabase
        .from('persone')
        .select('id')
        .or(`codice_fiscale.eq.${cf.trim().toUpperCase()},email.eq.${email.trim().toLowerCase()}`)
        .maybeSingle()

      if (esistente) {
        personaId = esistente.id
        // Aggiorna l'anagrafica esistente con eventuali nuovi dati
        await supabase
          .from('persone')
          .update({
            nome: nome.trim(),
            cognome: cognome.trim(),
            telefono: telefono.trim() || null,
            email: email.trim().toLowerCase() || null,
            indirizzo: residenza.trim() || null
          })
          .eq('id', personaId)
      } else {
        // Crea nuova persona
        const { data: nuovaPersona, error: createErr } = await supabase
          .from('persone')
          .insert({
            nome: nome.trim(),
            cognome: cognome.trim(),
            codice_fiscale: cf.trim().toUpperCase() || null,
            email: email.trim().toLowerCase() || null,
            telefono: telefono.trim() || null,
            indirizzo: residenza.trim() || null
          })
          .select('id')
          .single()

        if (createErr) throw createErr
        personaId = nuovaPersona.id
      }
      setPersonaEntranteId(personaId)

      // 2. Associa il nuovo occupante all'unità e disattiva il precedente (Fase A)
      await assegnaPersona(selectedUnitaId, personaId, ruolo, dataSubentro)

      // 3. Invio email di Benvenuto con richiesta accordi
      if (email.trim()) {
        const condominio = condomini.find(c => c.id === condominioId)
        const unit = unitaList.find(u => u.id === selectedUnitaId)
        const unitaDescr = unit ? `Scala ${unit.scala || '—'} · Piano ${unit.piano ?? '—'} · Int. ${unit.numero}` : ''

        const messaggio = `Gentile ${nome} ${cognome},

con la presente le diamo il benvenuto nel condominio "${condominio?.nome || 'Condominio'}".

Abbiamo provveduto ad aggiornare i registri condominiali inserendo il suo nominativo come nuovo ${ruolo} per l'unità immobiliare di riferimento (${unitaDescr}) a decorrere dal ${new Date(dataSubentro).toLocaleDateString('it-IT')}.

Al fine di allineare la situazione contabile con l'amministrazione, le chiediamo cortesemente di:
1. Confermarci l'esistenza di eventuali accordi scritti o pattuizioni private siglate con il precedente condomino in merito alla ripartizione delle spese condominiali in corso o di quelle straordinarie deliberate precedentemente.
2. Inviarci copia del rogito (estratti) o dell'autocertificazione catastale allegata qualora necessiti di modifiche.

Può rispondere direttamente a questa e-mail o allegare i documenti compilati.

Restiamo a disposizione per qualsiasi chiarimento.

Cordiali saluti,
Lo Studio Amministrativo`

        const allegatoPdfBase64 = exportModuloAutocertificazionePdf({
          condominio,
          unita: unit || { scala, piano, numero: interno },
          occupante: { ruolo, persona: { nome, cognome, codice_fiscale: cf, email, telefono, indirizzo: residenza } },
          profilo: item?.profilo || {}
        }, true) // returnBase64 = true

        await inviaComunicazione({
          condominioId,
          destinatari: [{ email: email.trim(), nome: `${nome} ${cognome}`.trim() }],
          oggetto: `Benvenuto in Condominio & Richiesta Dati - ${condominio?.nome || 'CondoFAST'}`,
          messaggio,
          tipo: 'avviso',
          skipFetch: true,
          allegati: [{
            filename: `Modulo_Anagrafe_${condominio?.nome?.replace(/\s+/g, '_') || 'Condominio'}.pdf`,
            content: allegatoPdfBase64
          }]
        })

        toast.success("Subentro registrato e Lettera di Benvenuto inviata con successo!")
      } else {
        toast.success("Subentro registrato con successo (email non specificata, invio saltato).")
      }

      // 4. Aggiorna lo stato della mail in Postbox a 'elaborato' ed elimina il corpo per GDPR
      await supabase
        .from('inbox_documenti')
        .update({ 
          stato: 'elaborato', 
          condominio_id: condominioId,
          email_corpo: 'Rimosso per conformità GDPR (Minimizzazione dei Dati)'
        })
        .eq('id', item.id)

      // Passa alla Fase B
      setFase('B')
    } catch (err) {
      console.error('[SubentroValidator] Errore salvataggio:', err)
      toast.error('Errore durante il salvataggio dei dati.')
    } finally {
      setLoading(false)
    }
  }

  // FASE B: Chiusura finanziaria e conguagli
  const handleCompletaContabilita = async () => {
    setLoading(true)
    try {
      let importoConguaglio = 0
      let statoContabile = 'in_attesa'

      if (accolloSpese === 'manuale') {
        importoConguaglio = parseFloat(saldoManuale) || 0
        statoContabile = 'bypassato'
      } else {
        importoConguaglio = conguaglioVecchio
        statoContabile = 'completato'
      }

      // 1. Registra record di contabilizzazione
      await supabase
        .from('subentri_contabilizzazione')
        .insert({
          inbox_documento_id: item.id,
          unita_id: selectedUnitaId,
          persona_uscente_id: personaUscenteId || null,
          persona_entrante_id: personaEntranteId,
          data_subentro: dataSubentro,
          stato_contabile: statoContabile,
          saldo_conguaglio: importoConguaglio,
          accollato_a_entrante: destinatarioSaldo === 'entrante'
        })

      // 2. Se l'importo è diverso da zero ed è accollato all'entrante, adegua la prima rata utile
      if (importoConguaglio !== 0 && destinatarioSaldo === 'entrante') {
        // Recupera l'esercizio attivo aperto per il condominio
        const { data: esercizi, error: esErr } = await supabase
          .from('esercizi')
          .select('id')
          .eq('condominio_id', condominioId)
          .eq('stato', 'aperto')
          .limit(1)

        if (esErr || !esercizi || esercizi.length === 0) {
          toast.error("Nessun esercizio aperto trovato per questo condominio. Impossibile conguagliare la rata.")
          setLoading(false)
          return
        }
        const esercizioId = esercizi[0].id

        // Carica la prima rata dell'unità ancora non interamente pagata o futura per l'esercizio aperto
        const { data: rateAperte, error: rErr } = await supabase
          .from('rate_unita')
          .select('id, dovuto, rate:rata_id(data_scadenza, esercizio_id)')
          .eq('unita_id', selectedUnitaId)
          .eq('rate.esercizio_id', esercizioId)

        if (!rErr && rateAperte && rateAperte.length > 0) {
          // Ordina deterministica mente le rate per data di scadenza
          const rateOrdinate = [...rateAperte].sort((a, b) => {
            const dateA = a.rate?.data_scadenza ? new Date(a.rate.data_scadenza).getTime() : 0
            const dateB = b.rate?.data_scadenza ? new Date(b.rate.data_scadenza).getTime() : 0
            return dateA - dateB
          })
          const primaRata = rateOrdinate[0]
          const nuovoDovuto = Math.max(0, Number(primaRata.dovuto || 0) + importoConguaglio)
          await supabase
            .from('rate_unita')
            .update({ dovuto: nuovoDovuto })
            .eq('id', primaRata.id)
        }
      }

      // 3. Aggiorna lo stato finale in Postbox a 'conguagliato'
      await supabase
        .from('inbox_documenti')
        .update({ stato: 'conguagliato' })
        .eq('id', item.id)

      toast.success("Situazione contabile del subentro salvata con successo!")
      onComplete()
    } catch (err) {
      console.error('[SubentroValidator] Errore chiusura finanziaria:', err)
      toast.error('Errore nel salvataggio dei conteggi finanziari.')
    } finally {
      setLoading(false)
    }
  }

  // Genera ed esporta il modulo precompilato cartaceo/firmabile per questa specifica richiesta
  const scaricaModuloPrecompilato = () => {
    const condominio = condomini.find(c => c.id === condominioId)
    const unit = unitaList.find(u => u.id === selectedUnitaId)
    
    exportModuloAutocertificazionePdf({
      condominio,
      unita: unit || { scala, piano, numero: interno },
      occupante: { ruolo, persona: { nome, cognome, codice_fiscale: cf, email, telefono, indirizzo: residenza } },
      profilo: item?.profilo || {}
    })
    toast.success('Modulo PDF scaricato con successo!')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0 24px 24px', overflowY: 'auto' }}>
      
      {/* Testata Step di convalida */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 20 }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: 0 }}>
            {fase === 'A' ? 'Step 1: Convalida Anagrafica & Benvenuto' : 'Step 2: Conguaglio Finanziario Subentro'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '4px 0 0' }}>
            {fase === 'A' 
              ? 'Verifica le informazioni del nuovo condomino estratte dall\'AI ed invia la lettera di benvenuto.' 
              : 'Definisci la situazione contabile pro-rata tra il condomino uscente e il nuovo entrante.'
            }
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: fase === 'A' ? '#2563eb' : 'var(--card-bg)', color: fase === 'A' ? '#fff' : 'var(--text-secondary)' }}>Fase A</span>
          <ArrowRight size={14} style={{ color: 'var(--text-muted)', alignSelf: 'center' }} />
          <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: fase === 'B' ? '#2563eb' : 'var(--card-bg)', color: fase === 'B' ? '#fff' : 'var(--text-secondary)' }}>Fase B</span>
        </div>
      </div>

      {fase === 'A' ? (
        <form onSubmit={handleSalvaAnagrafica} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {(!item?.profilo?.mail_invio_tipo || item?.profilo?.mail_invio_tipo === 'sistema') && (
            <div style={{ display: 'flex', gap: 10, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '12px 16px', borderRadius: 8, color: '#d97706', fontSize: 13 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ display: 'block', marginBottom: 4 }}>Invio tramite sistema (non aziendale)</strong>
                Non hai ancora configurato un server email professionale per lo studio. L'email di benvenuto verrà spedita tramite il sistema (onboarding@resend.dev). Configura l'invio SMTP nelle Impostazioni per una comunicazione più professionale verso i condòmini.
              </div>
            </div>
          )}
          
          {/* Condominio ed Unità di Riferimento */}
          <div style={{ padding: 16, background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Home size={14} /> Unità Immobiliare & Condominio
            </div>
            
            <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Condominio Destinatario</label>
                <select 
                  value={condominioId} 
                  onChange={e => setCondominioId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14 }}
                >
                  <option value="">Seleziona Condominio...</option>
                  {condomini.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Seleziona Unità (Verificata)</label>
                  <select 
                    value={selectedUnitaId} 
                    onChange={e => setSelectedUnitaId(e.target.value)}
                    required
                    disabled={!condominioId}
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14 }}
                  >
                    <option value="">Seleziona Unità...</option>
                    {unitaList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.numero} {u.scala ? `(Sc. ${u.scala})` : ''} {u.piano != null ? `- P.${u.piano}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Data Subentro / Cessione</label>
                  <input 
                    type="date"
                    value={dataSubentro}
                    onChange={e => setDataSubentro(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dati del Nuovo Entrante */}
          <div style={{ padding: 16, background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={14} /> Anagrafica Nuovo Condòmino (AI)
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Cognome</label>
                  <input style={{ padding: '10px 12px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14 }} type="text" required value={cognome} onChange={e => setCognome(e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Nome</label>
                  <input style={{ padding: '10px 12px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14 }} type="text" required value={nome} onChange={e => setNome(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Codice Fiscale</label>
                  <input style={{ padding: '10px 12px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, textTransform: 'uppercase' }} type="text" required value={cf} onChange={e => setCf(e.target.value)} maxLength={16} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ruolo</label>
                  <select 
                    value={ruolo} 
                    onChange={e => setRuolo(e.target.value)}
                    style={{ padding: '10px 12px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14 }}
                  >
                    <option value="proprietario">Proprietario</option>
                    <option value="inquilino">Inquilino (Conduttore)</option>
                    <option value="usufruttuario">Usufruttuario</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Email</label>
                  <input style={{ padding: '10px 12px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14 }} type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Telefono</label>
                  <input style={{ padding: '10px 12px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14 }} type="text" value={telefono} onChange={e => setTelefono(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Indirizzo di Residenza</label>
                <input style={{ padding: '10px 12px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14 }} type="text" value={residenza} onChange={e => setResidenza(e.target.value)} placeholder="Via, Città, CAP" />
              </div>
            </div>
          </div>

          {/* Azioni di salvataggio */}
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            <button 
              type="button" 
              onClick={onCancel}
              style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              Annulla
            </button>
            <button 
              type="button" 
              onClick={scaricaModuloPrecompilato}
              style={{ padding: 12, background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}
            >
              <Download size={14} /> Modulo PDF
            </button>
            <button 
              type="submit" 
              disabled={loading}
              style={{ flex: 2, padding: 12, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600 }}
            >
              <Save size={16} /> {loading ? 'Invio in corso...' : 'Conferma Anagrafica & Invia Benvenuto'}
            </button>
          </div>

        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Alert Esercizio Chiuso/Assente */}
          {!isEsercizioAperto && (
            <div style={{ display: 'flex', gap: 10, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '14px 18px', borderRadius: 12, color: '#f87171', fontSize: 13.5, marginBottom: 12 }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong style={{ display: 'block', marginBottom: 4 }}>Nessun Esercizio Contabile Aperto</strong>
                Non è presente alcun esercizio contabile aperto per questo condominio. È necessario aprire un esercizio per calcolare il pro-rata o addebitare conguagli finanziari sulle rate.
              </div>
            </div>
          )}

          {/* Riepilogo Saldo Calcolato (Fase B) */}
          <div style={{ padding: 20, background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={14} /> Saldo Contabile Unità al {new Date(dataSubentro).toLocaleDateString('it-IT')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, margin: '10px 0' }}>
              <div style={{ padding: 12, background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Dovuto Vecchio Condomino</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>€ {dovutoVecchio.toFixed(2)}</div>
              </div>
              <div style={{ padding: 12, background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Pagato (Riconciliato)</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>€ {pagatoVecchio.toFixed(2)}</div>
              </div>
              <div style={{ padding: 12, background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Conguaglio (Debito/Arretrato)</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: conguaglioVecchio > 0 ? '#ef4444' : '#10b981' }}>
                  € {conguaglioVecchio.toFixed(2)}
                </div>
              </div>
            </div>

            {conguaglioVecchio !== 0 && (
              <div style={{ display: 'flex', gap: 8, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  Risulta un {conguaglioVecchio > 0 ? 'debito insoluto' : 'credito eccedente'} di <strong>€ {Math.abs(conguaglioVecchio).toFixed(2)}</strong> del precedente condomino per le rate scadute fino al giorno del subentro.
                </span>
              </div>
            )}
          </div>

          {/* Opzioni di accollo e storno */}
          <div style={{ padding: 16, background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} /> Modalità di Gestione del Conguaglio
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ flex: 1, display: 'flex', gap: 8, padding: 14, border: '1px solid var(--border-color)', background: accolloSpese === 'attendi' ? 'rgba(37, 99, 235, 0.08)' : 'var(--app-bg)', borderColor: accolloSpese === 'attendi' ? '#2563eb' : 'var(--border-color)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                  <input type="radio" name="accollo" value="attendi" checked={accolloSpese === 'attendi'} onChange={() => setAccolloSpese('attendi')} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Calcolo Automatico Pro-Rata</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Usa il saldo calcolato in base alle rate scadute e pagamenti riconciliati.</div>
                  </div>
                </label>

                <label style={{ flex: 1, display: 'flex', gap: 8, padding: 14, border: '1px solid var(--border-color)', background: accolloSpese === 'manuale' ? 'rgba(37, 99, 235, 0.08)' : 'var(--app-bg)', borderColor: accolloSpese === 'manuale' ? '#2563eb' : 'var(--border-color)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                  <input type="radio" name="accollo" value="manuale" checked={accolloSpese === 'manuale'} onChange={() => setAccolloSpese('manuale')} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Bypass / Inserimento Manuale</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Inserisci tu la quota di saldo definita privatamente tra le parti.</div>
                  </div>
                </label>
              </div>

              {accolloSpese === 'manuale' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 12, background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Importo del Saldo da Trasferire (€)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={saldoManuale} 
                    onChange={e => setSaldoManuale(e.target.value)}
                    style={{ padding: '8px 12px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', width: 150 }} 
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Destinatario del Conguaglio (Spese/Crediti)</span>
                <div style={{ display: 'flex', gap: 20 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                    <input type="radio" name="dest_saldo" value="entrante" checked={destinatarioSaldo === 'entrante'} onChange={() => setDestinatarioSaldo('entrante')} />
                    Addebita/Accredita al Nuovo Entrante (Solidarietà)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                    <input type="radio" name="dest_saldo" value="uscente" checked={destinatarioSaldo === 'uscente'} onChange={() => setDestinatarioSaldo('uscente')} />
                    Conserva in capo all'Uscente (Gestione separata)
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Azioni di Chiusura */}
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            <button 
              type="button" 
              onClick={() => setFase('A')}
              style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              Indietro
            </button>
            <button 
              type="button" 
              onClick={handleCompletaContabilita}
              disabled={loading || !isEsercizioAperto}
              style={{ 
                flex: 2, 
                padding: 12, 
                background: !isEsercizioAperto ? 'var(--border-color)' : '#10b981', 
                color: !isEsercizioAperto ? 'var(--text-muted)' : '#fff', 
                border: 'none', 
                borderRadius: 8, 
                cursor: !isEsercizioAperto ? 'not-allowed' : 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 8, 
                fontWeight: 600 
              }}
            >
              <CheckCircle2 size={16} /> {loading ? 'Elaborazione...' : 'Completa Ripartizione Contabile & Chiudi'}
            </button>
          </div>

        </div>
      )}
      
    </div>
  )
}
