import React, { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Landmark, Download, FileSpreadsheet, Building2, User, Calendar, CheckCircle2, AlertTriangle, FileText, Upload, ChevronRight, ExternalLink, Monitor, ShieldCheck, ShieldAlert, PlayCircle, Calculator, Send, MailCheck, Archive } from 'lucide-react'
import { exportBozzaCU, exportQuietanzaFornitore, generaPdfQuietanzaBase64 } from '../lib/exportFiscale'
import { exportDossierFiscaleRevisori } from '../lib/exportDossierFiscale'
import { generaCbiF24 } from '../lib/cbiGenerator'
import { generaTelematicoCU, generaTelematico770 } from '../lib/fiscaleTelematico'
import { validaDelegheCbi } from '../lib/cbiValidator'
import { calcolaCreditiCondominio } from '../lib/creditiFiscaleEngine'
import PlanGate from '../components/PlanGate'
import ScadenzarioWidget from '../components/ScadenzarioWidget'
import { eseguiDiagnosiConformitaFiscale } from '../lib/diagnosiFiscaleEngine'
import { verificaQuadraturaFiscaleRitenute } from '../lib/auditFiscaleEngine'
import DiagnosiFiscaleModal from '../components/DiagnosiFiscaleModal'
import RavvedimentoModal from '../components/RavvedimentoModal'
import CassettoCreditiWidget from '../components/CassettoCreditiWidget'
import { usePlan } from '../hooks/usePlan'
import { useWatermark } from '../hooks/useWatermark'
import { X, CheckSquare, AlertCircle, Info, Mail, Activity, Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

const formattaData = (dataStr) => {
  if (!dataStr) return '—';
  const d = new Date(dataStr);
  return isNaN(d.getTime()) ? dataStr : d.toLocaleDateString('it-IT');
};

export default function ModuloFiscalePage() {
  const location = useLocation()
  const { profile } = usePlan()
  const { checkWatermark, WatermarkModal } = useWatermark()
  const [condomini, setCondomini] = useState([])
  const [fornitori, setFornitori] = useState([])
  const [fatture, setFatture] = useState([])
  const [f24Deleghe, setF24Deleghe] = useState([])
  const [tributi, setTributi] = useState([])
  const [abbinamenti, setAbbinamenti] = useState([])
  const [loading, setLoading] = useState(true)

  // Intercetta arrivo di quietanza F24 dalla Dropzone Globale
  useEffect(() => {
    if (location.state?.quietanzaF24 || location.state?.file) {
      setTabAttivo('f24')
      toast.success("Documento F24 ricevuto: seleziona la delega 'Registra Pagamento' per confermare l'abbinamento.", { duration: 6000 })
    }
  }, [location.state])

  // Filtri e Tabs
  const [tabAttivo, setTabAttivo] = useState('cu_770') // cu_770 | f24 | quietanze
  const [annoSelezionato, setAnnoSelezionato] = useState(new Date().getFullYear().toString())
  const [condominioSelezionato, setCondominioSelezionato] = useState('')
  
  // Modale Ravvedimento Operoso & Invio Massivo CU
  const [modalRavvedimentoOpen, setModalRavvedimentoOpen] = useState(false)
  const [ravvedimentoDefaultData, setRavvedimentoDefaultData] = useState({})
  const [invioCuMassivoBusy, setInvioCuMassivoBusy] = useState(false)
  const [invioCuProgresso, setInvioCuProgresso] = useState('')

  // Selezione e Validazione Checkout per CBI massivo
  const [selezionatiCbi, setSelezionatiCbi] = useState({}) // f24Id -> boolean
  const [f24UploadingId, setF24UploadingId] = useState(null)
  const [wizardStepCU, setWizardStepCU] = useState(1)
  
  // Modal Checkout Fiscale CBI F24
  const [modalCbiOpen, setModalCbiOpen] = useState(false)
  const [cbiValidazione, setCbiValidazione] = useState(null)
  const [cbiDisclaimerAccettato, setCbiDisclaimerAccettato] = useState(false)
  const [delegheDaEsportare, setDelegheDaEsportare] = useState([])

  // Modal Diagnosi Conformità Fiscale & Invio Email Quietanza
  const [modalDiagnosiOpen, setModalDiagnosiOpen] = useState(false)
  const [diagnosiResult, setDiagnosiResult] = useState(null)
  const [diagnosiBusy, setDiagnosiBusy] = useState(false)
  const [invioEmailBusyId, setInvioEmailBusyId] = useState(null)

  const handleAvviaDiagnosiFiscale = async () => {
    setDiagnosiBusy(true)
    try {
      const condoTarget = condominioSelezionato ? condomini.find(c => c.id === condominioSelezionato) : condomini[0]
      if (!condoTarget) {
        toast.error("Seleziona prima un condominio su cui eseguire la diagnosi.")
        return
      }

      const [resUnita, resOccupanti] = await Promise.all([
        supabase.from('unita').select('*').eq('condominio_id', condoTarget.id),
        supabase.from('occupanti_unita').select('*, persona:persona_id(*)')
      ])

      const resDiagnosi = eseguiDiagnosiConformitaFiscale({
        condominio: condoTarget,
        fornitori,
        unita: resUnita.data || [],
        occupanti: resOccupanti.data || [],
        fatture,
        f24Deleghe
      })

      setDiagnosiResult(resDiagnosi)
      setModalDiagnosiOpen(true)
    } catch (e) {
      console.error("Errore diagnosi:", e)
      toast.error("Errore durante l'esecuzione della diagnosi: " + e.message)
    } finally {
      setDiagnosiBusy(false)
    }
  }

  const handleInviaQuietanzaEmail = async (fat) => {
    const condominioInfo = condomini.find(c => c.id === fat.condominio_id)
    const fornitoreInfo = fornitori.find(f => f.id === fat.fornitore_id) || { ragione_sociale: fat.fornitore }

    const emailDest = fornitoreInfo.email || prompt(`Inserisci l'indirizzo email di ${fornitoreInfo.ragione_sociale} per l'invio della quietanza:`)
    if (!emailDest) return

    setInvioEmailBusyId(fat.id)
    try {
      const abb = abbinamenti.find(a => a.fattura_id === fat.id)
      let delega = { data_pagamento: fat.data_pagamento, importo_totale: fat.importo_ritenuta }
      if (abb) {
        const d = f24Deleghe.find(x => x.id === abb.f24_id)
        if (d) delega = d
      }

      const { base64Data, filename } = generaPdfQuietanzaBase64(condominioInfo, fornitoreInfo, [fat], delega, profile)

      const bodyPayload = {
        condominio_id: fat.condominio_id,
        destinatari: [{ email: emailDest, nome: fornitoreInfo.ragione_sociale }],
        oggetto: `Certificazione Ritenuta d'Acconto - ${condominioInfo?.nome || 'Condominio'}`,
        messaggio: `Spettabile ${fornitoreInfo.ragione_sociale},\n\nIn allegato trasmettiamo la certificazione di avvenuto versamento della ritenuta d'acconto ai sensi dell'art. 25-ter D.P.R. 600/1973 per la fattura N° ${fat.numero_fattura || ''} del ${formattaData(fat.data_fattura)}.\n\nCordiali Saluti,\n${profile?.ragione_sociale || 'L\'Amministrazione'}`,
        tipo: 'email',
        allegati: [{ filename, content: base64Data, contentType: 'application/pdf' }]
      }

      const { error: invokeErr } = await supabase.functions.invoke('invia-comunicazione', { body: bodyPayload })
      if (invokeErr) throw invokeErr

      toast.success(`Attestazione quietanza inviata con successo all'indirizzo email ${emailDest}!`)
    } catch (err) {
      console.error("Errore invio quietanza email:", err)
      toast.error("Errore durante l'invio dell'email al fornitore: " + err.message)
    } finally {
      setInvioEmailBusyId(null)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [resCondomini, resFornitori, resFatture, resF24, resTributi, resAbbinamenti] = await Promise.all([
        supabase.from('condomini').select('id, nome, codice_fiscale, indirizzo, cap, citta, provincia').order('nome'),
        supabase.from('fornitori').select('*'),
        supabase.from('fatture_fornitori').select('*, fornitore_rel:fornitore_id(*)'),
        supabase.from('f24_deleghe').select('*').order('data_scadenza', { ascending: false }),
        supabase.from('f24_dettagli_tributi').select('*'),
        supabase.from('abbinamenti_f24_fatture').select('*')
      ])
      
      setCondomini(resCondomini.data || [])
      setFornitori(resFornitori.data || [])
      
      // Filtriamo solo le fatture che contengono ritenuta d'acconto
      const fattureConRitenuta = (resFatture.data || []).filter(
        f => (parseFloat(f.importo_ritenuta) > 0 || parseFloat(f.ritenuta_acconto) > 0)
      )
      setFatture(fattureConRitenuta)
      setF24Deleghe(resF24.data || [])
      setTributi(resTributi.data || [])
      setAbbinamenti(resAbbinamenti.data || [])
    } catch (e) {
      console.error('Errore caricamento dati fiscali:', e)
    } finally {
      setLoading(false)
    }
  }

  // --- LOGICA AUDIT FISCALE QUADRATURA 770/CU ---
  const quadratura770 = useMemo(() => {
    return verificaQuadraturaFiscaleRitenute(fatture, f24Deleghe)
  }, [fatture, f24Deleghe])

  // --- LOGICA RAGGRUPPAMENTO CERTIFICAZIONE UNICA ---
  const datiRaggruppatiCU = useMemo(() => {
    const filtrate = fatture.filter(f => {
      if (f.stato !== 'pagata') return false
      if (condominioSelezionato && f.condominio_id !== condominioSelezionato) return false
      
      const annoFattura = f.data_pagamento ? f.data_pagamento.substring(0, 4) : (f.data_fattura ? f.data_fattura.substring(0, 4) : null)
      if (annoFattura !== annoSelezionato) return false
      
      return true
    })

    const map = {}
    filtrate.forEach(fattura => {
      const cId = fattura.condominio_id
      const fId = fattura.fornitore_id || `sconosciuto-${fattura.fornitore}`
      
      if (!map[cId]) map[cId] = {}
      if (!map[cId][fId]) {
        const fornitoreInfo = fornitori.find(fo => fo.id === fId) || { 
          ragione_sociale: fattura.fornitore_rel?.ragione_sociale || fattura.fornitore, 
          partita_iva: fattura.fornitore_rel?.partita_iva || null,
          codice_fiscale: fattura.fornitore_rel?.codice_fiscale || null,
          indirizzo: fattura.fornitore_rel?.indirizzo || null,
          citta: fattura.fornitore_rel?.citta || null,
          cap: fattura.fornitore_rel?.cap || null,
          provincia: fattura.fornitore_rel?.provincia || null,
          regime_forfettario: fattura.fornitore_rel?.regime_forfettario || false,
          codice_esclusione_cu: fattura.fornitore_rel?.codice_esclusione_cu || null
        }
        
        map[cId][fId] = {
          condominio: condomini.find(c => c.id === cId) || { nome: 'Sconosciuto' },
          fornitore: fornitoreInfo,
          fatture: [],
          totaleImponibile: 0,
          totaleRitenute: 0
        }
      }
      
      map[cId][fId].fatture.push(fattura)
      const imponibile = parseFloat(fattura.imponibile_ritenuta) || (parseFloat(fattura.importo_totale || 0) - parseFloat(fattura.importo_iva || 0))
      map[cId][fId].totaleImponibile += imponibile
      map[cId][fId].totaleRitenute += parseFloat(fattura.importo_ritenuta || fattura.ritenuta_acconto || 0)
    })
    
    return map
  }, [fatture, annoSelezionato, condominioSelezionato, condomini, fornitori])

  // --- LOGICA FILTRO DELEGHE F24 ---
  const delegheFiltrare = useMemo(() => {
    return f24Deleghe.filter(d => {
      if (condominioSelezionato && d.condominio_id !== condominioSelezionato) return false
      const annoScadenza = d.data_scadenza ? d.data_scadenza.substring(0, 4) : null
      if (annoScadenza !== annoSelezionato) return false
      return true
    })
  }, [f24Deleghe, condominioSelezionato, annoSelezionato])

  // --- LOGICA RITENUTE PER QUIETANZE FORNITORI ---
  const ritenutePagateList = useMemo(() => {
    return fatture.filter(f => {
      if (f.stato !== 'pagata') return false
      if (!f.f24_url) {
        // Fallback: se l'F24 abbinato risulta pagato, consideriamo la ritenuta pagata
        const abb = abbinamenti.find(a => a.fattura_id === f.id)
        if (abb) {
          const del = f24Deleghe.find(d => d.id === abb.f24_id)
          if (del && del.stato === 'pagato') return true
        }
        return false
      }
      return true
    }).filter(f => {
      if (condominioSelezionato && f.condominio_id !== condominioSelezionato) return false
      const annoPagamento = (f.data_fattura || '').substring(0, 4)
      return annoPagamento === annoSelezionato
    })
  }, [fatture, abbinamenti, f24Deleghe, condominioSelezionato, annoSelezionato])

  // --- LOGICA CASSETTO CREDITI ERARIO CONDOMINIALE ---
  const creditiCondominio = useMemo(() => {
    const delegheCondo = f24Deleghe.filter(d => !condominioSelezionato || d.condominio_id === condominioSelezionato)
    const fattureCondo = fatture.filter(f => !condominioSelezionato || f.condominio_id === condominioSelezionato)
    return calcolaCreditiCondominio(delegheCondo, fattureCondo)
  }, [f24Deleghe, fatture, condominioSelezionato])

  // --- ESPORTAZIONI ED AZIONI ---
  
  const handleApriRavvedimento = (datiPrefill = {}) => {
    setRavvedimentoDefaultData({
      condominio_id: condominioSelezionato || condomini[0]?.id || '',
      importo: datiPrefill.differenza || datiPrefill.importo || 100,
      codice_tributo: datiPrefill.codice_tributo || '1019',
      data_scadenza: datiPrefill.data_scadenza || new Date(new Date().setMonth(new Date().getMonth() - 1, 16)).toISOString().split('T')[0]
    })
    setModalRavvedimentoOpen(true)
  }

  const handleExportDossierRevisori = (cId) => {
    checkWatermark((withWatermark) => {
      const targetId = cId || condominioSelezionato || condomini[0]?.id
      const condoTarget = condomini.find(c => c.id === targetId)
      if (!condoTarget) {
        toast.error("Seleziona prima un condominio.")
        return
      }

      exportDossierFiscaleRevisori({
        condominio: condoTarget,
        anno: annoSelezionato,
        fatture: fatture.filter(f => f.condominio_id === condoTarget.id),
        delegheF24: f24Deleghe.filter(d => d.condominio_id === condoTarget.id),
        abbinamenti,
        tributi,
        profile,
        withWatermark
      })
      toast.success("Dossier Fiscale Asseverato PDF esportato con successo!")
    })
  }

  const handleInviaCuMassive = async (cId) => {
    const targetMap = datiRaggruppatiCU[cId]
    if (!targetMap) return
    const listaFornitori = Object.values(targetMap)
    if (listaFornitori.length === 0) return

    setInvioCuMassivoBusy(true)
    setInvioCuProgresso(`Preparazione CU per ${listaFornitori.length} fornitori...`)
    
    let inviate = 0
    let fallite = 0

    try {
      const condoTarget = condomini.find(c => c.id === cId)
      for (let i = 0; i < listaFornitori.length; i++) {
        const item = listaFornitori[i]
        const email = item.fornitore?.email
        setInvioCuProgresso(`Invio CU (${i + 1}/${listaFornitori.length}): ${item.fornitore.ragione_sociale}...`)

        if (!email) {
          fallite++
          continue
        }

        try {
          const { base64Data, filename } = generaPdfQuietanzaBase64(condoTarget, item.fornitore, item.fatture, null, profile)
          const bodyPayload = {
            condominio_id: cId,
            destinatari: [{ email, nome: item.fornitore.ragione_sociale }],
            oggetto: `Certificazione Unica ${annoSelezionato} - ${condoTarget?.nome || 'Condominio'}`,
            messaggio: `Spettabile ${item.fornitore.ragione_sociale},\n\nIn allegato trasmettiamo la Certificazione Unica sintetica per le ritenute d'acconto operate dal ${condoTarget?.nome || 'Condominio'} nell'anno d'imposta ${annoSelezionato}.\n\nCordiali Saluti,\n${profile?.ragione_sociale || 'L\'Amministrazione'}`,
            tipo: 'email',
            allegati: [{ filename: `CU_${annoSelezionato}_${item.fornitore.ragione_sociale.replace(/\s+/g, '_')}.pdf`, content: base64Data, contentType: 'application/pdf' }]
          }
          const { error: sendErr } = await supabase.functions.invoke('invia-comunicazione', { body: bodyPayload })
          if (sendErr) throw sendErr
          inviate++
        } catch (e) {
          console.warn("Invio CU fallito per", item.fornitore?.ragione_sociale, e)
          fallite++
        }
      }

      toast.success(`Invio massivo CU completato: ${inviate} inviate con successo${fallite > 0 ? `, ${fallite} senza email o fallite` : ''}.`)
    } catch (err) {
      toast.error("Errore durante l'invio massivo: " + err.message)
    } finally {
      setInvioCuMassivoBusy(false)
      setInvioCuProgresso('')
    }
  }
  
  const handleExportPdfCU = (cId) => {
    checkWatermark((withWatermark) => {
      const condominioData = datiRaggruppatiCU[cId]
      const condominioInfo = condomini.find(c => c.id === cId)
      if (!condominioData) return
      
      const fornitoriList = Object.values(condominioData)
      exportBozzaCU(condominioInfo, annoSelezionato, fornitoriList, profile, withWatermark)
    })
  }

  const handleExportTxtCU = (cId) => {
    const condominioData = datiRaggruppatiCU[cId]
    const condominioInfo = condomini.find(c => c.id === cId)
    if (!condominioData) return

    const fornitoriList = Object.values(condominioData)
    const txtCU = generaTelematicoCU(condominioInfo, annoSelezionato, fornitoriList, profile)
    
    scaricaFileTxt(txtCU, `CU_${condominioInfo.nome.replace(/\s+/g, '_')}_${annoSelezionato}.txt`)
  }

  const handleExportTxt770 = (cId) => {
    const condominioInfo = condomini.find(c => c.id === cId)
    if (!condominioInfo) return

    const deleghePagate = f24Deleghe.filter(
      d => d.condominio_id === cId && d.stato === 'pagato' && d.data_pagamento?.substring(0, 4) === annoSelezionato
    ).map(d => ({
      ...d,
      f24_dettagli_tributi: tributi.filter(t => t.f24_id === d.id)
    }))

    if (deleghePagate.length === 0) {
      toast.error("Nessun modello F24 pagato (con quietanza registrata) trovato per questo condominio nell'anno selezionato. Impossibile generare il 770.")
      return
    }

    const txt770 = generaTelematico770(condominioInfo, annoSelezionato, deleghePagate, profile)
    scaricaFileTxt(txt770, `770_${condominioInfo.nome.replace(/\s+/g, '_')}_${annoSelezionato}.txt`)
    toast.success("File telematico 770 generato con successo!")
  }

  const handleAvviaExportCBI = () => {
    const idsSelezionati = Object.keys(selezionatiCbi).filter(id => selezionatiCbi[id])
    if (idsSelezionati.length === 0) {
      toast.error("Seleziona almeno un F24 da esportare.")
      return
    }

    const delegheDaGenerare = f24Deleghe.filter(d => idsSelezionati.includes(d.id)).map(d => ({
      ...d,
      condominio: condomini.find(c => c.id === d.condominio_id),
      f24_dettagli_tributi: tributi.filter(t => t.f24_id === d.id)
    }))

    const resValidazione = validaDelegheCbi(delegheDaGenerare, profile)
    setDelegheDaEsportare(delegheDaGenerare)
    setCbiValidazione(resValidazione)
    setCbiDisclaimerAccettato(false)
    setModalCbiOpen(true)
  }

  const handleConfermaEGeneraCBI = async () => {
    if (!cbiValidazione || !cbiValidazione.ok) {
      toast.error("Impossibile procedere: correggi prima gli errori bloccanti indicati nella diagnostica.")
      return
    }
    if (!cbiDisclaimerAccettato) {
      toast.error("Spunta la casella di conferma e responsabilità per procedere al download.")
      return
    }

    const cbiText = generaCbiF24(delegheDaEsportare, profile)
    scaricaFileTxt(cbiText, `DISTINTA_F24_${new Date().toISOString().split('T')[0]}.txt`)

    // Tracciamento note aggiornate
    try {
      const ids = delegheDaEsportare.map(d => d.id)
      const dataOra = new Date().toLocaleString('it-IT')
      await supabase.from('f24_deleghe')
        .update({ note: `Distinta CBI generata il ${dataOra}` })
        .in('id', ids)
    } catch (e) {
      console.warn("Nota distinta non aggiornata:", e)
    }

    setModalCbiOpen(false)
    await loadData()
    toast.success("Distinta F24 CBI generata con successo! File pronto per l'home banking.")
  }

  const handleUploadQuietanza = async (f24Id, file) => {
    if (!file) return
    setF24UploadingId(f24Id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const path = `${user.id}/f24_quietanze/${Date.now()}_${file.name}`
      
      const { error: uploadErr } = await supabase.storage
        .from('fatture')
        .upload(path, file)
      if (uploadErr) throw uploadErr

      const dataOggi = new Date().toISOString().split('T')[0]
      
      // Aggiorna F24
      const { error: updErr } = await supabase.from('f24_deleghe')
        .update({ 
          stato: 'pagato',
          data_pagamento: dataOggi,
          quietanza_url: path
        })
        .eq('id', f24Id)
      if (updErr) throw updErr

      // Aggiorna fatture collegate
      const collegateIds = abbinamenti.filter(a => a.f24_id === f24Id).map(a => a.fattura_id)
      if (collegateIds.length > 0) {
        const { error: updFattErr } = await supabase.from('fatture_fornitori')
          .update({ 
            f24_url: path
          })
          .in('id', collegateIds)
        if (updFattErr) throw updFattErr
      }

      toast.success('Quietanza registrata e F24 impostato come PAGATO con successo.')
      await loadData()
    } catch (err) {
      toast.error('Errore registrazione quietanza: ' + err.message)
    } finally {
      setF24UploadingId(null)
    }
  }

  const visualizzaQuietanza = async (path) => {
    const newTab = window.open('about:blank', '_blank')
    try {
      const { data, error } = await supabase.storage
        .from('fatture')
        .createSignedUrl(path, 900)
      if (error) throw error
      newTab.location.href = data.signedUrl
    } catch (err) {
      newTab.close()
      toast.error('Errore apertura quietanza: ' + err.message)
    }
  }

  const handleGeneraQuietanzaFornitore = (fat) => {
    checkWatermark((withWatermark) => {
      const condominio = condomini.find(c => c.id === fat.condominio_id)
      const fornitore = fornitori.find(f => f.id === fat.fornitore_id) || { ragione_sociale: fat.fornitore }
      
      const abb = abbinamenti.find(a => a.fattura_id === fat.id)
      let delega = { data_pagamento: fat.data_pagamento, importo_totale: fat.importo_ritenuta }
      if (abb) {
        const d = f24Deleghe.find(x => x.id === abb.f24_id)
        if (d) delega = d
      }
      
      exportQuietanzaFornitore(condominio, fornitore, [fat], delega, profile, withWatermark)
    })
  }

  function scaricaFileTxt(text, filename) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  const toggleSelezionato = (id) => {
    setSelezionatiCbi(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div style={styles.page}>
      <WatermarkModal />
      
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#2563eb20', padding: 12, borderRadius: 12 }}>
            <Landmark size={28} color="#60a5fa" />
          </div>
          <div>
            <h1 style={styles.title}>Modulo Fiscale & Adempimenti</h1>
            <p style={styles.subtitle}>Gestione Ritenute d'Acconto, F24 Cumulativi (CBI) e invii telematici Agenzia delle Entrate</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => handleExportDossierRevisori()}
            style={{ ...styles.btnAction, background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Archive size={16} style={{ color: '#3b82f6' }} /> Dossier Revisori (PDF)
          </button>
          <button
            onClick={() => handleApriRavvedimento()}
            style={{ ...styles.btnAction, background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Calculator size={16} style={{ color: '#f59e0b' }} /> Calcola Ravvedimento F24
          </button>
          <button
            onClick={handleAvviaDiagnosiFiscale}
            disabled={diagnosiBusy}
            style={{ ...styles.btnActionPrimary, background: '#10b981', padding: '10px 16px', fontSize: 13.5 }}
          >
            <Activity size={18} />
            {diagnosiBusy ? 'Diagnosi in corso...' : 'Diagnosi Conformità Fiscale'}
          </button>
        </div>
      </div>

      {/* Toolbar Filtri */}
      <div style={styles.toolbar}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div>
            <label style={styles.label}>Anno d'Imposta</label>
            <select value={annoSelezionato} onChange={e => setAnnoSelezionato(e.target.value)} style={styles.select}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label style={styles.label}>Filtro Condominio</label>
            <select value={condominioSelezionato} onChange={e => setCondominioSelezionato(e.target.value)} style={styles.select}>
              <option value="">Tutti i condomini</option>
              {condomini.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Disclaimer Fiscale */}
      <div style={{ background: '#f59e0b10', border: '1px solid #f59e0b30', borderRadius: 10, padding: '12px 16px', margin: '0 24px 12px 24px', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <ShieldAlert size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          <b>Disclaimer di Responsabilità Fiscale:</b> CondoFast opera esclusivamente come software di calcolo ed elaborazione dati. La responsabilità legale per la correttezza, la validazione, l'invio telematico degli adempimenti (F24, 770, CU) e il rispetto delle scadenze di legge in qualità di Sostituto d'Imposta ricade in via esclusiva sull'Amministratore del Condominio.
        </span>
      </div>

      {/* Card di Quadratura Matematica Ritenute / F24 */}
      {quadratura770 && quadratura770.status !== 'in_attesa' && (
        <div style={{
          background: quadratura770.status === 'conforme' ? '#10b98110' : '#ef444410',
          border: quadratura770.status === 'conforme' ? '1px solid #10b98130' : '1px solid #ef444430',
          borderRadius: 10,
          padding: '12px 16px',
          margin: '0 24px 16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {quadratura770.status === 'conforme' ? (
              <CheckCircle2 size={20} color="#10b981" style={{ flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: quadratura770.status === 'conforme' ? '#10b981' : '#ef4444' }}>
                {quadratura770.status === 'conforme' ? '✓ Quadratura Fiscale 100% Verificata (Fatture ↔ F24)' : '⚠️ Discrepanza Ritenute / Versamenti F24'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {quadratura770.messaggio}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Ritenute Fatture: <strong style={{ color: 'var(--text-primary)' }}>€ {quadratura770.totaleRitenuteFatture.toFixed(2)}</strong> · F24 Pagati: <strong style={{ color: '#10b981' }}>€ {quadratura770.totaleF24Pagati.toFixed(2)}</strong>
            </div>
            {quadratura770.status !== 'conforme' && (
              <button
                type="button"
                onClick={() => setTabAttivo('f24')}
                style={{
                  background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6,
                  padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6
                }}
              >
                <Sparkles size={12} /> Genera F24 Mancante
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs di Navigazione */}
      <div style={styles.tabsContainer}>
        {[
          { id: 'cu_770', label: 'Certificazione Unica & 770' },
          { id: 'f24', label: 'Modelli F24 in Scadenza' },
          { id: 'quietanze', label: 'Quietanza ai Fornitori' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTabAttivo(t.id)}
            style={{
              ...styles.tabButton,
              ...(tabAttivo === t.id ? styles.tabButtonActive : {})
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Caricamento dati fiscali in corso...</div>
      ) : (
        <>
          {/* TAB 1: CERTIFICAZIONE UNICA & 770 (WIZARD INVIO DIRETTO) */}
          {tabAttivo === 'cu_770' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Wizard Progress Bar */}
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '16px 24px', gap: 16 }}>
                {[
                  { step: 1, title: '1. Estrazione & Controlli', desc: 'Genera file telematici' },
                  { step: 2, title: '2. Validazione AdE', desc: 'Desktop Telematico (Sogei)' },
                  { step: 3, title: '3. Trasmissione', desc: 'Invio con SPID su Fisconline' }
                ].map((s, idx) => (
                  <React.Fragment key={s.step}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: wizardStepCU >= s.step ? 1 : 0.4, flex: 1, cursor: 'pointer' }} onClick={() => setWizardStepCU(s.step)}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: wizardStepCU === s.step ? '#2563eb' : (wizardStepCU > s.step ? '#10b981' : 'var(--app-bg)'), color: wizardStepCU >= s.step ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, border: wizardStepCU < s.step ? '1px solid var(--border-color)' : 'none' }}>
                        {wizardStepCU > s.step ? <CheckCircle2 size={20} /> : s.step}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: wizardStepCU >= s.step ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.desc}</div>
                      </div>
                    </div>
                    {idx < 2 && <ChevronRight size={24} color="var(--border-color-2)" />}
                  </React.Fragment>
                ))}
              </div>

              {wizardStepCU === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {Object.keys(datiRaggruppatiCU).length === 0 ? (
                    <div style={styles.empty}>
                      Nessun compenso erogato soggetto a ritenuta (fatture pagate) per l'anno e condominio selezionati.
                    </div>
                  ) : (
                    Object.entries(datiRaggruppatiCU).map(([cId, fornitoriMap]) => {
                      const fornitoriList = Object.values(fornitoriMap)
                      const condName = fornitoriList[0]?.condominio?.nome || 'Condominio'
                      const fornitoriIncompleti = fornitoriList.filter(f => !f.fornitore.partita_iva && !f.fornitore.codice_fiscale)
                      const canExport = fornitoriIncompleti.length === 0
                      
                      return (
                        <div key={cId} style={styles.section}>
                          <div style={styles.sectionHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Building2 size={20} color="#94a3b8" />
                              <h2 style={styles.sectionTitle}>{condName}</h2>
                            </div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              <button onClick={() => handleInviaCuMassive(cId)} disabled={invioCuMassivoBusy} style={{ ...styles.btnActionPrimary, background: '#8b5cf6', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {invioCuMassivoBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                {invioCuMassivoBusy ? (invioCuProgresso || 'Invio in corso...') : 'Invia CU ai Fornitori (Email/PEC)'}
                              </button>
                              <button onClick={() => handleExportDossierRevisori(cId)} style={styles.btnAction}>
                                <Archive size={14} style={{ color: '#3b82f6' }} /> Dossier Revisori PDF
                              </button>
                              <button onClick={() => handleExportPdfCU(cId)} style={styles.btnAction}>
                                <Download size={14} /> PDF Bozza CU
                              </button>
                              <button onClick={() => handleExportTxtCU(cId)} disabled={!canExport} style={{...styles.btnActionPrimary, opacity: canExport ? 1 : 0.5, cursor: canExport ? 'pointer' : 'not-allowed'}}>
                                <FileText size={14} /> Telematico CU (.txt)
                              </button>
                              <button onClick={() => handleExportTxt770(cId)} disabled={!canExport} style={{...styles.btnActionPrimary, opacity: canExport ? 1 : 0.5, cursor: canExport ? 'pointer' : 'not-allowed'}}>
                                <FileText size={14} /> Telematico 770 (.txt)
                              </button>
                            </div>
                          </div>
                          
                          {/* Alert Bloccante Anagrafiche Incomplete */}
                          {!canExport && (
                            <div style={{ background: '#ef444415', borderBottom: '1px solid #ef444430', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                              <AlertTriangle size={24} color="#ef4444" style={{ flexShrink: 0 }} />
                              <div>
                                <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 14 }}>Generazione telematica bloccata: Anagrafiche incomplete</div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>Ci sono {fornitoriIncompleti.length} fornitore/i senza Partita IVA o Codice Fiscale. L'Agenzia delle Entrate scarterebbe il file. Completa le anagrafiche nella sezione Fornitori prima di generare l'export.</div>
                              </div>
                            </div>
                          )}

                          <div style={styles.tableContainer}>
                            <table style={styles.table}>
                              <thead>
                                <tr>
                                  <th style={styles.th}>Fornitore</th>
                                  <th style={styles.th}>P.IVA / CF</th>
                                  <th style={styles.th}>Regime</th>
                                  <th style={styles.th}>N° Fatt.</th>
                                  <th style={{ ...styles.th, textAlign: 'right' }}>Imponibile Lordo</th>
                                  <th style={{ ...styles.th, textAlign: 'right' }}>Ritenuta Trattenuta</th>
                                </tr>
                              </thead>
                              <tbody>
                                {fornitoriList.map((fData, i) => {
                                  const missingIva = !fData.fornitore.partita_iva && !fData.fornitore.codice_fiscale;
                                  return (
                                  <tr key={i} style={{...styles.tr, background: missingIva ? '#ef444408' : 'transparent'}}>
                                    <td style={styles.td}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <User size={14} color="#64748b" />
                                        <span style={{ fontWeight: 600, color: missingIva ? '#ef4444' : 'var(--text-primary)' }}>{fData.fornitore.ragione_sociale}</span>
                                      </div>
                                    </td>
                                    <td style={styles.td}>
                                      {missingIva ? (
                                        <span style={{ ...styles.badge, background: '#ef444420', color: '#ef4444' }}>MANCANTE!</span>
                                      ) : (
                                        <span style={styles.badge}>{fData.fornitore.codice_fiscale || fData.fornitore.partita_iva}</span>
                                      )}
                                    </td>
                                    <td style={styles.td}>
                                      {fData.fornitore.regime_forfettario ? (
                                        <span style={{ ...styles.badge, background: '#10b98120', color: '#10b981' }}>Forfettario (Esente)</span>
                                      ) : (
                                        <span style={{ ...styles.badge, background: '#2563eb20', color: '#60a5fa' }}>Ordinario (Soggetto)</span>
                                      )}
                                    </td>
                                    <td style={styles.td}>{fData.fatture.length} doc.</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>€ {fData.totaleImponibile.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                                    <td style={{ ...styles.td, textAlign: 'right', color: fData.totaleRitenute > 0 ? '#f59e0b' : '#64748b', fontWeight: 600 }}>
                                      € {fData.totaleRitenute.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                )})}
                              </tbody>
                            </table>
                          </div>
                          
                          <div style={{ padding: '16px 20px', background: 'var(--app-bg)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button 
                              onClick={() => setWizardStepCU(2)} 
                              disabled={!canExport}
                              style={{...styles.btnActionPrimary, background: canExport ? '#10b981' : '#64748b', fontSize: 14, padding: '10px 20px', opacity: canExport ? 1 : 0.5}}
                            >
                              File Generato? Vai al controllo AdE <ChevronRight size={18} />
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {wizardStepCU === 2 && (
                <div style={styles.wizardPanel}>
                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ display: 'inline-flex', padding: 16, borderRadius: '50%', background: '#3b82f615', marginBottom: 16 }}>
                      <Monitor size={48} color="#3b82f6" />
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Validazione Ufficiale Sogei</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 600, margin: '8px auto' }}>
                      Prima di inviare i file telematici all'Agenzia delle Entrate, è obbligatorio verificarne la correttezza formale utilizzando il software ufficiale gratuito.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
                    <div style={{ flex: 1, background: 'var(--app-bg)', borderRadius: 12, padding: 24, border: '1px solid var(--border-color)' }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>1</span> 
                        Scarica "Desktop Telematico"
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16, lineHeight: '1.5' }}>
                        Accedi al portale dell'Agenzia delle Entrate e scarica l'applicazione Desktop Telematico sul tuo computer. Installa i moduli di controllo per le Certificazioni Uniche e per il modello 770.
                      </p>
                      <button onClick={() => window.open('https://telematici.agenziaentrate.gov.it/', '_blank')} style={styles.btnAction}>
                        <ExternalLink size={16} /> Vai al portale Download AdE
                      </button>
                    </div>
                    
                    <div style={{ flex: 1, background: 'var(--app-bg)', borderRadius: 12, padding: 24, border: '1px solid var(--border-color)' }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>2</span> 
                        Esegui il controllo
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16, lineHeight: '1.5' }}>
                        Apri il Desktop Telematico, vai in <b>Applicazioni {'>'} Controlla file</b>. Seleziona i file `.txt` generati da CondoFAST al passaggio precedente. Assicurati che non ci siano errori bloccanti.
                      </p>
                      <div style={{ background: '#10b98115', border: '1px dashed #10b98150', padding: 12, borderRadius: 8, color: '#10b981', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShieldCheck size={18} /> L'esito deve essere "Elaborato senza errori".
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: 24 }}>
                    <button onClick={() => setWizardStepCU(1)} style={styles.btnAction}>
                      Indietro
                    </button>
                    <button onClick={() => setWizardStepCU(3)} style={{...styles.btnActionPrimary, fontSize: 15, padding: '12px 24px'}}>
                      Ho validato i file, procediamo all'invio <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}

              {wizardStepCU === 3 && (
                <div style={styles.wizardPanel}>
                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ display: 'inline-flex', padding: 16, borderRadius: '50%', background: '#10b98115', marginBottom: 16 }}>
                      <PlayCircle size={48} color="#10b981" />
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Trasmissione Diretta su Fisconline</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 600, margin: '8px auto' }}>
                      Salta il commercialista caricando il file direttamente con il tuo SPID nel tuo cassetto fiscale. L'operazione è gratuita e legalmente inattaccabile se il file è stato validato al passo 2.
                    </p>
                  </div>

                  <div style={{ background: 'var(--app-bg)', borderRadius: 12, padding: 32, border: '1px solid var(--border-color)', maxWidth: 700, margin: '0 auto 32px' }}>
                    <ol style={{ paddingLeft: 20, margin: 0, color: 'var(--text-primary)', fontSize: 15, lineHeight: '1.8' }}>
                      <li style={{ marginBottom: 12 }}>Clicca sul pulsante qui sotto per accedere a <b>Fisconline / Entratel</b>.</li>
                      <li style={{ marginBottom: 12 }}>Autenticati con il tuo <b>SPID</b> o <b>CIE</b>.</li>
                      <li style={{ marginBottom: 12 }}>Dal menu di sinistra, seleziona <b>Servizi per {'>'} Inviare</b>.</li>
                      <li style={{ marginBottom: 12 }}>Seleziona i file `.txt` controllati e autenticali inserendo il tuo codice PIN dispositivo.</li>
                      <li style={{ marginBottom: 12 }}>Conferma l'invio. Troverai la ricevuta di accettazione AdE dopo 24/48 ore nella sezione "Ricevute".</li>
                    </ol>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16, borderTop: '1px solid var(--border-color)', paddingTop: 24 }}>
                    <button onClick={() => setWizardStepCU(2)} style={styles.btnAction}>
                      Indietro
                    </button>
                    <button onClick={() => window.open('https://ivaservizi.agenziaentrate.gov.it/portale/', '_blank')} style={{...styles.btnActionPrimary, background: '#10b981', fontSize: 16, padding: '14px 28px'}}>
                      <ExternalLink size={20} /> Accedi all'Agenzia delle Entrate (SPID)
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: MODELLI F24 IN SCADENZA */}
          {tabAttivo === 'f24' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Banner Chiarificatore F24 per Piani */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Info size={16} color="#60a5fa" style={{ flexShrink: 0 }} />
                <span>
                  <b>Gestione F24:</b> Nei piani Base e Studio puoi monitorare lo Scadenzario F24 e registrare i pagamenti effettuati. L'esportazione del tracciato telematico massivo <b>CBI F24</b> per l'Home Banking è inclusa nel piano Professional.
                </span>
              </div>

              {/* Cassetto Crediti Erario Condominiale */}
              <CassettoCreditiWidget
                creditoDisponibile={creditiCondominio.totaleCreditoDisponibile}
                listaCrediti={creditiCondominio.listaCrediti}
                condominioId={condominioSelezionato || condomini[0]?.id}
                onRefresh={loadData}
              />

              {/* Scadenzario Timeline Widget */}
              <ScadenzarioWidget deleghe={f24Deleghe} />

              {/* Esportazione cumulativa CBI (Riservata a Piano Professional) */}
              {delegheFiltrare.some(d => d.stato === 'da_pagare') && (
                <PlanGate feature="distinta_cbi_f24">
                  <div style={styles.massivePanel}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                      Seleziona le deleghe "Da Pagare" e scarica la distinta F24 CBI per l'addebito massivo in banca.
                    </div>
                    <button onClick={handleAvviaExportCBI} style={styles.btnActionPrimary}>
                      <FileSpreadsheet size={16} /> Esporta Distinta CBI F24 ({Object.values(selezionatiCbi).filter(Boolean).length} sel.)
                    </button>
                  </div>
                </PlanGate>
              )}

              {delegheFiltrare.length === 0 ? (
                <div style={styles.empty}>
                  Nessun modello F24 generato per i filtri selezionati.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {delegheFiltrare.map(delega => {
                    const condo = condomini.find(c => c.id === delega.condominio_id) || { nome: 'Condominio' }
                    const dettagli = tributi.filter(t => t.f24_id === delega.id)
                    const fattureAbbinate = abbinamenti.filter(a => a.f24_id === delega.id)
                    
                    const isDaPagare = delega.stato === 'da_pagare'
                    
                    return (
                      <div key={delega.id} style={{ ...styles.cardF24, borderLeft: `4px solid ${isDaPagare ? '#f59e0b' : '#10b981'}` }}>
                        <div style={styles.cardF24Header}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {isDaPagare && (
                              <input 
                                type="checkbox" 
                                checked={!!selezionatiCbi[delega.id]} 
                                onChange={() => toggleSelezionato(delega.id)}
                                style={{ width: 18, height: 18, cursor: 'pointer' }}
                              />
                            )}
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>{condo.nome}</div>
                              <div style={{ display: 'flex', gap: 12, marginTop: 4, alignItems: 'center' }}>
                                <span style={styles.dateLabel}>
                                  <Calendar size={12} /> Scadenza: {formattaData(delega.data_scadenza)}
                                </span>
                                {delega.data_pagamento && (
                                  <span style={{ ...styles.dateLabel, color: '#10b981' }}>
                                    <CheckCircle2 size={12} /> Pagato il: {formattaData(delega.data_pagamento)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={styles.f24Importo}>€ {delega.importo_totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                            <span style={{ 
                              ...styles.statoBadge, 
                              background: isDaPagare ? '#f59e0b20' : '#10b98120', 
                              color: isDaPagare ? '#f59e0b' : '#10b981' 
                            }}>
                              {isDaPagare ? 'Da pagare' : 'Pagato'}
                            </span>
                          </div>
                        </div>

                        {/* Tributi Interni ed Azioni */}
                        <div style={styles.cardF24Body}>
                          <div>
                            <div style={styles.subTitleF24}>Codici Tributo Associati:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                              {dettagli.map(t => (
                                <div key={t.id} style={styles.tributoChip}>
                                  <span style={{ fontWeight: 700, color: '#60a5fa' }}>Cod. {t.codice_tributo}</span>
                                  <span style={{ color: 'var(--text-secondary)' }}>({String(t.mese_riferimento).padStart(2, '0')}/{t.anno_riferimento})</span>
                                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>€ {t.importo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                              Fatture collegate: {fattureAbbinate.length} documenti
                            </div>
                          </div>

                          {/* Upload / Visualizzazione Quietanza */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {delega.quietanza_url ? (
                              <button onClick={() => visualizzaQuietanza(delega.quietanza_url)} style={styles.btnAction}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> Visualizza Quietanza PDF</span>
                              </button>
                            ) : (
                              <label style={styles.btnUpload}>
                                <Upload size={14} />
                                {f24UploadingId === delega.id ? 'Salvataggio...' : 'Registra Pagamento (Quietanza)'}
                                <input 
                                  type="file" 
                                  accept=".pdf" 
                                  style={{ display: 'none' }}
                                  disabled={f24UploadingId === delega.id}
                                  onChange={(e) => handleUploadQuietanza(delega.id, e.target.files[0])}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: QUIETANZA AI FORNITORI */}
          {(tabAttivo === 'quieta' || tabAttivo === 'quietanze') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {ritenutePagateList.length === 0 ? (
                <div style={styles.empty}>
                  Nessuna ritenuta d'acconto versata (F24 liquidato) nell'anno selezionato.
                </div>
              ) : (
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <h2 style={styles.sectionTitle}>Certificazioni di Versamento Ritenuta d'Acconto</h2>
                  </div>
                  <div style={styles.tableContainer}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Fornitore</th>
                          <th style={styles.th}>P.IVA / CF</th>
                          <th style={styles.th}>Fattura</th>
                          <th style={styles.th}>Data Pagamento</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>Importo Ritenuta</th>
                          <th style={{ ...styles.th, textAlign: 'center' }}>Azione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ritenutePagateList.map((fat) => {
                          const fName = fat.fornitore
                          const fIva = fat.fornitore_rel?.partita_iva || fat.fornitore_rel?.codice_fiscale || '-'
                          return (
                            <tr key={fat.id} style={styles.tr}>
                              <td style={styles.td}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fName}</span>
                              </td>
                              <td style={styles.td}>
                                <span style={styles.badge}>{fIva}</span>
                              </td>
                              <td style={styles.td}>N° {fat.numero_fattura || '-'} del {formattaData(fat.data_fattura)}</td>
                              <td style={styles.td}>{formattaData(fat.data_pagamento)}</td>
                              <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600, color: '#10b981' }}>
                                € {parseFloat(fat.importo_ritenuta || fat.ritenuta_acconto || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ ...styles.td, textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                  <button onClick={() => handleGeneraQuietanzaFornitore(fat)} style={styles.btnAction}>
                                    <Download size={13} /> Scarica PDF
                                  </button>
                                  <button
                                    onClick={() => handleInviaQuietanzaEmail(fat)}
                                    disabled={invioEmailBusyId === fat.id}
                                    style={{ ...styles.btnActionPrimary, fontSize: 12, padding: '4px 10px' }}
                                  >
                                    <Mail size={13} /> {invioEmailBusyId === fat.id ? 'Invio...' : 'Invia Email'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODALE CHECKOUT & DIAGNOSTICA FISCALE CBI F24 */}
      {modalCbiOpen && cbiValidazione && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16,
            width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', padding: 28,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', fontFamily: 'Sora, sans-serif'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={24} color={cbiValidazione.ok ? '#10b981' : '#ef4444'} />
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Checkout & Pre-Flight Check Distinta F24 CBI
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Verifica di sicurezza ed assunzione di responsabilità per l'addebito massivo in banca
                  </div>
                </div>
              </div>
              <button onClick={() => setModalCbiOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Status Summary Banner */}
            <div style={{
              background: cbiValidazione.ok ? '#10b98115' : '#ef444415',
              border: `1px solid ${cbiValidazione.ok ? '#10b98140' : '#ef444440'}`,
              borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12
            }}>
              {cbiValidazione.ok ? <ShieldCheck size={28} color="#10b981" /> : <AlertCircle size={28} color="#ef4444" />}
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: cbiValidazione.ok ? '#10b981' : '#ef4444' }}>
                  {cbiValidazione.ok ? "Verifica completata con successo — Distinta idonea" : "Blocco di sicurezza: Rilevati errori formali"}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {cbiValidazione.ok 
                    ? `Totale da addebitare: € ${cbiValidazione.totaleImporto.toLocaleString('it-IT', { minimumFractionDigits: 2 })} su ${delegheDaEsportare.length} deleghe.`
                    : "Correggi le anomalie bloccanti indicate qui sotto prima di scaricare il file per l'home banking."
                  }
                </div>
              </div>
            </div>

            {/* Diagnostic Logs (Errors, Warnings, Info) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {cbiValidazione.errors.map((err, idx) => (
                <div key={`err-${idx}`} style={{ background: '#ef444410', borderLeft: '4px solid #ef4444', padding: '10px 14px', borderRadius: 6, fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{err}</span>
                </div>
              ))}

              {cbiValidazione.warnings.map((warn, idx) => (
                <div key={`warn-${idx}`} style={{ background: '#f59e0b10', borderLeft: '4px solid #f59e0b', padding: '10px 14px', borderRadius: 6, fontSize: 13, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>{warn}</span>
                </div>
              ))}

              {cbiValidazione.info.map((inf, idx) => (
                <div key={`inf-${idx}`} style={{ background: '#2563eb10', borderLeft: '4px solid #2563eb', padding: '10px 14px', borderRadius: 6, fontSize: 13, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Info size={16} style={{ flexShrink: 0 }} />
                  <span>{inf}</span>
                </div>
              ))}
            </div>

            {/* List of Deleghe */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
                Riepilogo Deleghe F24 Incolonnate:
              </div>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: 'var(--app-bg)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)' }}>Condominio</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)' }}>IBAN Addebito</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)' }}>Scadenza</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>Importo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delegheDaEsportare.map((del, i) => (
                      <tr key={del.id || i} style={{ borderBottom: '1px solid var(--border-color-2)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{del.condominio?.nome || '-'}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{del.condominio?.iban || 'MANCANTE'}</td>
                        <td style={{ padding: '8px 12px' }}>{formattaData(del.data_scadenza)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                          € {parseFloat(del.importo_totale || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Disclaimer Checkbox */}
            {cbiValidazione.ok && (
              <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 16, marginBottom: 24 }}>
                <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cbiDisclaimerAccettato}
                    onChange={(e) => setCbiDisclaimerAccettato(e.target.checked)}
                    style={{ width: 18, height: 18, marginTop: 2, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: '1.5' }}>
                    <b>Dichiaro di aver verificato i dati bancari e fiscali.</b> Confermo la copertura sul conto corrente del condominio e la correttezza dei codici tributo. Dichiaro di assumermi la piena responsabilità dell'addebito massivo autorizzato con il file CBI.
                  </span>
                </label>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
              <button onClick={() => setModalCbiOpen(false)} style={styles.btnAction}>
                Annulla
              </button>
              <button
                onClick={handleConfermaEGeneraCBI}
                disabled={!cbiValidazione.ok || !cbiDisclaimerAccettato}
                style={{
                  ...styles.btnActionPrimary,
                  padding: '10px 20px', fontSize: 14,
                  opacity: (cbiValidazione.ok && cbiDisclaimerAccettato) ? 1 : 0.4,
                  cursor: (cbiValidazione.ok && cbiDisclaimerAccettato) ? 'pointer' : 'not-allowed'
                }}
              >
                <Download size={16} /> Scarica Distinta CBI F24 (.txt)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE DIAGNOSI CONFORMITÀ FISCALE */}
      <DiagnosiFiscaleModal
        isOpen={modalDiagnosiOpen}
        onClose={() => setModalDiagnosiOpen(false)}
        condominioNome={condomini.find(c => c.id === condominioSelezionato)?.nome || 'Condominio'}
        diagnosiResult={diagnosiResult}
      />

      {/* MODALE RAVVEDIMENTO OPEROSO F24 */}
      <RavvedimentoModal
        isOpen={modalRavvedimentoOpen}
        onClose={() => setModalRavvedimentoOpen(false)}
        defaultData={ravvedimentoDefaultData}
        condomini={condomini}
        onSuccess={loadData}
      />
    </div>
  )
}

const styles = {
  page: { padding: '28px 32px', background: 'var(--app-bg)', minHeight: '100vh', fontFamily: 'Sora, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { color: 'var(--text-primary)', fontSize: 24, fontWeight: 700, margin: 0 },
  subtitle: { color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 },
  toolbar: { display: 'flex', gap: 16, marginBottom: 24, background: 'var(--card-bg)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border-color)' },
  label: { display: 'block', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 },
  select: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none' },
  tabsContainer: { display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color-2)', paddingBottom: 12, marginBottom: 24 },
  tabButton: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', borderRadius: 6, transition: 'all 0.2s', fontFamily: 'Sora, sans-serif' },
  tabButtonActive: { background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' },
  alertBanner: { display: 'flex', gap: 12, alignItems: 'center', background: '#f59e0b15', border: '1px solid #f59e0b30', padding: '14px 18px', borderRadius: 10 },
  empty: { background: 'var(--card-bg)', border: '1px dashed var(--border-color)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--text-muted)' },
  section: { background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--app-bg)' },
  sectionTitle: { color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, margin: 0 },
  btnAction: { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid #475569', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600, fontFamily: 'Sora, sans-serif' },
  btnActionPrimary: { display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 700, fontFamily: 'Sora, sans-serif' },
  tableContainer: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: { padding: '12px 20px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' },
  td: { padding: '12px 20px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' },
  tr: { transition: 'background 0.2s', borderBottom: '1px solid var(--border-color-2)' },
  badge: { background: 'var(--border-color)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: 4, fontSize: 11.5, fontFamily: 'monospace' },
  massivePanel: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '14px 20px', borderRadius: 10 },
  wizardPanel: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 40 },
  cardF24: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 18, transition: 'all 0.2s' },
  cardF24Header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  dateLabel: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--text-secondary)' },
  f24Importo: { fontSize: 19, fontWeight: 800, color: 'var(--text-primary)' },
  statoBadge: { borderRadius: 20, padding: '3px 12px', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', display: 'inline-block', marginTop: 4 },
  cardF24Body: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-color)' },
  subTitleF24: { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' },
  tributoChip: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 20, padding: '4px 12px', fontSize: 12 },
  btnUpload: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#fff', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 700, fontFamily: 'Sora, sans-serif' }
}
