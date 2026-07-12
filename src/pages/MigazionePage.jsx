// src/pages/MigazionePage.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useCondomini } from '../hooks/useCondomini'
import toast from 'react-hot-toast'
import { classificaEStraiFileGestionale, aggregaDatiGestionale, validaMimeType } from '../lib/fileExtractor'
import { User, Home, Calculator, ClipboardList, CreditCard, Coins, Folder, HelpCircle, Users, Check, AlertTriangle, Play, CheckCircle2, ArrowRight, Loader2, XCircle, Clock, Minus, Plus, Settings, X, FileText } from 'lucide-react'

// ─── Palette dark ─────────────────────────────────────────────
const C = {
  bg: '#0f172a',
  card: '#1e293b',
  cardLight: '#253047',
  border: 'var(--border-color)',
  borderFocus: '#6366f1',
  text: 'var(--text-primary)',
  muted: '#94a3b8',
  accent: '#6366f1',
  accentHover: '#4f46e5',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  errorBg: 'rgba(239,68,68,0.12)',
  successBg: 'rgba(34,197,94,0.12)',
  warningBg: 'rgba(245,158,11,0.12)',
}

const TIPO_BADGE = {
  anagrafica:   { label: 'Anagrafica',   bg: 'rgba(99,102,241,0.2)',  color: '#a5b4fc', icon: User },
  unita:        { label: 'Unità',         bg: 'rgba(34,197,94,0.2)',  color: '#86efac', icon: Home },
  millesimi:    { label: 'Millesimi',     bg: 'rgba(245,158,11,0.2)', color: '#fcd34d', icon: Calculator },
  spese:        { label: 'Spese',         bg: 'rgba(239,68,68,0.2)',  color: '#fca5a5', icon: ClipboardList },
  rate:         { label: 'Rate',          bg: 'rgba(59,130,246,0.2)', color: '#93c5fd', icon: CreditCard },
  saldo_cassa:  { label: 'Saldi',         bg: 'rgba(16,185,129,0.2)', color: '#6ee7b7', icon: Coins },
  misto:        { label: 'Misto',         bg: 'rgba(139,92,246,0.2)', color: '#c4b5fd', icon: Folder },
  sconosciuto:  { label: 'Sconosciuto',   bg: 'rgba(100,116,139,0.2)',color: 'var(--text-secondary)', icon: HelpCircle },
}

const BLOCCHI_DEF = [
  { key: 'persone',        label: 'Anagrafica condòmini', icon: Users, campi: ['cognome','nome','codice_fiscale','email','telefono','ruolo','unita_rif'] },
  { key: 'unita',          label: 'Unità',                  icon: Home, campi: ['numero','tipo','scala','piano','mq','proprietario_nome','proprietario_cognome'] },
  { key: 'millesimi',      label: 'Millesimi',              icon: Calculator, campi: ['tabella','unita_rif','valore','proprietario_nome'] },
  { key: 'saldi_iniziali', label: 'Saldi iniziali',         icon: Coins, campi: ['anno','unita_rif','proprietario_nome','saldo'] },
  { key: 'spese',          label: 'Spese',                  icon: ClipboardList, campi: ['anno','data','descrizione','categoria','importo','fornitore'] },
  { key: 'rate',           label: 'Rate',                   icon: CreditCard, campi: ['anno','numero_rata','scadenza','unita_rif','importo','importo_pagato','stato'] },
]

const BLOCCO_STATE_INIT = () => Object.fromEntries(BLOCCHI_DEF.map(b => [b.key, true]))

// ─── Componente step indicator ─────────────────────────────────
function StepIndicator({ step, total }) {
  const labels = ['Condominio', 'Carica file', 'Revisione', 'Importazione', 'Report']
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 36 }}>
      {labels.map((label, i) => {
        const num = i + 1
        const isActive = num === step
        const isDone = num < step
        return (
          <div key={num} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: isDone ? C.success : isActive ? C.accent : C.card,
                border: `2px solid ${isDone ? C.success : isActive ? C.accent : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14,
                color: isDone || isActive ? '#fff' : C.muted,
                transition: 'all 0.3s',
                boxShadow: isActive ? `0 0 0 4px rgba(99,102,241,0.2)` : 'none',
              }}>
                {isDone ? '✓' : num}
              </div>
              <span style={{ fontSize: 11, color: isActive ? C.text : C.muted, whiteSpace: 'nowrap', fontWeight: isActive ? 600 : 400 }}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div style={{
                width: 48, height: 2,
                background: num < step ? C.success : C.border,
                margin: '0 4px', marginBottom: 22, transition: 'background 0.3s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────
const formattaData = (d) => (d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleDateString('it-IT') : '—')
const fmt = (n) => typeof n === 'number' ? n.toLocaleString('it-IT', { minimumFractionDigits: 2 }) : (n ?? '—')

function Badge({ label, bg, color, icon: Icon }) {
  return (
    <span style={{ background: bg, color, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {Icon && <Icon size={12} />}
      <span>{label}</span>
    </span>
  )
}
function renderStatoImportIcon(stato, size = 20) {
  switch (stato) {
    case 'in_corso':
      return <Loader2 size={size} style={{ color: C.warning, animation: 'spin 1s linear infinite' }} />;
    case 'completato':
      return <CheckCircle2 size={size} style={{ color: C.success }} />;
    case 'errore':
      return <XCircle size={size} style={{ color: C.error }} />;
    case 'saltato':
      return <Minus size={size} style={{ color: C.muted }} />;
    case 'attesa':
    default:
      return <Clock size={size} style={{ color: C.muted }} />;
  }
}
// ─── Componente principale ────────────────────────────────────
export default function MigazionePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { condomini, loading: loadingCond, createCondominio } = useCondomini()

  // Step
  const [step, setStep] = useState(1)
  const [fadeIn, setFadeIn] = useState(true)

  // Step 1
  const [condominioId, setCondominioId] = useState('')
  const [nuovoCondo, setNuovoCondo] = useState(false)
  const [nomeNuovo, setNomeNuovo] = useState('')
  const [indirizzoNuovo, setIndirizzoNuovo] = useState('')
  const [creandoCondo, setCreandoCondo] = useState(false)

  // Step 2
  const [files, setFiles] = useState([]) // [{file, id, analisi: null|oggetto, errore: null|string, loading: bool}]
  const [gestionale, setGestionale] = useState('')
  const [analizzando, setAnalizzando] = useState(false)
  const [progressLog, setProgressLog] = useState([])
  const [daneaInfo, setDaneaInfo] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  // Step 3
  const [datiAggregati, setDatiAggregati] = useState(null)
  const [blocchiAbilitati, setBlocchiAbilitati] = useState(BLOCCO_STATE_INIT())
  const [conflitti, setConflitti] = useState({}) // {key: {id: azione}}
  const [conflittiInfo, setConflittiInfo] = useState({}) // {key: [{item, existing, action}]}
  const [editRows, setEditRows] = useState({}) // {key: {idx: {campo: val}}}
  const [openAccordion, setOpenAccordion] = useState({})
  const [caricandoConflitti, setCaricandoConflitti] = useState(false)

  // Step 4
  const [progressoImport, setProgressoImport] = useState({}) // {key: {stato, created, updated, skipped, errors: []}}
  const [importLog, setImportLog] = useState([])

  // Step 5
  const [riepilogo, setRiepilogo] = useState({})
  const [condominioImportatoId, setCondominioImportatoId] = useState('')

  // ─── Navigazione step con fade ─────────────────────────────
  const goToStep = useCallback((n) => {
    setFadeIn(false)
    setTimeout(() => { setStep(n); setFadeIn(true) }, 220)
  }, [])

  // ─── STEP 1 — Crea condominio ───────────────────────────────
  async function handleCreaCondominio() {
    if (!nomeNuovo.trim()) { toast.error('Inserisci il nome del condominio'); return }
    setCreandoCondo(true)
    try {
      const result = await createCondominio({ nome: nomeNuovo.trim(), indirizzo: indirizzoNuovo.trim() })
      if (result?.id) {
        setCondominioId(result.id)
        setNuovoCondo(false)
        toast.success('Condominio creato!')
      } else {
        toast.error('Errore nella creazione del condominio')
      }
    } catch (e) {
      toast.error('Errore: ' + (e.message || e))
    } finally {
      setCreandoCondo(false)
    }
  }

  // ─── STEP 2 — Drag & Drop + Upload ─────────────────────────
  function aggiungiFiles(newFiles) {
    const valid = Array.from(newFiles).filter(f => {
      if (!validaMimeType(f)) {
        toast.error(`File non supportato: ${f.name}`)
        return false
      }
      return true
    })
    setFiles(prev => [
      ...prev,
      ...valid.map(f => ({ file: f, id: `${f.name}-${Date.now()}-${Math.random()}`, analisi: null, errore: null, loading: false }))
    ])
  }

  function rimuoviFile(id) {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    aggiungiFiles(e.dataTransfer.files)
  }

  async function analizzaFiles() {
    if (!files.length) return
    setAnalizzando(true)
    setProgressLog([])
    const results = []
    let gestRilevato = ''

    const updatedFiles = [...files]
    for (let i = 0; i < files.length; i++) {
      const item = files[i]
      updatedFiles[i] = { ...item, loading: true, errore: null }
      setFiles([...updatedFiles])
      setProgressLog(prev => [...prev, `Analisi file ${i + 1}/${files.length}: ${item.file.name}...`])
      try {
        const res = await classificaEStraiFileGestionale(item.file)
        updatedFiles[i] = { ...updatedFiles[i], analisi: res, loading: false }
        if (res?.gestionale && !gestRilevato) gestRilevato = res.gestionale
        results.push(res)
        setProgressLog(prev => [...prev, `[OK] ${item.file.name} — tipo: ${res?.tipo || 'sconosciuto'}`])
      } catch (e) {
        updatedFiles[i] = { ...updatedFiles[i], errore: e.message || 'Errore analisi', loading: false }
        setProgressLog(prev => [...prev, `[ERRORE] ${item.file.name} — ${e.message || 'errore'}`])
        results.push(null)
      }
      setFiles([...updatedFiles])
    }

    const validResults = results.filter(Boolean)
    const aggregati = aggregaDatiGestionale(validResults)
    setDatiAggregati(aggregati)
    if (gestRilevato) setGestionale(gestRilevato)
    setAnalizzando(false)
    toast.success('Analisi completata!')
    await rilevaDupliciDB(aggregati, condominioId)
    goToStep(3)
  }

  // ─── STEP 3 — Rileva conflitti DB ──────────────────────────
  async function rilevaDupliciDB(aggregati, condId) {
    if (!aggregati || !user?.id) return
    setCaricandoConflitti(true)
    try {
      const { data: personeEsistenti } = await supabase
        .from('persone')
        .select('id, nome, cognome, codice_fiscale')
        .eq('user_id', user.id)

      const { data: unitaEsistenti } = await supabase
        .from('unita')
        .select('id, numero')
        .eq('condominio_id', condId)

      const conflittiNew = {}
      const conflittiInfoNew = {}

      // Persone
      if (aggregati.persone?.length) {
        const conflicts = []
        for (const p of aggregati.persone) {
          const match = (personeEsistenti || []).find(e =>
            (p.codice_fiscale && e.codice_fiscale && p.codice_fiscale.toUpperCase() === e.codice_fiscale.toUpperCase()) ||
            (`${p.nome}${p.cognome}`.toLowerCase() === `${e.nome}${e.cognome}`.toLowerCase())
          )
          if (match) conflicts.push({ item: p, existing: match, action: 'aggiorna' })
        }
        if (conflicts.length) {
          conflittiInfoNew['persone'] = conflicts
          conflittiNew['persone'] = Object.fromEntries(conflicts.map((c, i) => [i, 'aggiorna']))
        }
      }

      // Unità
      if (aggregati.unita?.length) {
        const conflicts = []
        for (const u of aggregati.unita) {
          const match = (unitaEsistenti || []).find(e =>
            String(u.numero).trim().toLowerCase() === String(e.numero).trim().toLowerCase()
          )
          if (match) conflicts.push({ item: u, existing: match, action: 'aggiorna' })
        }
        if (conflicts.length) {
          conflittiInfoNew['unita'] = conflicts
          conflittiNew['unita'] = Object.fromEntries(conflicts.map((c, i) => [i, 'aggiorna']))
        }
      }

      setConflitti(conflittiNew)
      setConflittiInfo(conflittiInfoNew)
    } catch {
      // Non bloccare per errore read-only
    } finally {
      setCaricandoConflitti(false)
    }
  }

  function setAzioneConflitto(blocco, idx, action) {
    setConflitti(prev => ({ ...prev, [blocco]: { ...(prev[blocco] || {}), [idx]: action } }))
  }

  function getRigheMillesimi(aggregati) {
    if (!aggregati?.millesimi?.length) return []
    return aggregati.millesimi.flatMap(t =>
      (t.righe || []).map(r => ({ tabella: t.tabella, ...r }))
    )
  }

  function getRowsForBlocco(key, dati) {
    if (!dati) return []
    if (key === 'millesimi') return getRigheMillesimi(dati)
    return dati[key] || []
  }

  // ─── STEP 4 — Import FK-safe ─────────────────────────────
  async function eseguiImport() {
    goToStep(4)
    const progresso = {}
    BLOCCHI_DEF.forEach(b => {
      progresso[b.key] = { stato: 'attesa', created: 0, updated: 0, skipped: 0, errors: [] }
    })
    setProgressoImport({ ...progresso })

    const log = []
    const addLog = (msg) => { log.push(msg); setImportLog([...log]) }

    const { data: { user: u } } = await supabase.auth.getUser()
    const adminId = u?.id
    const condId = condominioId
    const dati = datiAggregati

    const idMap = {
      persone: {},    // unita_rif o cf → persona_id
      unita: {},      // numero → unita_id
      esercizi: {},   // anno → esercizio_id
      tabelle: {},    // tabella_nome → tabella_id
    }

    const setStato = (key, stato) => {
      setProgressoImport(prev => ({ ...prev, [key]: { ...prev[key], stato } }))
    }
    const incr = (key, campo) => {
      setProgressoImport(prev => ({
        ...prev, [key]: { ...prev[key], [campo]: (prev[key][campo] || 0) + 1 }
      }))
    }
    const addError = (key, msg) => {
      setProgressoImport(prev => ({
        ...prev, [key]: { ...prev[key], errors: [...prev[key].errors, msg] }
      }))
    }

    // ── 1. Esercizi ────────────────────────────────────────
    const anniUnici = new Set()
    ;(dati?.spese || []).forEach(s => s.anno && anniUnici.add(Number(s.anno)))
    ;(dati?.rate || []).forEach(r => r.anno && anniUnici.add(Number(r.anno)))
    ;(dati?.saldi_iniziali || []).forEach(s => s.anno && anniUnici.add(Number(s.anno)))

    if (anniUnici.size > 0) {
      addLog('Creazione esercizi...')
      for (const anno of [...anniUnici].sort()) {
        try {
          const { data: ex } = await supabase
            .from('esercizi')
            .select('id')
            .eq('condominio_id', condId)
            .eq('nome', String(anno))
            .maybeSingle()
          if (ex?.id) {
            idMap.esercizi[anno] = ex.id
          } else {
            const { data: newEx, error } = await supabase.from('esercizi').insert({
              nome: String(anno),
              data_inizio: `${anno}-01-01`,
              data_fine: `${anno}-12-31`,
              condominio_id: condId,
              amministratore_id: adminId,
            }).select('id').single()
            if (error) throw error
            idMap.esercizi[anno] = newEx.id
          }
          addLog(`[OK] Esercizio ${anno} pronto`)
        } catch (e) {
          addLog(`[ERRORE] Esercizio ${anno}: ${e.message}`)
        }
      }
    }

    // ── 2. Persone ─────────────────────────────────────────
    if (blocchiAbilitati.persone && dati?.persone?.length) {
      setStato('persone', 'in_corso')
      addLog('Importazione persone...')
      for (let i = 0; i < dati.persone.length; i++) {
        const p = dati.persone[i]
        // Controlla azione conflitto
        const conflictIdx = (conflittiInfo['persone'] || []).findIndex(c =>
          (p.codice_fiscale && c.item.codice_fiscale === p.codice_fiscale) ||
          (`${p.nome}${p.cognome}` === `${c.item.nome}${c.item.cognome}`)
        )
        const azione = conflictIdx >= 0 ? (conflitti['persone']?.[conflictIdx] || 'aggiorna') : 'crea'

        try {
          if (azione === 'salta') {
            // recupera id esistente per mapping
            const existing = conflittiInfo['persone']?.[conflictIdx]?.existing
            if (existing?.id) {
              const chiave = p.codice_fiscale || `${p.nome}|${p.cognome}`
              idMap.persone[chiave] = existing.id
              if (p.unita_rif) idMap.persone[p.unita_rif] = existing.id
            }
            incr('persone', 'skipped'); continue
          }

          const record = {
            user_id: adminId,
            nome: p.nome || '',
            cognome: p.cognome || '',
            email: p.email || null,
            telefono: p.telefono || null,
            codice_fiscale: p.codice_fiscale || null,
          }

          let personaId = null
          if (azione === 'aggiorna' && conflictIdx >= 0) {
            const existingId = conflittiInfo['persone'][conflictIdx]?.existing?.id
            if (existingId) {
              const { error } = await supabase.from('persone').update(record).eq('id', existingId)
              if (error) throw error
              personaId = existingId
              incr('persone', 'updated')
            }
          } else {
            // Upsert su codice_fiscale se valorizzato, altrimenti insert
            if (p.codice_fiscale) {
              const { data: ins, error } = await supabase
                .from('persone').upsert(record, { onConflict: 'codice_fiscale' }).select('id').single()
              if (error) throw error
              personaId = ins.id
            } else {
              const { data: ins, error } = await supabase.from('persone').insert(record).select('id').single()
              if (error) throw error
              personaId = ins.id
            }
            incr('persone', 'created')
          }
          if (personaId) {
            const chiave = p.codice_fiscale || `${p.nome}|${p.cognome}`
            idMap.persone[chiave] = personaId
            if (p.unita_rif) idMap.persone[p.unita_rif] = personaId
          }
        } catch (e) {
          addError('persone', `${p.cognome} ${p.nome}: ${e.message}`)
          addLog(`[ERRORE] Persona ${p.cognome} ${p.nome}: ${e.message}`)
        }
      }
      setStato('persone', 'completato')
    } else {
      setStato('persone', 'saltato')
    }

    // ── 3. Unità ───────────────────────────────────────────
    if (blocchiAbilitati.unita && dati?.unita?.length) {
      setStato('unita', 'in_corso')
      addLog('Importazione unità...')
      for (const u of dati.unita) {
        const conflictIdx = (conflittiInfo['unita'] || []).findIndex(c =>
          String(c.item.numero).trim().toLowerCase() === String(u.numero).trim().toLowerCase()
        )
        const azione = conflictIdx >= 0 ? (conflitti['unita']?.[conflictIdx] || 'aggiorna') : 'crea'

        try {
          if (azione === 'salta') {
            const existing = conflittiInfo['unita']?.[conflictIdx]?.existing
            if (existing?.id) idMap.unita[String(u.numero)] = existing.id
            incr('unita', 'skipped'); continue
          }

          const record = {
            numero: String(u.numero || ''),
            tipo: u.tipo || null,
            scala: u.scala || null,
            piano: u.piano || null,
            mq: u.mq ? Number(u.mq) : null,
            condominio_id: condId,
          }

          let unitaId = null
          if (azione === 'aggiorna' && conflictIdx >= 0) {
            const existingId = conflittiInfo['unita'][conflictIdx]?.existing?.id
            if (existingId) {
              const { error } = await supabase.from('unita').update(record).eq('id', existingId)
              if (error) throw error
              unitaId = existingId
              incr('unita', 'updated')
            }
          } else {
            const { data: ins, error } = await supabase.from('unita').insert(record).select('id').single()
            if (error) throw error
            unitaId = ins.id
            incr('unita', 'created')
          }
          if (unitaId) idMap.unita[String(u.numero)] = unitaId
        } catch (e) {
          addError('unita', `Unità ${u.numero}: ${e.message}`)
        }
      }
      setStato('unita', 'completato')
    } else {
      setStato('unita', 'saltato')
    }

    // ── 4. Occupanti unità ────────────────────────────────
    if (blocchiAbilitati.persone && dati?.persone?.length) {
      addLog('Abbinamento occupanti...')
      for (const p of dati.persone) {
        try {
          const chiaveP = p.codice_fiscale || `${p.nome}|${p.cognome}`
          const personaId = idMap.persone[chiaveP] || idMap.persone[p.unita_rif]
          const unitaId = p.unita_rif ? idMap.unita[String(p.unita_rif)] : null
          if (!personaId || !unitaId) continue

          const { data: existing } = await supabase
            .from('occupanti_unita')
            .select('id')
            .eq('unita_id', unitaId)
            .eq('persona_id', personaId)
            .maybeSingle()

          if (!existing) {
            const { error } = await supabase.from('occupanti_unita').insert({
              unita_id: unitaId,
              persona_id: personaId,
              ruolo: p.ruolo || 'proprietario',
              attivo: true,
            })
            if (error) throw error
          }
        } catch {
          // ignora errori occupanti singoli
        }
      }
    }

    // ── 5. Millesimi ──────────────────────────────────────
    if (blocchiAbilitati.millesimi && dati?.millesimi?.length) {
      setStato('millesimi', 'in_corso')
      addLog('Importazione millesimi...')
      for (const t of dati.millesimi) {
        try {
          // Crea/recupera tabella millesimale
          let tabellaId = idMap.tabelle[t.tabella]
          if (!tabellaId) {
            const { data: existing } = await supabase
              .from('tabelle_millesimali')
              .select('id')
              .eq('condominio_id', condId)
              .eq('nome', t.tabella)
              .maybeSingle()

            if (existing?.id) {
              tabellaId = existing.id
            } else {
              const { data: ins, error } = await supabase
                .from('tabelle_millesimali')
                .insert({ nome: t.tabella, condominio_id: condId })
                .select('id').single()
              if (error) throw error
              tabellaId = ins.id
              incr('millesimi', 'created')
            }
            idMap.tabelle[t.tabella] = tabellaId
          }

          // Inserisci righe millesimi
          for (const r of (t.righe || [])) {
            try {
              const unitaId = idMap.unita[String(r.unita_rif)]
              if (!unitaId) continue
              const { error } = await supabase
                .from('millesimi_unita')
                .upsert({ tabella_id: tabellaId, unita_id: unitaId, valore: Number(r.valore) || 0 },
                  { onConflict: 'tabella_id,unita_id' })
              if (error) throw error
              incr('millesimi', 'created')
            } catch (e) {
              addError('millesimi', `Riga millesimo ${r.unita_rif}: ${e.message}`)
            }
          }
        } catch (e) {
          addError('millesimi', `Tabella ${t.tabella}: ${e.message}`)
        }
      }
      setStato('millesimi', 'completato')
    } else {
      setStato('millesimi', 'saltato')
    }

    // ── 6. Saldi iniziali ─────────────────────────────────
    if (blocchiAbilitati.saldi_iniziali && dati?.saldi_iniziali?.length) {
      setStato('saldi_iniziali', 'in_corso')
      addLog('Importazione saldi iniziali...')
      for (const s of dati.saldi_iniziali) {
        try {
          const eserciziId = s.anno ? idMap.esercizi[Number(s.anno)] : null
          const unitaId = s.unita_rif ? idMap.unita[String(s.unita_rif)] : null
          if (!eserciziId || !unitaId) continue
          const { error } = await supabase
            .from('saldi_iniziali_unita')
            .upsert({
              esercizio_id: eserciziId,
              condominio_id: condId,
              unita_id: unitaId,
              saldo: Number(s.saldo) || 0,
              note: s.proprietario_nome || null,
            }, { onConflict: 'esercizio_id,unita_id' })
          if (error) throw error
          incr('saldi_iniziali', 'created')
        } catch (e) {
          addError('saldi_iniziali', `Saldo ${s.unita_rif} ${s.anno}: ${e.message}`)
        }
      }
      setStato('saldi_iniziali', 'completato')
    } else {
      setStato('saldi_iniziali', 'saltato')
    }

    // ── 7. Spese ──────────────────────────────────────────
    if (blocchiAbilitati.spese && dati?.spese?.length) {
      setStato('spese', 'in_corso')
      addLog('Importazione spese...')
      for (const s of dati.spese) {
        try {
          const eserciziId = s.anno ? idMap.esercizi[Number(s.anno)] : null
          const { error } = await supabase.from('spese').insert({
            descrizione: s.descrizione || '',
            importo: Number(s.importo) || 0,
            categoria: s.categoria || 'altro',
            data_spesa: s.data || null,
            condominio_id: condId,
            esercizio_id: eserciziId || null,
            criterio: 'manuale',
          })
          if (error) throw error
          incr('spese', 'created')
        } catch (e) {
          addError('spese', `Spesa "${s.descrizione}": ${e.message}`)
        }
      }
      setStato('spese', 'completato')
    } else {
      setStato('spese', 'saltato')
    }

    // ── 8. Rate ───────────────────────────────────────────
    if (blocchiAbilitati.rate && dati?.rate?.length) {
      setStato('rate', 'in_corso')
      addLog('Importazione rate...')
      // Raggruppa per anno+numero_rata per creare la rata padre prima
      const rateMap = new Map() // `${anno}-${numero_rata}` → rata_id
      for (const r of dati.rate) {
        try {
          const eserciziId = r.anno ? idMap.esercizi[Number(r.anno)] : null
          if (!eserciziId) continue
          const rataKey = `${r.anno}-${r.numero_rata}`
          let rataId = rateMap.get(rataKey)
          if (!rataId) {
            const { data: existing } = await supabase
              .from('rate')
              .select('id')
              .eq('esercizio_id', eserciziId)
              .eq('numero', Number(r.numero_rata))
              .maybeSingle()
            if (existing?.id) {
              rataId = existing.id
            } else {
              const { data: ins, error } = await supabase.from('rate').insert({
                esercizio_id: eserciziId,
                numero: Number(r.numero_rata),
                scadenza: r.scadenza || null,
                condominio_id: condId,
                amministratore_id: adminId,
              }).select('id').single()
              if (error) throw error
              rataId = ins.id
            }
            rateMap.set(rataKey, rataId)
          }
          // Inserisci rata_unita
          const unitaId = r.unita_rif ? idMap.unita[String(r.unita_rif)] : null
          if (!unitaId) continue
          const { error: ruErr } = await supabase.from('rate_unita').upsert({
            rata_id: rataId,
            unita_id: unitaId,
            importo: Number(r.importo) || 0,
            importo_pagato: Number(r.importo_pagato) || 0,
            stato: r.stato || 'non_pagata',
          }, { onConflict: 'rata_id,unita_id' })
          if (ruErr) throw ruErr
          incr('rate', 'created')
        } catch (e) {
          addError('rate', `Rata ${r.numero_rata} unità ${r.unita_rif}: ${e.message}`)
        }
      }
      setStato('rate', 'completato')
    } else {
      setStato('rate', 'saltato')
    }

    // Fine import
    addLog('[OK] Importazione completata!')
    setCondominioImportatoId(condId)
    setProgressoImport(prev => {
      const fin = { ...prev }
      Object.keys(fin).forEach(k => { if (fin[k].stato === 'attesa') fin[k].stato = 'saltato' })
      return fin
    })

    setTimeout(() => {
      const riepilogoFinal = {}
      setProgressoImport(curr => {
        Object.entries(curr).forEach(([k, v]) => { riepilogoFinal[k] = v })
        return curr
      })
      setTimeout(() => {
        setRiepilogo(riepilogoFinal)
        goToStep(5)
      }, 200)
    }, 800)
  }

  // ─── Reset wizard ───────────────────────────────────────
  function resetWizard() {
    setStep(1); setFadeIn(true)
    setCondominioId(''); setNuovoCondo(false); setNomeNuovo(''); setIndirizzoNuovo('')
    setFiles([]); setGestionale(''); setAnalizzando(false); setProgressLog([])
    setDatiAggregati(null); setBlocchiAbilitati(BLOCCO_STATE_INIT())
    setConflitti({}); setConflittiInfo({}); setOpenAccordion({})
    setProgressoImport({}); setImportLog([])
    setRiepilogo({}); setCondominioImportatoId('')
  }

  // ─── Helpers tabelle step 3 ────────────────────────────
  function getEditedRow(key, idx, row) {
    return { ...row, ...(editRows[key]?.[idx] || {}) }
  }
  function setEditCell(key, idx, campo, val) {
    setEditRows(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [idx]: { ...(prev[key]?.[idx] || {}), [campo]: val } }
    }))
  }

  // ──────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────

  const container = {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    fontFamily: "'Sora', sans-serif",
    padding: '32px 16px',
  }

  const inner = {
    maxWidth: 860,
    margin: '0 auto',
  }

  const card = {
    background: C.card,
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    padding: '32px',
    marginBottom: 24,
    transition: 'opacity 0.22s ease',
    opacity: fadeIn ? 1 : 0,
  }

  const inputStyle = {
    background: 'var(--app-bg)',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.text,
    padding: '10px 14px',
    fontSize: 14,
    fontFamily: "'Sora', sans-serif",
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  const btnPrimary = {
    background: `linear-gradient(135deg, ${C.accent}, ${C.accentHover})`,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 28px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'Sora', sans-serif",
    transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
  }

  const btnSecondary = {
    background: C.cardLight,
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '12px 28px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Sora', sans-serif",
    transition: 'background 0.15s',
  }

  return (
    <div style={container}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={inner}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 40, padding: '8px 20px', marginBottom: 20,
          }}>
            <span style={{ fontSize: 20 }}>🏗️</span>
            <span style={{ color: '#a5b4fc', fontWeight: 600, fontSize: 14 }}>Wizard Migrazione</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 10px', lineHeight: 1.2 }}>
            Migra da gestionale
          </h1>
          <p style={{ color: C.muted, margin: 0, fontSize: 16 }}>
            Importa anagrafica, millesimi, spese e rate dal tuo software attuale in pochi passi.
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator step={step} total={5} />

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div style={card}>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>🏢 Scegli il condominio</h2>
            <p style={{ color: C.muted, margin: '0 0 28px', fontSize: 14 }}>
              Seleziona il condominio destinatario dei dati importati.
            </p>

            {/* Toggle nuovoCondo */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <button
                style={{ ...btnSecondary, borderColor: !nuovoCondo ? C.accent : C.border, color: !nuovoCondo ? '#a5b4fc' : C.text }}
                onClick={() => setNuovoCondo(false)}
              >📋 Condominio esistente</button>
              <button
                style={{ ...btnSecondary, borderColor: nuovoCondo ? C.accent : C.border, color: nuovoCondo ? '#a5b4fc' : C.text }}
                onClick={() => setNuovoCondo(true)}
              >➕ Crea nuovo condominio</button>
            </div>

            {!nuovoCondo ? (
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 8, fontWeight: 600 }}>
                  Condominio
                </label>
                {loadingCond ? (
                  <p style={{ color: C.muted }}>Caricamento...</p>
                ) : (
                  <select
                    value={condominioId}
                    onChange={e => setCondominioId(e.target.value)}
                    style={{ ...inputStyle }}
                  >
                    <option value="">— Seleziona condominio —</option>
                    {condomini.map(c => (
                      <option key={c.id} value={c.id}>{c.nome} {c.indirizzo ? `— ${c.indirizzo}` : ''}</option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 8, fontWeight: 600 }}>Nome condominio *</label>
                  <input
                    style={inputStyle}
                    placeholder="es. Condominio Le Querce"
                    value={nomeNuovo}
                    onChange={e => setNomeNuovo(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: C.muted, marginBottom: 8, fontWeight: 600 }}>Indirizzo</label>
                  <input
                    style={inputStyle}
                    placeholder="es. Via Roma 12, Milano"
                    value={indirizzoNuovo}
                    onChange={e => setIndirizzoNuovo(e.target.value)}
                  />
                </div>
                <button
                  style={{ ...btnPrimary, alignSelf: 'flex-start' }}
                  onClick={handleCreaCondominio}
                  disabled={creandoCondo || !nomeNuovo.trim()}
                >
                  {creandoCondo ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creazione...
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Plus size={14} /> Crea condominio
                    </span>
                  )}
                </button>
                {condominioId && nuovoCondo === false && (
                  <div style={{ color: C.success, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={16} /> Condominio creato e selezionato!
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                style={{ ...btnPrimary, opacity: condominioId ? 1 : 0.4 }}
                disabled={!condominioId}
                onClick={() => goToStep(2)}
              >
                Avanti →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div style={card}>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>📂 Carica i file del gestionale</h2>
            <p style={{ color: C.muted, margin: '0 0 28px', fontSize: 14 }}>
              Carica uno o più file esportati dal tuo gestionale. L'AI classificherà automaticamente il tipo di dati.
            </p>

            {/* Badge gestionale */}
            {gestionale && (
              <div style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 20, padding: '6px 16px' }}>
                <span>📊</span>
                <span style={{ color: C.success, fontWeight: 600, fontSize: 13 }}>Gestionale rilevato: {gestionale}</span>
              </div>
            )}

            {/* Info collapsible Danea */}
            <div style={{ marginBottom: 20, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <button
                onClick={() => setDaneaInfo(v => !v)}
                style={{ width: '100%', background: C.cardLight, border: 'none', color: C.text,
                  padding: '12px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: "'Sora', sans-serif",
                  fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span>💡</span>
                <span>Istruzioni per Danea Domustudio</span>
                <span style={{ marginLeft: 'auto' }}>{daneaInfo ? '▲' : '▼'}</span>
              </button>
              {daneaInfo && (
                <div style={{ padding: '16px', fontSize: 13, color: C.muted, lineHeight: 1.7, background: 'var(--app-bg)' }}>
                  <strong style={{ color: C.text }}>Da Danea Domustudio:</strong> esporta separatamente le sezioni:
                  <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                    <li>📋 <strong>Unità immobiliari</strong> — file Excel/CSV</li>
                    <li>👤 <strong>Persone/Condòmini</strong> — file Excel/CSV con contatti</li>
                    <li>📐 <strong>Tabelle millesimali</strong> — file Excel</li>
                    <li>💰 <strong>Rendiconto annuale</strong> — Excel con spese e rate</li>
                  </ul>
                  Carica tutti i file insieme: l'AI li classificherà e aggregherà automaticamente.
                </div>
              )}
            </div>

            {/* Dropzone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? C.accent : C.border}`,
                borderRadius: 14,
                padding: '36px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(99,102,241,0.06)' : 'transparent',
                transition: 'all 0.2s',
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Trascina i file qui</div>
              <div style={{ color: C.muted, fontSize: 13 }}>o clicca per selezionarli</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>PDF, XLSX, CSV, DOCX, JPG, PNG</div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.csv,.docx,.jpg,.jpeg,.png,.webp,.txt"
                style={{ display: 'none' }}
                onChange={e => { aggiungiFiles(e.target.files); e.target.value = '' }}
              />
            </div>

            {/* Lista file */}
            {files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {files.map(item => {
                  const tipoBadge = item.analisi?.tipo ? TIPO_BADGE[item.analisi.tipo] : null
                  return (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: C.cardLight, borderRadius: 10, padding: '10px 14px',
                      border: `1px solid ${item.errore ? C.error : C.border}`,
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.loading ? (
                          <Loader2 size={20} style={{ color: C.warning, animation: 'spin 1s linear infinite' }} />
                        ) : item.errore ? (
                          <XCircle size={20} style={{ color: C.error }} />
                        ) : item.analisi ? (
                          <CheckCircle2 size={20} style={{ color: C.success }} />
                        ) : (
                          <FileText size={20} style={{ color: C.muted }} />
                        )}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.file.name}
                      </span>
                      {tipoBadge && <Badge {...tipoBadge} />}
                      {item.errore && (
                        <span style={{ fontSize: 12, color: C.error }}>{item.errore}</span>
                      )}
                      {!item.loading && (
                        <button
                          onClick={(e) => { e.stopPropagation(); rimuoviFile(item.id) }}
                          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                          title="Rimuovi"
                        >×</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pulsante aggiungi altri */}
            {files.length > 0 && !analizzando && (
              <button
                style={{ ...btnSecondary, fontSize: 13, padding: '8px 16px', marginBottom: 16 }}
                onClick={() => inputRef.current?.click()}
              >
                + Aggiungi altri file
              </button>
            )}

            {/* Progress log */}
            {progressLog.length > 0 && (
              <div style={{
                background: '#0a1628', borderRadius: 10, padding: '14px 16px',
                fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)',
                maxHeight: 160, overflowY: 'auto', marginBottom: 20,
                border: `1px solid ${C.border}`,
              }}>
                {progressLog.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button style={btnSecondary} onClick={() => goToStep(1)}>← Indietro</button>
              <button
                style={{ ...btnPrimary, opacity: files.length && !analizzando ? 1 : 0.4 }}
                disabled={!files.length || analizzando}
                onClick={analizzaFiles}
              >
                {analizzando ? '⏳ Analisi AI in corso...' : 'Analizza file →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div style={card}>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>🔍 Revisione blocchi dati</h2>
            <p style={{ color: C.muted, margin: '0 0 24px', fontSize: 14 }}>
              Verifica i dati estratti prima di importarli. Puoi abilitare/disabilitare blocchi e modificare singole righe.
            </p>

            {caricandoConflitti && (
              <div style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>
                ⏳ Rilevamento conflitti con dati esistenti...
              </div>
            )}

            {BLOCCHI_DEF.map(blocco => {
              const rows = getRowsForBlocco(blocco.key, datiAggregati)
              if (!rows.length) return null

              const isOpen = !!openAccordion[blocco.key]
              const conflittiBlk = conflittiInfo[blocco.key] || []
              const hasConflicts = conflittiBlk.length > 0

              return (
                <div key={blocco.key} style={{
                  border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 14, overflow: 'hidden',
                }}>
                  {/* Accordion header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: C.cardLight, padding: '14px 18px', cursor: 'pointer',
                  }} onClick={() => setOpenAccordion(prev => ({ ...prev, [blocco.key]: !isOpen }))}>
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={!!blocchiAbilitati[blocco.key]}
                      onChange={e => { e.stopPropagation(); setBlocchiAbilitati(prev => ({ ...prev, [blocco.key]: e.target.checked })) }}
                      style={{ width: 16, height: 16, accentColor: C.accent, cursor: 'pointer' }}
                    />
                    <span style={{ flex: 1, fontWeight: 700, fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {blocco.icon && <blocco.icon size={16} style={{ color: C.accent }} />}
                      {blocco.label}
                    </span>
                    <Badge label={`${rows.length}`} bg="rgba(99,102,241,0.2)" color="#a5b4fc" />
                    {hasConflicts && (
                      <Badge label={`${conflittiBlk.length} conflitti`} bg={C.warningBg} color={C.warning} icon={AlertTriangle} />
                    )}
                    <span style={{ color: C.muted, fontSize: 14, display: 'inline-flex', alignItems: 'center' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>

                  {/* Accordion body */}
                  {isOpen && (
                    <div style={{ padding: '0 0 4px' }}>
                      {/* Tabella */}
                      <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: 'var(--app-bg)' }}>
                              {blocco.key === 'millesimi'
                                ? ['Tabella', 'Unità rif.', 'Valore', 'Proprietario'].map(h => (
                                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: C.muted, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                                  ))
                                : blocco.campi.map(c => (
                                    <th key={c} style={{ padding: '8px 12px', textAlign: 'left', color: C.muted, fontWeight: 600, borderBottom: `1px solid ${C.border}`, textTransform: 'capitalize' }}>{c.replace(/_/g, ' ')}</th>
                                  ))
                              }
                              {hasConflicts && <th style={{ padding: '8px 12px', color: C.muted, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>Azione</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, idx) => {
                              const editedRow = getEditedRow(blocco.key, idx, row)
                              const conflictIdx = conflittiBlk.findIndex(c =>
                                blocco.key === 'persone'
                                  ? (row.codice_fiscale && c.item.codice_fiscale === row.codice_fiscale) ||
                                    (`${row.nome}${row.cognome}` === `${c.item.nome}${c.item.cognome}`)
                                  : blocco.key === 'unita'
                                  ? String(row.numero) === String(c.item.numero)
                                  : false
                              )
                              const isConflict = conflictIdx >= 0
                              const fields = blocco.key === 'millesimi'
                                ? ['tabella', 'unita_rif', 'valore', 'proprietario_nome']
                                : blocco.campi

                              return (
                                <tr key={idx} style={{
                                  background: isConflict ? 'rgba(245,158,11,0.05)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                                  borderBottom: `1px solid ${C.border}`,
                                }}>
                                  {fields.map(campo => (
                                    <td key={campo} style={{ padding: '6px 12px' }}>
                                      <input
                                        value={editedRow[campo] ?? ''}
                                        onChange={e => setEditCell(blocco.key, idx, campo, e.target.value)}
                                        style={{
                                          background: 'transparent', border: 'none', borderBottom: '1px solid transparent',
                                          color: C.text, fontSize: 12, fontFamily: "'Sora', sans-serif",
                                          width: '100%', padding: '2px 0',
                                          outline: 'none',
                                        }}
                                        onFocus={e => e.target.style.borderBottomColor = C.accent}
                                        onBlur={e => e.target.style.borderBottomColor = 'transparent'}
                                      />
                                    </td>
                                  ))}
                                  {hasConflicts && (
                                    <td style={{ padding: '6px 12px' }}>
                                      {isConflict ? (
                                        <select
                                          value={conflitti['persone' === blocco.key ? 'persone' : blocco.key]?.[conflictIdx] || 'aggiorna'}
                                          onChange={e => setAzioneConflitto(blocco.key, conflictIdx, e.target.value)}
                                          style={{ ...inputStyle, fontSize: 11, padding: '3px 8px', width: 'auto' }}
                                        >
                                          <option value="aggiorna">Aggiorna</option>
                                          <option value="salta">Salta</option>
                                          <option value="crea_nuovo">Crea nuovo</option>
                                        </select>
                                      ) : (
                                        <span style={{ color: C.muted, fontSize: 11 }}>—</span>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Messaggio se nessun dato */}
            {BLOCCHI_DEF.every(b => !getRowsForBlocco(b.key, datiAggregati).length) && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><HelpCircle size={40} style={{ color: C.muted }} /></div>
                <div>Nessun dato estratto. Torna al passo precedente e verifica i file caricati.</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button style={btnSecondary} onClick={() => goToStep(2)}>← Indietro</button>
              <button style={btnPrimary} onClick={eseguiImport}>
                Importa dati →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4 ── */}
        {step === 4 && (
          <div style={card}>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={22} style={{ color: C.accent }} /> Importazione in corso...
            </h2>
            <p style={{ color: C.muted, margin: '0 0 28px', fontSize: 14 }}>
              Non chiudere questa pagina. L'importazione è automatica e rispetta l'ordine delle dipendenze.
            </p>

            {BLOCCHI_DEF.map(blocco => {
              const p = progressoImport[blocco.key] || { stato: 'attesa', created: 0, updated: 0, skipped: 0, errors: [] }
              const statoColor = { attesa: C.muted, in_corso: C.warning, completato: C.success, errore: C.error, saltato: C.muted }
              const isInProgress = p.stato === 'in_corso'

              return (
                <div key={blocco.key} style={{
                  background: C.cardLight, borderRadius: 12, padding: '16px 20px', marginBottom: 12,
                  border: `1px solid ${p.stato === 'completato' ? 'rgba(34,197,94,0.3)' : p.stato === 'errore' ? 'rgba(239,68,68,0.3)' : C.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20, display: 'flex', alignItems: 'center' }}>{renderStatoImportIcon(p.stato)}</span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {blocco.icon && <blocco.icon size={16} style={{ color: C.accent }} />}
                      {blocco.label}
                    </span>
                    <span style={{ color: statoColor[p.stato], fontSize: 13, fontWeight: 600 }}>
                      {p.stato === 'in_corso' ? 'In corso...' : p.stato === 'completato' ? `${p.created} creati · ${p.updated} aggiornati · ${p.skipped} saltati` : p.stato}
                    </span>
                  </div>
                  {/* Progress bar */}
                  {isInProgress && (
                    <div style={{ marginTop: 10, height: 4, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: '40%',
                        background: `linear-gradient(90deg, ${C.accent}, #8b5cf6)`,
                        borderRadius: 4,
                        animation: 'pulse-bar 1.2s ease-in-out infinite',
                      }} />
                    </div>
                  )}
                  {/* Errori */}
                  {p.errors?.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 12, color: C.error }}>
                      {p.errors.slice(0, 5).map((e, i) => <div key={i}>⚠️ {e}</div>)}
                      {p.errors.length > 5 && <div>...e altri {p.errors.length - 5} errori</div>}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Log console */}
            {importLog.length > 0 && (
              <div style={{
                background: '#0a1628', borderRadius: 10, padding: '14px 16px',
                fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)',
                maxHeight: 180, overflowY: 'auto', marginTop: 20,
                border: `1px solid ${C.border}`,
              }}>
                {importLog.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            )}

            <style>{`
              @keyframes pulse-bar {
                0%, 100% { opacity: 1; transform: translateX(0); }
                50% { opacity: 0.7; transform: translateX(60%); }
              }
            `}</style>
          </div>
        )}

        {/* ── STEP 5 ── */}
        {step === 5 && (
          <div style={card}>
            <div style={{ textAlign: 'center', marginBottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: C.success }}><CheckCircle2 size={56} /></div>
              <h2 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800 }}>Migrazione completata!</h2>
              <p style={{ color: C.muted, fontSize: 15 }}>Ecco il riepilogo dell'importazione.</p>
            </div>

            {/* Tabella riepilogo */}
            <div style={{ overflowX: 'auto', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--app-bg)' }}>
                    {['Blocco', 'Creati', 'Aggiornati', 'Saltati', 'Errori'].map(h => (
                      <th key={h} style={{
                        padding: '12px 16px', textAlign: 'left', color: C.muted, fontWeight: 600,
                        borderBottom: `2px solid ${C.border}`, fontSize: 12,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BLOCCHI_DEF.map(blocco => {
                    const p = progressoImport[blocco.key] || { created: 0, updated: 0, skipped: 0, errors: [] }
                    const hasErr = (p.errors?.length || 0) > 0
                    return (
                      <tr key={blocco.key} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            {blocco.icon && <blocco.icon size={14} style={{ color: C.muted }} />}
                            {blocco.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: C.success }}>{p.created || 0}</td>
                        <td style={{ padding: '12px 16px', color: C.warning }}>{p.updated || 0}</td>
                        <td style={{ padding: '12px 16px', color: C.muted }}>{p.skipped || 0}</td>
                        <td style={{ padding: '12px 16px', color: hasErr ? C.error : C.muted }}>
                          {hasErr ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <AlertTriangle size={12} /> {p.errors.length}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Warning errori */}
            {BLOCCHI_DEF.some(b => (progressoImport[b.key]?.errors?.length || 0) > 0) && (
              <div style={{
                background: C.warningBg, border: `1px solid ${C.warning}`,
                borderRadius: 12, padding: '16px 20px', marginBottom: 24,
              }}>
                <div style={{ fontWeight: 700, color: C.warning, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} /> Avvertenze
                </div>
                {BLOCCHI_DEF.map(b => {
                  const errs = progressoImport[b.key]?.errors || []
                  if (!errs.length) return null
                  return (
                    <div key={b.key} style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{b.label}:</div>
                      {errs.map((e, i) => (
                        <div key={i} style={{ fontSize: 12, color: C.muted, paddingLeft: 12 }}>• {e}</div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}

            {/* CTA */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              {condominioImportatoId && (
                <button
                  style={{ ...btnPrimary, fontSize: 15 }}
                  onClick={() => navigate(`/condomini/${condominioImportatoId}`)}
                >
                  → Vai al condominio
                </button>
              )}
              <button
                style={{ ...btnSecondary, fontSize: 15 }}
                onClick={resetWizard}
              >
                + Nuova migrazione
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
