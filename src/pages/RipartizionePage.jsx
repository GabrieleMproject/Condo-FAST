import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { exportRipartizioneXlsx } from '../lib/exportXlsx';
import { exportRipartizionePdf } from '../lib/exportPdf';

export default function RipartizionePage() {
  const { condominioId } = useParams();

  const [esercizi, setEsercizi] = useState([]);
  const [esercizioId, setEsercizioId] = useState('');
  const [condominio, setCondominio] = useState(null);
  const [spese, setSpese] = useState([]);
  const [unita, setUnita] = useState([]);
  const [ripartizioni, setRipartizioni] = useState([]);
  const [tabelle, setTabelle] = useState([]);
  const [millesimi, setMillesimi] = useState([]);
  const [rate, setRate] = useState([]);     // colonne rate (per export XLSX foglio Rate)
  const [cells, setCells] = useState([]);   // rate_unita (per export XLSX foglio Rate)
  const [loading, setLoading] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [viewMode, setViewMode] = useState('tabella'); // 'tabella' | 'unita'
  const [exporting, setExporting] = useState(false);

  // ─── Carica condominio e esercizi ────────────────────────────
  useEffect(() => {
    if (!condominioId) return;
    Promise.all([
      supabase.from('condomini').select('*').eq('id', condominioId).single(),
      supabase.from('esercizi').select('*').eq('condominio_id', condominioId).order('anno', { ascending: false }),
    ]).then(([{ data: cond }, { data: eserc }]) => {
      setCondominio(cond);
      setEsercizi(eserc || []);
      if (eserc?.length > 0) setEsercizioId(eserc[0].id);
    });
  }, [condominioId]);

  // ─── Carica dati quando cambia esercizio ─────────────────────
  useEffect(() => {
    if (!esercizioId || !condominioId) return;
    loadDati();
  }, [esercizioId, condominioId]);

  async function loadDati() {
    setLoading(true);
    try {
      const [
        { data: sp },
        { data: uni },
        { data: rip },
        { data: tab },
        { data: rt },
      ] = await Promise.all([
        supabase.from('spese').select('*').eq('esercizio_id', esercizioId).order('data_spesa'),
        supabase.from('unita').select(`
          *,
          occupanti:occupanti_unita(
            id, ruolo, attivo,
            persona:persone(nominativo, email)
          )
        `).eq('condominio_id', condominioId).order('numero'),
        supabase.from('ripartizioni').select(`
          *, spesa:spese(id, descrizione, importo, criterio, tabella_millesimale_id, categoria)
        `).eq('condominio_id', condominioId),
        supabase.from('tabelle_millesimali').select('*').eq('condominio_id', condominioId),
        supabase.from('rate').select('*').eq('esercizio_id', esercizioId).order('numero_rata'),
      ]);

      const tabelleList = tab || [];
      let milList = [];
      if (tabelleList.length > 0) {
        const { data: milData } = await supabase
          .from('millesimi_unita')
          .select('*')
          .in('tabella_id', tabelleList.map(t => t.id));
        milList = milData || [];
      }

      // celle rate_unita: scoped alle rate di questo esercizio
      const rateList = rt || [];
      let cellList = [];
      if (rateList.length) {
        const { data: cellData } = await supabase
          .from('rate_unita').select('*')
          .in('rata_id', rateList.map(r => r.id));
        cellList = cellData || [];
      }

      setSpese(sp || []);
      setUnita(uni || []);
      setRipartizioni(rip || []);
      setTabelle(tabelleList);
      setMillesimi(milList);
      setRate(rateList);
      setCells(cellList);
    } finally {
      setLoading(false);
    }
  }

  // ─── Categorie disponibili ───────────────────────────────────
  const categorie = useMemo(() => {
    return [...new Set(spese.map(s => s.categoria).filter(Boolean))];
  }, [spese]);

  // ─── Spese filtrate ──────────────────────────────────────────
  const speseFiltrate = useMemo(() => {
    return filtroCategoria ? spese.filter(s => s.categoria === filtroCategoria) : spese;
  }, [spese, filtroCategoria]);

  // ─── Mappa ripartizioni: spesaId → [{ unita_id, importo, override }] ──
  const ripMap = useMemo(() => {
    const map = {};
    ripartizioni.forEach(r => {
      if (!map[r.spesa_id]) map[r.spesa_id] = [];
      map[r.spesa_id].push(r);
    });
    return map;
  }, [ripartizioni]);

  // ─── Totale per unità su tutto l'esercizio ───────────────────
  const totalePerUnita = useMemo(() => {
    const map = {};
    ripartizioni.forEach(r => {
      const spesaDelEsercizio = spese.find(s => s.id === r.spesa_id);
      if (!spesaDelEsercizio) return;
      const imp = r.override_manuale ? (r.importo_override ?? r.importo) : r.importo;
      map[r.unita_id] = (map[r.unita_id] || 0) + imp;
    });
    return map;
  }, [ripartizioni, spese]);

  // ─── KPI ─────────────────────────────────────────────────────
  const totaleSpese = speseFiltrate.reduce((acc, s) => acc + (s.importo || 0), 0);
  const speseNonRipartite = speseFiltrate.filter(s => !ripMap[s.id] || ripMap[s.id].length === 0);

  // ─── Helper: nome proprietario unità (stringa, per display) ──
  function getProprietario(u) {
    const occ = u.occupanti?.find(o => (o.ruolo === 'proprietario' || o.tipo_occupante === 'proprietario') && o.attivo !== false);
    return occ?.persona?.nominativo || '—';
  }

  // ─── Helper: proprietario come oggetto occupante (per export) ─
  // exportRipartizioneXlsx legge prop.persona?.nominativo nel foglio Rate.
  function getProprietarioOcc(u) {
    return u.occupanti?.find(o => (o.ruolo === 'proprietario' || o.tipo_occupante === 'proprietario') && o.attivo !== false) || null;
  }

  // ─── Export ──────────────────────────────────────────────────
  async function handleExportXlsx() {
    setExporting(true);
    try {
      await exportRipartizioneXlsx({
        condominio,
        esercizio: esercizi.find(e => e.id === esercizioId),
        spese, unita, ripartizioni,
        rate, cells,
        getProprietario: getProprietarioOcc,
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleExportPdf() {
    setExporting(true);
    try {
      await exportRipartizionePdf({ condominio, esercizio: esercizi.find(e => e.id === esercizioId), spese, unita, ripartizioni });
    } finally {
      setExporting(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Prospetto Ripartizione</h1>
          <p style={styles.subtitle}>{condominio?.nome || '...'}</p>
        </div>
        <div style={styles.headerRight}>
          <select
            style={styles.select}
            value={esercizioId}
            onChange={e => setEsercizioId(e.target.value)}
          >
            {esercizi.map(e => (
              <option key={e.id} value={e.id}>{e.anno} — {e.note || 'Esercizio'}</option>
            ))}
          </select>
          <button style={styles.btnSecondary} onClick={handleExportXlsx} disabled={exporting}>
            📊 XLSX
          </button>
          <button style={styles.btnSecondary} onClick={handleExportPdf} disabled={exporting}>
            📄 PDF
          </button>
        </div>
      </div>

      {/* KPI */}
      <div style={styles.kpiRow}>
        {[
          { label: 'Totale Spese', value: `€ ${totaleSpese.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, color: '#2563eb' },
          { label: 'Spese Ripartite', value: spese.filter(s => ripMap[s.id]?.length > 0).length, color: '#16a34a' },
          { label: 'Da Ripartire', value: speseNonRipartite.length, color: speseNonRipartite.length > 0 ? '#f59e0b' : '#16a34a' },
          { label: 'Unità', value: unita.length, color: '#8b5cf6' },
        ].map(k => (
          <div key={k.label} style={styles.kpiCard}>
            <div style={{ ...styles.kpiValue, color: k.color }}>{k.value}</div>
            <div style={styles.kpiLabel}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Alert spese non ripartite */}
      {speseNonRipartite.length > 0 && (
        <div style={styles.alert}>
          ⚠️ {speseNonRipartite.length} {speseNonRipartite.length === 1 ? 'spesa non è stata' : 'spese non sono state'} ancora ripartita. Vai in "Spese" per elaborarle.
        </div>
      )}

      {/* Filtri + toggle vista */}
      <div style={styles.toolbar}>
        <div style={styles.filtri}>
          <select style={styles.select} value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
            <option value="">Tutte le categorie</option>
            {categorie.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={styles.viewToggle}>
          <button
            style={{ ...styles.toggleBtn, ...(viewMode === 'tabella' ? styles.toggleActive : {}) }}
            onClick={() => setViewMode('tabella')}
          >
            Per Spesa
          </button>
          <button
            style={{ ...styles.toggleBtn, ...(viewMode === 'unita' ? styles.toggleActive : {}) }}
            onClick={() => setViewMode('unita')}
          >
            Per Unità
          </button>
        </div>
      </div>

      {loading ? (
        <div style={styles.loading}>Caricamento...</div>
      ) : viewMode === 'tabella' ? (
        <TabellaPerSpesa spese={speseFiltrate} unita={unita} ripMap={ripMap} tabelle={tabelle} />
      ) : (
        <TabellaPerUnita unita={unita} spese={speseFiltrate} ripMap={ripMap} totalePerUnita={totalePerUnita} getProprietario={getProprietario} />
      )}
    </div>
  );
}

// ─── Vista per Spesa ────────────────────────────────────────────────────────
function TabellaPerSpesa({ spese, unita, ripMap, tabelle }) {
  if (spese.length === 0) return <EmptyState msg="Nessuna spesa per questo esercizio" />;

  return (
    <div style={styles.tableWrap}>
      {spese.map(spesa => {
        const rips = ripMap[spesa.id] || [];
        const totaleRip = rips.reduce((acc, r) => acc + (r.override_manuale ? (r.importo_override ?? r.importo) : r.importo), 0);

        return (
          <div key={spesa.id} style={styles.spesaBlock}>
            <div style={styles.spesaHeader}>
              <div style={styles.spesaInfo}>
                <span style={styles.spesaTitolo}>{spesa.descrizione}</span>
                <span style={styles.spesaCategoria}>{spesa.categoria}</span>
                {spesa.criterio && (
                  <span style={styles.spesaCriterio}>{spesa.criterio}</span>
                )}
              </div>
              <div style={styles.spesaImporti}>
                <span style={styles.spesaImporto}>€ {(spesa.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                {rips.length > 0 && Math.abs(totaleRip - spesa.importo) > 0.05 && (
                  <span style={styles.spesaAlert}>⚠️ Δ € {Math.abs(totaleRip - spesa.importo).toFixed(2)}</span>
                )}
              </div>
            </div>

            {rips.length === 0 ? (
              <div style={styles.nonRipartita}>Spesa non ancora ripartita</div>
            ) : (
              <table style={styles.innerTable}>
                <thead>
                  <tr>
                    <th style={styles.innerTh}>Unità</th>
                    <th style={styles.innerTh}>Millesimi</th>
                    <th style={styles.innerTh}>Importo</th>
                    <th style={styles.innerTh}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {rips.sort((a, b) => {
                    const ua = unita.find(u => u.id === a.unita_id);
                    const ub = unita.find(u => u.id === b.unita_id);
                    return (ua?.numero || '').localeCompare(ub?.numero || '');
                  }).map(r => {
                    const u = unita.find(un => un.id === r.unita_id);
                    const imp = r.override_manuale ? (r.importo_override ?? r.importo) : r.importo;
                    return (
                      <tr key={r.id}>
                        <td style={styles.innerTd}>{u?.numero || '—'} {u?.tipo ? `(${u.tipo})` : ''}</td>
                        <td style={styles.innerTd}>{r.millesimi_usati ?? '—'}</td>
                        <td style={{ ...styles.innerTd, fontWeight: 600 }}>
                          € {(imp || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                          {r.override_manuale && <span style={styles.overrideBadge}>override</span>}
                        </td>
                        <td style={{ ...styles.innerTd, color: '#64748b', fontSize: 12 }}>
                          {r.note_override || ''}
                          {r.giorni_competenza ? ` (${r.giorni_competenza}/${r.giorni_totali}gg)` : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#1e293b' }}>
                    <td style={{ ...styles.innerTd, fontWeight: 700 }} colSpan={2}>Totale ripartito</td>
                    <td style={{ ...styles.innerTd, fontWeight: 700, color: '#2563eb' }}>
                      € {totaleRip.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={styles.innerTd} />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Vista per Unità ────────────────────────────────────────────────────────
function TabellaPerUnita({ unita, spese, ripMap, totalePerUnita, getProprietario }) {
  if (unita.length === 0) return <EmptyState msg="Nessuna unità nel condominio" />;

  return (
    <div style={styles.tableWrap}>
      <table style={{ ...styles.table, width: '100%' }}>
        <thead>
          <tr>
            <th style={styles.th}>Unità</th>
            <th style={styles.th}>Proprietario</th>
            {spese.map(s => (
              <th key={s.id} style={{ ...styles.th, fontSize: 11 }} title={s.descrizione}>
                {s.descrizione?.substring(0, 20)}{s.descrizione?.length > 20 ? '…' : ''}
              </th>
            ))}
            <th style={{ ...styles.th, color: '#2563eb' }}>TOTALE</th>
          </tr>
        </thead>
        <tbody>
          {unita.map((u, idx) => (
            <tr key={u.id} style={{ background: idx % 2 === 0 ? '#0f172a' : 'transparent' }}>
              <td style={styles.td}><strong>{u.numero}</strong></td>
              <td style={{ ...styles.td, color: '#94a3b8', fontSize: 13 }}>{getProprietario(u)}</td>
              {spese.map(s => {
                const rips = ripMap[s.id] || [];
                const r = rips.find(r => r.unita_id === u.id);
                const imp = r ? (r.override_manuale ? (r.importo_override ?? r.importo) : r.importo) : null;
                return (
                  <td key={s.id} style={{ ...styles.td, textAlign: 'right' }}>
                    {imp !== null ? (
                      <span style={{ color: r?.override_manuale ? '#f59e0b' : '#e2e8f0' }}>
                        € {imp.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span style={{ color: '#334155' }}>—</span>
                    )}
                  </td>
                );
              })}
              <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                € {(totalePerUnita[u.id] || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#1e293b' }}>
            <td style={{ ...styles.td, fontWeight: 700 }} colSpan={2}>TOTALE SPESE</td>
            {spese.map(s => (
              <td key={s.id} style={{ ...styles.td, fontWeight: 700, textAlign: 'right', color: '#2563eb' }}>
                € {(s.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </td>
            ))}
            <td style={{ ...styles.td, fontWeight: 700, textAlign: 'right', color: '#2563eb' }}>
              € {spese.reduce((a, s) => a + (s.importo || 0), 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EmptyState({ msg }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
      {msg}
    </div>
  );
}

// ─── Stili ──────────────────────────────────────────────────────────────────
const styles = {
  page: { fontFamily: "'Sora', sans-serif", color: '#e2e8f0', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' },
  subtitle: { margin: '4px 0 0', fontSize: 14, color: '#64748b' },
  headerRight: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  kpiRow: { display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  kpiCard: {
    flex: '1 1 140px', background: '#1e293b', borderRadius: 12,
    padding: '16px 20px', border: '1px solid #334155',
  },
  kpiValue: { fontSize: 24, fontWeight: 700, lineHeight: 1 },
  kpiLabel: { fontSize: 12, color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' },
  alert: {
    background: '#f59e0b15', border: '1px solid #f59e0b40',
    borderRadius: 10, padding: '12px 16px', marginBottom: 16,
    color: '#fbbf24', fontSize: 14,
  },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  filtri: { display: 'flex', gap: 10 },
  viewToggle: { display: 'flex', background: '#1e293b', borderRadius: 8, padding: 2 },
  toggleBtn: {
    background: 'none', border: 'none', color: '#64748b',
    padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
    fontFamily: "'Sora', sans-serif", fontSize: 13, fontWeight: 600,
    transition: 'all 0.2s',
  },
  toggleActive: { background: '#2563eb', color: '#fff' },
  select: {
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: 8, padding: '8px 12px', color: '#e2e8f0',
    fontFamily: "'Sora', sans-serif", fontSize: 13, cursor: 'pointer',
  },
  btnSecondary: {
    background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
    borderRadius: 8, padding: '8px 16px', fontFamily: "'Sora', sans-serif",
    fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  tableWrap: { overflowX: 'auto' },
  loading: { textAlign: 'center', padding: 60, color: '#475569' },
  // Per spesa
  spesaBlock: {
    background: '#1e293b', borderRadius: 12, border: '1px solid #334155',
    marginBottom: 16, overflow: 'hidden',
  },
  spesaHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 20px', borderBottom: '1px solid #334155',
    flexWrap: 'wrap', gap: 8,
  },
  spesaInfo: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  spesaTitolo: { fontWeight: 700, color: '#f1f5f9', fontSize: 15 },
  spesaCategoria: {
    background: '#334155', color: '#94a3b8', borderRadius: 20,
    padding: '2px 10px', fontSize: 11,
  },
  spesaCriterio: {
    background: '#2563eb20', color: '#60a5fa', borderRadius: 20,
    padding: '2px 10px', fontSize: 11,
  },
  spesaImporti: { display: 'flex', alignItems: 'center', gap: 10 },
  spesaImporto: { fontWeight: 700, color: '#2563eb', fontSize: 17 },
  spesaAlert: { color: '#f59e0b', fontSize: 12 },
  nonRipartita: {
    padding: '16px 20px', color: '#64748b', fontSize: 13, fontStyle: 'italic',
  },
  innerTable: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  innerTh: {
    background: '#0f172a', color: '#64748b', padding: '8px 16px',
    textAlign: 'left', fontWeight: 600, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid #334155',
  },
  innerTd: {
    padding: '8px 16px', borderBottom: '1px solid #1e293b',
    color: '#cbd5e1',
  },
  overrideBadge: {
    marginLeft: 6, background: '#f59e0b20', color: '#f59e0b',
    borderRadius: 10, padding: '1px 6px', fontSize: 10,
  },
  // Per unità
  table: { borderCollapse: 'collapse', fontSize: 13 },
  th: {
    background: '#1e293b', color: '#94a3b8', padding: '10px 14px',
    textAlign: 'center', fontWeight: 600, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: '0.04em',
    borderBottom: '1px solid #334155', minWidth: 100,
  },
  td: {
    padding: '8px 14px', borderBottom: '1px solid #1e293b40',
    color: '#cbd5e1',
  },
};