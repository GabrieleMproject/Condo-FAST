// src/components/SaldiInizialiTab.jsx
import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useEsercizi } from '../hooks/useEsercizi'
import { useSaldiIniziali } from '../hooks/useSaldiIniziali'
import { estraiSaldiConsuntivo } from '../lib/fileExtractor'
import { Loader2, FileText, Check } from 'lucide-react'

const inputStyle = {
  width: '100%', background: 'var(--app-bg)', color: 'var(--text-primary)',
  border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 10px',
  fontSize: 13, fontFamily: 'Sora, sans-serif', boxSizing: 'border-box'
}

const fmt = (v) => v == null || v === '' ? '—'
  : `€${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`

export default function SaldiInizialiTab({ condominioId }) {
  const { esercizi, fetch: fetchEsercizi } = useEsercizi(condominioId)
  const { saldi, saldoCassa, loading, fetch, salvaSaldi, salvaSaldoCassa, calcolaDaEsercizio } =
    useSaldiIniziali(condominioId)

  const [esercizioId, setEsercizioId] = useState('')
  const [unita, setUnita] = useState([])
  const [input, setInput] = useState({})        // { [unita_id]: { saldo, note } }
  const [cassaInput, setCassaInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)          // { tipo:'ok'|'err', testo }

  // Import AI
  const [loadingImport, setLoadingImport] = useState(false)
  const [mapping, setMapping] = useState(null)  // { righe:[{numero,nominativo,saldo,unita_id}], cassa }
  const fileRef = useRef()

  useEffect(() => { fetchEsercizi() }, [fetchEsercizi])

  // Unità del condominio
  useEffect(() => {
    if (!condominioId) return
    supabase.from('unita').select('id, numero, piano').eq('condominio_id', condominioId)
      .order('numero')
      .then(({ data }) => setUnita(data || []))
  }, [condominioId])

  // Auto-seleziona l'esercizio più recente
  useEffect(() => {
    if (!esercizioId && esercizi.length) setEsercizioId(esercizi[0].id)
  }, [esercizi, esercizioId])

  // Carica saldi quando cambia esercizio
  useEffect(() => { if (esercizioId) fetch(esercizioId) }, [esercizioId, fetch])

  // Popola input da DB
  useEffect(() => {
    const init = {}
    saldi.forEach(s => { init[s.unita_id] = { saldo: String(s.saldo ?? ''), note: s.note ?? '' } })
    setInput(init)
  }, [saldi])

  useEffect(() => {
    setCassaInput(saldoCassa != null ? String(saldoCassa) : '')
  }, [saldoCassa])

  const esercizioCorr = useMemo(
    () => esercizi.find(e => e.id === esercizioId), [esercizi, esercizioId]
  )

  // Esercizio precedente in CondoSmart (anno − 1) con rate presenti
  const esercizioPrec = useMemo(() => {
    if (!esercizioCorr) return null
    return esercizi.find(e => e.anno === (esercizioCorr.anno - 1)) || null
  }, [esercizi, esercizioCorr])

  const setSaldo = (uid, v) => setInput(m => ({ ...m, [uid]: { ...(m[uid] || {}), saldo: v } }))
  const setNota  = (uid, v) => setInput(m => ({ ...m, [uid]: { ...(m[uid] || {}), note: v } }))

  const totale = useMemo(
    () => unita.reduce((s, u) => s + (parseFloat(input[u.id]?.saldo) || 0), 0),
    [unita, input]
  )

  // ── Salva tutto ────────────────────────────────────────────────────────────
  const handleSalva = async () => {
    if (!esercizioId) return
    setSaving(true); setMsg(null)
    try {
      const valori = unita
        .filter(u => input[u.id]?.saldo !== undefined && input[u.id]?.saldo !== '')
        .map(u => ({ unita_id: u.id, saldo: input[u.id].saldo, note: input[u.id].note }))
      await salvaSaldi(esercizioId, valori)
      await salvaSaldoCassa(esercizioId, cassaInput === '' ? null : cassaInput)
      setMsg({ tipo: 'ok', testo: 'Saldi iniziali salvati.' })
    } catch (e) {
      setMsg({ tipo: 'err', testo: e.message || 'Errore nel salvataggio.' })
    } finally {
      setSaving(false)
    }
  }

  // ── Auto-riporto dall'esercizio precedente ──────────────────────────────────
  const handleRiporta = async () => {
    if (!esercizioPrec) return
    setMsg(null)
    try {
      const calcolati = await calcolaDaEsercizio(esercizioPrec.id)
      if (!calcolati.length) {
        setMsg({ tipo: 'err', testo: `Nessuna rata trovata sull'esercizio ${esercizioPrec.anno}. Inserisci i saldi a mano o carica il consuntivo.` })
        return
      }
      setInput(m => {
        const next = { ...m }
        calcolati.forEach(c => {
          next[c.unita_id] = { ...(next[c.unita_id] || {}), saldo: String(c.saldo) }
        })
        return next
      })
      setMsg({ tipo: 'ok', testo: `Saldi proposti dall'esercizio ${esercizioPrec.anno}. Verifica e salva.` })
    } catch (e) {
      setMsg({ tipo: 'err', testo: e.message || 'Errore nel calcolo.' })
    }
  }

  // ── Import da consuntivo PDF/immagine (AI) ──────────────────────────────────
  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoadingImport(true); setMsg(null)
    try {
      const dati = await estraiSaldiConsuntivo(file)
      const righe = (dati.saldi_unita || []).map(r => {
        // auto-match per numero unità
        const match = r.numero != null
          ? unita.find(u => String(u.numero) === String(r.numero))
          : null
        return {
          numero: r.numero ?? '',
          nominativo: r.nominativo ?? '',
          saldo: r.saldo,
          unita_id: match?.id || '',
        }
      })
      setMapping({ righe, cassa: dati.saldo_cassa_finale ?? null })
    } catch (err) {
      console.error('Errore estrazione consuntivo:', err)
      setMsg({ tipo: 'err', testo: 'Impossibile estrarre i saldi dal file. Verifica il documento o inserisci a mano.' })
    } finally {
      setLoadingImport(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const setMapUnita = (idx, unitaId) =>
    setMapping(m => ({ ...m, righe: m.righe.map((r, i) => i === idx ? { ...r, unita_id: unitaId } : r) }))

  const applicaMapping = () => {
    if (!mapping) return
    setInput(m => {
      const next = { ...m }
      mapping.righe.forEach(r => {
        if (r.unita_id) next[r.unita_id] = { ...(next[r.unita_id] || {}), saldo: String(r.saldo) }
      })
      return next
    })
    if (mapping.cassa != null) setCassaInput(String(mapping.cassa))
    setMapping(null)
    setMsg({ tipo: 'ok', testo: 'Saldi importati dal consuntivo. Verifica le associazioni e salva.' })
  }

  if (!esercizi.length) {
    return <div style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>
      Nessun esercizio. Crea prima un esercizio per impostare i saldi iniziali.
    </div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Barra: esercizio + azioni import */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>Esercizio</label>
          <select style={{ ...inputStyle, width: 180 }} value={esercizioId} onChange={e => setEsercizioId(e.target.value)}>
            {esercizi.map(e => <option key={e.id} value={e.id}>{e.anno} ({e.stato})</option>)}
          </select>
        </div>

        <button
          onClick={handleRiporta}
          disabled={!esercizioPrec}
          title={esercizioPrec ? `Calcola dai dati ${esercizioPrec.anno}` : 'Nessun esercizio precedente in CondoSmart'}
          style={{
            background: esercizioPrec ? '#0e7490' : '#1e293b',
            color: esercizioPrec ? '#fff' : '#475569',
            border: '1px solid var(--border-color)', borderRadius: 8, padding: '9px 16px',
            fontSize: 13, fontWeight: 600, cursor: esercizioPrec ? 'pointer' : 'not-allowed',
            fontFamily: 'Sora, sans-serif'
          }}
        >
          ↩︎ Riporta da {esercizioPrec ? esercizioPrec.anno : 'anno prec.'}
        </button>

        <button
          onClick={() => !loadingImport && fileRef.current?.click()}
          style={{
            background: loadingImport ? '#1e3a6e' : '#7c3aed', color: '#fff', border: 'none',
            borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600,
            cursor: loadingImport ? 'not-allowed' : 'pointer', fontFamily: 'Sora, sans-serif'
          }}
        >
          {loadingImport ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Estrazione…
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FileText size={14} /> Carica consuntivo anno prec.
            </span>
          )}
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.xls,.csv,.txt"
          style={{ display: 'none' }} onChange={handleFile} />
      </div>

      {msg && (
        <div style={{
          background: msg.tipo === 'ok' ? '#10b98122' : '#ef444422',
          border: `1px solid ${msg.tipo === 'ok' ? '#10b98144' : '#ef444444'}`,
          color: msg.tipo === 'ok' ? '#10b981' : '#ef4444',
          borderRadius: 8, padding: '8px 12px', fontSize: 13
        }}>{msg.testo}</div>
      )}

      {/* Fondo cassa riportato */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '16px 18px' }}>
        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>
          Fondo cassa riportato (saldo c/c al 31/12 dell'anno precedente)
        </label>
        <input type="number" step="0.01" style={{ ...inputStyle, maxWidth: 240 }}
          placeholder="0.00" value={cassaInput} onChange={e => setCassaInput(e.target.value)} />
      </div>

      {/* Griglia saldi per unità */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 12 }}>
          Saldo iniziale per unità — <span style={{ color: '#10b981' }}>positivo = credito</span> · <span style={{ color: '#ef4444' }}>negativo = debito</span>
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--app-bg)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>Unità</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>Piano</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', width: 160 }}>Saldo €</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {unita.map((u, i) => {
                const val = parseFloat(input[u.id]?.saldo)
                const col = Number.isFinite(val) ? (val < 0 ? '#ef4444' : val > 0 ? '#10b981' : '#94a3b8') : '#94a3b8'
                return (
                  <tr key={u.id} style={{ borderTop: i > 0 ? '1px solid var(--border-color-2)' : 'none' }}>
                    <td style={{ padding: '6px 12px', color: 'var(--text-primary)' }}>{u.numero || '—'}</td>
                    <td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>{u.piano ?? '—'}</td>
                    <td style={{ padding: '5px 12px', textAlign: 'right' }}>
                      <input type="number" step="0.01"
                        style={{ ...inputStyle, textAlign: 'right', color: col, maxWidth: 140 }}
                        placeholder="0.00"
                        value={input[u.id]?.saldo ?? ''}
                        onChange={e => setSaldo(u.id, e.target.value)} />
                    </td>
                    <td style={{ padding: '5px 12px' }}>
                      <input style={inputStyle} placeholder="—"
                        value={input[u.id]?.note ?? ''}
                        onChange={e => setNota(u.id, e.target.value)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--border-color)', background: 'var(--app-bg)' }}>
                <td colSpan={2} style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>Totale saldi</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700,
                  color: totale < 0 ? '#ef4444' : totale > 0 ? '#10b981' : '#94a3b8' }}>
                  {fmt(totale)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSalva} disabled={saving || loading}
          style={{
            background: saving ? '#1e3a6e' : '#2563eb', color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Sora, sans-serif'
          }}>
          {saving ? 'Salvataggio…' : 'Salva saldi iniziali'}
        </button>
      </div>

      {/* Modal mapping import AI */}
      {mapping && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000099', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 28, maxWidth: 640, width: '100%',
            border: '1px solid #7c3aed66', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 6px', color: 'var(--text-primary)', fontSize: 17 }}>Associa i saldi estratti alle unità</h3>
            <p style={{ margin: '0 0 18px', color: 'var(--text-muted)', fontSize: 12 }}>
              Controlla l'abbinamento proposto e correggilo dove serve. Le righe senza unità verranno ignorate.
            </p>
            {mapping.cassa != null && (
              <div style={{ background: 'var(--app-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
                Fondo cassa rilevato: <strong style={{ color: 'var(--text-primary)' }}>{fmt(mapping.cassa)}</strong>
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Estratto</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Saldo</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>→ Unità</th>
                </tr>
              </thead>
              <tbody>
                {mapping.righe.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-color-2)' }}>
                    <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>
                      {r.nominativo || '—'} {r.numero ? <span style={{ color: 'var(--text-muted)' }}>(n° {r.numero})</span> : null}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: r.saldo < 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                      {fmt(r.saldo)}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <select style={{ ...inputStyle, width: 200 }} value={r.unita_id}
                        onChange={e => setMapUnita(i, e.target.value)}>
                        <option value="">— ignora —</option>
                        {unita.map(u => <option key={u.id} value={u.id}>Unità {u.numero}{u.piano != null ? ` · p.${u.piano}` : ''}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 22 }}>
              <button onClick={() => setMapping(null)} style={{
                background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)',
                borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}>
                Annulla
              </button>
              <button onClick={applicaMapping} style={{
                background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={14} /> Applica alla griglia</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}