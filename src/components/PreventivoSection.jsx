// src/components/PreventivoSection.jsx
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useUnita } from '../hooks/useUnita'
import { useMillesimi } from '../hooks/useMillesimi'
import { usePreventivo, calcRipartizione } from '../hooks/usePreventivo'
import { Plus, Trash2, Wand2, Equal, AlertCircle, CheckCircle2 } from 'lucide-react'

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const eur = (n) => `€${(Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function defaultScadenze(anno, totale) {
  const dates = [`${anno}-03-31`, `${anno}-06-30`, `${anno}-09-30`, `${anno}-12-31`]
  const base = round2(totale / 4)
  return dates.map((d, i) => ({
    numero: i + 1,
    scadenza: d,
    descrizione: `Rata ${i + 1}`,
    importo: i < 3 ? base : round2(totale - base * 3),
  }))
}

export default function PreventivoSection({ condominioId }) {
  const [esercizi, setEsercizi] = useState([])
  const [esercizio, setEsercizio] = useState(null)
  const [scadenze, setScadenze] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // voce in composizione
  const [nv, setNv] = useState({ descrizione: '', categoria: '', importo: '', criterio: 'millesimi', tabella_millesimale_id: '' })

  const { unita, getProprietario } = useUnita(condominioId)
  const mill = useMillesimi(condominioId)
  const prev = usePreventivo(condominioId, esercizio?.id)

  useEffect(() => {
    supabase.from('esercizi').select('*').eq('condominio_id', condominioId)
      .order('anno', { ascending: false })
      .then(({ data }) => {
        setEsercizi(data || [])
        setEsercizio(data?.find((e) => e.stato === 'aperto') || data?.[0] || null)
      })
  }, [condominioId])

  useEffect(() => { mill.fetch() }, [mill.fetch])
  useEffect(() => { prev.fetch() }, [prev.fetch])

  // Ripartizione annua per unità (anteprima, ricalcolata dalle voci correnti)
  const perUnita = useMemo(
    () => calcRipartizione(prev.voci, unita, mill.getMillesimiUnita, mill.getTotaleTabella),
    [prev.voci, unita, mill.tabelle, mill.getMillesimiUnita, mill.getTotaleTabella]
  )
  const totaleRipartito = round2(Object.values(perUnita).reduce((a, b) => a + b, 0))
  const ripartizioneTorna = prev.totale === 0 || Math.abs(totaleRipartito - prev.totale) <= 0.01

  // Inizializza/reset scadenze quando cambia l'esercizio o nasce il preventivo
  useEffect(() => {
    if (esercizio && prev.preventivo) setScadenze(defaultScadenze(esercizio.anno, prev.totale))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esercizio?.id, prev.preventivo?.id])

  const sommaScadenze = round2(scadenze.reduce((s, x) => s + (parseFloat(x.importo) || 0), 0))
  const scadenzeTornano = Math.abs(sommaScadenze - prev.totale) <= 0.01 && prev.totale > 0
  const tabelleMillesimali = mill.tabelle || []

  // ── azioni voci ────────────────────────────────────────────
  async function aggiungiVoce() {
    if (!nv.descrizione.trim()) { setErr('La voce deve avere una descrizione'); return }
    if (nv.criterio === 'millesimi' && !nv.tabella_millesimale_id) { setErr('Scegli la tabella millesimale per la voce'); return }
    setErr('')
    try {
      await prev.aggiungiVoce(nv)
      setNv({ descrizione: '', categoria: '', importo: '', criterio: 'millesimi', tabella_millesimale_id: '' })
    } catch (e) { setErr(e.message) }
  }

  // ── azioni scadenze ────────────────────────────────────────
  function ripartisciEqualmente() {
    const n = scadenze.length || 4
    const base = round2(prev.totale / n)
    setScadenze(scadenze.map((s, i) => ({ ...s, importo: i < n - 1 ? base : round2(prev.totale - base * (n - 1)) })))
  }
  function rateTrimestrali() {
    if (esercizio) setScadenze(defaultScadenze(esercizio.anno, prev.totale))
  }
  function aggiornaScadenza(i, patch) {
    setScadenze(scadenze.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  function aggiungiScadenza() {
    const n = scadenze.length
    setScadenze([...scadenze, { numero: n + 1, scadenza: `${esercizio?.anno || ''}-12-31`, descrizione: `Rata ${n + 1}`, importo: 0 }])
  }
  function rimuoviScadenza(i) {
    setScadenze(scadenze.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, numero: idx + 1 })))
  }

  // ── genera rate ────────────────────────────────────────────
  async function handleGenera() {
    setErr(''); setMsg('')
    if (!scadenzeTornano) { setErr('Bilancia le rate sul totale prima di generare'); return }
    if (!ripartizioneTorna) { setErr('La ripartizione non copre il totale: controlla i millesimi delle voci'); return }
    if (prev.preventivo?.stato === 'approvato') {
      const ok = window.confirm('Rigenerare le rate sovrascrive gli importi di piano e azzera gli stati di pagamento già registrati. Continuare?')
      if (!ok) return
    }
    try {
      setBusy(true)
      const res = await prev.generaRate({
        scadenze, unitaList: unita,
        getMillesimiUnita: mill.getMillesimiUnita, getTotaleTabella: mill.getTotaleTabella,
      })
      setMsg(`Generate ${res.nRate} rate e ${res.nCelle} importi per unità (totale ${eur(res.totale)}). Trovi gli stati di pagamento nella scheda Rate.`)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  // ── render ─────────────────────────────────────────────────
  if (!esercizio) {
    return (
      <div style={st.empty}>
        <AlertCircle size={34} color="var(--text-muted)" style={{ marginBottom: 12 }} />
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nessun esercizio contabile</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Crea un esercizio dalla sezione Spese per impostare il preventivo</p>
      </div>
    )
  }

  return (
    <div>
      {/* Selettore esercizio */}
      {esercizi.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {esercizi.map((es) => (
            <button key={es.id} onClick={() => setEsercizio(es)} style={st.esBtn(esercizio?.id === es.id)}>
              {es.anno}
              <span style={st.esTag(es.stato === 'aperto')}>{es.stato}</span>
            </button>
          ))}
        </div>
      )}

      {msg && <div style={st.okMsg}><CheckCircle2 size={15} /> {msg}</div>}
      {err && <div style={st.errMsg}><AlertCircle size={15} /> {err}</div>}

      {!prev.preventivo ? (
        <div style={st.empty}>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 14px' }}>Nessun preventivo per l'esercizio {esercizio.anno}.</p>
          <button style={st.btnPrimary} onClick={() => prev.creaPreventivo().catch((e) => setErr(e.message))}>
            <Plus size={15} style={{ marginRight: 6 }} /> Crea preventivo {esercizio.anno}
          </button>
        </div>
      ) : (
        <>
          {/* ── VOCI DI SPESA ── */}
          <div style={st.section}>
            <div style={st.sectionHead}>
              <span style={st.sectionTitle}>Voci di spesa preventivate</span>
              <span style={st.totBadge}>Totale {eur(prev.totale)}</span>
            </div>

            {prev.voci.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 14px' }}>Aggiungi le voci di spesa e scegli per ognuna il criterio di ripartizione.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {prev.voci.map((v) => (
                  <VoceRow key={v.id} voce={v} tabelle={tabelleMillesimali}
                    onSave={(patch) => prev.aggiornaVoce(v.id, patch).catch((e) => setErr(e.message))}
                    onDelete={() => prev.eliminaVoce(v.id).catch((e) => setErr(e.message))} />
                ))}
              </div>
            )}

            {/* form nuova voce */}
            <div style={st.addRow}>
              <input style={{ ...st.input, flex: 2 }} placeholder="Descrizione (es. Pulizie scale)"
                value={nv.descrizione} onChange={(e) => setNv({ ...nv, descrizione: e.target.value })} />
              <input style={{ ...st.input, flex: 1 }} placeholder="Categoria"
                value={nv.categoria} onChange={(e) => setNv({ ...nv, categoria: e.target.value })} />
              <input style={{ ...st.input, width: 110 }} type="number" placeholder="Importo €"
                value={nv.importo} onChange={(e) => setNv({ ...nv, importo: e.target.value })} />
              <select style={{ ...st.input, width: 130 }} value={nv.criterio}
                onChange={(e) => setNv({ ...nv, criterio: e.target.value })}>
                <option value="millesimi">Millesimi</option>
                <option value="parti_uguali">Parti uguali</option>
              </select>
              <select style={{ ...st.input, width: 150, opacity: nv.criterio === 'millesimi' ? 1 : 0.4 }}
                disabled={nv.criterio !== 'millesimi'} value={nv.tabella_millesimale_id}
                onChange={(e) => setNv({ ...nv, tabella_millesimale_id: e.target.value })}>
                <option value="">— tabella —</option>
                {tabelleMillesimali.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              <button style={st.btnAdd} onClick={aggiungiVoce}><Plus size={16} /></button>
            </div>
          </div>

          {/* ── ANTEPRIMA RIPARTIZIONE ── */}
          {prev.voci.length > 0 && (
            <div style={st.section}>
              <div style={st.sectionHead}>
                <span style={st.sectionTitle}>Anteprima ripartizione annua per unità</span>
                <span style={{ ...st.totBadge, color: ripartizioneTorna ? '#10b981' : '#f59e0b', borderColor: (ripartizioneTorna ? '#10b981' : '#f59e0b') + '55' }}>
                  Ripartito {eur(totaleRipartito)}
                </span>
              </div>
              {!ripartizioneTorna && (
                <p style={{ color: '#f59e0b', fontSize: 12, margin: '0 0 10px' }}>
                  Il ripartito non coincide col totale: alcune voci a millesimi potrebbero avere unità senza valore millesimale.
                </p>
              )}
              <div style={st.previewBox}>
                {unita.map((u) => {
                  const p = getProprietario(u)
                  return (
                    <div key={u.id} style={st.previewRow}>
                      <span style={{ color: 'var(--text-primary)' }}>Unità {u.numero}{p ? ` · ${p.cognome} ${p.nome}` : ''}</span>
                      <span style={{ color: '#60a5fa', fontWeight: 600 }}>{eur(perUnita[u.id] || 0)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── SCADENZE ── */}
          <div style={st.section}>
            <div style={st.sectionHead}>
              <span style={st.sectionTitle}>Rate e scadenze</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={st.btnGhost} onClick={rateTrimestrali}>4 rate trimestrali</button>
                <button style={st.btnGhost} onClick={ripartisciEqualmente}><Equal size={13} style={{ marginRight: 4 }} />Ripartisci equamente</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {scadenze.map((s, i) => (
                <div key={i} style={st.scadRow}>
                  <span style={st.scadNum}>{s.numero}</span>
                  <input style={{ ...st.input, flex: 1 }} value={s.descrizione}
                    onChange={(e) => aggiornaScadenza(i, { descrizione: e.target.value })} />
                  <input style={{ ...st.input, width: 150 }} type="date" value={s.scadenza}
                    onChange={(e) => aggiornaScadenza(i, { scadenza: e.target.value })} />
                  <input style={{ ...st.input, width: 120 }} type="number" value={s.importo}
                    onChange={(e) => aggiornaScadenza(i, { importo: e.target.value })} />
                  <button style={st.btnIcon} onClick={() => rimuoviScadenza(i)}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <button style={st.btnGhost} onClick={aggiungiScadenza}><Plus size={13} style={{ marginRight: 4 }} />Aggiungi rata</button>
              <span style={{ fontSize: 13, color: scadenzeTornano ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                Somma rate {eur(sommaScadenze)} / Totale {eur(prev.totale)}
                {!scadenzeTornano && prev.totale > 0 && ` (Δ ${eur(sommaScadenze - prev.totale)})`}
              </span>
            </div>
          </div>

          {/* ── GENERA ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <button style={{ ...st.btnGenera, opacity: busy || !scadenzeTornano ? 0.5 : 1 }}
              disabled={busy || !scadenzeTornano} onClick={handleGenera}>
              <Wand2 size={16} style={{ marginRight: 8 }} />
              {busy ? 'Generazione...' : (prev.preventivo?.stato === 'approvato' ? 'Rigenera rate' : 'Genera rate')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Riga voce (modifica inline, salva su blur) ───────────────
function VoceRow({ voce, tabelle, onSave, onDelete }) {
  const [d, setD] = useState(voce.descrizione || '')
  const [cat, setCat] = useState(voce.categoria || '')
  const [imp, setImp] = useState(voce.importo ?? '')
  const [crit, setCrit] = useState(voce.criterio || 'millesimi')
  const [tab, setTab] = useState(voce.tabella_millesimale_id || '')

  return (
    <div style={st.voceRow}>
      <input style={{ ...st.input, flex: 2 }} value={d} onChange={(e) => setD(e.target.value)}
        onBlur={() => d !== voce.descrizione && onSave({ descrizione: d })} />
      <input style={{ ...st.input, flex: 1 }} value={cat} placeholder="Categoria"
        onChange={(e) => setCat(e.target.value)} onBlur={() => cat !== (voce.categoria || '') && onSave({ categoria: cat || null })} />
      <input style={{ ...st.input, width: 110 }} type="number" value={imp} onChange={(e) => setImp(e.target.value)}
        onBlur={() => parseFloat(imp || 0) !== parseFloat(voce.importo || 0) && onSave({ importo: imp })} />
      <select style={{ ...st.input, width: 130 }} value={crit}
        onChange={(e) => { setCrit(e.target.value); onSave({ criterio: e.target.value, tabella_millesimale_id: e.target.value === 'parti_uguali' ? null : tab }) }}>
        <option value="millesimi">Millesimi</option>
        <option value="parti_uguali">Parti uguali</option>
      </select>
      <select style={{ ...st.input, width: 150, opacity: crit === 'millesimi' ? 1 : 0.4 }} disabled={crit !== 'millesimi'}
        value={tab} onChange={(e) => { setTab(e.target.value); onSave({ tabella_millesimale_id: e.target.value }) }}>
        <option value="">— tabella —</option>
        {tabelle.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </select>
      <button style={st.btnIcon} onClick={onDelete}><Trash2 size={15} /></button>
    </div>
  )
}

const st = {
  empty: { textAlign: 'center', padding: 40, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border-color)' },
  section: { background: 'var(--card-bg)', borderRadius: 12, padding: '18px 20px', marginBottom: 14, border: '1px solid var(--border-color)' },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 },
  sectionTitle: { color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' },
  totBadge: { fontSize: 13, fontWeight: 700, color: '#60a5fa', border: '1px solid #2563eb55', borderRadius: 8, padding: '4px 12px' },
  input: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 13, outline: 'none' },
  voceRow: { display: 'flex', gap: 8, alignItems: 'center' },
  addRow: { display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: 14 },
  scadRow: { display: 'flex', gap: 8, alignItems: 'center' },
  scadNum: { width: 26, height: 26, borderRadius: 6, background: 'rgba(37,99,235,0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 },
  previewBox: { maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 },
  previewRow: { display: 'flex', justifyContent: 'space-between', background: 'var(--app-bg)', borderRadius: 8, padding: '8px 12px', fontSize: 13 },
  btnPrimary: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', display: 'inline-flex', alignItems: 'center' },
  btnGenera: { background: 'linear-gradient(135deg, #2563eb, #8b5cf6)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Sora, sans-serif', display: 'inline-flex', alignItems: 'center' },
  btnGhost: { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', display: 'inline-flex', alignItems: 'center' },
  btnAdd: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, width: 38, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  btnIcon: { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  okMsg: { display: 'flex', alignItems: 'center', gap: 8, background: '#10b98115', border: '1px solid #10b98140', borderRadius: 10, padding: '10px 14px', color: '#10b981', fontSize: 13, marginBottom: 14 },
  errMsg: { display: 'flex', alignItems: 'center', gap: 8, background: '#ef444415', border: '1px solid #ef444440', borderRadius: 10, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 14 },
  esBtn: (active) => ({ padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: `1px solid ${active ? '#2563eb' : 'var(--border-color)'}`, background: active ? 'rgba(37,99,235,0.15)' : 'transparent', color: active ? '#60a5fa' : '#64748b', fontFamily: 'Sora, sans-serif', fontWeight: active ? 600 : 400 }),
  esTag: (aperto) => ({ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 4, background: aperto ? '#10b98122' : '#64748b22', color: aperto ? '#10b981' : '#64748b' }),
}
