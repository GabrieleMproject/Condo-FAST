import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { X, Search, Building2, ShieldCheck, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';

export default function SelezionaBancaModal({ isOpen, onClose, condominioId, onLinkSuccess }) {
  const [institutions, setInstitutions] = useState([]);
  const [filteredInstitutions, setFilteredInstitutions] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(null); // id banca
  const [error, setError] = useState('');
  const [consapevolezza, setConsapevolezza] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadInstitutions();
    } else {
      setSearch('');
      setError('');
      setConsapevolezza(false);
    }
  }, [isOpen]);

  async function loadInstitutions() {
    setLoading(true);
    setError('');
    try {
      const { data, error: funcError } = await supabase.functions.invoke('gocardless-proxy', {
        body: { action: 'get_institutions' }
      });
      if (funcError) throw funcError;
      
      if (!Array.isArray(data)) {
        throw new Error("Risposta non valida dal server bancario");
      }
      
      // Ordinamento alfabetico
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setInstitutions(sorted);
      setFilteredInstitutions(sorted);
    } catch (err) {
      console.error(err);
      setError('Impossibile caricare la lista delle banche: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!search.trim()) {
      setFilteredInstitutions(institutions);
    } else {
      const lower = search.toLowerCase();
      setFilteredInstitutions(
        institutions.filter(i => i.name.toLowerCase().includes(lower))
      );
    }
  }, [search, institutions]);

  async function handleSelect(bank) {
    if (!consapevolezza) {
      setError('Devi confermare di avere il mandato per operare sul conto corrente del condominio.');
      return;
    }
    setConnecting(bank.id);
    setError('');
    try {
      const { data, error: linkErr } = await supabase.functions.invoke('gocardless-proxy', {
        body: { 
          action: 'create_requisition', 
          payload: { 
            condominioId: condominioId,
            institutionId: bank.id,
            institutionName: bank.name,
            // Aggiungiamo un parametro ref all'URL di redirect per facilitare l'auto-sync al ritorno
            redirectUrl: window.location.href.split('?')[0] + '?gocardless_ref=' + condominioId
          }
        }
      });
      if (linkErr) throw linkErr;
      
      if (data?.link) {
        // Redirige l'utente alla pagina sicura della banca
        window.location.href = data.link;
      } else {
        // Fallback per sandbox se manca il link o per test locali offline
        onLinkSuccess();
      }
    } catch (err) {
      console.error(err);
      setError('Errore durante la creazione del link bancario: ' + err.message);
      setConnecting(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={24} style={{ color: '#2563eb' }} />
            <h2 style={styles.title}>Collega Conto Corrente (PSD2)</h2>
          </div>
          <button style={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        <div style={styles.body}>
          {/* Informative Privacy e Sicurezza GDPR/PSD2 */}
          <div style={styles.infoBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontWeight: 600, marginBottom: 4 }}>
              <ShieldCheck size={18} /> Sola Lettura — Massima Sicurezza
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
              CondoFAST utilizza <strong>GoCardless (AISP autorizzato)</strong> per collegarsi al conto in totale sicurezza, ai sensi della Direttiva Europea <strong>PSD2</strong>. Non possiamo disporre bonifici né leggere le tue credenziali. Accediamo <u>solo ai saldi e ai movimenti</u>.
            </p>
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16, cursor: 'pointer', padding: '12px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
            <input 
              type="checkbox" 
              checked={consapevolezza}
              onChange={(e) => {
                setConsapevolezza(e.target.checked);
                if (e.target.checked) setError('');
              }}
              style={{ marginTop: 2, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>
              Dichiaro, in qualità di Amministratore pro-tempore, di essere autorizzato ad accedere ai dati contabili di questo Condominio e acconsento al trattamento dei dati di sincronizzazione bancaria.
            </span>
          </label>

          <div style={styles.searchContainer}>
            <Search size={16} style={{ color: 'var(--text-muted)', position: 'absolute', left: 12, top: 10 }} />
            <input
              type="text"
              placeholder="Cerca la tua banca..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: '#ef444415', color: '#ef4444', fontSize: 13, borderRadius: 8, marginBottom: 16 }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <div style={styles.list}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <Loader2 size={24} className="spin" />
              </div>
            ) : filteredInstitutions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
                Nessuna banca trovata.
              </div>
            ) : (
              filteredInstitutions.map(bank => (
                <button 
                  key={bank.id} 
                  style={{...styles.bankRow, opacity: connecting && connecting !== bank.id ? 0.5 : 1}}
                  onClick={() => handleSelect(bank)}
                  disabled={!!connecting}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {bank.logo ? (
                      <img src={bank.logo} alt={bank.name} style={styles.bankLogo} onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div style={styles.bankLogoPlaceholder}><Building2 size={16} /></div>
                    )}
                    <span style={styles.bankName}>{bank.name}</span>
                  </div>
                  {connecting === bank.id ? (
                    <Loader2 size={16} className="spin" style={{ color: '#2563eb' }} />
                  ) : (
                    <ExternalLink size={16} style={{ color: 'var(--text-muted)' }} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: 20
  },
  modal: {
    background: 'var(--app-bg)',
    width: '100%', maxWidth: 500,
    borderRadius: 16, overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
    border: '1px solid var(--border-color)',
    display: 'flex', flexDirection: 'column', maxHeight: '85vh'
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px', borderBottom: '1px solid var(--border-color)',
    background: 'var(--card-bg)'
  },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 4
  },
  body: { padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  infoBox: {
    background: '#16a34a10', border: '1px solid #16a34a30',
    borderRadius: 8, padding: 16,
  },
  searchContainer: {
    position: 'relative', marginTop: 20, marginBottom: 16
  },
  searchInput: {
    width: '100%', padding: '10px 10px 10px 38px',
    background: 'var(--card-bg)', border: '1px solid var(--border-color)',
    color: 'var(--text-primary)', borderRadius: 8, fontSize: 14, outline: 'none'
  },
  list: {
    border: '1px solid var(--border-color)', borderRadius: 8,
    overflowY: 'auto', background: 'var(--card-bg)', flex: 1, minHeight: 250
  },
  bankRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', padding: '12px 16px', border: 'none', background: 'none',
    borderBottom: '1px solid var(--border-color)', cursor: 'pointer',
    textAlign: 'left', transition: 'background 0.2s', fontFamily: 'inherit'
  },
  bankLogo: {
    width: 32, height: 32, borderRadius: 6, objectFit: 'contain', background: '#fff', border: '1px solid #e2e8f0'
  },
  bankLogoPlaceholder: {
    width: 32, height: 32, borderRadius: 6, background: '#e2e8f0', color: '#64748b',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  bankName: {
    fontSize: 14, fontWeight: 600, color: 'var(--text-primary)'
  }
};
