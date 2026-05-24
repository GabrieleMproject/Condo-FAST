import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * MillesimiEditor
 * Griglia interattiva: righe = unità, colonne = tabelle millesimali
 * Validazione: somma per ogni tabella deve essere 1000
 */
export default function MillesimiEditor({ condominioId }) {
  const [tabelle, setTabelle] = useState([]);
  const [unita, setUnita] = useState([]);
  const [valori, setValori] = useState({});       // { `${unitaId}_${tabellaId}`: numeric }
  const [originali, setOriginali] = useState({});  // snapshot per dirty check
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [nuovaTabella, setNuovaTabella] = useState('');
  const [showNuovaTabella, setShowNuovaTabella] = useState(false);

  // ─── Caricamento dati ───────────────────────────────────────
  useEffect(() => {
    if (!condominioId) return;
    loadAll();
  }, [condominioId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [{ data: tab }, { data: uni }, { data: mil }] = await Promise.all([
        supabase.from('tabelle_millesimali').select('*').eq('condominio_id', condominioId).order('nome'),
        supabase.from('unita').select('*, persone:occupanti_unita(persona:persone(nominativo))').eq('condominio_id', condominioId).order('numero'),
        supabase.from('millesimi_unita').select('*').eq('condominio_id', condominioId),
      ]);

      setTabelle(tab || []);
      setUnita(uni || []);

      // Costruisci mappa valori
      const map = {};
      (mil || []).forEach(m => {
        map[`${m.unita_id}_${m.tabella_id}`] = m.valore;
      });
      setValori(map);
      setOriginali(map);
    } catch (e) {
      showToast('Errore caricamento dati', 'error');
    } finally {
      setLoading(false);
    }
  }

  // ─── Calcolo somme per colonna (tabella) ────────────────────
  const sommaPer = useCallback((tabellaId) => {
    return unita.reduce((acc, u) => {
      const v = parseFloat(valori[`${u.id}_${tabellaId}`] || 0);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
  }, [unita, valori]);

  // ─── Modifica cella ─────────────────────────────────────────
  function handleChange(unitaId, tabellaId, raw) {
    const key = `${unitaId}_${tabellaId}`;
    // Permetti stringa vuota e numeri con virgola
    const normalized = raw.replace(',', '.');
    setValori(prev => ({ ...prev, [key]: normalized }));

    // Valida in tempo reale la somma
    const nuoviValori = { ...valori, [key]: normalized };
    const somma = unita.reduce((acc, u) => {
      const v = parseFloat(nuoviValori[`${u.id}_${tabellaId}`] || 0);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);

    setErrors(prev => ({
      ...prev,
      [tabellaId]: Math.abs(somma - 1000) > 0.01 ? `Somma: ${somma.toFixed(2)} (deve essere 1000)` : null,
    }));
  }

  // ─── Distribuzione automatica ───────────────────────────────
  function distribuisciEquamente(tabellaId) {
    if (unita.length === 0) return;
    const quota = (1000 / unita.length);
    const nuovi = { ...valori };
    unita.forEach((u, i) => {
      // L'ultima unità prende il resto per garantire esattamente 1000
      const v = i === unita.length - 1
        ? (1000 - quota * (unita.length - 1))
        : quota;
      nuovi[`${u.id}_${tabellaId}`] = parseFloat(v.toFixed(2));
    });
    setValori(nuovi);
    setErrors(prev => ({ ...prev, [tabellaId]: null }));
  }

  // ─── Salvataggio ────────────────────────────────────────────
  async function salva() {
    // Controlla errori
    const hasErrors = Object.values(errors).some(e => e !== null);
    if (hasErrors) {
      showToast('Correggi gli errori prima di salvare', 'error');
      return;
    }

    setSaving(true);
    try {
      const upserts = [];
      const { data: { user } } = await supabase.auth.getUser();

      unita.forEach(u => {
        tabelle.forEach(t => {
          const key = `${u.id}_${t.id}`;
          const valore = parseFloat(valori[key] || 0);
          if (!isNaN(valore)) {
            upserts.push({
              condominio_id: condominioId,
              unita_id: u.id,
              tabella_id: t.id,
              valore,
              user_id: user.id,
            });
          }
        });
      });

      const { error } = await supabase
        .from('millesimi_unita')
        .upsert(upserts, { onConflict: 'unita_id,tabella_id' });

      if (error) throw error;

      setOriginali({ ...valori });
      showToast('Millesimi salvati con successo', 'success');
    } catch (e) {
      showToast('Errore durante il salvataggio: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // ─── Nuova tabella millesimale ───────────────────────────────
  async function creaTabella() {
    if (!nuovaTabella.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('tabelle_millesimali').insert({
        condominio_id: condominioId,
        nome: nuovaTabella.trim(),
        user_id: user.id,
      });
      if (error) throw error;
      setNuovaTabella('');
      setShowNuovaTabella(false);
      await loadAll();
      showToast('Tabella creata', 'success');
    } catch (e) {
      showToast('Errore: ' + e.message, 'error');
    }
  }

  // ─── Helpers ────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const isDirty = JSON.stringify(valori) !== JSON.stringify(originali);

  function getNominativo(u) {
    const occ = u.persone?.[0];
    return occ?.persona?.nominativo || '—';
  }

  // ─── Render ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.spinner} />
        <span style={{ color: '#94a3b8', marginTop: 12 }}>Caricamento millesimi...</span>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Editor Millesimi</h2>
          <p style={styles.subtitle}>
            Inserisci i valori per ogni unità. La somma di ogni colonna deve essere <strong style={{ color: '#2563eb' }}>1000</strong>.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button
            style={styles.btnSecondary}
            onClick={() => setShowNuovaTabella(!showNuovaTabella)}
          >
            + Tabella
          </button>
          <button
            style={{ ...styles.btnPrimary, opacity: (!isDirty || saving) ? 0.5 : 1 }}
            onClick={salva}
            disabled={!isDirty || saving}
          >
            {saving ? 'Salvataggio...' : '💾 Salva Millesimi'}
          </button>
        </div>
      </div>

      {/* Form nuova tabella */}
      {showNuovaTabella && (
        <div style={styles.nuovaTabellaBar}>
          <input
            style={styles.input}
            placeholder="Nome tabella (es. Generale, Scale, Ascensore...)"
            value={nuovaTabella}
            onChange={e => setNuovaTabella(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && creaTabella()}
            autoFocus
          />
          <button style={styles.btnPrimary} onClick={creaTabella}>Crea</button>
          <button style={styles.btnSecondary} onClick={() => setShowNuovaTabella(false)}>Annulla</button>
        </div>
      )}

      {/* Griglia */}
      {tabelle.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <p style={{ color: '#94a3b8' }}>Nessuna tabella millesimale. Creane una con "+ Tabella".</p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.thFixed }}>Unità</th>
                <th style={{ ...styles.th, ...styles.thFixed, color: '#94a3b8', fontWeight: 400 }}>Proprietario</th>
                {tabelle.map(t => (
                  <th key={t.id} style={styles.th}>
                    <div style={styles.thTabella}>
                      <span>{t.nome}</span>
                      <button
                        style={styles.btnDistribuisci}
                        title="Distribuisci equamente"
                        onClick={() => distribuisciEquamente(t.id)}
                      >
                        ⚖️
                      </button>
                    </div>
                    {/* Somma colonna */}
                    <div style={{
                      ...styles.sommaBadge,
                      background: errors[t.id] ? '#ef444420' : '#16a34a20',
                      color: errors[t.id] ? '#ef4444' : '#16a34a',
                    }}>
                      {sommaPer(t.id).toFixed(2)}
                    </div>
                    {errors[t.id] && (
                      <div style={styles.errorMsg}>{errors[t.id]}</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unita.map((u, idx) => (
                <tr key={u.id} style={{ background: idx % 2 === 0 ? '#0f172a' : '#1e293b08' }}>
                  <td style={{ ...styles.td, ...styles.tdUnit }}>
                    <span style={styles.unitNum}>{u.numero}</span>
                    <span style={styles.unitTipo}>{u.tipo || 'appartamento'}</span>
                  </td>
                  <td style={{ ...styles.td, color: '#64748b', fontSize: 13 }}>
                    {getNominativo(u)}
                  </td>
                  {tabelle.map(t => {
                    const key = `${u.id}_${t.id}`;
                    const val = valori[key] ?? '';
                    return (
                      <td key={t.id} style={styles.td}>
                        <input
                          type="text"
                          inputMode="decimal"
                          style={styles.cellInput}
                          value={val}
                          onChange={e => handleChange(u.id, t.id, e.target.value)}
                          placeholder="0"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {/* Footer somme */}
            <tfoot>
              <tr style={{ background: '#1e293b' }}>
                <td style={{ ...styles.td, fontWeight: 700, color: '#94a3b8' }} colSpan={2}>
                  TOTALE
                </td>
                {tabelle.map(t => {
                  const s = sommaPer(t.id);
                  const ok = Math.abs(s - 1000) <= 0.01;
                  return (
                    <td key={t.id} style={{ ...styles.td, fontWeight: 700, color: ok ? '#16a34a' : '#ef4444', textAlign: 'center' }}>
                      {s.toFixed(2)}
                      {ok && <span style={{ marginLeft: 4 }}>✓</span>}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Legend */}
      <div style={styles.legend}>
        <span style={styles.legendItem}>⚖️ = Distribuisci equamente tra le unità</span>
        <span style={styles.legendItem}>· La somma per ogni tabella deve essere esattamente 1000</span>
        <span style={styles.legendItem}>· I valori vengono usati per calcolare la ripartizione delle spese</span>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          ...styles.toast,
          background: toast.type === 'error' ? '#ef4444' : '#16a34a',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── Stili ──────────────────────────────────────────────────────────────────
const styles = {
  wrap: {
    fontFamily: "'Sora', sans-serif",
    color: '#e2e8f0',
    position: 'relative',
  },
  loadingWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: 60,
  },
  spinner: {
    width: 36, height: 36,
    border: '3px solid #1e293b',
    borderTop: '3px solid #2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 20, gap: 16, flexWrap: 'wrap',
  },
  title: { margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#94a3b8' },
  headerActions: { display: 'flex', gap: 10, alignItems: 'center' },
  nuovaTabellaBar: {
    display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center',
    background: '#1e293b', padding: '12px 16px', borderRadius: 10,
    border: '1px solid #334155',
  },
  input: {
    flex: 1, background: '#0f172a', border: '1px solid #334155',
    borderRadius: 8, padding: '8px 12px', color: '#e2e8f0',
    fontFamily: "'Sora', sans-serif", fontSize: 14,
    outline: 'none',
  },
  btnPrimary: {
    background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: 8, padding: '8px 18px', fontFamily: "'Sora', sans-serif",
    fontWeight: 600, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'background 0.2s',
  },
  btnSecondary: {
    background: '#1e293b', color: '#94a3b8',
    border: '1px solid #334155', borderRadius: 8,
    padding: '8px 16px', fontFamily: "'Sora', sans-serif",
    fontWeight: 600, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  emptyState: {
    textAlign: 'center', padding: '60px 20px',
    background: '#1e293b', borderRadius: 12, border: '1px dashed #334155',
  },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: 12,
    border: '1px solid #1e293b',
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    background: '#1e293b', color: '#94a3b8',
    padding: '10px 12px', textAlign: 'center',
    fontWeight: 600, fontSize: 12, textTransform: 'uppercase',
    letterSpacing: '0.05em', borderBottom: '1px solid #334155',
    minWidth: 110,
  },
  thFixed: { textAlign: 'left', minWidth: 120 },
  thTabella: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 6,
  },
  btnDistribuisci: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, padding: 2, opacity: 0.7,
    transition: 'opacity 0.2s',
  },
  sommaBadge: {
    display: 'inline-block', marginTop: 4,
    padding: '2px 8px', borderRadius: 20,
    fontSize: 11, fontWeight: 700,
  },
  errorMsg: {
    color: '#ef4444', fontSize: 10, marginTop: 2,
  },
  td: {
    padding: '8px 12px', borderBottom: '1px solid #1e293b10',
    textAlign: 'center', color: '#cbd5e1',
    borderRight: '1px solid #1e293b30',
  },
  tdUnit: { textAlign: 'left' },
  unitNum: {
    fontWeight: 700, color: '#f1f5f9', marginRight: 6,
  },
  unitTipo: {
    color: '#64748b', fontSize: 11,
    background: '#334155', padding: '2px 6px', borderRadius: 10,
  },
  cellInput: {
    width: 80, background: '#0f172a',
    border: '1px solid #334155', borderRadius: 6,
    padding: '5px 8px', color: '#e2e8f0',
    fontFamily: "'Sora', sans-serif", fontSize: 14,
    textAlign: 'right', outline: 'none',
    transition: 'border-color 0.2s',
  },
  legend: {
    display: 'flex', flexWrap: 'wrap', gap: 16,
    marginTop: 12, fontSize: 12, color: '#475569',
  },
  legendItem: {},
  toast: {
    position: 'fixed', bottom: 32, right: 32,
    padding: '12px 24px', borderRadius: 10,
    color: '#fff', fontWeight: 600, fontSize: 14,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    zIndex: 9999, animation: 'slideUp 0.3s ease',
  },
};
