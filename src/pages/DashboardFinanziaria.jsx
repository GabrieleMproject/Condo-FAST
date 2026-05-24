import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

/**
 * DashboardFinanziaria
 * Schermata riepilogo aggiornata in tempo reale:
 * - Saldo conto corrente condominio
 * - Movimenti in/out con riconciliazione
 * - Collegamento aggiornato con le fatture dei fornitori
 * - Alert spese non riconciliate
 */
export default function DashboardFinanziaria() {
  const { condominioId } = useParams();

  const [dati, setDati] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mesiViz, setMesiViz] = useState(6);

  useEffect(() => {
    if (condominioId) loadDashboard();
  }, [condominioId, mesiViz]);

  async function loadDashboard() {
    setLoading(true);
    const dataLimite = new Date();
    dataLimite.setMonth(dataLimite.getMonth() - mesiViz);
    const dataStr = dataLimite.toISOString().split('T')[0];

    const [
      { data: cond },
      { data: movimenti },
      { data: fatture },
      { data: riconciliazioni },
      { data: spese },
      { data: rate },
    ] = await Promise.all([
      supabase.from('condomini').select('*').eq('id', condominioId).single(),
      supabase.from('estratto_conto').select('*').eq('condominio_id', condominioId).gte('data_movimento', dataStr).order('data_movimento', { ascending: false }),
      supabase.from('fatture_fornitori').select('*').eq('condominio_id', condominioId).order('data_fattura', { ascending: false }),
      supabase.from('riconciliazioni').select('*').eq('condominio_id', condominioId),
      supabase.from('spese').select('*, esercizio:esercizi(anno, data_inizio, data_fine)').eq('condominio_id', condominioId).order('data_competenza', { ascending: false }).limit(20),
      supabase.from('rate').select('*').eq('condominio_id', condominioId).eq('stato', 'non_pagata').lte('data_scadenza', new Date().toISOString().split('T')[0]),
    ]);

    setDati({ cond, movimenti: movimenti || [], fatture: fatture || [], riconciliazioni: riconciliazioni || [], spese: spese || [], rate: rate || [] });
    setLoading(false);
  }

  const computed = useMemo(() => {
    if (!dati) return null;
    const { movimenti, fatture, riconciliazioni, spese, rate } = dati;

    // Saldo (ultimo saldo registrato nei movimenti)
    const movConSaldo = movimenti.filter(m => m.saldo !== null);
    const ultimoSaldo = movConSaldo.length > 0
      ? movConSaldo.sort((a, b) => new Date(b.data_movimento) - new Date(a.data_movimento))[0]?.saldo
      : null;

    // Flusso entrate/uscite
    const entrate = movimenti.filter(m => m.tipo === 'entrata').reduce((a, m) => a + m.importo, 0);
    const uscite = movimenti.filter(m => m.tipo === 'uscita').reduce((a, m) => a + Math.abs(m.importo), 0);

    // Fatture
    const fattureAttesa = fatture.filter(f => f.stato === 'attesa');
    const totaleAttesa = fattureAttesa.reduce((a, f) => a + (f.importo_totale || 0), 0);
    const fattureInScadenza = fattureAttesa.filter(f => {
      if (!f.data_scadenza) return false;
      const diff = (new Date(f.data_scadenza) - new Date()) / (1000 * 60 * 60 * 24);
      return diff <= 14 && diff >= 0;
    });

    // Riconciliazione
    const movNonRic = movimenti.filter(m => m.tipo === 'uscita' && !m.riconciliato).length;
    const suggerimentiPendenti = riconciliazioni.filter(r => r.stato === 'suggerita').length;

    // Movimenti per grafico (ultimi 30 gg raggruppati per settimana)
    const perSettimana = {};
    movimenti.forEach(m => {
      const d = new Date(m.data_movimento);
      const settimana = `${d.getFullYear()}-W${Math.ceil((d.getDate()) / 7)}`;
      if (!perSettimana[settimana]) perSettimana[settimana] = { entrate: 0, uscite: 0 };
      if (m.tipo === 'entrata') perSettimana[settimana].entrate += m.importo;
      else perSettimana[settimana].uscite += Math.abs(m.importo);
    });

    return {
      ultimoSaldo, entrate, uscite,
      fattureAttesa, totaleAttesa, fattureInScadenza,
      movNonRic, suggerimentiPendenti,
      rateScadute: rate.length,
    };
  }, [dati]);

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#475569', fontFamily: "'Sora', sans-serif" }}>Caricamento dashboard...</div>;
  if (!dati || !computed) return null;

  const { movimenti, fatture, spese } = dati;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dashboard Finanziaria</h1>
          <p style={styles.subtitle}>{dati.cond?.nome} · Aggiornata adesso</p>
        </div>
        <select style={styles.select} value={mesiViz} onChange={e => setMesiViz(parseInt(e.target.value))}>
          <option value={3}>Ultimi 3 mesi</option>
          <option value={6}>Ultimi 6 mesi</option>
          <option value={12}>Ultimo anno</option>
        </select>
      </div>

      {/* Alert bar */}
      {(computed.rateScadute > 0 || computed.fattureInScadenza.length > 0 || computed.movNonRic > 0) && (
        <div style={styles.alertBar}>
          {computed.rateScadute > 0 && (
            <AlertChip color="#ef4444" icon="⚠️">
              {computed.rateScadute} rate scadute
            </AlertChip>
          )}
          {computed.fattureInScadenza.length > 0 && (
            <AlertChip color="#f59e0b" icon="⏰">
              {computed.fattureInScadenza.length} fatture in scadenza (14gg)
            </AlertChip>
          )}
          {computed.movNonRic > 0 && (
            <AlertChip color="#8b5cf6" icon="🔗">
              {computed.movNonRic} movimenti da riconciliare
              {computed.suggerimentiPendenti > 0 && ` · ${computed.suggerimentiPendenti} suggerimenti AI`}
            </AlertChip>
          )}
        </div>
      )}

      {/* KPI principali */}
      <div style={styles.kpiGrid}>
        <KpiCard
          titolo="Saldo Conto"
          valore={computed.ultimoSaldo !== null
            ? `€ ${computed.ultimoSaldo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
            : 'N/D'}
          sub="Ultimo saldo registrato"
          color="#2563eb"
          icon="🏦"
        />
        <KpiCard
          titolo="Entrate"
          valore={`+€ ${computed.entrate.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
          sub={`Ultimi ${mesiViz} mesi`}
          color="#16a34a"
          icon="↑"
        />
        <KpiCard
          titolo="Uscite"
          valore={`-€ ${computed.uscite.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
          sub={`Ultimi ${mesiViz} mesi`}
          color="#ef4444"
          icon="↓"
        />
        <KpiCard
          titolo="Fatture da Pagare"
          valore={`€ ${computed.totaleAttesa.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
          sub={`${computed.fattureAttesa.length} fatture in attesa`}
          color="#f59e0b"
          icon="🧾"
        />
      </div>

      {/* Layout a 2 colonne */}
      <div style={styles.twoCol}>
        {/* Col sinistra: movimenti recenti */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Movimenti Recenti</h3>
            <Link to={`/condomini/${condominioId}/estratto-conto`} style={styles.seeAll}>Vedi tutti →</Link>
          </div>
          {movimenti.slice(0, 8).map(m => (
            <div key={m.id} style={styles.movRow}>
              <div style={{
                ...styles.movDot,
                background: m.tipo === 'entrata' ? '#16a34a20' : '#ef444420',
                color: m.tipo === 'entrata' ? '#16a34a' : '#ef4444',
              }}>
                {m.tipo === 'entrata' ? '↑' : '↓'}
              </div>
              <div style={styles.movInfo}>
                <div style={styles.movCausale} title={m.causale}>{m.causale?.substring(0, 45)}{m.causale?.length > 45 ? '…' : ''}</div>
                <div style={styles.movMeta}>
                  {new Date(m.data_movimento).toLocaleDateString('it-IT')}
                  {m.fornitore_rilevato && ` · ${m.fornitore_rilevato}`}
                  {m.riconciliato && <span style={styles.ricTag}>✓ ric.</span>}
                </div>
              </div>
              <span style={{ ...styles.movImporto, color: m.importo >= 0 ? '#16a34a' : '#ef4444' }}>
                {m.importo >= 0 ? '+' : ''}€ {Math.abs(m.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
          {movimenti.length === 0 && <EmptyInSection msg="Nessun movimento nel periodo" />}
        </div>

        {/* Col destra: fatture fornitori */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Fatture Fornitori</h3>
            <Link to={`/condomini/${condominioId}/fatture`} style={styles.seeAll}>Vedi tutte →</Link>
          </div>
          {fatture.slice(0, 8).map(f => {
            const isScadenza = f.data_scadenza && (new Date(f.data_scadenza) - new Date()) / (1000 * 60 * 60 * 24) <= 14 && f.stato === 'attesa';
            return (
              <div key={f.id} style={{ ...styles.movRow, ...(isScadenza ? styles.movRowAlert : {}) }}>
                <div style={{
                  ...styles.movDot,
                  background: f.stato === 'pagata' ? '#16a34a20' : f.stato === 'attesa' ? '#f59e0b20' : '#ef444420',
                  color: f.stato === 'pagata' ? '#16a34a' : f.stato === 'attesa' ? '#f59e0b' : '#ef4444',
                  fontSize: 14,
                }}>🧾</div>
                <div style={styles.movInfo}>
                  <div style={styles.movCausale}>{f.fornitore}</div>
                  <div style={styles.movMeta}>
                    {new Date(f.data_fattura).toLocaleDateString('it-IT')}
                    {f.data_scadenza && ` · Scad: ${new Date(f.data_scadenza).toLocaleDateString('it-IT')}`}
                    {f.riconciliata && <span style={styles.ricTag}>✓ ric.</span>}
                    {isScadenza && <span style={{ color: '#f59e0b', marginLeft: 4 }}>⏰</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
                    € {(f.importo_totale || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: f.stato === 'pagata' ? '#16a34a' : '#f59e0b', marginTop: 2 }}>
                    {f.stato === 'pagata' ? 'Pagata' : 'Da pagare'}
                  </div>
                </div>
              </div>
            );
          })}
          {fatture.length === 0 && <EmptyInSection msg="Nessuna fattura caricata" />}
        </div>
      </div>

      {/* Sezione riconciliazione rapida */}
      {computed.suggerimentiPendenti > 0 && (
        <div style={styles.ricBox}>
          <div style={styles.ricLeft}>
            <div style={{ fontSize: 28 }}>🤖</div>
            <div>
              <div style={{ fontWeight: 700, color: '#a78bfa', fontSize: 16 }}>
                {computed.suggerimentiPendenti} abbinamenti AI da confermare
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                L'AI ha trovato possibili corrispondenze tra movimenti e fatture. Verifica e conferma.
              </div>
            </div>
          </div>
          <Link
            to={`/condomini/${condominioId}/riconciliazioni`}
            style={styles.btnRic}
          >
            Vai alla Riconciliazione →
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Componenti helper ────────────────────────────────────────────────────────
function KpiCard({ titolo, valore, sub, color, icon }) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiIcon}>{icon}</div>
      <div style={{ ...styles.kpiVal, color }}>{valore}</div>
      <div style={styles.kpiTitolo}>{titolo}</div>
      <div style={styles.kpiSub}>{sub}</div>
    </div>
  );
}

function AlertChip({ color, icon, children }) {
  return (
    <div style={{ ...styles.alertChip, background: color + '15', borderColor: color + '30', color }}>
      {icon} {children}
    </div>
  );
}

function EmptyInSection({ msg }) {
  return <div style={{ textAlign: 'center', padding: '24px 0', color: '#475569', fontSize: 13 }}>{msg}</div>;
}

// ─── Stili ────────────────────────────────────────────────────────────────────
const styles = {
  page: { fontFamily: "'Sora', sans-serif", color: '#e2e8f0', padding: 24 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#64748b' },
  select: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '7px 12px', color: '#e2e8f0', fontFamily: "'Sora', sans-serif", fontSize: 13, cursor: 'pointer' },
  alertBar: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 },
  alertChip: { borderRadius: 20, border: '1px solid', padding: '6px 14px', fontSize: 12, fontWeight: 600 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
  kpiCard: { background: '#1e293b', borderRadius: 14, border: '1px solid #334155', padding: '18px 20px' },
  kpiIcon: { fontSize: 22, marginBottom: 8 },
  kpiVal: { fontSize: 22, fontWeight: 700, lineHeight: 1 },
  kpiTitolo: { fontSize: 13, color: '#94a3b8', marginTop: 4, fontWeight: 600 },
  kpiSub: { fontSize: 11, color: '#475569', marginTop: 2 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 },
  section: { background: '#1e293b', borderRadius: 14, border: '1px solid #334155', padding: '18px 20px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: '#f1f5f9' },
  seeAll: { fontSize: 12, color: '#2563eb', textDecoration: 'none' },
  movRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #0f172a', transition: 'background 0.15s' },
  movRowAlert: { background: '#f59e0b08' },
  movDot: { width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, fontSize: 12 },
  movInfo: { flex: 1, minWidth: 0 },
  movCausale: { fontSize: 13, color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  movMeta: { fontSize: 11, color: '#64748b', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 },
  ricTag: { background: '#16a34a20', color: '#16a34a', borderRadius: 20, padding: '1px 6px', fontSize: 10 },
  movImporto: { fontSize: 14, fontWeight: 700, flexShrink: 0 },
  ricBox: {
    background: '#8b5cf615', border: '1px solid #8b5cf630',
    borderRadius: 14, padding: '18px 24px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
  },
  ricLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  btnRic: {
    background: 'linear-gradient(135deg, #2563eb, #8b5cf6)',
    color: '#fff', textDecoration: 'none', borderRadius: 10,
    padding: '10px 20px', fontFamily: "'Sora', sans-serif",
    fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
  },
};
