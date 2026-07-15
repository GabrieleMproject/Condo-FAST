import { useState, useEffect, useRef, useMemo } from 'react'
import { callGemini, callGeminiDocument } from '../lib/geminiClient'
import { estraiFattura, fileToBase64 } from '../lib/fileExtractor'
import { supabase } from '../lib/supabaseClient'
import { CheckCircle2, Receipt, AlertTriangle, Bot, Sparkles, Check, Scale, Split, Loader2, FileSpreadsheet } from 'lucide-react'

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

export default function SpeseForm({ esercizioId, condominioId, tabelle, unita, documenti, spesaInEdit, onSave, onCancel, fromFattura = false, prefillData = null, onRefreshTabelle = null }) {
  const [strutturandoDoc, setStrutturandoDoc] = useState(false)

  const tabelleAssociate = useMemo(() => {
    const list = [...(tabelle || [])]
    const docTabelle = (documenti || []).filter(d => d.tipo === 'tabella_millesimale_doc')
    docTabelle.forEach(d => {
      const exists = list.some(t => String(t.nome || '').trim().toLowerCase() === String(d.nome || '').trim().toLowerCase())
      if (!exists) {
        list.push({
          id: `doc_${d.id}`,
          nome: d.nome || 'Tabella da Documenti',
          tipo_lavoro: 'da Documenti',
          is_doc: true,
          doc_id: d.id,
          testo_estratto: d.testo_estratto,
          url_storage: d.url_storage
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
  const [fileCaricato, setFileCaricato] = useState(null)
  const [aiDatiEstratti, setAiDatiEstratti] = useState(null)


  const [showAiModal, setShowAiModal] = useState(false)
  const [loadingAi, setLoadingAi] = useState(false)
  const [aiSuggerimento, setAiSuggerimento] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  // Stato import fattura
  const [loadingFattura, setLoadingFattura] = useState(false)
  const [fatturaImportata, setFatturaImportata] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [errFattura, setErrFattura] = useState(null)
  const fileInputRef = useRef()

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
        importo: prefillData.importo || prev.importo,
        data_spesa: prefillData.data_spesa || prev.data_spesa,
        descrizione: prefillData.descrizione || prev.descrizione,
        fornitore: prefillData.fornitore || prev.fornitore,
      }))
    }
  }, [spesaInEdit, prefillData])

  useEffect(() => {
    if (form.criterio === 'manuale') { calcolaManuale(); return }
    if (!form.importo || !unita?.length) return
    calcolaRipartizioni()
  }, [form.importo, form.criterio, form.tabella_millesimale_id, form.percentuale_millesimi, importiManuali, unita])

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ─── Ripartizione MANUALE ──────────────────────────────────────────────────
  const calcolaManuale = () => {
    setRipartizioni(unita.map(u => {
      const val = parseFloat(importiManuali[u.id])
      return {
        unita_id: u.id, interno: u.interno, piano: u.piano,
        importo: Number.isFinite(val) ? Math.round(val * 100) / 100 : 0,
        millesimi: null,
        override_manuale: true,
        importo_override: Number.isFinite(val) ? Math.round(val * 100) / 100 : 0,
      }
    }))
  }

  const setImportoManuale = (unitaId, v) =>
    setImportiManuali(m => ({ ...m, [unitaId]: v }))

  const calcolaRipartizioni = () => {
    const importo = parseFloat(form.importo)
    if (!importo) return

    if (form.criterio === 'quota_fissa') {
      const quota = importo / unita.length
      setRipartizioni(unita.map(u => ({
        unita_id: u.id, interno: u.interno, piano: u.piano,
        importo: Math.round(quota * 100) / 100, millesimi: null,
      })))
      return
    }

    const tabella = tabelleAssociate.find(t => t.id === form.tabella_millesimale_id)
    if (!tabella?.millesimi_unita?.length) { setRipartizioni([]); return }

    const totMill = tabella.millesimi_unita.reduce((s, m) => s + parseFloat(m.valore || 0), 0)
    if (!totMill) return

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
        unita_id: u.id, interno: u.interno, piano: u.piano,
        importo: Math.round((qMill + qFissa) * 100) / 100,
        millesimi: vMill,
      }
    }))
  }

 // ─── Import da fattura (via estraiFattura — fix #10) ────────────────────────
  const elaboraFattura = async (file) => {
    if (!file) return
    setLoadingFattura(true)
    setErrFattura(null)
    try {
      const estratto = await estraiFattura(file)

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
      setFileCaricato(file)
      setAiDatiEstratti(estratto)
    } catch (e) {
      console.error('Errore estrazione fattura:', e)
      setErrFattura('Impossibile estrarre i dati. Verifica il file e riprova.')
    } finally {
      setLoadingFattura(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) elaboraFattura(file)
  }

  const handleFileInput = (e) => {
    const file = e.target.files?.[0]
    if (file) elaboraFattura(file)
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
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSalva = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        importo: parseFloat(form.importo),
        percentuale_millesimi: parseFloat(form.percentuale_millesimi) || 100,
        tabella_millesimale_id: form.tabella_millesimale_id || null,
      }
      const ripartDaSalvare = ripartizioni.map(r => ({
        unita_id: r.unita_id,
        importo: r.importo,
        millesimi_usati: r.millesimi || null,
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
              accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.xls,.csv,.txt"
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
                  Trascina la fattura qui oppure clicca per selezionarla
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                  PDF, immagine, DOCX, Excel · L'AI compilerà automaticamente i campi
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
          <label style={labelStyle}>Importo (€) *</label>
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
          <label style={labelStyle}>Fornitore</label>
          <input style={inputStyle} placeholder="Es. Rossi Ascensori Srl"
            value={form.fornitore} onChange={e => setField('fornitore', e.target.value)} />
        </div>

        <div>
          <label style={labelStyle}>N. Fattura</label>
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
                    <td style={{ padding: '7px 12px', color: 'var(--text-primary)' }}>{u.interno || u.numero || '—'}</td>
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
                    <td style={{ padding: '7px 12px', color: 'var(--text-primary)' }}>{r.interno || '—'}</td>
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

      {/* Azioni */}
      {errors.ripartizioni && (
        <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16, background: '#ef444410', padding: '10px 14px', borderRadius: 8, border: '1px solid #ef444430', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} /> <span>{errors.ripartizioni}</span>
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