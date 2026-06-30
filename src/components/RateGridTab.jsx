// src/components/RateGridTab.jsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useUnita } from '../hooks/useUnita'
import { useComunicazioni } from '../hooks/useComunicazioni'
import { CreditCard, X, CheckCircle2, Coins, Mail } from 'lucide-react'

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const eur = (n) => `€${(Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function deriveStato(importo, pagato) {
  if (importo <= 0.001) return pagato > 0.01 ? 'sovra_pagata' : 'pagata'
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
  const { inviaComunicazione } = useComunicazioni()
  const [inviandoSollecito, setInviandoSollecito] = useState(false)
  const [showProposteModal, setShowProposteModal] = useState(false)

  const [esercizi, setEsercizi] = useState([])
  const [esercizio, setEsercizio] = useState(null)
  const [rate, setRate] = useState([])           // colonne
  const [cells, setCells] = useState([])          // rate_unita
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)    // { cell, rata, unita }

  const { unita, getProprietario, fetchUnita } = useUnita(condominioId)

  // Rileva le rate scadute da oltre 10 giorni
  const rateScaduteDa10Giorni = useMemo(() => {
    if (!esercizio || rate.length === 0 || cells.length === 0) return [];
    
    const rateScaduteIds = rate
      .filter(r => {
        if (!r.data_scadenza) return false;
        const diffMs = new Date() - new Date(r.data_scadenza);
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays >= 10;
      })
      .map(r => r.id);

    if (rateScaduteIds.length === 0) return [];

    const proposte = [];
    unita.forEach(u => {
      const p = getProprietario(u);
      if (!p || !p.email) return;

      const rateUnitaInsolute = cells.filter(c => 
        c.unita_id === u.id && 
        rateScaduteIds.includes(c.rata_id) && 
        c.stato !== 'pagata' && 
        c.stato !== 'sovra_pagata' &&
        parseFloat(c.importo || 0) > 0.001
      );

      if (rateUnitaInsolute.length > 0) {
        const importoInsoluto = rateUnitaInsolute.reduce((s, c) => s + (parseFloat(c.importo || 0) - parseFloat(c.importo_pagato || 0)), 0);
        proposte.push({
          unita: u,
          proprietario: p,
          rateCoinvolte: rateUnitaInsolute.map(c => {
            const r = rate.find(x => x.id === c.rata_id);
            return r ? (r.descrizione || `Rata ${r.numero_rata}`) : 'Rata';
          }).join(', '),
          importoInsoluto,
        });
      }
    });

    return proposte;
  }, [esercizio, rate, cells, unita, getProprietario]);

  async function handleSollecitaRata(u, prop, silenzioso = false) {
    if (!prop || !prop.email) return;
    setInviandoSollecito(true);
    try {
      if (!esercizio) throw new Error("Nessun esercizio selezionato o aperto.");

      // Carica rate dell'esercizio
      const { data: rateData } = await supabase
        .from('rate')
        .select('id, data_scadenza, descrizione')
        .eq('esercizio_id', esercizio.id);
      
      const rateIds = (rateData || []).map(r => r.id);

      // Carica rate_unita
      const { data: rateUnitaData } = await supabase
        .from('rate_unita')
        .select('*')
        .eq('unita_id', u.id)
        .in('rata_id', rateIds);

      const rateUnitaList = rateUnitaData || [];
      const dovuto = rateUnitaList.reduce((s, r) => s + parseFloat(r.importo || 0), 0);
      const pagato = rateUnitaList.reduce((s, r) => s + parseFloat(r.importo_pagato || 0), 0);
      const insoluto = dovuto - pagato;

      const rateScadute = rateUnitaList.filter(ru => {
        const rata = (rateData || []).find(r => r.id === ru.rata_id);
        const scaduta = rata?.data_scadenza && new Date(rata.data_scadenza) < new Date();
        return scaduta && ru.stato !== 'pagata' && ru.stato !== 'sovra_pagata';
      });

      const importoScaduto = rateScadute.reduce((s, r) => s + (parseFloat(r.importo || 0) - parseFloat(r.importo_pagato || 0)), 0);

      const nomeDest = `${prop.nome} ${prop.cognome}`;
      const alignmentText = u.scala ? `scala ${u.scala}` : '';
      const testo = `Gentile <strong>${nomeDest}</strong>,<br/><br/>
Le inviamo la presente comunicazione in merito all'esercizio condominiale <strong>${esercizio.anno}</strong> (Unità: ${u.numero} ${alignmentText}).<br/><br/>
Dalle nostre scritture contabili risulta la seguente <strong>quadratura finanziaria aggiornata</strong> per le sue quote:<br/>
<ul>
  <li>Totale dovuto per l'esercizio: <strong>€ ${dovuto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong></li>
  <li>Totale da lei versato ad oggi: <strong>€ ${pagato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong></li>
  <li>Saldo insoluto residuo: <strong>€ ${insoluto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong></li>
</ul>
Di questo saldo insoluto, l'importo attualmente <span style="color:#ef4444; font-weight:bold;">in ritardo / già scaduto</span> è pari a: <strong>€ ${importoScaduto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong>.<br/><br/>
La invitiamo a provvedere al saldo delle quote insolute a mezzo bonifico bancario.<br/><br/>
Cordiali saluti,<br/>
L'Amministratore`;

      await inviaComunicazione({
        condominioId,
        destinatari: [{ email: prop.email, nome: nomeDest }],
        oggetto: `Sollecito pagamento rate Esercizio ${esercizio.anno} - Unità ${u.numero}`,
        messaggio: testo,
        tipo: 'sollecito',
      });

      if (!silenzioso) {
        alert(`Sollecito inviato con successo a ${prop.email}`);
      }
    } catch (err) {
      if (!silenzioso) {
        alert("Errore durante l'invio del sollecito: " + err.message);
      } else {
        console.error("Errore invio sollecito:", err.message);
      }
      throw err;
    } finally {
      setInviandoSollecito(false);
    }
  }

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

      {rateScaduteDa10Giorni.length > 0 && (
        <div style={st.bannerProposte}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📢</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: 14 }}>Solleciti Consigliati</div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                Rilevate {rateScaduteDa10Giorni.length} unità con rate scadute da oltre 10 giorni.
              </div>
            </div>
          </div>
          <button onClick={() => setShowProposteModal(true)} style={st.btnProposte}>
            Visualizza Proposte ({rateScaduteDa10Giorni.length})
          </button>
        </div>
      )}

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
          onSollecita={handleSollecitaRata}
          inviandoSollecito={inviandoSollecito}
          fetchUnita={fetchUnita}
        />
      )}

      {showProposteModal && (
        <ProposteSollecitoModal
          proposte={rateScaduteDa10Giorni}
          onClose={() => setShowProposteModal(false)}
          onSollecita={handleSollecitaRata}
          inviando={inviandoSollecito}
        />
      )}
    </div>
  )
}

// ── Editor cella (modale) ────────────────────────────────────
function CellEditor({ cell, rata, unita, getProprietario, onClose, onSave, onSollecita, inviandoSollecito, fetchUnita }) {
  const [importo, setImporto] = useState(cell.importo ?? 0)
  const [pagato, setPagato] = useState(cell.importo_pagato ?? 0)
  const [data, setData] = useState(cell.data_pagamento || '')
  const p = getProprietario(unita)

  // Stati per la modifica anagrafica proprietario
  const [showAnagrafica, setShowAnagrafica] = useState(false)
  const [nome, setNome] = useState(p?.nome || '')
  const [cognome, setCognome] = useState(p?.cognome || '')
  const [email, setEmail] = useState(p?.email || '')
  const [telefono, setTelefono] = useState(p?.telefono || '')
  const [salvandoAnagrafica, setSalvandoAnagrafica] = useState(false)

  const handleSalvaAnagrafica = async () => {
    if (!p) return;
    setSalvandoAnagrafica(true);
    try {
      const { error } = await supabase
        .from('persone')
        .update({ nome, cognome, email, telefono })
        .eq('id', p.id);
      if (error) throw error;
      alert('Anagrafica salvata con successo!');
      if (fetchUnita) await fetchUnita();
    } catch (err) {
      alert("Errore durante il salvataggio dell'anagrafica: " + err.message);
    } finally {
      setSalvandoAnagrafica(false);
    }
  };

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

        {((parseFloat(importo) || 0) > (parseFloat(pagato) || 0)) && p?.email && (
          <button 
            type="button" 
            disabled={inviandoSollecito}
            style={{ ...st.btnPrimary, background: '#ef4444', marginTop: 10, width: '100%' }} 
            onClick={() => onSollecita(unita, p).then(() => onClose())}
          >
            {inviandoSollecito ? 'Invio sollecito...' : '📧 Invia Sollecito Rata'}
          </button>
        )}

        <div style={{ marginTop: 16, borderTop: '1px solid #334155', paddingTop: 12 }}>
          <button 
            type="button" 
            onClick={() => setShowAnagrafica(!showAnagrafica)} 
            style={{ ...st.btnGhost, color: '#60a5fa', borderColor: 'transparent', padding: '4px 0', fontSize: 12, justifyContent: 'flex-start', width: '100%', display: 'flex', alignItems: 'center' }}
          >
            {showAnagrafica ? '▼ Nascondi Anagrafica' : '▶ Modifica Anagrafica Proprietario'}
          </button>

          {showAnagrafica && p && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, textAlign: 'left' }}>
              <div>
                <label style={st.fieldLabel}>Nome</label>
                <input style={st.input} type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div>
                <label style={st.fieldLabel}>Cognome</label>
                <input style={st.input} type="text" value={cognome} onChange={(e) => setCognome(e.target.value)} />
              </div>
              <div>
                <label style={st.fieldLabel}>Email</label>
                <input style={st.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label style={st.fieldLabel}>Telefono</label>
                <input style={st.input} type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </div>
              <button 
                type="button"
                disabled={salvandoAnagrafica}
                onClick={handleSalvaAnagrafica} 
                style={{ ...st.btnPrimary, background: '#10b981', marginTop: 6 }}
              >
                {salvandoAnagrafica ? 'Salvataggio...' : 'Salva Anagrafica'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modale Proposte Solleciti (Scaduti da > 10 giorni) ─────────
function ProposteSollecitoModal({ proposte, onSollecita, onClose, inviando }) {
  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={{ ...st.modal, width: 500, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
        <div style={st.modalHead}>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>Solleciti Consigliati (Scadenza &gt; 10 giorni)</div>
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
              Le rate di queste unità risultano insolute da oltre 10 giorni.
            </div>
          </div>
          <button style={st.btnIcon} onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, margin: '14px 0' }}>
          {proposte.map(p => (
            <div key={p.unita.id} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>Unità {p.unita.numero} - {p.proprietario.cognome} {p.proprietario.nome}</div>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>Rate: {p.rateCoinvolte}</div>
                <div style={{ color: '#ef4444', fontSize: 12, fontWeight: 700, marginTop: 4 }}>Scaduto: € {p.importoInsoluto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
              </div>
              <button 
                disabled={inviando}
                style={{ ...st.btnPrimary, flex: 'none', padding: '6px 12px', fontSize: 11, background: '#ef4444', width: 'auto' }} 
                onClick={async () => {
                  try {
                    await onSollecita(p.unita, p.proprietario, true);
                    alert('Sollecito inviato con successo!');
                  } catch (err) {
                    alert("Invio fallito: " + err.message);
                  }
                }}
              >
                Invia
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
          <button style={st.btnCancel} onClick={onClose}>Chiudi</button>
          <button 
            disabled={inviando}
            style={{ ...st.btnPrimary, background: '#ef4444', width: 'auto' }} 
            onClick={async () => {
              if (confirm(`Inviare il sollecito a tutte le ${proposte.length} unità consigliate?`)) {
                let falliti = 0;
                for (const p of proposte) {
                  try {
                    await onSollecita(p.unita, p.proprietario, true);
                  } catch (err) {
                    falliti++;
                  }
                }
                if (falliti > 0) {
                  alert(`Invio completato. Alcuni invii sono falliti (${falliti} unità).`);
                } else {
                  alert('Tutti i solleciti sono stati inviati!');
                }
                onClose();
              }
            }}
          >
            {inviando ? 'Invio in corso...' : 'Invia a tutti'}
          </button>
        </div>
      </div>
    </div>
  );
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
  bannerProposte: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f59e0b15', border: '1px solid #f59e0b40', borderRadius: 12, padding: '14px 20px', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  btnProposte: { background: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
  btnCancel: { background: 'transparent', border: '1px solid #334155', borderRadius: 8, padding: '8px 20px', color: '#94a3b8', cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontSize: 13 },
}