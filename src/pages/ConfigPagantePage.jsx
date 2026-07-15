import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Save, Home, User, Info } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

/**
 * ConfigPagantePage
 * Per ogni unità del condominio, configura chi è responsabile del pagamento:
 * - Proprietario (default)
 * - Inquilino (se presente)
 * Salva su config_pagante_unita
 */
export default function ConfigPagantePage() {
  const { condominioId } = useParams();

  const [unita, setUnita] = useState([]);
  const [config, setConfig] = useState({});           // { unitaId: 'proprietario' | 'inquilino' }
  const [originale, setOriginale] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [defaultGlobal, setDefaultGlobal] = useState('proprietario');

  const [esercizi, setEsercizi] = useState([]);
  const [esercizioId, setEsercizioId] = useState('');

  // ─── Caricamento Esercizi ─────────────────────────────────────
  useEffect(() => {
    if (!condominioId) return;
    loadEsercizi();
  }, [condominioId]);

  async function loadEsercizi() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('esercizi')
        .select('*')
        .eq('condominio_id', condominioId)
        .order('anno', { ascending: false });

      if (error) throw error;
      setEsercizi(data || []);
      
      const active = data?.find(e => e.stato === 'aperto') || data?.[0];
      if (active) {
        setEsercizioId(active.id);
      } else {
        setLoading(false);
      }
    } catch (e) {
      showToast('Errore caricamento esercizi: ' + e.message, 'error');
      setLoading(false);
    }
  }

  // ─── Caricamento Configurazione per Esercizio ──────────────────
  useEffect(() => {
    if (!esercizioId) return;
    loadConfig();
  }, [esercizioId]);

  async function loadConfig() {
    setLoading(true);
    try {
      const [{ data: uni }, { data: cfg }] = await Promise.all([
        supabase.from('unita').select(`
          *,
          occupanti:occupanti_unita(
            id, ruolo, attivo,
            persona:persone(id, nominativo, email, telefono)
          )
        `).eq('condominio_id', condominioId).order('numero'),
        supabase.from('config_pagante_unita').select('*').eq('esercizio_id', esercizioId),
      ]);

      setUnita(uni || []);

      const map = {};
      (cfg || []).forEach(c => {
        map[c.unita_id] = c.pagante;
      });
      setConfig(map);
      setOriginale(map);
    } catch (e) {
      showToast('Errore: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // ─── Applica default a tutte ──────────────────────────────────
  function applicaDefault() {
    const nuovoConfig = {};
    unita.forEach(u => {
      nuovoConfig[u.id] = defaultGlobal;
    });
    setConfig(nuovoConfig);
  }

  // ─── Cambio singola unità ─────────────────────────────────────
  function togglePagante(unitaId, valore) {
    setConfig(prev => ({ ...prev, [unitaId]: valore }));
  }

  // ─── Salvataggio ─────────────────────────────────────────────
  async function salva() {
    if (!esercizioId) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const upserts = Object.entries(config).map(([unita_id, pagante]) => ({
        esercizio_id: esercizioId,
        unita_id,
        pagante,
        user_id: user.id,
      }));

      const { error } = await supabase
        .from('config_pagante_unita')
        .upsert(upserts, { onConflict: 'esercizio_id,unita_id' });

      if (error) throw error;

      setOriginale({ ...config });
      showToast('Configurazione salvata', 'success');
    } catch (e) {
      showToast('Errore: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function showToast(msg, type) {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function getProprietario(u) {
    return u.occupanti?.find(o => (o.ruolo === 'proprietario' || o.tipo_occupante === 'proprietario') && o.attivo !== false)?.persona;
  }

  // eslint-disable-next-line
  function getInquilino(u) {
    return u.occupanti?.find(o =>
      (o.ruolo === 'inquilino' || o.tipo_occupante === 'inquilino') && o.attivo !== false
    )?.persona;
  }

  const isDirty = JSON.stringify(config) !== JSON.stringify(originale);
  const uniteSenzaConfig = unita.filter(u => !config[u.id]).length;

  if (loading) return <div style={styles.loading}>Caricamento...</div>;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Configurazione Pagante</h1>
          <p style={styles.subtitle}>
            Definisci chi è responsabile del pagamento delle quote per ogni unità.
          </p>
        </div>
        <button
          style={{ ...styles.btnPrimary, opacity: (!isDirty || saving || !esercizioId) ? 0.5 : 1 }}
          onClick={salva}
          disabled={!isDirty || saving || !esercizioId}
        >
          {saving ? 'Salvataggio...' : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Save size={16} /> Salva Configurazione
            </span>
          )}
        </button>
      </div>

      {/* Selettore Esercizio */}
      <div style={{ ...styles.defaultBar, marginBottom: 12 }}>
        <span style={styles.defaultLabel}>Esercizio Contabile:</span>
        {esercizi.length > 0 ? (
          <select
            style={styles.select}
            value={esercizioId}
            onChange={e => setEsercizioId(e.target.value)}
          >
            {esercizi.map(es => (
              <option key={es.id} value={es.id}>
                {es.anno} - {es.tipo === 'straordinario' ? 'Straordinario' : 'Ordinario'} ({es.stato})
              </option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: 13, color: '#f87171' }}>Nessun esercizio creato per questo condominio. Crea prima un esercizio.</span>
        )}
      </div>

      {/* Alert unità senza config */}
      {uniteSenzaConfig > 0 && esercizioId && (
        <div style={{ ...styles.alert, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Info size={14} style={{ flexShrink: 0 }} />
          <span>{uniteSenzaConfig} {uniteSenzaConfig === 1 ? 'unità non ha' : 'unità non hanno'} ancora una configurazione. Il default è <strong>proprietario</strong>.</span>
        </div>
      )}

      {/* Default globale */}
      {esercizioId && (
        <div style={styles.defaultBar}>
          <span style={styles.defaultLabel}>Applica a tutte le unità:</span>
          <select
            style={styles.select}
            value={defaultGlobal}
            onChange={e => setDefaultGlobal(e.target.value)}
          >
            <option value="proprietario">Proprietario</option>
            <option value="inquilino">Inquilino</option>
          </select>
          <button style={styles.btnSecondary} onClick={applicaDefault}>
            Applica
          </button>
        </div>
      )}

      {/* Legenda */}
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <span style={{ ...styles.badge, background: '#2563eb20', color: '#60a5fa' }}>Proprietario</span>
          <span>Le quote vengono addebitate al proprietario dell'unità</span>
        </div>
        <div style={styles.legendItem}>
          <span style={{ ...styles.badge, background: '#8b5cf620', color: '#a78bfa' }}>Inquilino</span>
          <span>Le quote vengono addebitate all'inquilino corrente</span>
        </div>
      </div>

      {/* Lista unità */}
      <div style={styles.grid}>
        {unita.map(u => {
          const prop = getProprietario(u);
          const inq = getInquilino(u);
          const pagante = config[u.id] || 'proprietario';
          const hasInquilino = !!inq;

          return (
            <div key={u.id} style={{ ...styles.card, ...(pagante === 'inquilino' ? styles.cardInquilino : {}) }}>
              {/* Header card */}
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}>
                  <span style={styles.unitNum}>Unità {u.numero}</span>
                  <span style={styles.unitTipo}>{u.tipo || 'appartamento'}</span>
                  {u.piano && <span style={styles.unitTipo}>Piano {u.piano}</span>}
                </div>
                {/* Toggle pagante */}
                <div style={styles.toggleGroup}>
                  <button
                    style={{
                      ...styles.toggleBtn,
                      ...(pagante === 'proprietario' ? styles.toggleActiveProp : {}),
                    }}
                    onClick={() => togglePagante(u.id, 'proprietario')}
                  >
                    Proprietario
                  </button>
                  <button
                    style={{
                      ...styles.toggleBtn,
                      ...(pagante === 'inquilino' ? styles.toggleActiveInq : {}),
                      opacity: hasInquilino ? 1 : 0.4,
                      cursor: hasInquilino ? 'pointer' : 'not-allowed',
                    }}
                    onClick={() => hasInquilino && togglePagante(u.id, 'inquilino')}
                    title={!hasInquilino ? 'Nessun inquilino attivo' : ''}
                  >
                    Inquilino
                  </button>
                </div>
              </div>

              {/* Info occupanti */}
              <div style={styles.occupanti}>
                {/* Proprietario */}
                <div style={{ ...styles.occupanteRow, ...(pagante === 'proprietario' ? styles.occupanteActive : {}) }}>
                  <div style={styles.occupanteIcon}><Home size={16} /></div>
                  <div style={styles.occupanteInfo}>
                    <span style={styles.occupanteLabel}>Proprietario</span>
                    <span style={styles.occupanteNome}>{prop?.nominativo || '—'}</span>
                    {prop?.email && <span style={styles.occupanteEmail}>{prop.email}</span>}
                  </div>
                  {pagante === 'proprietario' && (
                    <span style={{ ...styles.badge, background: '#2563eb20', color: '#60a5fa', marginLeft: 'auto' }}>
                      Paga
                    </span>
                  )}
                </div>

                {/* Inquilino */}
                <div style={{
                  ...styles.occupanteRow,
                  ...(pagante === 'inquilino' ? styles.occupanteActive : {}),
                  opacity: hasInquilino ? 1 : 0.4,
                }}>
                  <div style={styles.occupanteIcon}><User size={16} /></div>
                  <div style={styles.occupanteInfo}>
                    <span style={styles.occupanteLabel}>Inquilino</span>
                    <span style={styles.occupanteNome}>
                      {inq?.nominativo || <em style={{ color: 'var(--text-muted)' }}>Nessun inquilino attivo</em>}
                    </span>
                    {inq?.email && <span style={styles.occupanteEmail}>{inq.email}</span>}
                  </div>
                  {pagante === 'inquilino' && hasInquilino && (
                    <span style={{ ...styles.badge, background: '#8b5cf620', color: '#a78bfa', marginLeft: 'auto' }}>
                      Paga
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div style={{ ...styles.toast, background: toast.type === 'error' ? '#ef4444' : '#16a34a' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { fontFamily: "'Sora', sans-serif", color: 'var(--text-primary)', padding: 24 },
  loading: { textAlign: 'center', padding: 60, color: 'var(--text-muted)' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 20, flexWrap: 'wrap', gap: 16,
  },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' },
  alert: {
    background: '#2563eb10', border: '1px solid #2563eb30',
    borderRadius: 10, padding: '10px 16px', marginBottom: 16,
    color: '#93c5fd', fontSize: 13,
  },
  defaultBar: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
    background: 'var(--card-bg)', borderRadius: 10, padding: '12px 16px',
    border: '1px solid var(--border-color)',
  },
  defaultLabel: { fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' },
  select: {
    background: 'var(--app-bg)', border: '1px solid var(--border-color)',
    borderRadius: 8, padding: '7px 12px', color: 'var(--text-primary)',
    fontFamily: "'Sora', sans-serif", fontSize: 13, cursor: 'pointer',
  },
  legend: {
    display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap',
    fontSize: 12, color: 'var(--text-muted)', alignItems: 'center',
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: 8 },
  badge: {
    borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: 16,
  },
  card: {
    background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--border-color)',
    overflow: 'hidden', transition: 'border-color 0.2s',
  },
  cardInquilino: { borderColor: '#8b5cf640' },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '14px 16px', borderBottom: '1px solid var(--border-color)', gap: 12, flexWrap: 'wrap',
  },
  cardTitle: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  unitNum: { fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 },
  unitTipo: {
    background: 'var(--border-color)', color: 'var(--text-secondary)',
    borderRadius: 20, padding: '2px 8px', fontSize: 11,
  },
  toggleGroup: {
    display: 'flex', background: 'var(--app-bg)',
    borderRadius: 8, padding: 2, border: '1px solid var(--border-color)',
  },
  toggleBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)',
    padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
    fontFamily: "'Sora', sans-serif", fontSize: 12, fontWeight: 600,
    transition: 'all 0.2s', whiteSpace: 'nowrap',
  },
  toggleActiveProp: { background: '#2563eb', color: '#fff' },
  toggleActiveInq: { background: '#8b5cf6', color: '#fff' },
  occupanti: { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  occupanteRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '8px 10px', borderRadius: 8, transition: 'background 0.2s',
  },
  occupanteActive: { background: 'var(--app-bg)' },
  occupanteIcon: { fontSize: 18, marginTop: 1 },
  occupanteInfo: { display: 'flex', flexDirection: 'column', gap: 1, flex: 1 },
  occupanteLabel: { fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  occupanteNome: { fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' },
  occupanteEmail: { fontSize: 11, color: 'var(--text-muted)' },
  btnPrimary: {
    background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 22px',
    fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer',
  },
  btnSecondary: {
    background: 'var(--border-color)', color: 'var(--text-secondary)', border: 'none',
    borderRadius: 8, padding: '7px 16px',
    fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  toast: {
    position: 'fixed', bottom: 32, right: 32,
    padding: '12px 24px', borderRadius: 10,
    color: '#fff', fontWeight: 600, fontSize: 14,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 9999,
  },
};
