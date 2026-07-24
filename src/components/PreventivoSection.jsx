// src/components/PreventivoSection.jsx
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useUnita } from '../hooks/useUnita'
import { useMillesimi } from '../hooks/useMillesimi'
import { usePreventivo, calcRipartizione } from '../hooks/usePreventivo'
import { useSaldiIniziali } from '../hooks/useSaldiIniziali'
import { estraiSaldiConsuntivo } from '../lib/fileExtractor'
import { 
  Plus, Trash2, Wand2, Equal, AlertCircle, CheckCircle2, 
  Wallet, FileText, Check, Loader2, ClipboardList, RefreshCw, AlertTriangle 
} from 'lucide-react'
import { toast } from 'react-hot-toast'

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

export default function PreventivoSection({ condominioId, esercizioId: esercizioIdProp, esercizioAttivo: esercizioAttivoProp, onSelectEsercizio }) {
  // Tab Interno: 'preventivo' | 'saldi'
  const [vistaAttiva, setVistaAttiva] = useState('preventivo')

  // --- STATI E HOOKS PREVENTIVO ---
  const [esercizi, setEsercizi] = useState([])
  const [esercizio, setEsercizio] = useState(esercizioAttivoProp || null)
  const [scadenze, setScadenze] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [nv, setNv] = useState({ descrizione: '', categoria: '', importo: '', criterio: 'millesimi', tabella_millesimale_id: '' })

  const { unita, getProprietario } = useUnita(condominioId)
  const mill = useMillesimi(condominioId)
  const prev = usePreventivo(condominioId, esercizio?.id)

  // --- STATI E HOOKS SALDI INIZIALI ---
  const { 
    saldi, saldoCassa, loading: loadingSaldi, fetch: fetchSaldi, 
    salvaSaldi, salvaSaldoCassa, calcolaDaEsercizio 
  } = useSaldiIniziali(condominioId)

  const [saldiInput, setSaldiInput] = useState({}) // { [unita_id]: { saldo, note } }
  const [cassaInput, setCassaInput] = useState('')
  const [savingSaldi, setSavingSaldi] = useState(false)
  const [loadingImport, setLoadingImport] = useState(false)
  const [mapping, setMapping] = useState(null) // { righe:[{numero,nominativo,saldo,unita_id}], cassa }
  const fileRef = useRef()

  // Esercizio precedente in CondoSmart (anno − 1)
  const esercizioPrec = useMemo(() => {
    if (!esercizio) return null
    return esercizi.find(e => e.anno === (esercizio.anno - 1)) || null
  }, [esercizi, esercizio])

  // --- CARICAMENTO DATI INIZIALI ---
  useEffect(() => {
    supabase.from('esercizi').select('*').eq('condominio_id', condominioId)
      .order('anno', { ascending: false })
      .then(({ data }) => {
        const lista = data || []
        setEsercizi(lista)
        if (esercizioIdProp) {
          const match = lista.find(e => e.id === esercizioIdProp)
          if (match) { setEsercizio(match); return }
        }
        setEsercizio(lista.find((e) => e.stato === 'aperto') || lista[0] || null)
      })
  }, [condominioId, esercizioIdProp])

  useEffect(() => {
    if (esercizioIdProp && esercizi.length > 0) {
      const match = esercizi.find(e => e.id === esercizioIdProp)
      if (match && match.id !== esercizio?.id) {
        setEsercizio(match)
      }
    }
  }, [esercizioIdProp, esercizi])

  useEffect(() => { mill.fetch() }, [mill.fetch])
  useEffect(() => { prev.fetch() }, [prev.fetch])

  // Ricarica saldi iniziali quando cambia l'esercizio selezionato
  useEffect(() => {
    if (esercizio?.id) {
      fetchSaldi(esercizio.id)
    }
  }, [esercizio?.id, fetchSaldi])

  // Sincronizza saldi iniziali caricati da DB con lo stato di input local
  useEffect(() => {
    const init = {}
    saldi.forEach(s => { init[s.unita_id] = { saldo: String(s.saldo ?? ''), note: s.note ?? '' } })
    setSaldiInput(init)
  }, [saldi])

  useEffect(() => {
    setCassaInput(saldoCassa != null ? String(saldoCassa) : '')
  }, [saldoCassa])

  // --- LOGICA RIAPERTURA RATE / PREVENTIVO ---
  const perUnita = useMemo(
    () => calcRipartizione(prev.voci, unita, mill.getMillesimiUnita, mill.getTotaleTabella),
    [prev.voci, unita, mill.getMillesimiUnita, mill.getTotaleTabella]
  )
  const totaleRipartito = round2(Object.values(perUnita).reduce((a, b) => a + b, 0))
  const ripartizioneTorna = prev.totale === 0 || Math.abs(totaleRipartito - prev.totale) <= 0.01

  useEffect(() => {
    if (esercizio && prev.preventivo) setScadenze(defaultScadenze(esercizio.anno, prev.totale))
  }, [esercizio?.id, prev.preventivo?.id])

  // Autoseleziona la prima tabella millesimale disponibile se non selezionata
  useEffect(() => {
    if (mill.tabelle && mill.tabelle.length > 0 && !nv.tabella_millesimale_id) {
      setNv(prevVal => ({ ...prevVal, tabella_millesimale_id: mill.tabelle[0].id }))
    }
  }, [mill.tabelle, nv.tabella_millesimale_id])

  const sommaScadenze = round2(scadenze.reduce((s, x) => s + (parseFloat(x.importo) || 0), 0))
  const scadenzeTornano = Math.abs(sommaScadenze - prev.totale) <= 0.01 && prev.totale > 0

  // Azioni Preventivo
  async function aggiungiVoce() {
    if (!nv.descrizione.trim()) { setErr('La voce deve avere una descrizione'); return }
    if (nv.criterio === 'millesimi' && !nv.tabella_millesimale_id) { setErr('Scegli la tabella millesimale per la voce'); return }
    setErr('')
    try {
      await prev.aggiungiVoce(nv)
      setNv({ descrizione: '', categoria: '', importo: '', criterio: 'millesimi', tabella_millesimale_id: '' })
    } catch (e) { setErr(e.message) }
  }

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

  // --- AZIONI SALDI INIZIALI ---
  const setSaldoInput = (uid, v) => setSaldiInput(m => ({ ...m, [uid]: { ...(m[uid] || {}), saldo: v } }))
  const setNotaInput  = (uid, v) => setSaldiInput(m => ({ ...m, [uid]: { ...(m[uid] || {}), note: v } }))

  const totaleSaldi = useMemo(
    () => unita.reduce((s, u) => s + (parseFloat(saldiInput[u.id]?.saldo) || 0), 0),
    [unita, saldiInput]
  )

  const handleSalvaSaldi = async () => {
    if (!esercizio?.id) return
    setSavingSaldi(true)
    try {
      const valori = unita
        .filter(u => saldiInput[u.id]?.saldo !== undefined && saldiInput[u.id]?.saldo !== '')
        .map(u => ({ unita_id: u.id, saldo: parseFloat(saldiInput[u.id].saldo) || 0, note: saldiInput[u.id].note }))
      
      await salvaSaldi(esercizio.id, valori)
      await salvaSaldoCassa(esercizio.id, cassaInput === '' ? null : parseFloat(cassaInput))
      toast.success('Saldi iniziali salvati con successo!')
    } catch (e) {
      toast.error('Errore nel salvataggio dei saldi: ' + e.message)
    } finally {
      setSavingSaldi(false)
    }
  }

  const handleRiportaSaldi = async () => {
    if (!esercizioPrec) return
    try {
      const calcolati = await calcolaDaEsercizio(esercizioPrec.id)
      if (!calcolati.length) {
        toast.error(`Nessuna rata o consuntivo trovato per l'esercizio ${esercizioPrec.anno}.`)
        return
      }
      setSaldiInput(m => {
        const next = { ...m }
        calcolati.forEach(c => {
          next[c.unita_id] = { ...(next[c.unita_id] || {}), saldo: String(c.saldo) }
        })
        return next
      })
      toast.success(`Saldi iniziali proposti a partire dall'esercizio ${esercizioPrec.anno}!`)
    } catch (e) {
      toast.error('Errore nel riporto dei saldi: ' + e.message)
    }
  }

  const handleFileSaldiImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoadingImport(true)
    try {
      const dati = await estraiSaldiConsuntivo(file)
      const righe = (dati.saldi_unita || []).map(r => {
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
      toast.success('File consuntivo analizzato con successo!')
    } catch (err) {
      console.error(err)
      toast.error('Impossibile estrarre i saldi dal file. Inserisci manualmente.')
    } finally {
      setLoadingImport(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const setMapUnita = (idx, unitaId) =>
    setMapping(m => ({ ...m, righe: m.righe.map((r, i) => i === idx ? { ...r, unita_id: unitaId } : r) }))

  const applicaMapping = () => {
    if (!mapping) return
    setSaldiInput(m => {
      const next = { ...m }
      mapping.righe.forEach(r => {
        if (r.unita_id) next[r.unita_id] = { ...(next[r.unita_id] || {}), saldo: String(r.saldo) }
      })
      return next
    })
    if (mapping.cassa != null) setCassaInput(String(mapping.cassa))
    setMapping(null)
    toast.success('Saldi importati sulla griglia! Ricorda di salvare.')
  }

  // --- RENDER ---
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
    <div style={{ fontFamily: 'Sora, sans-serif' }}>
      
      {/* Switch di visualizzazione premium */}
      <div style={st.viewSelector}>
        <button 
          onClick={() => setVistaAttiva('preventivo')}
          style={st.selectorBtn(vistaAttiva === 'preventivo')}
        >
          <ClipboardList size={15} style={{ marginRight: 6 }} /> Preventivo Spese
        </button>
        <button 
          onClick={() => setVistaAttiva('saldi')}
          style={st.selectorBtn(vistaAttiva === 'saldi')}
        >
          <Wallet size={15} style={{ marginRight: 6 }} /> Saldi Iniziali
        </button>
      </div>

      {/* Selettore Esercizio */}
      {esercizi.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {esercizi.map((es) => (
            <button
              key={es.id}
              onClick={() => {
                setEsercizio(es)
                if (onSelectEsercizio) onSelectEsercizio(es.id)
              }}
              style={st.esBtn(esercizio?.id === es.id)}
            >
              {es.anno}
              <span style={st.esTag(es.stato === 'aperto')}>{es.stato}</span>
            </button>
          ))}
        </div>
      )}

      {msg && <div style={st.okMsg}><CheckCircle2 size={15} /> {msg}</div>}
      {err && <div style={st.errMsg}><AlertCircle size={15} /> {err}</div>}

      {/* -------------------- SEZIONE PREVENTIVO -------------------- */}
      {vistaAttiva === 'preventivo' && (
        <div>
          {!prev.preventivo ? (
            <div style={st.empty}>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 14px' }}>Nessun preventivo per l'esercizio {esercizio.anno}.</p>
              <button style={st.btnPrimary} onClick={() => prev.creaPreventivo().catch((e) => setErr(e.message))}>
                <Plus size={15} style={{ marginRight: 6 }} /> Crea preventivo {esercizio.anno}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
              
              {/* Voci di spesa */}
              <div style={st.card}>
                <h3 style={st.cardTitle}>Voci di spesa nel preventivo</h3>
                {prev.voci.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
                    Nessuna voce inserita. Aggiungi le spese previste qui sotto.
                  </p>
                ) : (
                  <table style={st.tbl}>
                    <thead>
                      <tr>
                        <th style={st.th}>Descrizione</th>
                        <th style={st.th}>Categoria</th>
                        <th style={{ ...st.th, textAlign: 'right' }}>Importo</th>
                        <th style={st.th}>Criterio</th>
                        <th style={{ ...st.th, textAlign: 'center' }}>Azione</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prev.voci.map((v) => {
                        const tabName = v.tabella_millesimale?.nome || 'Proprietà'
                        return (
                          <tr key={v.id} style={st.tr}>
                            <td style={{ ...st.td, fontWeight: 600 }}>{v.descrizione}</td>
                            <td style={{ ...st.td, textTransform: 'capitalize' }}>{v.categoria || 'altro'}</td>
                            <td style={{ ...st.td, textAlign: 'right', fontWeight: 600 }}>{eur(v.importo)}</td>
                            <td style={{ ...st.td, fontSize: 12, color: 'var(--text-secondary)' }}>
                              {v.criterio === 'millesimi' ? `Millesimi (${tabName})` : 'Quote uguali'}
                            </td>
                            <td style={{ ...st.td, textAlign: 'center' }}>
                              <button onClick={() => prev.eliminaVoce(v.id)} style={st.btnTrash}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                      <tr style={{ borderTop: '2px solid var(--border-color)', background: 'var(--app-bg)' }}>
                        <td colSpan={2} style={{ ...st.td, fontWeight: 700 }}>TOTALE PREVENTIVO</td>
                        <td style={{ ...st.td, textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>{eur(prev.totale)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tbody>
                  </table>
                )}

                {/* Form nuova voce */}
                <div style={st.formGroupRow}>
                  <input style={st.input} placeholder="Descrizione voce (es. Pulizia scale)" value={nv.descrizione} onChange={(e) => setNv({ ...nv, descrizione: e.target.value })} />
                  <select style={st.input} value={nv.categoria} onChange={(e) => setNv({ ...nv, categoria: e.target.value })}>
                    <option value="">-- Categoria spesa --</option>
                    <option value="manutenzione">Manutenzione</option>
                    <option value="utenze">Utenze</option>
                    <option value="assicurazione">Assicurazione</option>
                    <option value="amministrazione">Amministrazione</option>
                    <option value="straordinaria">Straordinaria</option>
                    <option value="altro">Altro</option>
                  </select>
                  <input style={st.input} type="number" step="0.01" placeholder="Importo €" value={nv.importo} onChange={(e) => setNv({ ...nv, importo: e.target.value })} />
                  <select style={st.input} value={nv.criterio} onChange={(e) => setNv({ ...nv, criterio: e.target.value })}>
                    <option value="millesimi">Criterio: Millesimi</option>
                    <option value="parti_uguali">Criterio: Parti uguali</option>
                  </select>
                  {nv.criterio === 'millesimi' && (
                    <select style={st.input} value={nv.tabella_millesimale_id} onChange={(e) => setNv({ ...nv, tabella_millesimale_id: e.target.value })}>
                      <option value="">-- Tabella millesimale --</option>
                      {mill.tabelle.map((t) => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  )}
                  <button onClick={aggiungiVoce} style={st.btnSuccess}>
                    <Plus size={14} style={{ marginRight: 4 }} /> Aggiungi
                  </button>
                </div>
              </div>

              {/* Rateizzazione e Scadenze */}
              <div style={st.card}>
                <h3 style={st.cardTitle}>Pianificazione Rate</h3>
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  <button onClick={ripartisciEqualmente} style={st.btnPill}>
                    <Equal size={12} style={{ marginRight: 4 }} /> Uguali
                  </button>
                  <button onClick={rateTrimestrali} style={st.btnPill}>
                    <Wand2 size={12} style={{ marginRight: 4 }} /> Trimestrali
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {scadenze.map((s, idx) => (
                    <div key={idx} style={st.rataRow}>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 20 }}>#{s.numero}</span>
                      <input style={{ ...st.input, padding: 6, minWidth: 90 }} type="text" value={s.descrizione} onChange={(e) => aggiornaScadenza(idx, { descrizione: e.target.value })} />
                      <input style={{ ...st.input, padding: 6, minWidth: 110 }} type="date" value={s.scadenza} onChange={(e) => aggiornaScadenza(idx, { scadenza: e.target.value })} />
                      <input style={{ ...st.input, padding: 6, textAlign: 'right', maxWidth: 75 }} type="number" step="0.01" value={s.importo} onChange={(e) => aggiornaScadenza(idx, { importo: e.target.value })} />
                      <button onClick={() => rimuoviScadenza(idx)} style={st.btnTrashTiny}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button onClick={aggiungiScadenza} style={st.btnLink}>+ Aggiungi rata</button>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Somma rate pianificate:</span>
                    <strong style={{ color: scadenzeTornano ? '#10b981' : '#ef4444' }}>{eur(sommaScadenze)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Ripartizione millesimi:</span>
                    <strong style={{ color: ripartizioneTorna ? '#10b981' : '#ef4444' }}>
                      {ripartizioneTorna ? 'Bilanciata' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Sbilanciata <AlertTriangle size={13} /></span>}
                    </strong>
                  </div>

                  <button onClick={handleGenera} disabled={busy || prev.totale === 0} style={{ ...st.btnPrimary, width: '100%', justifyContent: 'center', height: 42 }}>
                    {busy ? 'Generazione in corso...' : 'Genera rateizzazione'}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* -------------------- SEZIONE SALDI INIZIALI -------------------- */}
      {vistaAttiva === 'saldi' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          
          {/* Top Actions Saldi */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <button
              onClick={handleRiportaSaldi}
              disabled={!esercizioPrec}
              title={esercizioPrec ? `Calcola dai dati ${esercizioPrec.anno}` : 'Nessun esercizio precedente'}
              style={{
                background: esercizioPrec ? '#0e7490' : 'var(--card-bg)',
                color: esercizioPrec ? '#fff' : '#475569',
                border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 16px',
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
                borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600,
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
              style={{ display: 'none' }} onChange={handleFileSaldiImport} />
          </div>

          {/* Fondo cassa */}
          <div style={st.card}>
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>
              Fondo cassa riportato (saldo c/c al 31/12 dell'anno precedente)
            </label>
            <input type="number" step="0.01" style={{ ...st.input, maxWidth: 240 }}
              placeholder="0.00" value={cassaInput} onChange={e => setCassaInput(e.target.value)} />
          </div>

          {/* Griglia saldi */}
          <div style={{ ...st.card, padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: 12 }}>
            <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 12, background: 'var(--card-bg)' }}>
              Saldo iniziale per unità — <span style={{ color: '#10b981', fontWeight: 600 }}>positivo = credito</span> · <span style={{ color: '#ef4444', fontWeight: 600 }}>negativo = debito</span>
            </div>
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              <table style={st.tbl}>
                <thead>
                  <tr style={{ background: 'var(--app-bg)' }}>
                    <th style={{ ...st.th, padding: '8px 12px' }}>Unità</th>
                    <th style={{ ...st.th, padding: '8px 12px' }}>Piano</th>
                    <th style={{ ...st.th, padding: '8px 12px', textAlign: 'right', width: 160 }}>Saldo €</th>
                    <th style={{ ...st.th, padding: '8px 12px' }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {unita.map((u, i) => {
                    const val = parseFloat(saldiInput[u.id]?.saldo)
                    const col = Number.isFinite(val) ? (val < 0 ? '#ef4444' : val > 0 ? '#10b981' : '#94a3b8') : '#94a3b8'
                    return (
                      <tr key={u.id} style={{ borderTop: i > 0 ? '1px solid var(--border-color-2)' : 'none' }}>
                        <td style={{ ...st.td, padding: '6px 12px' }}>{u.numero || '—'}</td>
                        <td style={{ ...st.td, padding: '6px 12px', color: 'var(--text-secondary)' }}>{u.piano ?? '—'}</td>
                        <td style={{ padding: '5px 12px', textAlign: 'right' }}>
                          <input type="number" step="0.01"
                            style={{ ...st.input, textAlign: 'right', color: col, maxWidth: 140, padding: 6 }}
                            placeholder="0.00"
                            value={saldiInput[u.id]?.saldo ?? ''}
                            onChange={e => setSaldoInput(u.id, e.target.value)} />
                        </td>
                        <td style={{ padding: '5px 12px' }}>
                          <input style={{ ...st.input, padding: 6 }} placeholder="—"
                            value={saldiInput[u.id]?.note ?? ''}
                            onChange={e => setNotaInput(u.id, e.target.value)} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--border-color)', background: 'var(--app-bg)' }}>
                    <td colSpan={2} style={{ ...st.td, padding: '8px 12px', fontWeight: 700 }}>Totale saldi</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: totaleSaldi < 0 ? '#ef4444' : totaleSaldi > 0 ? '#10b981' : '#94a3b8' }}>
                      {totaleSaldi == null || totaleSaldi === '' ? '—' : `€${totaleSaldi.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Salva Saldi */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSalvaSaldi} disabled={savingSaldi || loadingSaldi} style={st.btnPrimary}>
              {savingSaldi ? 'Salvataggio…' : 'Salva saldi iniziali'}
            </button>
          </div>

        </div>
      )}

      {/* -------------------- MODALI CONDIVISE -------------------- */}

      {/* Modal mapping import AI */}
      {mapping && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000099', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 28, maxWidth: 640, width: '100%', border: '1px solid var(--border-color)', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 6px', color: 'var(--text-primary)', fontSize: 17, fontWeight: 700 }}>Associa i saldi estratti alle unità</h3>
            <p style={{ margin: '0 0 18px', color: 'var(--text-muted)', fontSize: 12 }}>
              Controlla l'abbinamento proposto e correggilo dove serve. Le righe senza unità verranno ignorate.
            </p>
            {mapping.cassa != null && (
              <div style={{ background: 'var(--app-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
                Fondo cassa rilevato: <strong style={{ color: 'var(--text-primary)' }}>{`€${Number(mapping.cassa).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}</strong>
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
                      {`€${Number(r.saldo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <select style={{ ...st.input, width: 200, padding: 6 }} value={r.unita_id} onChange={e => setMapUnita(i, e.target.value)}>
                        <option value="">— ignora —</option>
                        {unita.map(u => <option key={u.id} value={u.id}>Unità {u.numero}{u.piano != null ? ` · p.${u.piano}` : ''}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 22 }}>
              <button onClick={() => setMapping(null)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}>
                Annulla
              </button>
              <button onClick={applicaMapping} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={14} /> Applica alla griglia</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// Stili locali dedicati
const st = {
  viewSelector: { display: 'flex', gap: 10, borderBottom: '1px solid var(--border-color)', paddingBottom: 14, marginBottom: 20 },
  selectorBtn: (active) => ({
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer',
    border: 'none', background: active ? 'rgba(37,99,235,0.12)' : 'transparent',
    color: active ? '#60a5fa' : '#64748b', transition: 'all 0.15s', fontFamily: 'Sora, sans-serif',
    display: 'flex', alignItems: 'center'
  }),
  card: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 22 },
  cardTitle: { color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: '0 0 16px' },
  tbl: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left' },
  tr: { borderBottom: '1px solid var(--border-color-2)' },
  td: { padding: '12px', fontSize: 13, color: 'var(--text-primary)' },
  input: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 8, padding: '9px 10px', fontSize: 13, outline: 'none', fontFamily: 'Sora, sans-serif' },
  btnPrimary: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', display: 'inline-flex', alignItems: 'center' },
  btnSuccess: { background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', display: 'inline-flex', alignItems: 'center' },
  btnTrash: { background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: 4 },
  btnTrashTiny: { background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2 },
  btnPill: { background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'Sora, sans-serif', display: 'inline-flex', alignItems: 'center' },
  btnLink: { background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 12, padding: 0, fontWeight: 600, alignSelf: 'flex-start' },
  rataRow: { display: 'flex', alignItems: 'center', gap: 8 },
  formGroupRow: { display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' },
  esBtn: (active) => ({ padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: 'none', background: active ? 'rgba(37,99,235,0.12)' : 'transparent', color: active ? '#60a5fa' : '#64748b', fontFamily: 'Sora, sans-serif', fontWeight: active ? 700 : 400, display: 'inline-flex', alignItems: 'center', gap: 6 }),
  esTag: (open) => ({ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: open ? '#064e3b' : '#3f3f46', color: open ? '#34d399' : '#d4d4d8', fontWeight: 600 }),
  okMsg: { background: '#064e3b22', border: '1px solid #064e3b44', color: '#34d399', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 },
  errMsg: { background: '#ef444422', border: '1px solid #ef444444', color: '#f87171', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 },
  empty: { textAlign: 'center', padding: '48px 24px', background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }
}
