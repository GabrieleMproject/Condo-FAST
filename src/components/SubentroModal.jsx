import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ArrowRightLeft, X, Calculator, Check } from 'lucide-react';

/**
 * SubentroModal
 * Gestione subentri mid-anno:
 * - Calcola pro-rata giorni automaticamente
 * - Permette override manuale dell'importo
 * - Salva su ripartizioni con flag override_manuale
 */
export default function SubentroModal({ spesa, unita, ripartizione, esercizio, onClose, onSaved }) {
  const [dataSubentro, setDataSubentro] = useState('');
  const [importoOverride, setImportoOverride] = useState('');
  const [useProrata, setUseProrata] = useState(true);
  const [notaOverride, setNotaOverride] = useState('');
  const [saving, setSaving] = useState(false);
  const [calcoloProrata, setCalcoloProrata] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // ─── Calcola pro-rata quando cambia la data ──────────────────
  useEffect(() => {
    if (!dataSubentro || !esercizio || !spesa) return;

    const dataInizio = new Date(esercizio.data_inizio);
    const dataFine = new Date(esercizio.data_fine);
    const dataSub = new Date(dataSubentro);

    // Valida che la data sia nell'esercizio
    if (dataSub < dataInizio || dataSub > dataFine) {
      setErrorMsg('La data deve essere compresa nel periodo dell\'esercizio');
      setCalcoloProrata(null);
      return;
    }
    setErrorMsg('');

    const giorniTotali = Math.round((dataFine - dataInizio) / (1000 * 60 * 60 * 24)) + 1;
    const giorniCompetenza = Math.round((dataFine - dataSub) / (1000 * 60 * 60 * 24)) + 1;
    const importoOriginale = ripartizione?.importo || 0;
    const importoCalcolato = (importoOriginale / giorniTotali) * giorniCompetenza;

    setCalcoloProrata({
      giorniTotali,
      giorniCompetenza,
      giorniPrecedenti: giorniTotali - giorniCompetenza,
      importoOriginale,
      importoCalcolato: Math.round(importoCalcolato * 100) / 100,
      importoPrec: Math.round((importoOriginale - importoCalcolato) * 100) / 100,
    });

    if (useProrata) {
      setImportoOverride((Math.round(importoCalcolato * 100) / 100).toString());
    }
  }, [dataSubentro, esercizio, spesa, ripartizione, useProrata]);

  // ─── Quando l'utente disabilita pro-rata ─────────────────────
  useEffect(() => {
    if (!useProrata) {
      setImportoOverride(ripartizione?.importo?.toString() || '');
    } else if (calcoloProrata) {
      setImportoOverride(calcoloProrata.importoCalcolato.toString());
    }
  }, [useProrata]);

  // ─── Salvataggio ─────────────────────────────────────────────
  async function salva() {
    if (!importoOverride || isNaN(parseFloat(importoOverride))) {
      setErrorMsg('Inserisci un importo valido');
      return;
    }
    if (errorMsg) return;

    setSaving(true);
    try {
      const importoNum = parseFloat(importoOverride);

      // Aggiorna la ripartizione esistente
      const update = {
        override_manuale: true,
        importo_override: importoNum,
        note_override: notaOverride || `Subentro dal ${dataSubentro}`,
        giorni_totali: calcoloProrata?.giorniTotali || null,
        giorni_competenza: calcoloProrata?.giorniCompetenza || null,
      };

      if (ripartizione?.id) {
        const { error } = await supabase
          .from('ripartizioni')
          .update(update)
          .eq('id', ripartizione.id);
        if (error) throw error;
      } else {
        // Crea nuova ripartizione se non esiste ancora
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('ripartizioni').insert({
          condominio_id: spesa.condominio_id,
          spesa_id: spesa.id,
          unita_id: unita.id,
          importo: importoNum,
          ...update,
          user_id: user.id,
        });
        if (error) throw error;
      }

      onSaved?.();
      onClose();
    } catch (e) {
      setErrorMsg('Errore salvataggio: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <div>
            <h3 style={{ ...styles.modalTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ArrowRightLeft size={18} /> Gestione Subentro
            </h3>
            <p style={styles.modalSub}>
              {unita?.numero && `Unità ${unita.numero} · `}
              {spesa?.descrizione}
            </p>
          </div>
          <button style={styles.closeBtn} onClick={onClose} type="button"><X size={18} /></button>
        </div>

        {/* Info spesa */}
        <div style={styles.infoBox}>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Importo spesa totale</span>
            <span style={styles.infoValue}>€ {(spesa?.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Quota originale unità</span>
            <span style={styles.infoValue}>€ {(ripartizione?.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Esercizio</span>
            <span style={styles.infoValue}>
              {new Date(esercizio?.data_inizio).toLocaleDateString('it-IT')} —{' '}
              {new Date(esercizio?.data_fine).toLocaleDateString('it-IT')}
            </span>
          </div>
        </div>

        {/* Data subentro */}
        <div style={styles.field}>
          <label style={styles.label}>Data subentro</label>
          <input
            type="date"
            style={styles.input}
            value={dataSubentro}
            onChange={e => setDataSubentro(e.target.value)}
            min={esercizio?.data_inizio}
            max={esercizio?.data_fine}
          />
          <span style={styles.hint}>Data da cui il nuovo occupante diventa responsabile</span>
        </div>

        {/* Preview pro-rata */}
        {calcoloProrata && (
          <div style={styles.proRataBox}>
            <div style={{ ...styles.proRataTitle, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calculator size={15} /> Calcolo Pro-Rata
            </div>
            <div style={styles.proRataGrid}>
              <div style={styles.proRataItem}>
                <span style={styles.proRataLabel}>Giorni esercizio</span>
                <span style={styles.proRataVal}>{calcoloProrata.giorniTotali}gg</span>
              </div>
              <div style={styles.proRataItem}>
                <span style={styles.proRataLabel}>Giorni nuovo occupante</span>
                <span style={{ ...styles.proRataVal, color: '#16a34a' }}>{calcoloProrata.giorniCompetenza}gg</span>
              </div>
              <div style={styles.proRataItem}>
                <span style={styles.proRataLabel}>Giorni precedente</span>
                <span style={{ ...styles.proRataVal, color: '#f59e0b' }}>{calcoloProrata.giorniPrecedenti}gg</span>
              </div>
              <div style={{ ...styles.proRataItem, borderTop: '1px solid var(--border-color)', paddingTop: 10, marginTop: 4, gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span style={styles.proRataLabel}>Quota nuovo occupante</span>
                  <span style={{ ...styles.proRataVal, color: '#16a34a', fontSize: 18, display: 'block' }}>
                    € {calcoloProrata.importoCalcolato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={styles.proRataLabel}>Quota precedente occupante</span>
                  <span style={{ ...styles.proRataVal, color: '#f59e0b', fontSize: 18, display: 'block' }}>
                    € {calcoloProrata.importoPrec.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toggle pro-rata / manuale */}
        {dataSubentro && (
          <div style={styles.field}>
            <div style={styles.toggleRow}>
              <label style={styles.label}>Modalità importo</label>
              <div style={styles.segmented}>
                <button
                  style={{ ...styles.segBtn, ...(useProrata ? styles.segActive : {}) }}
                  onClick={() => setUseProrata(true)}
                >
                  Pro-rata automatico
                </button>
                <button
                  style={{ ...styles.segBtn, ...(!useProrata ? styles.segActive : {}) }}
                  onClick={() => setUseProrata(false)}
                >
                  Importo manuale
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Importo override */}
        <div style={styles.field}>
          <label style={styles.label}>Importo da addebitare al nuovo occupante (€)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            style={{ ...styles.input, fontSize: 18, fontWeight: 700 }}
            value={importoOverride}
            onChange={e => {
              setImportoOverride(e.target.value);
              setUseProrata(false);
            }}
            placeholder="0.00"
          />
        </div>

        {/* Nota */}
        <div style={styles.field}>
          <label style={styles.label}>Nota (opzionale)</label>
          <input
            style={styles.input}
            placeholder={`Subentro dal ${dataSubentro || '...'}`}
            value={notaOverride}
            onChange={e => setNotaOverride(e.target.value)}
          />
        </div>

        {errorMsg && <div style={styles.errorMsg}>{errorMsg}</div>}

        {/* Footer */}
        <div style={styles.modalFooter}>
          <button style={styles.btnSecondary} onClick={onClose}>Annulla</button>
          <button
            style={{ ...styles.btnPrimary, opacity: saving ? 0.6 : 1 }}
            onClick={salva}
            disabled={saving}
          >
            {saving ? 'Salvataggio...' : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Check size={16} /> Conferma Subentro
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border-color)',
    padding: 28, width: '100%', maxWidth: 560,
    maxHeight: '90vh', overflowY: 'auto',
    fontFamily: "'Sora', sans-serif",
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: { margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' },
  modalSub: { margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', fontSize: 18, padding: 4,
  },
  infoBox: {
    background: 'var(--app-bg)', borderRadius: 10, padding: '12px 16px',
    marginBottom: 20, border: '1px solid var(--border-color)',
  },
  infoRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '4px 0', fontSize: 13, borderBottom: '1px solid var(--border-color-2)',
  },
  infoLabel: { color: 'var(--text-muted)' },
  infoValue: { color: 'var(--text-primary)', fontWeight: 600 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: {
    width: '100%', background: 'var(--app-bg)', border: '1px solid var(--border-color)',
    borderRadius: 8, padding: '10px 14px', color: 'var(--text-primary)',
    fontFamily: "'Sora', sans-serif", fontSize: 14, outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  hint: { fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' },
  proRataBox: {
    background: 'var(--app-bg)', borderRadius: 12, border: '1px solid #2563eb30',
    padding: '14px 18px', marginBottom: 20,
  },
  proRataTitle: { fontSize: 13, fontWeight: 700, color: '#60a5fa', marginBottom: 12 },
  proRataGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
  },
  proRataItem: { display: 'flex', flexDirection: 'column', gap: 4 },
  proRataLabel: { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  proRataVal: { fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' },
  toggleRow: {},
  segmented: {
    display: 'flex', background: 'var(--app-bg)', borderRadius: 8,
    padding: 2, border: '1px solid var(--border-color)', marginTop: 6,
  },
  segBtn: {
    flex: 1, background: 'none', border: 'none', color: 'var(--text-muted)',
    padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
    fontFamily: "'Sora', sans-serif", fontSize: 12, fontWeight: 600,
    transition: 'all 0.2s',
  },
  segActive: { background: '#2563eb', color: '#fff' },
  errorMsg: {
    background: '#ef444420', border: '1px solid #ef444440',
    borderRadius: 8, padding: '10px 14px', color: '#ef4444',
    fontSize: 13, marginBottom: 16,
  },
  modalFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20,
    paddingTop: 16, borderTop: '1px solid var(--border-color)',
  },
  btnPrimary: {
    background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 24px',
    fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer',
  },
  btnSecondary: {
    background: 'none', color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)', borderRadius: 8,
    padding: '10px 20px', fontFamily: "'Sora', sans-serif",
    fontWeight: 600, fontSize: 14, cursor: 'pointer',
  },
};
