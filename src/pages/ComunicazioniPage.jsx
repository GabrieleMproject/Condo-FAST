import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useCondomini } from '../hooks/useCondomini';
import { useComunicazioni } from '../hooks/useComunicazioni';
import { Mail, RefreshCw, Calendar, Eye, Filter, CheckCircle2, AlertTriangle, Send, X } from 'lucide-react';

export default function ComunicazioniPage() {
  const { condomini, loading: loadingCondo } = useCondomini();
  const { comunicazioni, loading, fetchComunicazioni } = useComunicazioni();

  const [filtroCondo, setFiltroCondo] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStato, setFiltroStato] = useState('');
  const [selectedMsg, setSelectedMsg] = useState(null);

  // Mappa dei nomi dei condomini
  const [condoNomi, setCondoNomi] = useState({});

  useEffect(() => {
    fetchComunicazioni();
  }, [fetchComunicazioni]);

  // Carica i nomi dei condomini per la tabella
  useEffect(() => {
    if (condomini && condomini.length > 0) {
      const mappa = {};
      condomini.forEach(c => {
        mappa[c.id] = c.nome;
      });
      setCondoNomi(mappa);
    }
  }, [condomini]);

  // Filtra le comunicazioni in locale per consentire filtri rapidi
  const comunicazioniFiltrate = comunicazioni.filter(c => {
    const matchCondo = filtroCondo ? c.condominio_id === filtroCondo : true;
    const matchTipo = filtroTipo ? c.tipo === filtroTipo : true;
    const matchStato = filtroStato ? c.stato === filtroStato : true;
    return matchCondo && matchTipo && matchStato;
  });

  // Calcolo KPI
  const totali = comunicazioniFiltrate.length;
  const consegnate = comunicazioniFiltrate.filter(c => c.stato === 'inviata' || c.stato === 'consegnata').length;
  const fallite = comunicazioniFiltrate.filter(c => c.stato === 'fallita').length;
  const tassoConsegna = totali > 0 ? Math.round((consegnate / totali) * 100) : 100;

  const STATI = {
    inviata:    { label: 'Inviata',    color: '#10b981', bg: '#10b98115' },
    consegnata: { label: 'Consegnata', color: '#10b981', bg: '#10b98115' },
    fallita:    { label: 'Fallita',    color: '#ef4444', bg: '#ef444415' }
  };

  const TIPI = {
    generale:  'Generale',
    avviso:    'Avviso/Convocazione',
    sollecito: 'Sollecito Rata'
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Registro Comunicazioni</h1>
          <p style={styles.subtitle}>Monitora lo storico delle email e dei solleciti inviati ai condòmini</p>
        </div>
        <button onClick={() => fetchComunicazioni()} style={styles.btnRefresh} disabled={loading}>
          <RefreshCw size={15} style={{ marginRight: 6 }} className={loading ? 'spin' : ''} /> Aggiorna
        </button>
      </div>

      {/* KPI Row */}
      <div style={styles.kpiRow}>
        {[
          { label: 'Totale Invii', value: totali, icon: Mail, color: '#3b82f6' },
          { label: 'Consegnate', value: consegnate, icon: CheckCircle2, color: '#10b981' },
          { label: 'Fallite', value: fallite, icon: AlertTriangle, color: '#ef4444' },
          { label: 'Tasso Consegna', value: `${tassoConsegna}%`, icon: Send, color: '#8b5cf6' },
        ].map(k => (
          <div key={k.label} style={styles.kpiCard}>
            <div style={styles.kpiContent}>
              <div style={styles.kpiLabel}>{k.label}</div>
              <div style={{ ...styles.kpiValue, color: k.color }}>{k.value}</div>
            </div>
            <div style={{ ...styles.kpiIconWrap, background: `${k.color}15` }}>
              <k.icon size={20} color={k.color} />
            </div>
          </div>
        ))}
      </div>

      {/* Filtri */}
      <div style={styles.filterBar}>
        <div style={styles.filterTitle}>
          <Filter size={14} style={{ marginRight: 6 }} /> Filtri Rapidi
        </div>
        <div style={styles.filterInputs}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Condominio</label>
            <select value={filtroCondo} onChange={e => setFiltroCondo(e.target.value)} style={styles.select}>
              <option value="">Tutti</option>
              {condomini.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Tipo</label>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={styles.select}>
              <option value="">Tutti</option>
              {Object.entries(TIPI).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Stato</label>
            <select value={filtroStato} onChange={e => setFiltroStato(e.target.value)} style={styles.select}>
              <option value="">Tutti</option>
              <option value="inviata">Inviata</option>
              <option value="consegnata">Consegnata</option>
              <option value="fallita">Fallita</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabella Registri */}
      {loading ? (
        <div style={styles.loadingWrap}>Caricamento registro comunicazioni...</div>
      ) : comunicazioniFiltrate.length === 0 ? (
        <div style={styles.emptyWrap}>
          <Mail size={40} color="#334155" style={{ marginBottom: 12 }} />
          <p style={{ margin: 0 }}>Nessuna comunicazione registrata per i filtri selezionati.</p>
        </div>
      ) : (
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Data/Ora</th>
                <th style={styles.th}>Condominio</th>
                <th style={styles.th}>Destinatario</th>
                <th style={styles.th}>Oggetto</th>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Stato</th>
                <th style={styles.th}>Azione</th>
              </tr>
            </thead>
            <tbody>
              {comunicazioniFiltrate.map(c => {
                const stato = STATI[c.stato] || STATI.inviata;
                return (
                  <tr key={c.id} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={13} color="#64748b" />
                        {new Date(c.created_at).toLocaleDateString('it-IT')}{' '}
                        {new Date(c.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontWeight: 600 }}>{condoNomi[c.condominio_id] || 'Generale'}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.destWrap}>
                        <span style={styles.destNome}>{c.destinatario_nome || 'Condòmino'}</span>
                        <span style={styles.destEmail}>{c.destinatario_email}</span>
                      </div>
                    </td>
                    <td style={styles.td}>{c.oggetto}</td>
                    <td style={styles.td}>
                      <span style={styles.tipoBadge}>{TIPI[c.tipo] || c.tipo}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.statoBadge, color: stato.color, background: stato.bg }}>
                        {stato.label}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button onClick={() => setSelectedMsg(c)} style={styles.btnView} title="Visualizza Messaggio">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modale Dettaglio Messaggio */}
      {selectedMsg && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Dettaglio Email Inviata</h3>
              <button onClick={() => setSelectedMsg(null)} style={styles.btnClose}><X size={18} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Destinatario:</span>
                <span style={styles.metaValue}>
                  {selectedMsg.destinatario_nome ? `${selectedMsg.destinatario_nome} <${selectedMsg.destinatario_email}>` : selectedMsg.destinatario_email}
                </span>
              </div>
              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Condominio:</span>
                <span style={styles.metaValue}>{condoNomi[selectedMsg.condominio_id] || 'Generale'}</span>
              </div>
              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Data di invio:</span>
                <span style={styles.metaValue}>
                  {new Date(selectedMsg.created_at).toLocaleString('it-IT')}
                </span>
              </div>
              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Oggetto:</span>
                <span style={{ ...styles.metaValue, fontWeight: 700 }}>{selectedMsg.oggetto}</span>
              </div>
              <div style={styles.msgContainer}>
                <div style={styles.msgLabel}>Contenuto Email (HTML):</div>
                <div 
                  style={styles.msgContent}
                  dangerouslySetInnerHTML={{ __html: selectedMsg.messaggio }} 
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setSelectedMsg(null)} style={styles.btnSecondary}>Chiudi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { color: '#e2e8f0', minHeight: '100vh', fontFamily: "'Sora', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#64748b' },
  btnRefresh: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 16px', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600, fontFamily: "'Sora', sans-serif" },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 24 },
  kpiCard: { background: '#1e293b', borderRadius: 12, padding: '18px 20px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  kpiContent: { display: 'flex', flexDirection: 'column' },
  kpiLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
  kpiValue: { fontSize: 24, fontWeight: 700 },
  kpiIconWrap: { width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  filterBar: { background: '#1e293b', borderRadius: 12, border: '1px solid #334155', padding: '16px 20px', marginBottom: 20 },
  filterTitle: { fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: 10, marginBottom: 14 },
  filterInputs: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  filterGroup: { flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 4 },
  filterLabel: { fontSize: 11, color: '#64748b', fontWeight: 600 },
  select: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontFamily: "'Sora', sans-serif", fontSize: 13, cursor: 'pointer' },
  loadingWrap: { textAlign: 'center', padding: 60, color: '#475569', fontSize: 14 },
  emptyWrap: { textAlign: 'center', padding: 60, color: '#475569', background: '#1e293b', borderRadius: 12, border: '1px solid #334155' },
  tableCard: { background: '#1e293b', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 },
  th: { padding: '14px 18px', background: '#0f172a', borderBottom: '1px solid #334155', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  tr: { borderBottom: '1px solid #334155', transition: 'background-color 0.15s' },
  td: { padding: '14px 18px', verticalAlign: 'middle' },
  destWrap: { display: 'flex', flexDirection: 'column' },
  destNome: { color: '#f1f5f9', fontWeight: 600 },
  destEmail: { color: '#64748b', fontSize: 12 },
  tipoBadge: { background: '#0f172a', color: '#94a3b8', borderRadius: 6, padding: '3px 8px', fontSize: 11, border: '1px solid #334155' },
  statoBadge: { borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, display: 'inline-block' },
  btnView: { background: '#334155', border: 'none', borderRadius: 6, padding: '6px 10px', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  // Modal styles
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modal: { background: '#1e293b', border: '1px solid #334155', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' },
  modalHeader: { padding: '18px 24px', background: '#0f172a', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' },
  btnClose: { background: 'none', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer' },
  modalBody: { padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 },
  metaRow: { display: 'grid', gridTemplateColumns: '130px 1fr', fontSize: 13 },
  metaLabel: { color: '#64748b', fontWeight: 600 },
  metaValue: { color: '#e2e8f0' },
  msgContainer: { borderTop: '1px solid #334155', paddingTop: 14, marginTop: 6 },
  msgLabel: { color: '#64748b', fontSize: 12, fontWeight: 600, marginBottom: 8 },
  msgContent: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '16px', color: '#e2e8f0', overflowX: 'auto', fontFamily: "'Sora', sans-serif", fontSize: 13, lineHeight: 1.6 },
  modalFooter: { padding: '14px 24px', background: '#0f172a', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'flex-end' },
  btnSecondary: { background: 'transparent', border: '1px solid #334155', borderRadius: 8, padding: '8px 20px', color: '#94a3b8', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontSize: 13 }
};
