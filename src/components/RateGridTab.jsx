// src/components/RateGridTab.jsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useUnita } from '../hooks/useUnita'
import { CreditCard, X, CheckCircle2, Coins } from 'lucide-react'

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const eur = (n) => `€${(Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function deriveStato(importo, pagato) {
  if (pagato <= 0.001) return 'non_pagata'
  if (pagato < importo - 0.01) return 'parziale'
  if (pagato > importo + 0.01) return 'sovra_pagata'
  return 'pagata'
}

function cellInfo(cell, rata) {
  if (!cell) return { color: '#475569', bg: 'transparent', label: '—', importo: 0, pagato: 0, credito: 0, missing: true }
  const importo = parseFloat(cell.importo || 0)
  const pagato = parseFloat(cell.importo_pagato || 0)
  const credito = round2(pagato - importo)
  const overdue = cell.stato !== 'pagata' && cell.stato !== 'sovra_pagata' && rata?.data_scadenza && new Date(rata.data_scadenza) < new Date()
  let color = '#64748b', label = 'Non pagata'
  if (cell.stato === 'pagata') { color = '#10b981'; label = 'Pagata' }
  else if (cell.stato === 'sovra_pagata') { color = '#38bdf8'; label = 'Sovra-versata' }
  else if (cell.stato === 'parziale') { color = '#f59e0b'; label = 'Parziale' }
  else if (overdue) { color = '#ef4444'; label = 'Scaduta' }
  return { color, bg: color + '22', importo, pagato, credito, label, overdue, missing: false }
}

export default function RateGridTab({ condominioId }) {
  const navigate = useNavigate()
  const [esercizi, setEsercizi] = useState([])
  const [esercizio, setEsercizio] = useState(null)
  const [rate, setRate] = useState([])           // colonne
  const [cells, setCells] = useState([])          // rate_unita
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)    // { cell, rata, unita }

  const { unita, getProprietario } = useUnita(condominioId)

  useEffect(() => {
    supabase.from('esercizi').select('*').eq('condominio_id', condominioId)
      .order('anno', { ascending: false })
      .then(({ data }) => {
        setEsercizi(data || [])
        setEsercizio(data?.find((e) => e.stato === 'aperto') || data?.[0] || null)
      })
  }, [condominioId])

  async function loadGriglia() {
    if (!esercizio) { setLoading(false); return }
    setLoading(true)
    const { data: rateData } = await supabase
      .from('rate').select('*').eq('esercizio_id', esercizio.id)
      .order('numero_rata', { ascending: true })
    const rateList = rateData || []
    setRate(rateList)
    if (rateList.length) {
      const { data: cellData } = await supabase
        .from('rate_unita').select('*')
        .in('rata_id', rateList.map((r) => r.id))
      setCells(cellData || [])
    } else {
      setCells([])
    }
    setLoading(false)
  }
  useEffect(() => { loadGriglia() /* eslint-disable-next-line */ }, [esercizio?.id])

  // mappa { `${unitaId}_${rataId}` : cell }
  const cellMap = useMemo(() => {
    const m = {}
    cells.forEach((c) => { m[`${c.unita_id}_${c.rata_id}`] = c })
    return m
  }, [cells])

  // ── salva modifiche cella ──────────────────────────────────
  async function salvaCella(cell, patch) {
    const importo = patch.importo !== undefined ? parseFloat(patch.importo) || 0 : parseFloat(cell.importo || 0)
    const pagato = patch.importo_pagato !== undefined ? parseFloat(patch.importo_pagato) || 0 : parseFloat(cell.importo_pagato || 0)
    const upd = {
      importo,
      importo_pagato: pagato,
      data_pagamento: patch.data_pagamento !== undefined ? (patch.data_pagamento || null) : cell.data_pagamento,
      stato: deriveStato(importo, pagato),
      modificato_manualmente: patch.importo !== undefined ? true : cell.modificato_manualmente,
    }
    const { data, error } = await supabase.from('rate_unita').update(upd).eq('id', cell.id).select().single()
    if (error) { alert('Errore: ' + error.message); return }
    setCells((prev) => prev.map((c) => (c.id === cell.id ? data : c)))
    setEditing(null)
  }

  // ── totali ─────────────────────────────────────────────────
  const totRata = (rataId) => {
    const cs = cells.filter((c) => c.rata_id === rataId)
    return {
      dovuto: round2(cs.reduce((s, c) => s + parseFloat(c.importo || 0), 0)),
      pagato: round2(cs.reduce((s, c) => s + parseFloat(c.importo_pagato || 0), 0)),
    }
  }
  const totUnita = (unitaId) => {
    const cs = cells.filter((c) => c.unita_id === unitaId)
    return {
      dovuto: round2(cs.reduce((s, c) => s + parseFloat(c.importo || 0), 0)),
      pagato: round2(cs.reduce((s, c) => s + parseFloat(c.importo_pagato || 0), 0)),
    }
  }
  const totaleDovuto = round2(cells.reduce((s, c) => s + parseFloat(c.importo || 0), 0))
  const totalePagato = round2(cells.reduce((s, c) => s + parseFloat(c.importo_pagato || 0), 0))

  // ── render ─────────────────────────────────────────────────
  if (loading) return <div style={{ color: '#64748b', textAlign: 'center', padding: 32 }}>Caricamento griglia...</div>

  if (!esercizio) return (
    <div style={st.empty}><CreditCard size={32} color="#334155" style={{ marginBottom: 10 }} />
      <p style={{ color: '#64748b', margin: 0 }}>Nessun esercizio contabile</p></div>
  )

  return (
    <div>
      {/* Azione: riconciliazione incassi */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={() => navigate(`/condomini/${condominioId}/riconciliazioni-incassi`)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #16a34a, #2563eb)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}
        >
          <Coins size={15} /> Riconcilia incassi
        </button>
      </div>

      {/* Selettore esercizio */}
      {esercizi.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {esercizi.map((es) => (
            <button key={es.id} onClick={() => setEsercizio(es)} style={st.esBtn(esercizio?.id === es.id)}>
              {es.anno}<span style={st.esTag(es.stato === 'aperto')}>{es.stato}</span>
            </button>
          ))}
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Totale dovuto', value: eur(totaleDovuto), color: '#60a5fa' },
          { label: 'Totale incassato', value: eur(totalePagato), color: '#10b981' },
       { label: 'Residuo', value: eur(Math.max(0, totaleDovuto - totalePagato)), color: (totaleDovuto - totalePagato) > 0.01 ? '#f59e0b' : '#10b981' },
        ].map((k) => (
          <div key={k.label} style={{ background: '#1e293b', borderRadius: 10, padding: '14px 18px', border: `1px solid ${k.color}33` }}>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>{k.label}</div>
            <div style={{ color: k.color, fontSize: 20, fontWeight: 700 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {rate.length === 0 ? (
        <div style={st.empty}>
          <CreditCard size={32} color="#334155" style={{ marginBottom: 10 }} />
          <p style={{ color: '#94a3b8', margin: 0 }}>Nessuna rata generata per l'esercizio {esercizio.anno}</p>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 6 }}>Vai alla scheda Preventivo e genera le rate</p>
        </div>
      ) : (
        <div style={st.scrollWrap}>
          <table style={st.table}>
            <thead>
              <tr>
                <th style={{ ...st.th, ...st.stickyCol, textAlign: 'left' }}>Unità</th>
                {rate.map((r) => (
                  <th key={r.id} style={st.th}>
                    <div style={{ color: '#e2e8f0' }}>{r.descrizione || `Rata ${r.numero_rata}`}</div>
                    <div style={{ color: '#64748b', fontWeight: 400, fontSize: 11 }}>
                      {r.data_scadenza ? new Date(r.data_scadenza).toLocaleDateString('it-IT') : ''}
                    </div>
                  </th>
                ))}
                <th style={{ ...st.th, color: '#60a5fa' }}>Totale</th>
              </tr>
            </thead>
            <tbody>
              {unita.map((u) => {
                const p = getProprietario(u)
                const tu = totUnita(u.id)
                return (
                  <tr key={u.id}>
                    <td style={{ ...st.tdLabel, ...st.stickyCol }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 600 }}>Unità {u.numero}</div>
                      {p && <div style={{ color: '#64748b', fontSize: 11 }}>{p.cognome} {p.nome}</div>}
                    </td>
                    {rate.map((r) => {
                      const cell = cellMap[`${u.id}_${r.id}`]
                      const info = cellInfo(cell, r)
                      return (
                        <td key={r.id} style={st.td}>
                          <button
                            disabled={info.missing}
                            onClick={() => setEditing({ cell, rata: r, unita: u })}
                            style={{ ...st.cellBtn, background: info.bg, borderColor: info.color + '55', cursor: info.missing ? 'default' : 'pointer' }}
                            title={info.missing ? 'Cella assente: rigenera le rate' : info.label}
                          >
                            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{info.missing ? '—' : eur(info.importo)}</span>
                            {!info.missing && (
                              <span style={{ color: info.color, fontSize: 10, marginTop: 2 }}>
                                {info.label}
                                {info.label === 'Sovra-versata'
                                  ? ` · credito ${eur(info.credito)}`
                                  : (info.pagato > 0 && info.label !== 'Pagata' ? ` · ${eur(info.pagato)}` : '')}
                              </span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                    <td style={{ ...st.td, textAlign: 'right' }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{eur(tu.dovuto)}</div>
                      <div style={{ color: '#10b981', fontSize: 11 }}>{eur(tu.pagato)}</div>
                    </td>
                  </tr>
                )
              })}
              {/* riga totali per rata */}
              <tr>
                <td style={{ ...st.tdLabel, ...st.stickyCol, color: '#60a5fa', fontWeight: 700 }}>Totale rata</td>
                {rate.map((r) => {
                  const t = totRata(r.id)
                  return (
                    <td key={r.id} style={{ ...st.td, textAlign: 'center' }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{eur(t.dovuto)}</div>
                      <div style={{ color: '#10b981', fontSize: 11 }}>{eur(t.pagato)}</div>
                    </td>
                  )
                })}
                <td style={{ ...st.td, textAlign: 'right' }}>
                  <div style={{ color: '#60a5fa', fontWeight: 700 }}>{eur(totaleDovuto)}</div>
                  <div style={{ color: '#10b981', fontSize: 11 }}>{eur(totalePagato)}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <CellEditor
          {...editing}
          getProprietario={getProprietario}
          onClose={() => setEditing(null)}
          onSave={(patch) => salvaCella(editing.cell, patch)}
        />
      )}
    </div>
  )
}

// ── Editor cella (modale) ────────────────────────────────────
function CellEditor({ cell, rata, unita, getProprietario, onClose, onSave }) {
  const [importo, setImporto] = useState(cell.importo ?? 0)
  const [pagato, setPagato] = useState(cell.importo_pagato ?? 0)
  const [data, setData] = useState(cell.data_pagamento || '')
  const p = getProprietario(unita)

  const segnaPagata = () => onSave({
    importo_pagato: parseFloat(importo) || 0,
    data_pagamento: data || new Date().toISOString().split('T')[0],
  })

  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={st.modal} onClick={(e) => e.stopPropagation()}>
        <div style={st.modalHead}>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 700 }}>Unità {unita.numero}{p ? ` · ${p.cognome} ${p.nome}` : ''}</div>
            <div style={{ color: '#64748b', fontSize: 12 }}>
              {rata.descrizione || `Rata ${rata.numero_rata}`} · scad. {rata.data_scadenza ? new Date(rata.data_scadenza).toLocaleDateString('it-IT') : '—'}
            </div>
          </div>
          <button style={st.btnIcon} onClick={onClose}><X size={16} /></button>
        </div>

        <label style={st.fieldLabel}>Importo dovuto (piano)</label>
        <input style={st.input} type="number" value={importo} onChange={(e) => setImporto(e.target.value)} />
        <p style={{ color: '#475569', fontSize: 11, margin: '4px 0 12px' }}>Modificarlo segna la cella come "modificata manualmente".</p>

        <label style={st.fieldLabel}>Importo incassato</label>
        <input style={st.input} type="number" value={pagato} onChange={(e) => setPagato(e.target.value)} />

        <label style={{ ...st.fieldLabel, marginTop: 12 }}>Data pagamento</label>
        <input style={st.input} type="date" value={data || ''} onChange={(e) => setData(e.target.value)} />

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button style={st.btnGhost} onClick={segnaPagata}><CheckCircle2 size={15} style={{ marginRight: 6 }} />Segna pagata</button>
          <button style={st.btnPrimary} onClick={() => onSave({ importo, importo_pagato: pagato, data_pagamento: data })}>Salva</button>
        </div>
      </div>
    </div>
  )
}

const st = {
  empty: { textAlign: 'center', padding: 40, background: '#1e293b', borderRadius: 12, border: '1px solid #334155' },
  scrollWrap: { overflowX: 'auto', border: '1px solid #334155', borderRadius: 12 },
  table: { borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontFamily: 'Sora, sans-serif' },
  th: { background: '#0f172a', color: '#64748b', fontSize: 12, fontWeight: 700, padding: '12px 10px', textAlign: 'center', borderBottom: '1px solid #334155', whiteSpace: 'nowrap' },
  td: { padding: '8px 10px', borderBottom: '1px solid #1e293b', verticalAlign: 'middle' },
  tdLabel: { padding: '8px 12px', borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap' },
  stickyCol: { position: 'sticky', left: 0, background: '#1e293b', zIndex: 1 },
  cellBtn: { width: '100%', minWidth: 92, border: '1px solid', borderRadius: 8, padding: '8px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'Sora, sans-serif' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  modal: { background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 22, width: 360, maxWidth: '90vw', fontFamily: 'Sora, sans-serif' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 10 },
  fieldLabel: { display: 'block', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
  input: { width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '9px 10px', color: '#e2e8f0', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none' },
  btnPrimary: { flex: 1, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
  btnGhost: { flex: 1, background: 'transparent', color: '#10b981', border: '1px solid #10b98155', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  btnIcon: { background: 'transparent', color: '#64748b', border: '1px solid #334155', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  esBtn: (active) => ({ padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: `1px solid ${active ? '#2563eb' : '#334155'}`, background: active ? 'rgba(37,99,235,0.15)' : 'transparent', color: active ? '#60a5fa' : '#64748b', fontFamily: 'Sora, sans-serif', fontWeight: active ? 600 : 400 }),
  esTag: (aperto) => ({ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 4, background: aperto ? '#10b98122' : '#64748b22', color: aperto ? '#10b981' : '#64748b' }),
}