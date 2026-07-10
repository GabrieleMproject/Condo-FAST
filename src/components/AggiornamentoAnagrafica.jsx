// src/components/AggiornamentoAnagrafica.jsx
// Flusso: incolla testo libero → Claude API interpreta → banner riepilogo diff → conferma → aggiorna DB

import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ArrowRightLeft, Plus, Edit3, Trash2, Home, Key, X, AlertTriangle, CheckCircle2, XCircle, Search, ClipboardList, Check } from 'lucide-react'
import { callClaude } from '../lib/claudeClient'

function renderDiffIcon(iconName, color, size = 20) {
  switch (iconName) {
    case 'ArrowRightLeft':
      return <ArrowRightLeft size={size} style={{ color }} />
    case 'Plus':
      return <Plus size={size} style={{ color }} />
    case 'Edit3':
      return <Edit3 size={size} style={{ color }} />
    case 'Trash2':
      return <Trash2 size={size} style={{ color }} />
    default:
      return null
  }
}

// ───────────────────────────────────────────────────────────────
// STEP INDICATOR
// ───────────────────────────────────────────────────────────────
function StepDot({ active, done, label, n }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
      <div style={{
        width:32, height:32, borderRadius:'50%', display:'flex',
        alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700,
        background: done ? '#16a34a' : active ? '#2563eb' : '#1e293b',
        color: (done || active) ? 'white' : '#475569',
        border:`2px solid ${done ? '#16a34a' : active ? '#3b82f6' : '#334155'}`,
        transition:'all .3s',
      }}>
        {done ? <Check size={14} /> : n}
      </div>
      <span style={{ fontSize:10, color: active ? '#e2e8f0' : '#475569', fontWeight: active ? 600 : 400 }}>
        {label}
      </span>
    </div>
  )
}

function StepLine({ done }) {
  return (
    <div style={{
      flex:1, height:2, marginBottom:22,
      background: done ? '#16a34a' : '#1e293b',
      transition:'background .4s',
    }} />
  )
}

// ───────────────────────────────────────────────────────────────
// DIFF BANNER
// ───────────────────────────────────────────────────────────────
const TIPO_STYLE = {
  sostituzione: { icon:'ArrowRightLeft', bg:'#1c1917', border:'#d97706', text:'#fbbf24', label:'SOSTITUZIONE' },
  nuovo:        { icon:'Plus', bg:'#052e16', border:'#16a34a', text:'#4ade80', label:'NUOVO' },
  modifica:     { icon:'Edit3',  bg:'#0c1a2e', border:'#2563eb', text:'#60a5fa', label:'MODIFICA' },
  rimozione:    { icon:'Trash2',  bg:'#2d0a0a', border:'#dc2626', text:'#f87171', label:'RIMOZIONE' },
}

function DiffBanner({ operazioni }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {operazioni.map((op, i) => {
        const st = TIPO_STYLE[op.tipo] || TIPO_STYLE.modifica
        const datiClean = op.dati
          ? Object.entries(op.dati).filter(([, v]) => v && String(v).trim())
          : []
        return (
          <div key={i} style={{
            background:st.bg, border:`1px solid ${st.border}`,
            borderRadius:12, padding:'14px 18px',
            display:'flex', gap:14, alignItems:'flex-start',
          }}>
            {renderDiffIcon(st.icon, st.border)}
            <div style={{ flex:1 }}>
              {/* Tipo + unità + ruolo */}
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:7, flexWrap:'wrap' }}>
                <span style={{
                  background:st.border, color:'white', fontSize:9,
                  fontWeight:800, padding:'2px 8px', borderRadius:20, letterSpacing:'0.08em',
                }}>{st.label}</span>
                <span style={{ color:'#e2e8f0', fontSize:14, fontWeight:700 }}>Unità {op.unita}</span>
                {op.ruolo && (
                  <span style={{ color:'#64748b', fontSize:12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    · {op.ruolo === 'proprietario' ? <Home size={12} /> : <Key size={12} />} <span>{op.ruolo === 'proprietario' ? 'Proprietario' : 'Inquilino'}</span>
                  </span>
                )}
              </div>

              {/* Testo descrittivo */}
              <p style={{ color:st.text, fontSize:13, margin:'0 0 8px', lineHeight:1.65 }}>
                {op.tipo === 'sostituzione' && <>
                  Dal <strong>{op.data || 'data odierna'}</strong> —{' '}
                  <span style={{ color:'#f87171', textDecoration:'line-through' }}>
                    {op.vecchio_nominativo}
                  </span>{' '}
                  sostituito da <strong style={{ color:'#4ade80' }}>{op.nuovo_nominativo}</strong>
                </>}
                {op.tipo === 'nuovo' && <>
                  Nuovo {op.ruolo}: <strong>{op.nuovo_nominativo}</strong>
                  {op.data && <> — dal <strong>{op.data}</strong></>}
                </>}
                {op.tipo === 'modifica' && <>
                  Aggiornamento dati di <strong>{op.nominativo}</strong>
                  {op.dettaglio && <span style={{ color:'#94a3b8' }}> — {op.dettaglio}</span>}
                </>}
                {op.tipo === 'rimozione' && <>
                  Rimozione di <strong>{op.nominativo}</strong>
                  {op.data && <> dal <strong>{op.data}</strong></>}
                </>}
              </p>

              {/* Dati estratti */}
              {datiClean.length > 0 && (
                <div style={{
                  padding:'8px 12px', background:'rgba(0,0,0,0.28)',
                  borderRadius:8, display:'flex', flexWrap:'wrap', gap:'4px 18px',
                }}>
                  {datiClean.map(([k, v]) => (
                    <span key={k} style={{ fontSize:11, color:'#94a3b8' }}>
                      <span style={{ color:'#475569' }}>{k}:</span> {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════
export default function AggiornamentoAnagrafica({ condominioId, unita, onAggiornato, onClose }) {
  const [step, setStep]           = useState(1)
  const [testo, setTesto]         = useState('')
  const [operazioni, setOperazioni] = useState([])
  const [loading, setLoading]     = useState(false)
  const [applying, setApplying]   = useState(false)
  const [error, setError]         = useState(null)
  const [risultato, setRisultato] = useState(null)

  // Contesto anagrafica attuale passato all'AI
  const contestoAnagrafica = unita.map(u => {
    const prop = u.occupanti_unita?.find(o => o.ruolo === 'proprietario' && o.attivo)?.persone
    const inq  = u.occupanti_unita?.find(o => o.ruolo === 'inquilino'    && o.attivo)?.persone
    return (
      `Unità ${u.numero} (${u.tipo}` +
      (u.scala ? ` Sc.${u.scala}` : '') +
      (u.piano != null ? ` P.${u.piano}` : '') +
      `): Proprietario: ${prop ? `${prop.cognome} ${prop.nome} <${prop.email || ''}> ${prop.telefono || ''}` : 'nessuno'}` +
      ` | Inquilino: ${inq ? `${inq.cognome} ${inq.nome} <${inq.email || ''}> ${inq.telefono || ''}` : 'nessuno'}`
    )
  }).join('\n')

  // ── Analisi AI ────────────────────────────────────────────────────────
  const analizzaTesto = async () => {
    if (!testo.trim()) { setError('Incolla del testo prima di continuare.'); return }
    setLoading(true)
    setError(null)
    try {
      const prompt = `Sei l'assistente di un gestionale condominiale italiano.
Ricevi un testo con nuove informazioni anagrafiche. Confrontalo con la situazione attuale e identifica le operazioni da effettuare.

ANAGRAFICA ATTUALE:
${contestoAnagrafica || 'Nessuna unità presente.'}

TESTO CON NUOVE INFORMAZIONI:
${testo}

Rispondi SOLO con un array JSON valido, senza testo aggiuntivo e senza backtick markdown.
Schema di ogni elemento:
{
  "tipo": "sostituzione" | "nuovo" | "modifica" | "rimozione",
  "unita": "numero unità come stringa (es: 3, A4, Box12)",
  "ruolo": "proprietario" | "inquilino",
  "vecchio_nominativo": "solo per sostituzione: Cognome Nome",
  "nuovo_nominativo": "per sostituzione/nuovo: Cognome Nome",
  "nominativo": "per modifica/rimozione: Cognome Nome",
  "data": "GG/MM/AAAA se specificata, altrimenti null",
  "dettaglio": "breve descrizione (solo per tipo modifica)",
  "dati": { "nome":"","cognome":"","email":"","telefono":"","indirizzo":"","citta":"","cap":"","provincia":"","codice_fiscale":"" }
}
Se non identifichi operazioni chiare, restituisci [].`

      const raw = await callClaude(prompt, {
        funzione: 'aggiornamento_anagrafica',
        condominio_id: condominioId,
        maxTokens: 2000
      })
      const parsed = JSON.parse(
        raw.trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim()
      )
      if (!Array.isArray(parsed)) throw new Error('Risposta non valida')
      if (parsed.length === 0) {
        setError('Nessuna modifica rilevata. Prova ad essere più specifico (es: "dal 01/03/2025 int.4 nuovo proprietario Mario Rossi").')
        return
      }
      setOperazioni(parsed)
      setStep(2)
    } catch (err) {
      setError('Errore analisi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Applica modifiche ─────────────────────────────────────────────────
  const applicaModifiche = async () => {
    setApplying(true)
    setError(null)
    const log = { ok: [], errori: [] }
    try {
      const { data: { user } } = await supabase.auth.getUser()

      for (const op of operazioni) {
        try {
          // Cerca unità per numero (case-insensitive, ignora spazi)
          const normalize = s => String(s || '').toLowerCase().replace(/\s+/g, '')
          const unitaTarget = unita.find(u => normalize(u.numero) === normalize(op.unita))
          if (!unitaTarget) { log.errori.push(`Unità "${op.unita}" non trovata nel condominio`); continue }

          const oggi = new Date().toISOString().split('T')[0]
          const dataOp = op.data ? italianToISO(op.data) : oggi

          if (op.tipo === 'sostituzione' || op.tipo === 'nuovo') {
            if (op.tipo === 'sostituzione') {
              await supabase.from('occupanti_unita')
                .update({ attivo: false })
                .eq('unita_id', unitaTarget.id)
                .eq('ruolo', op.ruolo)
                .eq('attivo', true)
            }
            const { data: persona, error: pErr } = await supabase.from('persone')
              .insert([{
                user_id:        user.id,
                nome:           op.dati?.nome     || estraiNome(op.nuovo_nominativo),
                cognome:        op.dati?.cognome  || estraiCognome(op.nuovo_nominativo),
                email:          op.dati?.email    || null,
                telefono:       op.dati?.telefono || null,
                indirizzo:      op.dati?.indirizzo || null,
                citta:          op.dati?.citta    || null,
                cap:            op.dati?.cap      || null,
                provincia:      op.dati?.provincia || null,
                codice_fiscale: op.dati?.codice_fiscale || null,
              }]).select().single()
            if (pErr) throw pErr
            const { error: oErr } = await supabase.from('occupanti_unita')
              .insert([{ unita_id: unitaTarget.id, persona_id: persona.id, ruolo: op.ruolo, attivo: true }])
            if (oErr) throw oErr
            log.ok.push(`${op.tipo === 'sostituzione' ? 'Sostituzione' : 'Aggiunto'}: ${op.nuovo_nominativo} → Unità ${op.unita}`)

          } else if (op.tipo === 'modifica') {
            const occ = unitaTarget.occupanti_unita?.find(o => o.ruolo === op.ruolo && o.attivo)
            if (!occ?.persona_id) { log.errori.push(`Persona non trovata: Unità ${op.unita} ${op.ruolo}`); continue }
            const upd = {}
            if (op.dati?.email)     upd.email     = op.dati.email
            if (op.dati?.telefono)  upd.telefono  = op.dati.telefono
            if (op.dati?.indirizzo) upd.indirizzo = op.dati.indirizzo
            if (op.dati?.citta)     upd.citta     = op.dati.citta
            if (op.dati?.cap)       upd.cap       = op.dati.cap
            if (Object.keys(upd).length > 0)
              await supabase.from('persone').update(upd).eq('id', occ.persona_id)
            log.ok.push(`Modificato: ${op.nominativo} → Unità ${op.unita}`)

          } else if (op.tipo === 'rimozione') {
            await supabase.from('occupanti_unita')
              .update({ attivo: false })
              .eq('unita_id', unitaTarget.id).eq('ruolo', op.ruolo).eq('attivo', true)
            log.ok.push(`Rimosso: ${op.nominativo} → Unità ${op.unita}`)
          }
        } catch (opErr) {
          log.errori.push(`Unità ${op.unita}: ${opErr.message}`)
        }
      }
      setRisultato(log)
      setStep(3)
      if (log.ok.length > 0) onAggiornato?.()
    } catch (err) {
      setError('Errore: ' + err.message)
    } finally {
      setApplying(false)
    }
  }

  // helpers
  const italianToISO = d => { const p = d.split('/'); return p.length === 3 ? `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}` : new Date().toISOString().split('T')[0] }
  const estraiNome    = s => (s || '').split(' ').slice(1).join(' ') || s || ''
  const estraiCognome = s => (s || '').split(' ')[0] || ''

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <h2 style={S.title}>Aggiornamento Anagrafica</h2>
            <p style={S.subtitle}>Incolla qualsiasi testo — l'AI rileva le modifiche e chiede conferma prima di procedere</p>
          </div>
          <button style={S.closeBtn} onClick={onClose} type="button"><X size={18} /></button>
        </div>

        {/* Steps */}
        <div style={S.steps}>
          <StepDot n={1} label="Testo"     active={step===1} done={step>1} />
          <StepLine done={step>1} />
          <StepDot n={2} label="Riepilogo" active={step===2} done={step>2} />
          <StepLine done={step>2} />
          <StepDot n={3} label="Fatto"     active={step===3} done={false} />
        </div>

        {/* ──────────── STEP 1 ──────────── */}
        {step === 1 && (
          <div style={S.body}>
            <div style={S.labelRow}>
              <span style={S.label}>Incolla il testo con le nuove informazioni</span>
              <span style={S.hint}>email, messaggio, nota — qualsiasi formato</span>
            </div>

            <textarea
              style={S.textarea}
              placeholder={
                'Esempi:\n\n' +
                '"Dal 1/02/2025 l\'appartamento 12 è venduto a Marco Bianchi (marco@mail.it, 333 1234567), subentra a Luigi Rossi."\n\n' +
                '"Nuovo inquilino int. 5: Sara Ferri, sara@gmail.com, 347 9876543, Via Torino 3 Milano"\n\n' +
                '"Unità B3 – cambio proprietà da Gianni Verdi a Lucia Neri (CF: NRELCU85T52F205X) dal 15/03/2025"'
              }
              value={testo}
              onChange={e => { setTesto(e.target.value); setError(null) }}
            />

            {/* Anteprima anagrafica attuale */}
            {unita.length > 0 && (
              <div style={S.contextBox}>
                <span style={{ color:'#475569', fontSize:11, fontWeight:600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ClipboardList size={14} /> ANAGRAFICA ATTUALE — {unita.length} unità
                </span>
                <div style={S.contextGrid}>
                  {unita.slice(0, 8).map(u => {
                    const prop = u.occupanti_unita?.find(o => o.ruolo==='proprietario' && o.attivo)?.persone
                    return (
                      <div key={u.id} style={S.contextItem}>
                        <span style={{ color:'#3b82f6', fontWeight:700 }}>Int.{u.numero}</span>
                        <span style={{ color:'#64748b' }}>{prop ? `${prop.cognome} ${prop.nome}` : '—'}</span>
                      </div>
                    )
                  })}
                  {unita.length > 8 && <div style={{ color:'#475569', fontSize:11, gridColumn:'1/-1' }}>…e altre {unita.length-8} unità</div>}
                </div>
              </div>
            )}

            {error && <div style={S.errorBox}>{error}</div>}

            <div style={S.actions}>
              <button style={S.btnSecondary} onClick={onClose}>Annulla</button>
              <button style={S.btnPrimary} onClick={analizzaTesto} disabled={loading || !testo.trim()}>
                {loading
                  ? <><span style={S.spin}/> Analisi AI in corso…</>
                  : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Search size={14} /> Analizza modifiche →</span>}
              </button>
            </div>
          </div>
        )}

        {/* ──────────── STEP 2 ──────────── */}
        {step === 2 && (
          <div style={S.body}>
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                <span style={S.badge}>{operazioni.length}</span>
                <span style={{ color:'#e2e8f0', fontSize:16, fontWeight:700 }}>
                  operazion{operazioni.length !== 1 ? 'i rilevate' : 'e rilevata'}
                </span>
              </div>
              <p style={{ color:'#64748b', fontSize:12, margin:0 }}>
                Verifica le modifiche qui sotto. Puoi tornare indietro se qualcosa non è corretto.
              </p>
            </div>

            <DiffBanner operazioni={operazioni} />

            <div style={{ ...S.warningBox, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={16} style={{ color: '#fbbf24', flexShrink: 0 }} />
              <span style={{ color:'#fbbf24', fontSize:12, lineHeight:1.6 }}>
                Confermando, l'anagrafica verrà aggiornata immediatamente. Gli occupanti precedenti
                vengono archiviati con data di uscita — <strong>lo storico è sempre consultabile</strong>.
              </span>
            </div>

            {error && <div style={S.errorBox}>{error}</div>}

            <div style={S.actions}>
              <button style={S.btnSecondary} onClick={() => { setStep(1); setOperazioni([]); setError(null) }}>
                ← Modifica testo
              </button>
              <button style={S.btnConfirm} onClick={applicaModifiche} disabled={applying}>
                {applying
                  ? <><span style={S.spin}/> Aggiornamento…</>
                  : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={16} /> Conferma e aggiorna anagrafica</span>}
              </button>
            </div>
          </div>
        )}

        {/* ──────────── STEP 3 ──────────── */}
        {step === 3 && risultato && (
          <div style={{ ...S.body, textAlign:'center', paddingTop:32 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom:12 }}>
              {risultato.errori.length === 0 ? (
                <CheckCircle2 size={54} style={{ color: '#16a34a' }} />
              ) : risultato.ok.length > 0 ? (
                <AlertTriangle size={54} style={{ color: '#f59e0b' }} />
              ) : (
                <XCircle size={54} style={{ color: '#dc2626' }} />
              )}
            </div>
            <h3 style={{ color:'#e2e8f0', fontSize:19, marginBottom:4 }}>
              {risultato.errori.length === 0 ? 'Anagrafica aggiornata' : 'Aggiornamento parziale'}
            </h3>
            <p style={{ color:'#64748b', fontSize:13, marginBottom:20 }}>
              {risultato.ok.length} operazion{risultato.ok.length!==1?'i':'e'} completata{risultato.ok.length!==1?'e':''}
              {risultato.errori.length > 0 && ` · ${risultato.errori.length} errore${risultato.errori.length!==1?'i':''}`}
            </p>

            {risultato.ok.length > 0 && (
              <div style={{ ...S.resultBox, borderColor:'#16a34a', background:'#052e16', marginBottom:10 }}>
                {risultato.ok.map((m,i) => <div key={i} style={{ color:'#4ade80', fontSize:13, padding:'3px 0', display: 'flex', alignItems: 'center', gap: 6 }}><Check size={12} /> {m}</div>)}
              </div>
            )}
            {risultato.errori.length > 0 && (
              <div style={{ ...S.resultBox, borderColor:'#dc2626', background:'#2d0a0a' }}>
                {risultato.errori.map((m,i) => <div key={i} style={{ color:'#f87171', fontSize:13, padding:'3px 0', display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={12} /> {m}</div>)}
              </div>
            )}

            <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:24 }}>
              {risultato.ok.length > 0 && (
                <button style={S.btnPrimary} onClick={() => { setStep(1); setTesto(''); setOperazioni([]); setRisultato(null) }}>
                  Nuovo aggiornamento
                </button>
              )}
              <button style={S.btnSecondary} onClick={onClose}>Chiudi</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
const S = {
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(6px)' },
  modal:       { background:'#1e293b', borderRadius:18, width:'92vw', maxWidth:680, maxHeight:'92vh', display:'flex', flexDirection:'column', border:'1px solid #334155', boxShadow:'0 32px 80px rgba(0,0,0,0.6)', fontFamily:'Sora, sans-serif' },
  header:      { display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'22px 26px 18px', borderBottom:'1px solid #334155' },
  title:       { color:'#e2e8f0', fontSize:19, fontWeight:700, margin:0 },
  subtitle:    { color:'#64748b', fontSize:12, margin:'4px 0 0' },
  closeBtn:    { background:'none', border:'none', color:'#64748b', fontSize:20, cursor:'pointer', padding:'2px 6px' },
  steps:       { display:'flex', alignItems:'center', padding:'18px 44px 0', gap:0 },
  body:        { padding:'20px 26px 24px', overflowY:'auto', flex:1 },
  labelRow:    { display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 },
  label:       { color:'#94a3b8', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' },
  hint:        { color:'#475569', fontSize:11 },
  textarea:    { width:'100%', background:'#0f172a', border:'1px solid #334155', color:'#e2e8f0', borderRadius:10, padding:'14px 16px', fontSize:13, outline:'none', resize:'vertical', lineHeight:1.7, fontFamily:'Sora, sans-serif', boxSizing:'border-box', minHeight:190 },
  contextBox:  { marginTop:14, padding:'12px 16px', background:'#0f172a', borderRadius:8, border:'1px solid #1e293b' },
  contextGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:'6px 12px', marginTop:8 },
  contextItem: { display:'flex', flexDirection:'column', fontSize:11 },
  errorBox:    { marginTop:12, padding:'10px 14px', background:'#450a0a', border:'1px solid #991b1b', color:'#fca5a5', borderRadius:8, fontSize:13 },
  warningBox:  { display:'flex', gap:10, alignItems:'flex-start', background:'#1c1917', border:'1px solid #78350f', borderRadius:8, padding:'10px 14px', marginTop:14 },
  resultBox:   { border:'1px solid', borderRadius:10, padding:'12px 16px', textAlign:'left' },
  actions:     { display:'flex', justifyContent:'flex-end', gap:10, marginTop:18 },
  badge:       { background:'#2563eb', color:'white', borderRadius:'50%', width:28, height:28, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, flexShrink:0 },
  btnPrimary:  { background:'#2563eb', color:'white', border:'none', borderRadius:9, padding:'11px 22px', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:8 },
  btnSecondary:{ background:'transparent', color:'#94a3b8', border:'1px solid #334155', borderRadius:9, padding:'11px 22px', fontSize:13, cursor:'pointer' },
  btnConfirm:  { background:'#16a34a', color:'white', border:'none', borderRadius:9, padding:'11px 24px', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:8 },
  spin:        { width:13, height:13, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid white', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block', flexShrink:0 },
}
