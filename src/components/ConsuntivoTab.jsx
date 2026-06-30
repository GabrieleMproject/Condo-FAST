// src/components/ConsuntivoTab.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useConsuntivo } from '../hooks/useConsuntivo'
import { useUnita } from '../hooks/useUnita'
import { useMillesimi } from '../hooks/useMillesimi'
import { estraiStrutturaConsuntivo } from '../lib/fileExtractor'
import { exportConsuntivoPdf } from '../lib/exportConsuntivo'
import { FileText, Upload, Download, RefreshCw } from 'lucide-react'

const eur = (n) => '€ ' + (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const sgn = (n) => (Number(n) < 0 ? '-' : '') + '€ ' + Math.abs(Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })

export default function ConsuntivoTab({ condominioId }) {
  const [condominio, setCondominio] = useState(null)
  const [esercizi, setEsercizi] = useState([])
  const [esercizioId, setEsercizioId] = useState(null)
  const [tabellaMillId, setTabellaMillId] = useState(null)
  const [uploadingTpl, setUploadingTpl] = useState(false)
  const [tplMsg, setTplMsg] = useState('')

  const { unita, getProprietario } = useUnita(condominioId)
  const { tabelle, fetch: fetchMill, getMillesimiUnita, getTotaleTabella } = useMillesimi(condominioId)
  const { data, template, loading, error, fetch } = useConsuntivo(condominioId, esercizioId)

  useEffect(() => {
    supabase.from('condomini').select('*').eq('id', condominioId).single()
      .then(({ data }) => setCondominio(data))
    supabase.from('esercizi').select('id, anno, stato').eq('condominio_id', condominioId)
      .order('anno', { ascending: false })
      .then(({ data }) => { setEsercizi(data || []); setEsercizioId(data?.find(e => e.stato === 'aperto')?.id || data?.[0]?.id || null) })
    fetchMill()
  }, [condominioId]) // eslint-disable-line

  useEffect(() => { if (tabelle.length && !tabellaMillId) setTabellaMillId(tabelle[0].id) }, [tabelle]) // eslint-disable-line
  useEffect(() => { if (esercizioId) fetch() }, [esercizioId, fetch])

  async function onTemplateFile(e) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setUploadingTpl(true); setTplMsg('Analisi modello con AI…')
    try {
      const struttura = await estraiStrutturaConsuntivo(file)
      const { data: { user } } = await supabase.auth.getUser()
      // disattiva i precedenti, inserisce il nuovo attivo
      await supabase.from('consuntivo_template').update({ attivo: false }).eq('amministratore_id', user.id)
      const { error: e1 } = await supabase.from('consuntivo_template').insert({
        amministratore_id: user.id, nome: file.name, struttura, attivo: true,
      })
      if (e1) throw e1
      setTplMsg('✅ Modello salvato e applicato')
      await fetch()
      setTimeout(() => setTplMsg(''), 3000)
    } catch (err) {
      setTplMsg('Errore: ' + err.message)
    } finally {
      setUploadingTpl(false)
    }
  }

  async function scaricaPdf() {
    if (!data) return
    try {
      await exportConsuntivoPdf({
        condominio, consuntivo: data, template, unita, getProprietario,
        getMillesimiUnita, getTotaleTabella, tabellaMillId,
      })
    } catch (err) {
      setTplMsg('Errore generazione PDF: ' + err.message)
      setTimeout(() => setTplMsg(''), 5000)
    }
  }

  if (!esercizioId) return <div style={st.empty}>Nessun esercizio contabile.</div>

  return (
    <div>
      {/* Toolbar */}
      <div style={st.toolbar}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {esercizi.map(es => (
            <button key={es.id} onClick={() => setEsercizioId(es.id)} style={st.esBtn(esercizioId === es.id)}>
              {es.anno}<span style={st.esTag(es.stato === 'aperto')}>{es.stato}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tabelle.length > 0 && (
            <select value={tabellaMillId || ''} onChange={e => setTabellaMillId(e.target.value)} style={st.select} title="Tabella millesimi per il riparto">
              {tabelle.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          )}
          <label style={st.btnGhost}>
            <Upload size={14} /> {uploadingTpl ? 'Analisi…' : 'Carica modello'}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.xls,.txt" style={{ display: 'none' }} onChange={onTemplateFile} disabled={uploadingTpl} />
          </label>
          <button style={st.btnGhost} onClick={fetch}><RefreshCw size={14} /> Ricalcola</button>
          <button style={st.btnPrimary} onClick={scaricaPdf} disabled={!data}><Download size={14} /> Esporta PDF</button>
        </div>
      </div>

      {tplMsg && <div style={st.msg}>{tplMsg}</div>}
      {error && <div style={st.err}>⚠️ {error}</div>}
      {loading && <div style={st.empty}>Calcolo consuntivo…</div>}

      {data && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Banner template */}
          <div style={st.tplBanner}>
            <FileText size={15} color="#60a5fa" />
            <span>Modello attivo: <b>{template == null ? '—' : (template.nome || 'profilo amministratore')}</b> · le sezioni seguono la presentazione del tuo consuntivo di riferimento.</span>
          </div>

          {/* A/B competenza */}
          <Card title="A — Rendiconto di competenza">
            <Table head={['Categoria', 'Tipo', 'Importo']}
              rows={[
                ...(template?.ordine_categorie || Object.keys(data.competenza.catMap))
                  .filter(k => data.competenza.catMap[k])
                  .map(k => {
                    const v = data.competenza.catMap[k]
                    const tot = v.ordinaria + v.straordinaria
                    return tot ? [template?.etichette_categorie?.[k] || k.toUpperCase(), v.straordinaria > 0 ? 'straordinaria' : 'ordinaria', eur(tot)] : null
                  }).filter(Boolean),
              ]}
              foot={[
                ['Totale ordinario', '', eur(data.competenza.totOrd)],
                ['Totale straordinario', '', eur(data.competenza.totStr)],
                ['TOTALE CONSUNTIVO', '', eur(data.competenza.totSpese)],
              ]} alignRight={[2]} />
          </Card>

          {/* C riparto */}
          <Card title="C — Riparto per unità">
            <Table head={['Unità', 'Proprietario', 'Mill.', 'Dovuto', 'Versato', 'Saldo iniz.', 'Conguaglio', 'Arretrati']}
              rows={(unita || []).map(u => {
                const r = data.riparto.unitaRows.find(x => x.unita_id === u.id) || { dovuto: 0, versato: 0, saldoIniz: 0, conguaglio: 0, arretrati: 0 }
                const p = getProprietario ? getProprietario(u) : null
                const mill = getMillesimiUnita ? getMillesimiUnita(tabellaMillId, u.id) : ''
                return [`U.${u.numero}`, p ? `${p.cognome || ''} ${p.nome || ''}`.trim() : '', mill ? Number(mill).toFixed(2) : '',
                  eur(r.dovuto), eur(r.versato), sgn(r.saldoIniz), sgn(r.conguaglio), eur(r.arretrati)]
              })}
              foot={[['TOTALI', '', '', eur(data.riparto.tot.dovuto), eur(data.riparto.tot.versato), sgn(data.riparto.tot.saldoIniz), sgn(data.riparto.tot.conguaglio), eur(data.riparto.tot.arretrati)]]}
              alignRight={[3, 4, 5, 6, 7]} congCol={6} />
            <p style={st.note}>(*) Saldo/conguaglio negativo = debito verso il Condominio; positivo = credito al condomino.</p>
          </Card>

          {/* D cassa */}
          <Card title="D — Situazione di cassa">
            <Table head={['Voce', 'Importo']} alignRight={[1]}
              rows={[
                ['Saldo cassa iniziale', eur(data.cassa.saldoInizCassa)],
                ['Entrate periodo', eur(data.cassa.entrate)],
                ['Uscite periodo', data.cassa.uscite > 0 ? ('-' + eur(data.cassa.uscite)) : eur(0)],
                ['Saldo cassa finale', sgn(data.cassa.saldoFinaleCassa)],
                ['Risultato di competenza (versato − spese)', sgn(data.cassa.saldoCompetenza)],
                ['Quadratura competenza ↔ cassa', sgn(data.cassa.scartoQuadratura)],
              ]} />
            <p style={st.note}>Il fondo di riserva non è gestito automaticamente; va riportato a mano se presente.</p>
          </Card>

          {/* E fatture */}
          {data.fatture.rows.length > 0 && (
            <Card title="E — Situazione fatture">
              <Table head={['Fornitore', 'N°', 'Data', 'Importo', 'Stato', 'Ritenuta/F24']} alignRight={[3]}
                rows={data.fatture.rows.map(f => [f.fornitore, f.numero_fattura || '—',
                  f.data_fattura ? new Date(f.data_fattura).toLocaleDateString('it-IT') : '', eur(f.importo_totale), f.stato, f.ritenutaBadge || '—'])}
                foot={[['TOTALE', '', '', eur(data.fatture.tot.totale), `pagate ${eur(data.fatture.tot.pagate)}`, data.fatture.tot.attesaF24 ? `${data.fatture.tot.attesaF24} att. F24` : '']]} />
            </Card>
          )}

          {/* confronto */}
          {data.confronto.rows.length > 0 && (
            <Card title="Confronto Preventivo / Consuntivo">
              <Table head={['Categoria', 'Preventivo', 'Consuntivo', 'Differenza']} alignRight={[1, 2, 3]}
                rows={data.confronto.rows.map(r => [template?.etichette_categorie?.[r.categoria] || r.categoria.toUpperCase(), eur(r.preventivo), eur(r.consuntivo), sgn(r.differenza)])}
                foot={[['TOTALE', eur(data.confronto.tot.preventivo), eur(data.confronto.tot.consuntivo), sgn(data.confronto.tot.differenza)]]} />
            </Card>
          )}

          {/* Nota sintetica (art. 1130-bis c.c.) */}
          <Card title="Nota sintetica esplicativa (art. 1130-bis c.c.)">
            <p style={{ ...st.note, fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>
              {(() => {
                const diff = data.confronto.tot.differenza
                const saldo = data.cassa.saldoFinaleCassa
                const quadr = data.cassa.scartoQuadratura
                return (
                  <>
                    L'esercizio chiude con un totale spese di competenza pari a {eur(data.competenza.totSpese)}
                    {data.competenza.totStr > 0 && <>, di cui {eur(data.competenza.totStr)} per gestione straordinaria</>}.
                    {' '}Rispetto al preventivo di {eur(data.confronto.tot.preventivo)}, si registra
                    {diff >= 0
                      ? <> un <b style={{ color: '#10b981' }}>avanzo di {eur(Math.abs(diff))}</b> (speso meno del previsto)</>
                      : <> un <b style={{ color: '#ef4444' }}>disavanzo di {eur(Math.abs(diff))}</b> (speso più del previsto)</>}.
                    {' '}Il saldo di cassa finale ammonta a {sgn(saldo)}.
                    {Math.abs(quadr) < 0.01
                      ? <> La quadratura competenza-cassa è <b style={{ color: '#10b981' }}>verificata</b> (scarto nullo).</>
                      : <> Lo scarto di quadratura competenza-cassa è pari a {sgn(quadr)}, dovuto a movimenti non ancora riconciliati.</>}
                  </>
                )
              })()}
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div style={st.card}>
      <div style={st.cardTitle}>{title}</div>
      {children}
    </div>
  )
}
function Table({ head, rows, foot = [], alignRight = [], congCol = -1 }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={st.table}>
        <thead><tr>{head.map((h, i) => <th key={i} style={{ ...st.th, textAlign: alignRight.includes(i) ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>{r.map((c, ci) => {
              let color = '#e2e8f0'
              if (ci === congCol) color = String(c).includes('-') ? '#ef4444' : (c !== '€ 0,00' ? '#10b981' : '#e2e8f0')
              return <td key={ci} style={{ ...st.td, textAlign: alignRight.includes(ci) ? 'right' : 'left', color }}>{c}</td>
            })}</tr>
          ))}
          {foot.map((r, ri) => (
            <tr key={'f' + ri}>{r.map((c, ci) => <td key={ci} style={{ ...st.td, ...st.footTd, textAlign: alignRight.includes(ci) ? 'right' : 'left' }}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const st = {
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  select: { background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', fontFamily: 'Sora, sans-serif', fontSize: 13 },
  btnGhost: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
  esBtn: (a) => ({ padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: `1px solid ${a ? '#2563eb' : '#334155'}`, background: a ? 'rgba(37,99,235,0.15)' : 'transparent', color: a ? '#60a5fa' : '#64748b', fontFamily: 'Sora, sans-serif', fontWeight: a ? 600 : 400 }),
  esTag: (ap) => ({ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 4, background: ap ? '#10b98122' : '#64748b22', color: ap ? '#10b981' : '#64748b' }),
  msg: { background: '#1e3a5f', color: '#93c5fd', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  err: { background: '#ef444415', border: '1px solid #ef444440', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 12 },
  empty: { textAlign: 'center', padding: 40, color: '#64748b', background: '#1e293b', borderRadius: 12, border: '1px solid #334155' },
  tplBanner: { display: 'flex', alignItems: 'center', gap: 8, background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px', color: '#94a3b8', fontSize: 12.5 },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 18 },
  cardTitle: { color: '#60a5fa', fontWeight: 700, fontSize: 14, marginBottom: 12, fontFamily: 'Sora, sans-serif' },
  table: { borderCollapse: 'collapse', width: '100%', fontFamily: 'Sora, sans-serif', fontSize: 13 },
  th: { color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 10px', borderBottom: '1px solid #334155', whiteSpace: 'nowrap' },
  td: { padding: '8px 10px', borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap' },
  footTd: { fontWeight: 700, color: '#e2e8f0', background: '#0f172a', borderTop: '1px solid #334155' },
  note: { color: '#64748b', fontSize: 11.5, marginTop: 8 },
}