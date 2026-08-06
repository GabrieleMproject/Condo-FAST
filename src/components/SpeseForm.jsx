import { useState, useEffect, useRef, useMemo } from 'react'
import { callGemini, callGeminiDocument } from '../lib/geminiClient'
import { estraiFattura, fileToBase64, comprimiImmagine, getTipoFile } from '../lib/fileExtractor'
import { parseFatturaXmlP7m } from '../lib/xmlFatturaParser'
import { usePlan } from '../hooks/usePlan'
import { supabase } from '../lib/supabaseClient'
import { CheckCircle2, Receipt, AlertTriangle, Bot, Sparkles, Check, Scale, Split, Loader2, FileSpreadsheet, Trash2, ChevronDown, ChevronUp, Layers, FileText, ShieldCheck } from 'lucide-react'
import AiBadge from './AiBadge'

const CATEGORIE = [
  { value: 'ordinaria', label: 'Ordinaria' },
  { value: 'straordinaria', label: 'Straordinaria' },
  { value: 'manutenzione', label: 'Manutenzione' },
  { value: 'utenze', label: 'Utenze' },
  { value: 'assicurazione', label: 'Assicurazione' },
  { value: 'altro', label: 'Altro' },
]

const inputStyle = {
  width: '100%', background: 'var(--app-bg)', color: 'var(--text-primary)',
  border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px',
  fontSize: 14, fontFamily: 'Sora, sans-serif', boxSizing: 'border-box'
}
const labelStyle = { display: 'block', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }

const trovaTabellaFuzzy = (tabelleList, nomeConsigliato, criterio) => {
  if (!tabelleList || !tabelleList.length) return null
  if (!nomeConsigliato) {
    if ((criterio === 'millesimi' || criterio === 'mista') && tabelleList.length === 1) return tabelleList[0]
    return null
  }
  const target = String(nomeConsigliato).trim().toLowerCase()
  // 1. Match esatto (case insensitive)
  let found = tabelleList.find(t => String(t.nome || '').trim().toLowerCase() === target)
  if (found) return found
  // 2. Substring match reciproco
  found = tabelleList.find(t => {
    const n = String(t.nome || '').trim().toLowerCase()
    return n.includes(target) || target.includes(n)
  })
  if (found) return found
  // 3. Parole significative
  const words = target.split(/[\s\-_\(\)\/,\.]+/).filter(w => w.length > 2 && !['tabella', 'tabelle', 'millesimale', 'millesimali', 'di', 'per', 'le', 'spese', 'generale', 'generali'].includes(w))
  if (words.length > 0) {
    // 3a. Priorità: Tutte le parole significative corrispondono
    found = tabelleList.find(t => {
      const nWords = String(t.nome || '').toLowerCase().split(/[\s\-_\(\)\/,\.]+/)
      return words.every(w => nWords.includes(w))
    })
    if (found) return found
    // 3b. Fallback: Almeno una parola significativa corrisponde
    found = tabelleList.find(t => {
      const nWords = String(t.nome || '').toLowerCase().split(/[\s\-_\(\)\/,\.]+/)
      return words.some(w => w.length > 1 && nWords.includes(w))
    })
    if (found) return found
  }
  // 4. Fallback: se c'è 1 sola tabella disponibile e il criterio è millesimi/mista
  if (tabelleList.length === 1 && (criterio === 'millesimi' || criterio === 'mista')) {
    return tabelleList[0]
  }
  return null
}

const calcolaRipartizioniBatch = (importoVal, criterio, tabellaId, percentualeMillesimi, importiManualiObj, unitaList, tabelleList) => {
  const importo = parseFloat(importoVal) || 0
  if (!importo || !unitaList?.length) return []

  if (criterio === 'manuale') {
    return unitaList.map(u => {
      const val = parseFloat(importiManualiObj?.[u.id]) || 0
      return {
        unita_id: u.id, interno: u.numero, scala: u.scala, piano: u.piano,
        importo: Number.isFinite(val) ? Math.round(val * 100) / 100 : 0,
        millesimi: null,
        override_manuale: true,
        importo_override: Number.isFinite(val) ? Math.round(val * 100) / 100 : 0,
      }
    })
  }

  if (criterio === 'quota_fissa') {
    const quota = importo / unitaList.length
    return unitaList.map(u => ({
      unita_id: u.id, interno: u.numero, scala: u.scala, piano: u.piano,
      importo: Math.round(quota * 100) / 100, millesimi: null,
    }))
  }

  const tabella = (tabelleList || []).find(t => t.id === tabellaId)
  if (!tabella?.millesimi_unita?.length) return []

  const totMill = tabella.millesimi_unita.reduce((s, m) => s + parseFloat(m.valore || 0), 0)
  if (!totMill) return []

  const importoMill = criterio === 'mista'
    ? importo * ((parseFloat(percentualeMillesimi) || 100) / 100)
    : importo
  const importoFisso = importo - importoMill

  return unitaList.map(u => {
    const mill = tabella.millesimi_unita.find(m => m.unita_id === u.id)
    const vMill = parseFloat(mill?.valore || 0)
    const qMill = (vMill / totMill) * importoMill
    const qFissa = unitaList.length > 0 ? importoFisso / unitaList.length : 0
    return {
      unita_id: u.id, interno: u.numero, scala: u.scala, piano: u.piano,
      importo: Math.round((qMill + qFissa) * 100) / 100,
      millesimi: vMill,
    }
  })
}

export default function SpeseForm({ esercizioId, condominioId, tabelle, unita, documenti, spesaInEdit, onSave, onSaveBatch, onCancel, fromFattura = false, prefillData = null, onRefreshTabelle = null, initialFile = null, initialAiDatiEstratti = null }) {
  const [strutturandoDoc, setStrutturandoDoc] = useState(false)

  const tabelleAssociate = useMemo(() => {
    const list = [...(tabelle || [])]
    const docTabelle = (documenti || []).filter(d => d.tipo === 'tabella_millesimale_doc')
    docTabelle.forEach(d => {
      // Evita duplicati se c'è già una tabella strutturata con lo stesso nome
      if (!list.some(t => t.nome?.toLowerCase() === d.nome?.toLowerCase())) {
        list.push({
          id: `doc_${d.id}`,
          nome: d.nome || d.file_name || 'Documento Tabella',
          criterio: 'millesimi',
          documento_id: d.id,
          millesimi_unita: [],
          is_doc: true
        })
      }
    })
    return list
  }, [tabelle, documenti])

  const handleStrutturaTabellaAI = async (tab) => {
    if (!unita || !unita.length) {
      alert("Nessuna unità censita nel condominio. Configura prima le unità in Anagrafica.")
      return
    }
    setStrutturandoDoc(true)
    try {
      let testo = tab.testo_estratto || ''
      if (!testo && tab.url_storage) {
        const { data: fileData, error: fErr } = await supabase.storage.from('documenti-condominio').download(tab.url_storage)
        if (!fErr && fileData) {
          const base64 = await fileToBase64(fileData)
          const res = await callGeminiDocument(
            `Estrai la tabella millesimale associando le quote al seguente elenco di unità del condominio:\n${JSON.stringify(unita.map(u => ({ id: u.id, numero: u.numero, scala: u.scala, piano: u.piano, tipo: u.tipo })))}\n\nRestituisci ESCLUSIVAMENTE un oggetto JSON: { "nome_tabella": "${tab.nome}", "tipo": "generale", "unita_millesimi": [ { "unita_id": "uuid", "valore": 123.45 } ] }`,
            base64,
            { maxTokens: 2000, mediaType: 'application/pdf', funzione: 'estrai_tabella_millesimale', condominio_id: condominioId }
          )
          testo = res || ''
        }
      }

      const prompt = `Sei un esperto contabile per condomìni.
Hai a disposizione il seguente testo / documento della tabella millesimale:
"""
${testo || tab.nome}
"""

Elenco ufficiale delle unità del condominio nel database:
${JSON.stringify(unita.map(u => ({ id: u.id, numero: u.numero, scala: u.scala, piano: u.piano, tipo: u.tipo })))}

Estrai i millesimi associando esattamente ogni unità (tramite il suo id) al valore numerico dei millesimi corrispondente.
Se una unità non è trovata, assegna valore 0.

Restituisci ESCLUSIVAMENTE un JSON valido di questa struttura:
{
  "nome_tabella": "${tab.nome}",
  "tipo": "generale",
  "unita_millesimi": [
    { "unita_id": "uuid_dell_unita", "valore": 125.50 }
  ]
}`

      const responseText = await callGemini(prompt, { maxTokens: 2500, funzione: 'struttura_tabella_millesimale', condominio_id: condominioId })
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleanJson)

      let tabellaId = tab.is_doc ? null : tab.id
      if (!tabellaId) {
        const { data: nuovaTab, error: errTab } = await supabase
          .from('tabelle_millesimali')
          .insert([{
            condominio_id: condominioId,
            nome: parsed.nome_tabella || tab.nome || 'Tabella Millesimale',
            tipo_lavoro: parsed.tipo || 'generale',
            descrizione: 'Strutturata automaticamente da Documenti via AI'
          }])
          .select()
          .single()
        if (errTab) throw errTab
        tabellaId = nuovaTab.id
      } else {
        await supabase.from('millesimi_unita').delete().eq('tabella_id', tabellaId)
      }

      const righeMillesimi = (parsed.unita_millesimi || [])
        .filter(item => item.unita_id && item.valore !== undefined)
        .map(item => ({
          condominio_id: condominioId,
          tabella_id: tabellaId,
          unita_id: item.unita_id,
          valore: Number(String(item.valore).replace(',', '.')) || 0
        }))

      if (righeMillesimi.length > 0) {
        const { error: errMil } = await supabase.from('millesimi_unita').insert(righeMillesimi)
        if (errMil) throw errMil
      }

      if (onRefreshTabelle) {
        await onRefreshTabelle()
      }
      setField('tabella_millesimale_id', tabellaId)
      alert("Tabella strutturata e salvata con successo nei Millesimi!")
    } catch (err) {
      console.error("Errore strutturazione AI:", err)
      alert("Errore durante la strutturazione automatica: " + (err.message || "Risposta AI non valida"))
    } finally {
      setStrutturandoDoc(false)
    }
  }

  const [form, setForm] = useState({
    esercizio_id: esercizioId,
    condominio_id: condominioId,
    descrizione: '',
    importo: '',
    data_spesa: new Date().toISOString().split('T')[0],
    categoria: 'ordinaria',
    tipo_lavoro: 'ordinario',
    criterio: 'millesimi',
    tabella_millesimale_id: '',
    percentuale_millesimi: 100,
    fornitore: '',
    numero_fattura: '',
    note: '',
    suggerimento_ai: null,
    criterio_override: false,
  })

  const [ripartizioni, setRipartizioni] = useState([])
  // Importi manuali: { [unita_id]: stringa } — modificabili dall'utente
  const [importiManuali, setImportiManuali] = useState({})
  const [fileCaricato, setFileCaricato] = useState(initialFile || null)
  const [aiDatiEstratti, setAiDatiEstratti] = useState(initialAiDatiEstratti || null)


  const [showAiModal, setShowAiModal] = useState(false)
  const [loadingAi, setLoadingAi] = useState(false)
  const [aiSuggerimento, setAiSuggerimento] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  // Rilevamento duplicati
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [forceSave, setForceSave] = useState(false)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)

  // Marketplace Pioneer Invite
  const [partnerSlotFree, setPartnerSlotFree] = useState(false)
  const [partnerPiva, setPartnerPiva] = useState(null)
  const [partnerCategoria, setPartnerCategoria] = useState(null)
  const [partnerProvincia, setPartnerProvincia] = useState(null)
  const [isSendingInvite, setIsSendingInvite] = useState(false)

  // Stato import fattura singola
  const [loadingFattura, setLoadingFattura] = useState(false)
  const [fatturaImportata, setFatturaImportata] = useState(!!initialAiDatiEstratti)
  const [dragOver, setDragOver] = useState(false)
  const [errFattura, setErrFattura] = useState(null)
  const fileInputRef = useRef()
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Stato import batch multi-fattura (fino a 5 file)
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [codaFatture, setCodaFatture] = useState([])
  const [savingBatch, setSavingBatch] = useState(false)

  const avviaLottoFatture = async (filesList) => {
    if (!filesList || !filesList.length) return
    setErrFattura(null)

    let targetFiles = Array.from(filesList)
    if (targetFiles.length > 5) {
      targetFiles = targetFiles.slice(0, 5)
      setErrFattura('Attenzione: sono state accettate le prime 5 fatture (limite massimo per lotto).')
    }

    setIsBatchMode(true)

    const initialQueue = targetFiles.map((file, idx) => ({
      id: `batch_${Date.now()}_${idx}`,
      file,
      nome: file.name,
      stato: 'in_attesa',
      errore: null,
      fileCompresso: null,
      estratto: null,
      form: {
        descrizione: file.name.replace(/\.[^/.]+$/, ""),
        importo: '',
        data_spesa: new Date().toISOString().split('T')[0],
        fornitore: '',
        numero_fattura: '',
        categoria: 'ordinaria',
        criterio: 'millesimi',
        tabella_millesimale_id: '',
        percentuale_millesimi: 100,
        note: '',
      },
      ripartizioni: [],
      importiManuali: {},
      showDetails: false,
    }))

    setCodaFatture(initialQueue)

    for (let i = 0; i < initialQueue.length; i++) {
      if (!isMountedRef.current) return
      const item = initialQueue[i]
      setCodaFatture(prev => prev.map((q, idx) => idx === i ? { ...q, stato: 'elaborazione' } : q))

      try {
        if (item.file.size > 10 * 1024 * 1024) {
          throw new Error('Il file supera 10MB')
        }

        const fileCompresso = await comprimiImmagine(item.file)
        const estratto = await estraiFattura(fileCompresso)

        const CAT_VALIDE = CATEGORIE.map(c => c.value)
        const catSpesa = CAT_VALIDE.includes(estratto.categoria) ? estratto.categoria : 'ordinaria'

        const trovata = trovaTabellaFuzzy(tabelleAssociate, estratto.descrizione || estratto.fornitore, 'millesimi')
        const defaultTabella = tabelleAssociate.find(t => !t.id.startsWith('doc_'))?.id || tabelleAssociate[0]?.id || ''
        const tabId = trovata?.id || defaultTabella

        const formItem = {
          descrizione: estratto.descrizione || item.form.descrizione,
          importo: estratto.importo_totale != null ? String(estratto.importo_totale) : '',
          data_spesa: estratto.data_fattura || item.form.data_spesa,
          fornitore: estratto.fornitore || '',
          numero_fattura: estratto.numero_fattura || '',
          categoria: catSpesa,
          criterio: 'millesimi',
          tabella_millesimale_id: tabId,
          percentuale_millesimi: 100,
          note: estratto.note || '',
        }

        const initialRipartizioni = calcolaRipartizioniBatch(formItem.importo, formItem.criterio, formItem.tabella_millesimale_id, formItem.percentuale_millesimi, {}, unita, tabelleAssociate)

        if (!isMountedRef.current) return
        setCodaFatture(prev => prev.map((q, idx) => idx === i ? {
          ...q,
          stato: 'completato',
          fileCompresso,
          estratto,
          form: formItem,
          ripartizioni: initialRipartizioni,
        } : q))

      } catch (err) {
        console.error(`Errore elaborazione fattura ${item.nome}:`, err)
        if (!isMountedRef.current) return
        setCodaFatture(prev => prev.map((q, idx) => idx === i ? {
          ...q,
          stato: 'errore',
          errore: err.message || 'Estrazione fallita'
        } : q))
      }
    }
  }

  useEffect(() => {
    if (spesaInEdit) {
      setForm({ ...spesaInEdit })
      // Pre-popola gli importi manuali se la spesa in edit è manuale
      if (spesaInEdit.criterio === 'manuale' && Array.isArray(spesaInEdit.ripartizioni)) {
        const init = {}
        spesaInEdit.ripartizioni.forEach(r => {
          init[r.unita_id] = String(r.importo_override ?? r.importo ?? '')
        })
        setImportiManuali(init)
      }
    } else if (prefillData) {
      setForm(prev => ({
        ...prev,
        importo: prefillData.importo_totale != null ? String(prefillData.importo_totale) : (prefillData.importo || prev.importo),
        data_spesa: prefillData.data_fattura || prefillData.data_spesa || prev.data_spesa,
        descrizione: prefillData.descrizione || prev.descrizione,
        fornitore: prefillData.fornitore || prev.fornitore,
        numero_fattura: prefillData.numero_fattura || prev.numero_fattura,
        categoria: prefillData.categoria || prev.categoria,
        note: prefillData.note || prev.note,
      }))
    }
  }, [spesaInEdit, prefillData])

  useEffect(() => {
    if (initialAiDatiEstratti && !spesaInEdit) {
      const CAT_VALIDE = CATEGORIE.map(c => c.value)
      const catSpesa = CAT_VALIDE.includes(initialAiDatiEstratti.categoria) ? initialAiDatiEstratti.categoria : 'altro'
      setForm(f => ({
        ...f,
        descrizione: initialAiDatiEstratti.descrizione || f.descrizione,
        importo: initialAiDatiEstratti.importo_totale != null ? String(initialAiDatiEstratti.importo_totale) : f.importo,
        data_spesa: initialAiDatiEstratti.data_fattura || f.data_spesa,
        fornitore: initialAiDatiEstratti.fornitore || f.fornitore,
        numero_fattura: initialAiDatiEstratti.numero_fattura || f.numero_fattura,
        categoria: catSpesa,
        note: initialAiDatiEstratti.note || f.note,
      }))
      setFatturaImportata(true)
      setFileCaricato(initialFile)
      setAiDatiEstratti(initialAiDatiEstratti)
    }
  }, [initialAiDatiEstratti, initialFile])

  useEffect(() => {
    if (!condominioId || !form.importo || checkingDuplicate) {
      setDuplicateWarning(null)
      return
    }

    const checkDuplicate = async () => {
      setCheckingDuplicate(true)
      try {
        let query = supabase
          .from('fatture_fornitori')
          .select('id, spesa_id, numero_fattura, fornitore, importo_totale, data_fattura')
          .eq('condominio_id', condominioId)
          .eq('importo_totale', parseFloat(form.importo) || 0)

        // Se abbiamo il numero fattura, controlliamo quello
        if (form.numero_fattura?.trim()) {
          query = query.ilike('numero_fattura', form.numero_fattura.trim())
        } else {
          // Altrimenti controlliamo per data e fornitore
          if (form.data_spesa) {
            query = query.eq('data_fattura', form.data_spesa)
          }
          if (form.fornitore?.trim()) {
            query = query.ilike('fornitore', form.fornitore.trim())
          }
        }

        const { data, error } = await query

        if (error) throw error

        if (data && data.length > 0) {
          // Filtriamo via la spesa corrente se siamo in modalità modifica
          const matches = spesaInEdit ? data.filter(d => d.spesa_id !== spesaInEdit.id) : data
          if (matches.length > 0) {
            setDuplicateWarning({
              numero_fattura: matches[0].numero_fattura,
              fornitore: matches[0].fornitore,
              data_fattura: matches[0].data_fattura,
              importo_totale: matches[0].importo_totale
            })
          } else {
            setDuplicateWarning(null)
          }
        } else {
          setDuplicateWarning(null)
        }
      } catch (err) {
        console.error('Errore durante il controllo duplicati:', err)
      } finally {
        setCheckingDuplicate(false)
      }
    }

    const timer = setTimeout(checkDuplicate, 600)
    return () => clearTimeout(timer)
  }, [condominioId, form.importo, form.numero_fattura, form.fornitore, form.data_spesa, spesaInEdit])

  // Controllo slot Pioneer Marketplace per il fornitore estratto dall'AI
  useEffect(() => {
    let isMounted = true;

    const checkPartnerSlot = async (piva, categoria, provincia) => {
      if (!piva || !categoria || !provincia) return
      try {
        const safePiva = String(piva).replace(/\s+/g, '')
        const safeCategoria = String(categoria).toLowerCase()
        const safeProvincia = String(provincia).toUpperCase()

        // 1. Il fornitore è già partner?
        const { data: existing, error: err1 } = await supabase
          .from('fornitori_partner')
          .select('id')
          .eq('partita_iva', safePiva)
          .maybeSingle()
        
        if (err1 || existing) {
          if (isMounted) setPartnerSlotFree(false)
          return
        }

        // 2. Se non lo è, lo slot territoriale per la sua categoria è già occupato da un altro Pioneer?
        const { data: slotOccupato, error: err2 } = await supabase
          .from('fornitori_partner')
          .select('id')
          .eq('categoria', safeCategoria)
          .eq('provincia_esclusiva', safeProvincia)
          .eq('attivo', true)
          .maybeSingle()

        if (isMounted) {
          if (err2 || slotOccupato) {
            setPartnerSlotFree(false) // Slot occupato, esclusiva non disponibile o errore DB
          } else {
            setPartnerPiva(safePiva)
            setPartnerCategoria(safeCategoria)
            setPartnerProvincia(safeProvincia)
            setPartnerSlotFree(true)
          }
        }
      } catch (err) {
        console.error("Errore controllo partner:", err)
        if (isMounted) setPartnerSlotFree(false)
      }
    }

    if (aiDatiEstratti?.partita_iva_fornitore && aiDatiEstratti?.categoria_fornitore && aiDatiEstratti?.provincia_fornitore) {
      checkPartnerSlot(aiDatiEstratti.partita_iva_fornitore, aiDatiEstratti.categoria_fornitore, aiDatiEstratti.provincia_fornitore)
    } else {
      setPartnerSlotFree(false)
    }

    return () => { isMounted = false }
  }, [aiDatiEstratti])

  const handleInvitaMarketplace = async () => {
    const email = prompt(`Inserisci l'email o PEC di ${form.fornitore} per inviare l'invito Pioneer esclusivo:`)
    if (!email || !email.includes('@')) return

    setIsSendingInvite(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const { data: userData } = await supabase.auth.getUser()
      
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invia-comunicazione`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          condominio_id: condominioId,
          destinatari: [{ email, nome: form.fornitore }],
          oggetto: `Invito Esclusivo Marketplace CondoFAST - ${partnerCategoria.toUpperCase()} a ${partnerProvincia}`,
          messaggio: `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h3 style="color: #1e3a8a;">Ciao ${form.fornitore},</h3>
              <p>Il tuo amministratore di fiducia ti ha invitato su <strong>CondoFAST</strong>, il gestionale in cloud per amministratori condominiali.</p>
              <p>Entrando ora puoi diventare il <strong>Pioneer Partner Esclusivo</strong> per la categoria <em>${partnerCategoria.toUpperCase()}</em> nella provincia di <em>${partnerProvincia}</em>.</p>
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin-top: 0;"><strong>Vantaggi dell'esclusiva Pioneer:</strong></p>
                <ul style="margin-bottom: 0;">
                  <li>Non pagherai <strong>NESSUNA COMMISSIONE (0%)</strong> sui lavori affidati dall'amministratore che ti ha invitato.</li>
                  <li>Avrai l'esclusiva sulla tua provincia per ottenere nuovi clienti da altri amministratori.</li>
                </ul>
              </div>
              <p style="text-align: center; margin: 30px 0;">
                <a href="https://condofast.it/fornitori/registrati?sponsor_id=${userData.user?.id}&piva=${partnerPiva}&cat=${partnerCategoria}&prov=${partnerProvincia}" style="background:#7c3aed;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">Accetta l'Invito Pioneer</a>
              </p>
              <p style="font-size: 12px; color: #666; margin-top: 40px; text-align: center;">Questo è un invito automatico generato su richiesta dell'Amministratore tramite CondoFAST.</p>
            </div>
          `,
          tipo: 'invito_marketplace'
        })
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || "Errore sconosciuto")
      }
      alert(`Invito inviato con successo a ${email}!`)
      setPartnerSlotFree(false) // Nascondi il banner dopo aver invitato
    } catch (err) {
      alert("Errore durante l'invio dell'invito: " + err.message)
    } finally {
      setIsSendingInvite(false)
    }
  }

  useEffect(() => {
    if (form.criterio === 'manuale') { calcolaManuale(); return }
    if (!form.importo || !unita?.length) return
    calcolaRipartizioni()
  }, [form.importo, form.criterio, form.tabella_millesimale_id, form.percentuale_millesimi, importiManuali, unita, tabelleAssociate])

  // Auto-seleziona la tabella millesimale di default se ce n'è una sola o se corrisponde a criteri generici
  useEffect(() => {
    if (!form.tabella_millesimale_id && tabelleAssociate.length > 0) {
      const tabelleStrutturate = tabelleAssociate.filter(t => !t.id.startsWith('doc_'))
      
      if (tabelleStrutturate.length === 1) {
        setField('tabella_millesimale_id', tabelleStrutturate[0].id)
      } else if (tabelleStrutturate.length > 1) {
        const generale = tabelleStrutturate.find(t => {
          const n = String(t.nome || '').toLowerCase()
          return n.includes('generale') || n.includes('proprietà') || n.includes('proprietá')
        })
        if (generale) {
          setField('tabella_millesimale_id', generale.id)
        }
      }
    }
  }, [tabelleAssociate, form.tabella_millesimale_id])

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ─── Ripartizione MANUALE ──────────────────────────────────────────────────
  const calcolaManuale = () => {
    setRipartizioni(unita.map(u => {
      const val = parseFloat(importiManuali[u.id]) || 0
      return {
        unita_id: u.id, interno: u.numero, scala: u.scala, piano: u.piano,
        importo: Number.isFinite(val) ? Math.round(val * 100) / 100 : 0,
        millesimi: null,
        override_manuale: true,
        importo_override: Number.isFinite(val) ? Math.round(val * 100) / 100 : 0,
      }
    }))
  }

  const setImportoManuale = (unitaId, v) =>
    setImportiManuali(m => ({ ...m, [unitaId]: v }))

  // TODO: wrappare in useCallback (M1 bug report)
  const calcolaRipartizioni = () => {
    const importo = parseFloat(form.importo)
    if (!importo) return

    if (form.criterio === 'quota_fissa') {
      const quota = importo / unita.length
      setRipartizioni(unita.map(u => ({
        unita_id: u.id, interno: u.numero, scala: u.scala, piano: u.piano,
        importo: Math.round(quota * 100) / 100, millesimi: null,
      })))
      return
    }

    const tabella = tabelleAssociate.find(t => t.id === form.tabella_millesimale_id)
    if (!tabella?.millesimi_unita?.length) { setRipartizioni([]); return }

    const totMill = tabella.millesimi_unita.reduce((s, m) => s + parseFloat(m.valore || 0), 0)
    if (!totMill) { setRipartizioni([]); return }

    const importoMill = form.criterio === 'mista'
      ? importo * (parseFloat(form.percentuale_millesimi) / 100)
      : importo
    const importoFisso = importo - importoMill

    setRipartizioni(unita.map(u => {
      const mill = tabella.millesimi_unita.find(m => m.unita_id === u.id)
      const vMill = parseFloat(mill?.valore || 0)
      const qMill = (vMill / totMill) * importoMill
      const qFissa = unita.length > 0 ? importoFisso / unita.length : 0
      return {
        unita_id: u.id, interno: u.numero, scala: u.scala, piano: u.piano,
        importo: Math.round((qMill + qFissa) * 100) / 100,
        millesimi: vMill,
      }
    }))
  }

  const { canUse } = usePlan()

  // ─── Import da fattura (via estraiFattura / parseFatturaXmlP7m) ────────────────────────
  const elaboraFattura = async (file) => {
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      setErrFattura('Il file supera il limite massimo consentito di 15MB.')
      return
    }

    const tipo = getTipoFile(file)
    if ((tipo === 'xml' || tipo === 'p7m') && !canUse('fatturazione_xml_sdi')) {
      setErrFattura('L\'importazione nativa delle Fatture Elettroniche XML/p7m è riservata al piano Professional.')
      return
    }

    setLoadingFattura(true)
    setErrFattura(null)
    try {
      let estratto = null
      let fileCompresso = file

      if (tipo === 'xml' || tipo === 'p7m') {
        const resXml = await parseFatturaXmlP7m(file)
        estratto = resXml.dati
      } else {
        fileCompresso = await comprimiImmagine(file)
        const res = await estraiFattura(fileCompresso)
        estratto = res
      }

      // Mappa categoria fattura → categoria spesa (set ristretto del form)
      const CAT_VALIDE = CATEGORIE.map(c => c.value)
      const catSpesa = CAT_VALIDE.includes(estratto.categoria) ? estratto.categoria : 'altro'

      setForm(f => ({
        ...f,
        descrizione: estratto.descrizione || f.descrizione,
        importo: estratto.importo_totale != null ? String(estratto.importo_totale) : f.importo,
        data_spesa: estratto.data_fattura || f.data_spesa,
        fornitore: estratto.fornitore || f.fornitore,
        numero_fattura: estratto.numero_fattura || f.numero_fattura,
        categoria: catSpesa,
        note: estratto.note || f.note,
      }))

      setFatturaImportata(true)
      setFileCaricato(fileCompresso)
      setAiDatiEstratti(estratto)
    } catch (e) {
      console.error('Errore estrazione fattura:', e)
      setErrFattura('Impossibile estrarre i dati: ' + e.message)
    } finally {
      setLoadingFattura(false)
    }
  }

  const autoCompilaConservazione = () => {
    setForm(f => ({
      ...f,
      fornitore: 'CondoFAST (Canone Piattaforma)',
      descrizione: 'Servizio Conservazione Sostitutiva 10 Anni e Portale GDPR',
      importo: '36.00',
      categoria: 'ordinaria',
      tipo_lavoro: 'ordinario',
      criterio: 'quota_fissa'
    }))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length === 1) {
      elaboraFattura(files[0])
    } else if (files.length > 1) {
      avviaLottoFatture(files)
    }
  }

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 1) {
      elaboraFattura(files[0])
    } else if (files.length > 1) {
      avviaLottoFatture(files)
    }
  }

  const updateBatchItemForm = (id, field, value) => {
    setCodaFatture(prev => prev.map(item => {
      if (item.id !== id) return item
      const updatedForm = { ...item.form, [field]: value }
      const updatedRipartizioni = calcolaRipartizioniBatch(
        updatedForm.importo,
        updatedForm.criterio,
        updatedForm.tabella_millesimale_id,
        updatedForm.percentuale_millesimi,
        item.importiManuali,
        unita,
        tabelleAssociate
      )
      return {
        ...item,
        form: updatedForm,
        ripartizioni: updatedRipartizioni
      }
    }))
  }

  const updateBatchItemImportoManuale = (id, unitaId, val) => {
    setCodaFatture(prev => prev.map(item => {
      if (item.id !== id) return item
      const updatedImporti = { ...item.importiManuali, [unitaId]: val }
      const updatedRipartizioni = calcolaRipartizioniBatch(
        item.form.importo,
        'manuale',
        item.form.tabella_millesimale_id,
        item.form.percentuale_millesimi,
        updatedImporti,
        unita,
        tabelleAssociate
      )
      return {
        ...item,
        importiManuali: updatedImporti,
        ripartizioni: updatedRipartizioni
      }
    }))
  }

  const toggleBatchItemDetails = (id) => {
    setCodaFatture(prev => prev.map(item => item.id === id ? { ...item, showDetails: !item.showDetails } : item))
  }

  const removeBatchItem = (id) => {
    setCodaFatture(prev => {
      const filtered = prev.filter(item => item.id !== id)
      if (filtered.length === 0) {
        setIsBatchMode(false)
      }
      return filtered
    })
  }

  const handleSalvaBatch = async () => {
    const lottoCompletato = codaFatture.filter(item => item.stato === 'completato')
    if (!lottoCompletato.length) {
      alert('Nessuna fattura estratta con successo nel lotto.')
      return
    }

    for (const item of lottoCompletato) {
      if (!item.form.descrizione?.trim()) {
        alert(`Inserisci una descrizione valida per la fattura: ${item.nome}`)
        return
      }
      if (!item.form.importo || parseFloat(item.form.importo) <= 0) {
        alert(`Inserisci un importo valido per la fattura: ${item.nome}`)
        return
      }
      if (item.form.criterio !== 'quota_fissa' && item.form.criterio !== 'manuale' && !item.form.tabella_millesimale_id) {
        alert(`Seleziona una tabella millesimale per la fattura: ${item.nome}`)
        return
      }
      if (!item.ripartizioni || item.ripartizioni.length === 0) {
        alert(`Impossibile ripartire la spesa per "${item.nome}": verifica che la tabella millesimale contenga quote e unità valide.`)
        return
      }
    }

    setSavingBatch(true)
    try {
      const lottoPayload = lottoCompletato.map(item => ({
        payload: {
          esercizio_id: esercizioId,
          condominio_id: condominioId,
          descrizione: item.form.descrizione,
          importo: parseFloat(item.form.importo),
          data_spesa: item.form.data_spesa,
          categoria: item.form.categoria,
          tipo_lavoro: 'ordinario',
          criterio: item.form.criterio,
          tabella_millesimale_id: item.form.tabella_millesimale_id || null,
          percentuale_millesimi: parseFloat(item.form.percentuale_millesimi) || 100,
          fornitore: item.form.fornitore,
          numero_fattura: item.form.numero_fattura,
          note: item.form.note,
        },
        ripartizioni: item.ripartizioni.map(r => ({
          unita_id: r.unita_id,
          importo: r.importo,
          millesimi_usati: r.millesimi != null ? r.millesimi : null,
          ...(item.form.criterio === 'manuale'
            ? { override_manuale: true, importo_override: r.importo_override ?? r.importo }
            : {}),
        })),
        fileCaricato: item.fileCompresso,
        aiDatiEstratti: item.estratto,
      }))

      if (onSaveBatch) {
        await onSaveBatch(lottoPayload)
      } else {
        for (const spesaData of lottoPayload) {
          await onSave(spesaData.payload, spesaData.ripartizioni, spesaData.fileCaricato, spesaData.aiDatiEstratti)
        }
      }
    } catch (err) {
      console.error('Errore salvataggio batch:', err)
      alert('Errore durante il salvataggio del lotto: ' + (err.message || err))
    } finally {
      setSavingBatch(false)
    }
  }

  // ─── AI suggerimento criterio (firma canonica) ──────────────────────────────
  const chiediAI = async () => {
    if (!form.descrizione.trim()) {
      setErrors({ descrizione: 'Inserisci la descrizione prima di chiedere all\'AI' })
      return
    }
    setLoadingAi(true)
    try {
      const documentiNormativi = documenti
        ?.filter(d => d.testo_estratto && ['regolamento', 'tabella_millesimale_doc', 'verbale', 'contratto', 'altro'].includes(d.tipo))
        .map(d => `--- DOCUMENTO (${d.tipo.toUpperCase()}: ${d.nome_file || 'senza nome'}) ---\n${d.testo_estratto.slice(0, 3500)}`)
        .join('\n\n') || ''
      const listaTabelle = tabelleAssociate.map(t => `- "${t.nome}" (tipo lavoro: ${t.tipo_lavoro || 'ordinario'})`).join('\n') || 'Nessuna tabella millesimale strutturata presente in archivio.'

      const systemPrompt = 'Sei un esperto di diritto condominiale italiano. Suggerisci il criterio di ripartizione per una spesa condominiale. Rispondi SOLO con un JSON valido, nessun testo prima o dopo.'

      const prompt = `SPESA: "${form.descrizione}"
IMPORTO: €${form.importo || 'non specificato'}
TIPO LAVORO: ${form.tipo_lavoro}
TABELLE MILLESIMALI STRUTTURATE DISPONIBILI IN ARCHIVIO:
${listaTabelle}
${documentiNormativi ? `\nDOCUMENTI DEL CONDOMINIO (Regolamento, Tabelle Millesimali, Verbali, ecc.):\n${documentiNormativi}` : ''}

Formato JSON:
{
  "criterio": "millesimi" | "quota_fissa" | "mista",
  "tabella_consigliata": "nome ESATTO della tabella tra quelle disponibili in archivio, oppure il nome indicato nei documenti, o null",
  "percentuale_millesimi": numero tra 0 e 100 (solo per criterio mista),
  "motivazione": "spiegazione in italiano, max 3 frasi, cita articoli di legge, regolamento o tabelle se pertinenti",
  "fonti": ["Regolamento condominiale", "Tabella millesimale", "Art. 1123 c.c."],
  "confidenza": "alta" | "media" | "bassa"
}`

      const risposta = await callGemini(prompt, {
        system: systemPrompt,
        funzione: 'criterio_spesa',
        condominio_id: condominioId,
        maxTokens: 1000,
      })
      const clean = risposta.replace(/```json|```/g, '').trim()
      const sug = JSON.parse(clean)
      setAiSuggerimento(sug)
      setShowAiModal(true)
    } catch (e) {
      console.error('AI error:', e)
      setAiSuggerimento({
        criterio: 'millesimi', tabella_consigliata: null,
        motivazione: 'Impossibile ottenere il suggerimento. Verifica la connessione.',
        fonti: [], confidenza: 'bassa'
      })
      setShowAiModal(true)
    } finally {
      setLoadingAi(false)
    }
  }

  const applicaAiSuggerimento = () => {
    if (!aiSuggerimento) return
    const tabella = trovaTabellaFuzzy(tabelleAssociate, aiSuggerimento.tabella_consigliata, aiSuggerimento.criterio)
    setForm(f => ({
      ...f,
      criterio: aiSuggerimento.criterio,
      tabella_millesimale_id: tabella?.id || f.tabella_millesimale_id,
      percentuale_millesimi: aiSuggerimento.percentuale_millesimi || 100,
      suggerimento_ai: aiSuggerimento,
      criterio_override: false,
    }))
    setShowAiModal(false)
  }

  // ─── Validazione ────────────────────────────────────────────────────────────
  const totaleRipartito = ripartizioni.reduce((s, r) => s + (r.importo || 0), 0)
  const scartoManuale = form.criterio === 'manuale'
    ? Math.round((totaleRipartito - (parseFloat(form.importo) || 0)) * 100) / 100
    : 0

  const validate = () => {
    const e = {}
    if (!form.descrizione.trim()) e.descrizione = 'Campo obbligatorio'
    if (!form.importo || parseFloat(form.importo) <= 0) e.importo = 'Inserisci un importo valido'
    if (!form.data_spesa) e.data_spesa = 'Campo obbligatorio'
    if (form.criterio !== 'quota_fissa' && form.criterio !== 'manuale' && !form.tabella_millesimale_id)
      e.tabella = 'Seleziona una tabella millesimale'
    if (form.criterio === 'manuale' && Math.abs(scartoManuale) > 0.01)
      e.manuale = `La somma degli importi (€${totaleRipartito.toFixed(2)}) deve corrispondere al totale (€${(parseFloat(form.importo) || 0).toFixed(2)}). Scarto: €${scartoManuale.toFixed(2)}`
    if (ripartizioni.length === 0)
      e.ripartizioni = 'Impossibile ripartire la spesa: verifica che la tabella millesimale selezionata contenga valori validi.'
    
    if (duplicateWarning && !forceSave) {
      e.duplicate = 'Rilevato potenziale duplicato. Conferma con il checkbox sotto per salvare comunque.'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSalva = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const { suggerimento_ai, criterio_override, ...formClean } = form
      const payload = {
        ...formClean,
        importo: parseFloat(form.importo),
        percentuale_millesimi: parseFloat(form.percentuale_millesimi) || 100,
        tabella_millesimale_id: form.tabella_millesimale_id || null,
      }
      const ripartDaSalvare = ripartizioni.map(r => ({
        unita_id: r.unita_id,
        importo: r.importo,
        millesimi_usati: r.millesimi != null ? r.millesimi : null,
        ...(form.criterio === 'manuale'
          ? { override_manuale: true, importo_override: r.importo_override ?? r.importo }
          : {}),
      }))
      await onSave(payload, ripartDaSalvare, fileCaricato, aiDatiEstratti)
    } finally {
      setSaving(false)
    }
  }

  const confidenzaColore = { alta: '#10b981', media: '#f59e0b', bassa: '#ef4444' }
  const isManuale = form.criterio === 'manuale'

  if (isBatchMode && codaFatture.length > 0) {
    const completati = codaFatture.filter(item => item.stato === 'completato')
    const inCorso = codaFatture.filter(item => item.stato === 'elaborazione' || item.stato === 'in_attesa')
    const errori = codaFatture.filter(item => item.stato === 'errore')
    const totaleImportoBatch = completati.reduce((sum, item) => sum + (parseFloat(item.form.importo) || 0), 0)

    return (
      <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 28, border: '1px solid var(--border-color)', fontFamily: 'Sora, sans-serif' }}>
        {/* Header Batch */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={20} style={{ color: '#7c3aed' }} /> Inserimento Multi-Fattura Batch AI (Max 5 file)
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
              {inCorso.length > 0
                ? `Elaborazione in corso... (${completati.length} di ${codaFatture.length} fatture estratte)`
                : `Tutte le ${completati.length} fatture sono state elaborate dall'AI. Verifica i dati e salva in 1 click.`}
            </p>
          </div>
          <button
            onClick={() => { setIsBatchMode(false); setCodaFatture([]); }}
            style={{
              background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)',
              borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'Sora, sans-serif'
            }}
          >
            Annulla lotto
          </button>
        </div>

        {/* Progress Bar */}
        {inCorso.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ height: 6, width: '100%', background: 'var(--app-bg)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(completati.length / codaFatture.length) * 100}%`,
                background: 'linear-gradient(90deg, #3b82f6, #7c3aed)',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: '#3b82f6', fontSize: 12 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Estrazione sequenziale AI in corso... ({completati.length}/${codaFatture.length})</span>
            </div>
          </div>
        )}

        {/* Error alert se presenti */}
        {errori.length > 0 && (
          <div style={{ background: '#ef444415', border: '1px solid #ef444433', borderRadius: 10, padding: 12, marginBottom: 16, color: '#ef4444', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>Impossibile estrarre i dati da {errori.length} file (es. file illeggibile). Gli altri file rimangono pronti per il salvataggio.</span>
          </div>
        )}

        {/* Griglia anteprima fatture */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          {codaFatture.map((item, index) => (
            <div
              key={item.id}
              style={{
                background: 'var(--app-bg)',
                borderRadius: 12,
                border: `1px solid ${item.stato === 'errore' ? '#ef444444' : item.stato === 'completato' ? '#10b98144' : 'var(--border-color)'}`,
                padding: 16,
                transition: 'all 0.2s'
              }}
            >
              {/* Header Riga */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: item.stato === 'completato' ? 12 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={18} style={{ color: item.stato === 'completato' ? '#10b981' : item.stato === 'errore' ? '#ef4444' : '#3b82f6' }} />
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
                    #{index + 1} - {item.nome}
                  </span>
                  {item.stato === 'elaborazione' && (
                    <span style={{ fontSize: 11, background: '#3b82f622', color: '#3b82f6', borderRadius: 4, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> In lettura AI...
                    </span>
                  )}
                  {item.stato === 'completato' && (
                    <span style={{ fontSize: 11, background: '#10b98122', color: '#10b981', borderRadius: 4, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Check size={10} /> Estratto
                    </span>
                  )}
                  {item.stato === 'errore' && (
                    <span style={{ fontSize: 11, background: '#ef444422', color: '#ef4444', borderRadius: 4, padding: '2px 6px' }}>
                      Errore
                    </span>
                  )}
                </div>

                <button
                  onClick={() => removeBatchItem(item.id)}
                  title="Rimuovi fattura dal lotto"
                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Form Riga (solo se completato) */}
              {item.stato === 'completato' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1fr 1.5fr 1fr', gap: 10, alignItems: 'center' }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Fornitore</label>
                      <input
                        style={{ ...inputStyle, padding: '6px 8px', fontSize: 13 }}
                        value={item.form.fornitore}
                        placeholder="Fornitore"
                        onChange={e => updateBatchItemForm(item.id, 'fornitore', e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Descrizione *</label>
                      <input
                        style={{ ...inputStyle, padding: '6px 8px', fontSize: 13 }}
                        value={item.form.descrizione}
                        placeholder="Descrizione spesa"
                        onChange={e => updateBatchItemForm(item.id, 'descrizione', e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Importo (€) *</label>
                      <input
                        type="number"
                        step="0.01"
                        style={{ ...inputStyle, padding: '6px 8px', fontSize: 13 }}
                        value={item.form.importo}
                        placeholder="0.00"
                        onChange={e => updateBatchItemForm(item.id, 'importo', e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Data *</label>
                      <input
                        type="date"
                        style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }}
                        value={item.form.data_spesa}
                        onChange={e => updateBatchItemForm(item.id, 'data_spesa', e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Tabella Millesimale *</label>
                      <select
                        style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }}
                        value={item.form.tabella_millesimale_id}
                        onChange={e => updateBatchItemForm(item.id, 'tabella_millesimale_id', e.target.value)}
                      >
                        <option value="">-- Seleziona Tabella --</option>
                        {tabelleAssociate.map(t => (
                          <option key={t.id} value={t.id}>{t.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Criterio</label>
                      <select
                        style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }}
                        value={item.form.criterio}
                        onChange={e => updateBatchItemForm(item.id, 'criterio', e.target.value)}
                      >
                        <option value="millesimi">Millesimi</option>
                        <option value="quota_fissa">Quota Fissa</option>
                        <option value="mista">Mista</option>
                        <option value="manuale">Manuale</option>
                      </select>
                    </div>
                  </div>

                  {/* Pulsante espansione Dettaglio Quote per unità */}
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => toggleBatchItemDetails(item.id)}
                      style={{
                        background: 'transparent', border: 'none', color: '#3b82f6', fontSize: 12,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0
                      }}
                    >
                      {item.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>{item.showDetails ? 'Nascondi dettaglio quote unità' : `Vedi/Modifica quote ripartite (${item.ripartizioni.length} unità)`}</span>
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Totale Ripartito: <strong style={{ color: 'var(--text-primary)' }}>€{(item.ripartizioni.reduce((s, r) => s + (r.importo || 0), 0)).toFixed(2)}</strong>
                    </span>
                  </div>

                  {/* Accordion Dettaglio Quote per unità */}
                  {item.showDetails && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                      {item.ripartizioni.map(r => (
                        <div key={r.unita_id} style={{ background: 'var(--card-bg)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                          <span>Unità {r.interno} (Sc. {r.scala || '-'})</span>
                          {item.form.criterio === 'manuale' ? (
                            <input
                              type="number"
                              step="0.01"
                              style={{ ...inputStyle, width: 80, padding: '2px 6px', fontSize: 12 }}
                              value={item.importiManuali[r.unita_id] ?? r.importo ?? ''}
                              onChange={e => updateBatchItemImportoManuale(item.id, r.unita_id, e.target.value)}
                            />
                          ) : (
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>€{r.importo?.toFixed(2)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Salvataggio Batch */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Totale Lotto ({completati.length} spese): <strong style={{ color: '#10b981', fontSize: 16 }}>€{totaleImportoBatch.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => { setIsBatchMode(false); setCodaFatture([]); }}
              style={{
                background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)',
                borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer', fontFamily: 'Sora, sans-serif'
              }}
            >
              Annulla
            </button>
            <button
              onClick={handleSalvaBatch}
              disabled={savingBatch || completati.length === 0}
              style={{
                background: savingBatch || completati.length === 0 ? '#6b7280' : 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px',
                fontSize: 14, fontWeight: 600, cursor: savingBatch || completati.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Sora, sans-serif'
              }}
            >
              {savingBatch ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={18} />}
              <span>Conferma e Salva {completati.length} {completati.length === 1 ? 'Spesa' : 'Spese'}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 28, border: '1px solid var(--border-color)' }}>
      <h3 style={{ margin: '0 0 24px', color: 'var(--text-primary)', fontSize: 18, fontWeight: 600 }}>
        {spesaInEdit ? 'Modifica spesa' : 'Nuova spesa'}
      </h3>

      {/* ── Drop zone import fattura ── */}
      {!spesaInEdit && (
        <div style={{ marginBottom: 24 }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !loadingFattura && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#7c3aed' : fatturaImportata ? '#10b981' : 'var(--border-color)'}`,
              borderRadius: 10,
              padding: '20px 24px',
              textAlign: 'center',
              cursor: loadingFattura ? 'not-allowed' : 'pointer',
              background: dragOver ? '#7c3aed11' : fatturaImportata ? '#10b98111' : 'var(--app-bg)',
              transition: 'all 0.2s',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.xls,.csv,.txt,.xml,.p7m"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
            {loadingFattura ? (
              <div>
                <Loader2 size={24} style={{ margin: '0 auto 8px', color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
                <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Estrazione dati in corso...</div>
              </div>
            ) : fatturaImportata ? (
              <div>
                <CheckCircle2 size={24} style={{ margin: '0 auto 8px', color: '#10b981' }} />
                <div style={{ color: '#10b981', fontSize: 14, fontWeight: 600 }}>Dati estratti dalla fattura</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                  Verifica e modifica i campi pre-compilati qui sotto
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFatturaImportata(false); setFileCaricato(null); setAiDatiEstratti(null); fileInputRef.current?.click() }}
                  style={{
                    marginTop: 8, background: 'transparent', color: 'var(--text-muted)',
                    border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 12px',
                    fontSize: 12, cursor: 'pointer', fontFamily: 'Sora, sans-serif'
                  }}
                >
                  Carica altra fattura
                </button>
              </div>
            ) : (
              <div>
                <Receipt size={28} style={{ margin: '0 auto 8px', color: 'var(--text-muted)' }} />
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>
                  Trascina le fatture qui oppure clicca per selezionarle (fino a 5 file)
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                  PDF, XML, p7m, immagini, DOCX, Excel · Estrazione nativa SDI o con IA
                </div>
              </div>
            )}
          </div>

          {errFattura && (
            <div style={{
              marginTop: 8, background: '#ef444422', border: '1px solid #ef444444',
              borderRadius: 6, padding: '8px 12px', color: '#ef4444', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} /> <span>{errFattura}</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>oppure compila manualmente</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <button
              type="button"
              onClick={autoCompilaConservazione}
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'Sora, sans-serif'
              }}
            >
              <ShieldCheck size={16} /> Aggiungi Spesa Conservazione Fiscale (36€)
            </button>
          </div>
        </div>
      )}

      {/* ── Campi form ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={labelStyle}>Descrizione *</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              style={{ ...inputStyle, flex: 1, borderColor: errors.descrizione ? '#ef4444' : 'var(--border-color)' }}
              placeholder="Es. Manutenzione ascensore, Pulizia scale..."
              value={form.descrizione}
              onChange={e => setField('descrizione', e.target.value)}
            />
            <button
              type="button"
              onClick={chiediAI}
              disabled={loadingAi}
              title="Chiedi all'AI il criterio di ripartizione"
              style={{
                background: loadingAi ? '#1e3a6e' : '#7c3aed',
                color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 16px', fontSize: 13, fontWeight: 600,
                cursor: loadingAi ? 'not-allowed' : 'pointer',
                fontFamily: 'Sora, sans-serif', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              {loadingAi ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />} {loadingAi ? 'Analisi...' : 'Suggerisci'}
            </button>
          </div>
          {errors.descrizione && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.descrizione}</span>}
        </div>

        <div>
          <label style={labelStyle}>
            Importo (€) * {fatturaImportata && <AiBadge />}
          </label>
          <input
            type="number" step="0.01" min="0"
            style={{ ...inputStyle, borderColor: errors.importo ? '#ef4444' : 'var(--border-color)' }}
            placeholder="0.00"
            value={form.importo}
            onChange={e => setField('importo', e.target.value)}
          />
          {errors.importo && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.importo}</span>}
        </div>

        <div>
          <label style={labelStyle}>Data spesa *</label>
          <input
            type="date"
            style={{ ...inputStyle, borderColor: errors.data_spesa ? '#ef4444' : 'var(--border-color)' }}
            value={form.data_spesa}
            onChange={e => setField('data_spesa', e.target.value)}
          />
        </div>

        <div>
          <label style={labelStyle}>Categoria</label>
          <select style={inputStyle} value={form.categoria} onChange={e => setField('categoria', e.target.value)}>
            {CATEGORIE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Tipo lavoro</label>
          <select style={inputStyle} value={form.tipo_lavoro} onChange={e => setField('tipo_lavoro', e.target.value)}>
            <option value="ordinario">Ordinario</option>
            <option value="straordinario">Straordinario</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Criterio ripartizione</label>
          <select style={inputStyle} value={form.criterio} onChange={e => setField('criterio', e.target.value)}>
            <option value="millesimi">Millesimi</option>
            <option value="quota_fissa">Quota fissa (parti uguali)</option>
            <option value="mista">Mista (millesimi + quota fissa)</option>
            <option value="manuale">Manuale (importi per unità)</option>
          </select>
        </div>

        {form.criterio !== 'quota_fissa' && form.criterio !== 'manuale' && (
          <div>
            <label style={labelStyle}>Tabella millesimale *</label>
            <select
              style={{ ...inputStyle, borderColor: errors.tabella ? '#ef4444' : 'var(--border-color)' }}
              value={form.tabella_millesimale_id}
              onChange={e => setField('tabella_millesimale_id', e.target.value)}
            >
              <option value="">— Seleziona —</option>
              {tabelleAssociate.map(t => (
                <option key={t.id} value={t.id}>{t.nome} ({t.tipo_lavoro})</option>
              ))}
            </select>
            {errors.tabella && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.tabella}</span>}

            {(() => {
              const tabSel = tabelleAssociate.find(t => t.id === form.tabella_millesimale_id)
              if (!tabSel || (!tabSel.is_doc && tabSel.millesimi_unita?.length > 0)) return null
              return (
                <div style={{
                  background: '#8b5cf61a', border: '1px solid #8b5cf666', borderRadius: 8, padding: '12px 16px',
                  marginTop: 10, fontSize: 13, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 10
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={18} style={{ color: '#fbbf24', flexShrink: 0 }} />
                    <span>
                      <strong>{tabSel.nome}</strong> {tabSel.is_doc ? 'è caricata nei Documenti ma non è ancora strutturata nei Millesimi' : 'non ha ancora valori millesimali assegnati alle unità'}.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={strutturandoDoc}
                      onClick={() => handleStrutturaTabellaAI(tabSel)}
                      style={{
                        background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6,
                        padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: strutturandoDoc ? 'not-allowed' : 'pointer',
                        opacity: strutturandoDoc ? 0.7 : 1
                      }}
                    >
                      {strutturandoDoc ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Estrazione AI in corso...</span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Sparkles size={12} /> Struttura automaticamente con AI e Salva</span>
                      )}
                    </button>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      L'AI assegnerà automaticamente le quote alle {unita?.length || 0} unità del condominio.
                    </span>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {form.criterio === 'mista' && (
          <div>
            <label style={labelStyle}>% a millesimi</label>
            <input
              type="number" min="1" max="99"
              style={inputStyle}
              value={form.percentuale_millesimi}
              onChange={e => setField('percentuale_millesimi', e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Il resto ({100 - form.percentuale_millesimi}%) in parti uguali</span>
          </div>
        )}

        <div>
          <label style={labelStyle}>
            Fornitore {fatturaImportata && <AiBadge />}
          </label>
          <input style={inputStyle} placeholder="Es. Rossi Ascensori Srl"
            value={form.fornitore} onChange={e => setField('fornitore', e.target.value)} />
            
          {partnerSlotFree && (
            <div style={{
              marginTop: 8, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px',
              display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#1e3a8a', fontFamily: 'Sora, sans-serif'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Sparkles size={16} style={{ color: '#3b82f6' }} /> Slot Pioneer Libero a {partnerProvincia}!
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                La ditta non è ancora partner CondoFAST. Nessun <strong>{partnerCategoria}</strong> ha ancora preso l'esclusiva nella provincia di <strong>{partnerProvincia}</strong>.
              </div>
              <button
                type="button"
                onClick={handleInvitaMarketplace}
                disabled={isSendingInvite}
                style={{
                  background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px',
                  fontSize: 12, fontWeight: 600, cursor: isSendingInvite ? 'not-allowed' : 'pointer', alignSelf: 'flex-start',
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                {isSendingInvite ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Bot size={12} />}
                {isSendingInvite ? 'Invio in corso...' : 'Invita nel Marketplace (Commissioni 0%)'}
              </button>
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>
            N. Fattura {fatturaImportata && <AiBadge />}
          </label>
          <input style={inputStyle} placeholder="Es. 2024/0042"
            value={form.numero_fattura} onChange={e => setField('numero_fattura', e.target.value)} />
        </div>

        <div style={{ gridColumn: '1/-1' }}>
          <label style={labelStyle}>Note</label>
          <textarea
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            placeholder="Note aggiuntive..."
            value={form.note}
            onChange={e => setField('note', e.target.value)}
          />
        </div>
      </div>

      {/* ── Griglia MANUALE editabile ── */}
      {isManuale && (
        <div style={{ marginTop: 24 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 10, fontWeight: 600 }}>
            Importi per unità ({unita.length}) — inserisci manualmente la quota di ciascuna unità
          </div>
          <div style={{
            background: 'var(--app-bg)', borderRadius: 8, border: '1px solid var(--border-color)',
            maxHeight: 260, overflowY: 'auto'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--card-bg)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>Interno</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>Piano</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', width: 160 }}>Importo €</th>
                </tr>
              </thead>
              <tbody>
                {unita.map((u, i) => (
                  <tr key={u.id} style={{ borderTop: i > 0 ? '1px solid var(--border-color-2)' : 'none' }}>
                    <td style={{ padding: '7px 12px', color: 'var(--text-primary)' }}>
                      {u.numero || '—'}{u.scala ? ` (Sc. ${u.scala})` : ''}
                    </td>
                    <td style={{ padding: '7px 12px', color: 'var(--text-secondary)' }}>{u.piano ?? '—'}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                      <input
                        type="number" step="0.01" min="0"
                        style={{ ...inputStyle, padding: '6px 10px', textAlign: 'right', maxWidth: 140 }}
                        placeholder="0.00"
                        value={importiManuali[u.id] ?? ''}
                        onChange={e => setImportoManuale(u.id, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td colSpan={2} style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>
                    Totale ripartito
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700,
                    color: Math.abs(scartoManuale) > 0.01 ? '#ef4444' : '#10b981' }}>
                    €{totaleRipartito.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {Math.abs(scartoManuale) > 0.01 ? (
            <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>
              Scarto rispetto al totale (€{(parseFloat(form.importo) || 0).toFixed(2)}): €{scartoManuale.toFixed(2)}
            </div>
          ) : (
            (parseFloat(form.importo) > 0) && (
              <div style={{ color: '#10b981', fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={14} /> La somma corrisponde al totale
              </div>
            )
          )}
          {errors.manuale && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{errors.manuale}</div>}
        </div>
      )}

      {/* Anteprima ripartizioni (criteri automatici) */}
      {!isManuale && ripartizioni.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 10, fontWeight: 600 }}>
            Anteprima ripartizione ({ripartizioni.length} unità)
          </div>
          <div style={{
            background: 'var(--app-bg)', borderRadius: 8, border: '1px solid var(--border-color)',
            maxHeight: 200, overflowY: 'auto'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--card-bg)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>Interno</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>Piano</th>
                  {form.criterio !== 'quota_fissa' && (
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>Millesimi</th>
                  )}
                  <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>Quota €</th>
                </tr>
              </thead>
              <tbody>
                {ripartizioni.map((r, i) => (
                  <tr key={r.unita_id} style={{ borderTop: i > 0 ? '1px solid var(--border-color-2)' : 'none' }}>
                    <td style={{ padding: '7px 12px', color: 'var(--text-primary)' }}>
                      {r.interno || '—'}{r.scala ? ` (Sc. ${r.scala})` : ''}
                    </td>
                    <td style={{ padding: '7px 12px', color: 'var(--text-secondary)' }}>{r.piano ?? '—'}</td>
                    {form.criterio !== 'quota_fissa' && (
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                        {r.millesimi?.toFixed(2) || '—'}
                      </td>
                    )}
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                      €{r.importo.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td colSpan={form.criterio !== 'quota_fissa' ? 3 : 2} style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>
                    Totale
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 700 }}>
                    €{ripartizioni.reduce((s, r) => s + r.importo, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Rilevamento potenziale duplicato */}
      {duplicateWarning && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          fontSize: 13,
          color: '#fbbf24',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            <AlertTriangle size={16} />
            <span>Rilevato potenziale duplicato nel database</span>
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Esiste già una fattura di {duplicateWarning.importo_totale}€ da "{duplicateWarning.fornitore || 'Fornitore sconosciuto'}"{duplicateWarning.numero_fattura ? ` (Num. ${duplicateWarning.numero_fattura})` : ''} del {new Date(duplicateWarning.data_fattura).toLocaleDateString('it-IT')}.
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, cursor: 'pointer', userSelect: 'none', color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={forceSave}
              onChange={(e) => setForceSave(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <span>Forza salvataggio (confermo che non si tratta di un duplicato)</span>
          </label>
        </div>
      )}

      {/* Azioni */}
      {errors.ripartizioni && (
        <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16, background: '#ef444410', padding: '10px 14px', borderRadius: 8, border: '1px solid #ef444430', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} /> <span>{errors.ripartizioni}</span>
        </div>
      )}
      {errors.duplicate && (
        <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16, background: '#ef444410', padding: '10px 14px', borderRadius: 8, border: '1px solid #ef444430', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} /> <span>{errors.duplicate}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 28 }}>
        <button onClick={onCancel} style={{
          background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer',
          fontFamily: 'Sora, sans-serif'
        }}>Annulla</button>
        <button
          onClick={handleSalva}
          disabled={saving}
          style={{
            background: saving ? '#1e3a6e' : '#2563eb', color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Sora, sans-serif'
          }}
        >
          {saving ? 'Salvataggio...' : 'Salva spesa'}
        </button>
      </div>

      {/* Modal AI */}
      {showAiModal && aiSuggerimento && (
        <div style={{
          position: 'fixed', inset: 0, background: '#00000099', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: 'var(--card-bg)', borderRadius: 16, padding: 32, maxWidth: 540,
            width: '100%', border: '1px solid #7c3aed66'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Bot size={28} style={{ color: '#8b5cf6' }} />
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17 }}>Suggerimento AI</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>
                  Basato su regolamento, tabelle millesimali e Codice Civile
                </p>
              </div>
            </div>

            <div style={{
              background: 'var(--app-bg)', borderRadius: 8, padding: '10px 14px',
              marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)'
            }}>
              Spesa: <strong style={{ color: 'var(--text-primary)' }}>{form.descrizione}</strong>
              {form.importo && <span> · €{parseFloat(form.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 8 }}>Criterio suggerito</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{
                  background: '#7c3aed22', color: '#7c3aed', borderRadius: 8,
                  padding: '8px 16px', fontSize: 15, fontWeight: 700
                }}>
                  {aiSuggerimento.criterio === 'millesimi' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileSpreadsheet size={14} /> Millesimi</span>
                  ) : aiSuggerimento.criterio === 'quota_fissa' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Scale size={14} /> Quota fissa</span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Split size={14} /> Mista</span>
                  )}
                </span>
                {aiSuggerimento.tabella_consigliata && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    Tabella: <strong style={{ color: 'var(--text-secondary)' }}>{aiSuggerimento.tabella_consigliata}</strong>
                  </span>
                )}
                {aiSuggerimento.criterio === 'mista' && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {aiSuggerimento.percentuale_millesimi}% millesimi
                  </span>
                )}
              </div>
            </div>

            {aiSuggerimento.tabella_consigliata && !trovaTabellaFuzzy(tabelleAssociate, aiSuggerimento.tabella_consigliata, aiSuggerimento.criterio) && (
              <div style={{
                background: '#f59e0b1a', border: '1px solid #f59e0b66', borderRadius: 8, padding: '10px 14px',
                marginBottom: 16, fontSize: 12, color: 'var(--sepa-yellow)', display: 'flex', alignItems: 'center', gap: 8
              }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>
                  La tabella consigliata "<strong>{aiSuggerimento.tabella_consigliata}</strong>" non corrisponde a nessuna tabella strutturata in sezione Millesimi. Valuta se crearla o selezionare manualmente la tabella.
                </span>
              </div>
            )}

            <div style={{
              background: 'var(--app-bg)', borderRadius: 8, padding: '14px 16px',
              marginBottom: 16, borderLeft: '3px solid #7c3aed'
            }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>Motivazione</div>
              <p style={{ color: 'var(--text-primary)', margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                {aiSuggerimento.motivazione}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {aiSuggerimento.fonti?.map((f, i) => (
                  <span key={i} style={{
                    background: 'var(--card-bg)', color: 'var(--text-muted)', borderRadius: 4,
                    padding: '3px 8px', fontSize: 11, border: '1px solid var(--border-color)'
                  }}>{f}</span>
                ))}
              </div>
              <span style={{
                background: (confidenzaColore[aiSuggerimento.confidenza] || '#6b7280') + '22',
                color: confidenzaColore[aiSuggerimento.confidenza] || '#6b7280',
                borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600
              }}>
                Confidenza {aiSuggerimento.confidenza}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setShowAiModal(false); setField('criterio_override', true) }}
                style={{
                  flex: 1, background: 'transparent', color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)', borderRadius: 8,
                  padding: '11px 16px', fontSize: 14, cursor: 'pointer',
                  fontFamily: 'Sora, sans-serif'
                }}
              >
                Scegli manualmente
              </button>
              <button
                onClick={applicaAiSuggerimento}
                style={{
                  flex: 1, background: '#7c3aed', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '11px 16px', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Sora, sans-serif',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}
              >
                <Check size={16} /> Usa questo criterio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}