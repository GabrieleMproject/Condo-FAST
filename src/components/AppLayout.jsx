// src/components/AppLayout.jsx
import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { useNotifiche } from '../hooks/useNotifiche';
import { PlanBadge } from './PlanGate';
import { toast } from 'react-hot-toast';
import BrandLogo from './BrandLogo';
import NotificheDropdown from './NotificheDropdown';
import GuidaRapidaModal from './GuidaRapidaModal';
import OnboardingTourModal from './OnboardingTourModal';
import MasterclassBar from './MasterclassBar';
import SpotlightHighlight from './SpotlightHighlight';
import AiComplianceModal from './AiComplianceModal';
import GlobalDropzone from './GlobalDropzone';
import { useMasterclass } from '../hooks/useMasterclass';
import { supabase } from '../lib/supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  Receipt,
  Archive,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  Bell,
  Send,
  LifeBuoy,
  Landmark,
  ArrowLeftRight,
  Bot,
  Inbox,
  Menu,
  X,
  Clock,
  HelpCircle,
  Sparkles,
  Search,
  Trash2,
  ArrowRight,
  FileText,
  PhoneCall,
  Gift
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/dashboard',          label: 'Dashboard',            icon: LayoutDashboard },
  { path: '/condomini',          label: 'Condomini',             icon: Building2 },
  { path: '/anagrafica',         label: 'Anagrafica',            icon: Users },
  { path: '/pronto-intervento',  label: 'Pronto Intervento',     icon: PhoneCall, badge: 'H24' },
  { path: '/comunicazioni',       label: 'Comunicazioni',        icon: Send },
  { path: '/fiscale',            label: 'Certificazioni',        icon: Landmark },
  { path: '/archivio',           label: 'Storico operazioni',    icon: Archive },
  { path: '/migrazione',         label: 'Migra gestionale',      icon: ArrowLeftRight, badge: 'NEW' },
  { path: '/assistenza',         label: 'Assistenza',            icon: LifeBuoy },
  { path: '/sconti',             label: 'Sconti & Promo',        icon: Gift },
  { path: '/impostazioni',       label: 'Impostazioni',          icon: Settings },
];

const QUICK_ACTIONS = [
  { id: 'qa1', label: 'Nuovo Condominio', icon: Building2, action: (navigate) => navigate('/condomini?new=1') },
  { id: 'qa2', label: 'Registra Spesa', icon: Receipt, action: (navigate) => navigate('/spese?new=1') },
  { id: 'qa3', label: 'Carica File (AI)', icon: Sparkles, action: () => window.dispatchEvent(new CustomEvent('open-ai-dropzone')) },
  { id: 'qa4', label: 'Aggiungi Persona', icon: Users, action: (navigate) => navigate('/anagrafica?new=1') }
];



// ── Componente Barra di Ricerca Interattiva in Topbar Header ──────────────
function HeaderSearchBar({ navigate }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [results, setResults] = useState({
    condomini: [],
    persone: [],
    spese: [],
    documenti: []
  });

  const getSearchStorageKey = () => localStorage.getItem('condofast_search_history') ? 'condofast_search_history' : (localStorage.getItem('condosmart_search_history') ? 'condosmart_search_history' : 'condofast_search_history');

  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(getSearchStorageKey());
      if (saved) setHistory(JSON.parse(saved));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (inputRef.current) {
          inputRef.current.focus();
          setIsOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const salvaInCronologia = (term) => {
    const trimmed = term.trim();
    if (!trimmed || trimmed.length < 2) return;
    setHistory((prev) => {
      const filtered = prev.filter((item) => item.term.toLowerCase() !== trimmed.toLowerCase());
      const updated = [{ id: Date.now(), term: trimmed, timestamp: new Date().toISOString() }, ...filtered].slice(0, 15);
      try {
        localStorage.setItem(getSearchStorageKey(), JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  useEffect(() => {
    let active = true;
    const term = query.trim();
    if (term.length < 2) {
      setResults({ condomini: [], persone: [], spese: [], documenti: [] });
      return;
    }

    setLoading(true);
    const pattern = `%${term}%`;

    const timer = setTimeout(async () => {
      try {
        const [resC, resP, resS, resD] = await Promise.all([
          supabase.from('condomini').select('id, nome, indirizzo, comune').or(`nome.ilike.${pattern},indirizzo.ilike.${pattern},comune.ilike.${pattern}`).limit(3),
          supabase.from('persone').select('id, nome, cognome, email, telefono, occupanti_unita(unita(condominio_id, condomini(id, nome)))').or(`nome.ilike.${pattern},cognome.ilike.${pattern},email.ilike.${pattern}`).limit(3),
          supabase.from('spese').select('id, descrizione, fornitore, importo, data_spesa, condominio_id, condomini(id, nome)').or(`descrizione.ilike.${pattern},fornitore.ilike.${pattern}`).order('data_spesa', { ascending: false }).limit(3),
          supabase.from('documenti_condominio').select('id, nome, note, tipo, condominio_id, condomini(id, nome)').or(`nome.ilike.${pattern},note.ilike.${pattern}`).order('created_at', { ascending: false }).limit(3)
        ]);

        if (active) {
          setResults({
            condomini: resC.data || [],
            persone: resP.data || [],
            spese: resS.data || [],
            documenti: resD.data || []
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    salvaInCronologia(query);
    setIsOpen(false);
    navigate(`/ricerca?q=${encodeURIComponent(query.trim())}`);
  };

  const handleSelectResult = (path, termToSave) => {
    if (termToSave) salvaInCronologia(termToSave);
    setIsOpen(false);
    navigate(path);
  };

  const rimuoviDaCronologia = (id, e) => {
    e.stopPropagation();
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem('condosmart_search_history', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
  };

  const svuotaCronologia = () => {
    setHistory([]);
    try {
      localStorage.removeItem('condosmart_search_history');
    } catch (e) {
      console.error(e);
    }
  };

  const totalResults = results.condomini.length + results.persone.length + results.spese.length + results.documenti.length;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
      <form onSubmit={handleSubmit} style={{ margin: 0, padding: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color-2)',
          borderRadius: 8,
          padding: '6px 12px',
          gap: 8,
          transition: 'all 0.15s',
          borderColor: isOpen ? 'var(--accent)' : 'var(--border-color-2)',
        }}>
          <Search size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            placeholder="Cerca spesa, persona, via..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 13,
              width: '100%',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults({ condomini: [], persone: [], spese: [], documenti: [] }); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}
            >
              <X size={14} />
            </button>
          )}
          {loading && (
            <div style={{ width: 14, height: 14, border: '2px solid var(--border-color-2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          )}
          <kbd style={{
            background: 'var(--app-bg)',
            border: '1px solid var(--border-color-2)',
            borderRadius: 4,
            padding: '1px 5px',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-muted)',
            flexShrink: 0
          }}>⌘K</kbd>
        </div>
      </form>

      {/* Dropdown Results Overlay */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 6,
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color-2)',
          borderRadius: 10,
          boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
          zIndex: 1000,
          maxHeight: '420px',
          overflowY: 'auto',
          padding: '12px',
        }}>
          {query.trim().length < 2 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border-color-2)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Sparkles size={13} /> Azioni Rapide
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {QUICK_ACTIONS.map(qa => (
                  <button key={qa.id} onClick={() => { setIsOpen(false); setQuery(''); qa.action(navigate); }} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    borderRadius: 8, border: '1px solid var(--border-color-2)',
                    background: 'var(--app-bg)', color: 'var(--text-primary)',
                    cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--border-color)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--app-bg)'; e.currentTarget.style.borderColor = 'var(--border-color-2)' }}
                  >
                    <qa.icon size={14} style={{ color: 'var(--accent)' }} /> {qa.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border-color-2)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={13} /> Ricerche recenti
                </span>
                {history.length > 0 && (
                  <button onClick={svuotaCronologia} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Trash2 size={11} /> Svuota
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>
                  Nessuna ricerca recente
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {history.map((h) => (
                    <div
                      key={h.id}
                      onClick={() => { setQuery(h.term); setIsOpen(true); }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 16,
                        background: 'var(--app-bg)',
                        border: '1px solid var(--border-color-2)',
                        fontSize: 12,
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      <span>{h.term}</span>
                      <span onClick={(e) => rimuoviDaCronologia(h.id, e)} style={{ color: 'var(--text-muted)', display: 'flex', padding: 2 }} title="Elimina">
                        <X size={11} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {query.trim().length >= 2 && (
            <div>
              {totalResults === 0 && !loading && (
                <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                  Nessun risultato trovato per "{query}"
                </div>
              )}

              {/* Quick Actions (filtrate) */}
              {(() => {
                const filteredQA = QUICK_ACTIONS.filter(qa => qa.label.toLowerCase().includes(query.toLowerCase()));
                if (filteredQA.length === 0) return null;
                return (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Sparkles size={13} style={{ color: 'var(--accent)' }} /> Azioni Rapide
                    </div>
                    {filteredQA.map(qa => (
                      <div
                        key={qa.id}
                        onClick={() => { setIsOpen(false); setQuery(''); qa.action(navigate); }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--app-bg)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <qa.icon size={16} style={{ color: 'var(--text-muted)' }} />
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{qa.label}</div>
                        </div>
                        <ArrowRight size={14} style={{ color: 'var(--accent)' }} />
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Condomini */}
              {results.condomini.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Building2 size={13} style={{ color: 'var(--accent)' }} /> Condomini
                  </div>
                  {results.condomini.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectResult(`/condomini/${c.id}`, query)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--app-bg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.indirizzo}</div>
                      </div>
                      <ArrowRight size={14} style={{ color: 'var(--accent)' }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Persone */}
              {results.persone.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={13} style={{ color: 'var(--accent)' }} /> Persone
                  </div>
                  {results.persone.map((p) => {
                    const condoId = p.occupanti_unita?.[0]?.unita?.condominio_id;
                    const condoName = p.occupanti_unita?.[0]?.unita?.condomini?.nome;
                    const path = condoId ? `/condomini/${condoId}/anagrafica` : '/anagrafica';

                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectResult(path, query)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--app-bg)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.cognome} {p.nome}</div>
                          {condoName && <div style={{ fontSize: 11, color: 'var(--accent)' }}>{condoName}</div>}
                        </div>
                        <ArrowRight size={14} style={{ color: 'var(--accent)' }} />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Spese */}
              {results.spese.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Receipt size={13} style={{ color: 'var(--accent)' }} /> Spese
                  </div>
                  {results.spese.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => handleSelectResult(`/condomini/${s.condominio_id}/spese`, query)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--app-bg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.descrizione}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          € {Number(s.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })} {s.fornitore ? `• ${s.fornitore}` : ''}
                        </div>
                      </div>
                      <ArrowRight size={14} style={{ color: 'var(--accent)' }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Documenti */}
              {results.documenti.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FileText size={13} style={{ color: 'var(--accent)' }} /> Documenti
                  </div>
                  {results.documenti.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => handleSelectResult(`/condomini/${d.condominio_id}`, query)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--app-bg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{d.nome}</div>
                        {d.condomini?.nome && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.condomini.nome}</div>}
                      </div>
                      <ArrowRight size={14} style={{ color: 'var(--accent)' }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Footer Vedi Tutti */}
              <div
                onClick={handleSubmit}
                style={{
                  marginTop: 8,
                  padding: '8px',
                  borderRadius: 6,
                  background: 'rgba(37,99,235,0.1)',
                  color: 'var(--accent)',
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: 'center',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                Vedi tutti i risultati per "{query}" (Invio) <ArrowRight size={14} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Menu Mobile Drawer
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Chiudi menu al cambio pagina
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Scorciatoia da tastiera globale Cmd+K / Ctrl+K per aprire la ricerca
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        navigate('/ricerca');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
  
  // Conteggio documenti Postbox pendenti
  const [inboxCount, setInboxCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    
    const fetchInboxCount = async () => {
      try {
        const { data, error } = await supabase
          .from('inbox_documenti')
          .select('id, tipo, stato')
          .in('stato', ['nuovo', 'rilevato', 'da_smistare', 'elaborato']);
        
        if (!error && data) {
          const activeCount = data.filter(item => {
            if (item.tipo === 'subentro') return item.stato !== 'conguagliato';
            if (item.tipo === 'messaggio') return item.stato !== 'elaborato';
            return item.stato !== 'inserito';
          }).length;
          if (!mounted) return;
          setInboxCount(activeCount);
        }
      } catch (err) {
        console.error('Errore conteggio inbox:', err);
      }
    };

    fetchInboxCount();

    // Sottoscrizione realtime
    const channel = supabase
      .channel('inbox_layout_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inbox_documenti'
      }, () => {
        fetchInboxCount();
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  // ── Gestione Piano e Profilo ──────────────────────────────────────────
  const {
    piano, limiti, profile,
    isTrialActive, isTrialScaduto, trialEndsAt,
    isStripeAttivo, stripeStatus, isReadOnly,
    condominiCount, condominiInclusi, condominiExtra, costoExtraMese,
    aiCallsCount, aiCallsLimit, aiCallsRimanenti,
    updateBranding, refresh, isSuperAdmin
  } = usePlan();

  // ── Notifiche / Promemoria ────────────────────────────────────────────
  const {
    notifiche, nonLette, count: notificheCount,
    loading: notificheLoading, refresh: refreshNotifiche,
    segnaLetta, segnaAllLette,
  } = useNotifiche();
  const [dropdownNotificheOpen, setDropdownNotificheOpen] = useState(false);
  const [showGuidaModal, setShowGuidaModal] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);

  // Hook Masterclass Operativa a 10 Step
  const {
    currentStep: masterclassStep,
    completedSteps: masterclassCompleted,
    isGuidanceActive: masterclassActive,
    spotlightTarget,
    activeStepData: masterclassStepData,
    totalStepsCount: masterclassTotalSteps,
    completeStep: completeMasterclassStep,
    goToStep: goToMasterclassStep,
    toggleGuidance: toggleMasterclassGuidance,
    showSpotlight: showMasterclassSpotlight,
    hideSpotlight: hideMasterclassSpotlight
  } = useMasterclass();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Stati per il form di modifica
  const [studioNome, setStudioNome] = useState('');
  const [studioIndirizzo, setStudioIndirizzo] = useState('');
  const [studioContatti, setStudioContatti] = useState('');
  const [logoBase64, setLogoBase64] = useState('');
  const [ragioneSociale, setRagioneSociale] = useState('');
  const [partitaIva, setPartitaIva] = useState('');
  const [codiceFiscale, setCodiceFiscale] = useState('');
  const logoInputRef = useRef(null);

  const startEditing = () => {
    setStudioNome(profile?.studio_nome || '');
    setStudioIndirizzo(profile?.studio_indirizzo || '');
    setStudioContatti(profile?.studio_contatti || '');
    setLogoBase64(profile?.logo_base64 || '');
    setRagioneSociale(profile?.ragione_sociale || '');
    setPartitaIva(profile?.partita_iva || '');
    setCodiceFiscale(profile?.codice_fiscale || '');
    setIsEditing(true);
  };

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      const res = await updateBranding({
        studio_nome: studioNome,
        studio_indirizzo: studioIndirizzo,
        studio_contatti: studioContatti,
        logo_base64: logoBase64,
        ragione_sociale: ragioneSociale,
        partita_iva: partitaIva,
        codice_fiscale: codiceFiscale,
      });
      if (res.error) throw res.error;
      toast.success('Dati studio aggiornati con successo!');
      setIsEditing(false);
    } catch (err) {
      toast.error('Errore durante il salvataggio: ' + err.message);
    } finally {
      setSavingBranding(false);
    }
  };

  const onLogoSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Logo: usa PNG, JPG o WEBP.');
      return;
    }
    try {
      const dataUrl = await fileToResizedDataUrl(file, 400);
      setLogoBase64(dataUrl);
    } catch {
      toast.error('Impossibile elaborare il logo.');
    }
  };

  const handleStripePortal = async () => {
    setLoadingPortal(true);
    try {
      await apriPortaleStripe(profile?.stripe_customer_id);
    } catch (err) {
      toast.error("Errore durante l'apertura del portale Stripe: " + err.message);
    } finally {
      setLoadingPortal(false);
    }
  };

  const confirmSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSignOut = () => {
    setShowLogoutConfirm(true);
  };

  return (
    <div className={isReadOnly ? 'read-only-mode' : ''} style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--app-bg)', fontFamily: 'Sora, sans-serif' }}>
      
      {/* Sidebar Overlay Mobile */}
      {isMobileMenuOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 1000,
            backdropFilter: 'blur(2px)'
          }}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`} style={{
        width: collapsed ? 64 : 240,
        background: 'var(--app-bg)',
        borderRight: '1px solid var(--border-color-2)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? 0 : '0 20px', borderBottom: '1px solid var(--border-color-2)', overflow: 'hidden' }}>
          <BrandLogo size={32} showText={!collapsed} variant="sidebar" />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV_ITEMS.map(({ path, label, icon: Icon, badge }) => {
            const active = location.pathname.startsWith(path);
            const activeBadge = path === '/postbox' && inboxCount > 0 ? String(inboxCount) : badge;
            return (
              <Link key={path} to={path} title={collapsed ? label : undefined} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: collapsed ? '10px 16px' : '10px 12px',
                borderRadius: 8, textDecoration: 'none',
                background: active ? 'rgba(37,99,235,0.15)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 400, fontSize: 14,
                transition: 'all 0.15s', whiteSpace: 'nowrap', overflow: 'hidden',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--border-color-2)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} style={{ flexShrink: 0 }} />
                {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
                {!collapsed && activeBadge && (
                  <span style={{
                    marginLeft: 'auto', marginRight: 4, flexShrink: 0, fontSize: 9, fontWeight: 700,
                    background: path === '/postbox' && inboxCount > 0 ? 'linear-gradient(135deg,#7c3aed,#9061f9)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    color: '#fff', borderRadius: 4, padding: '2px 5px',
                    letterSpacing: '0.05em',
                  }}>{activeBadge}</span>
                )}
              </Link>
            );
          })}

          
          {isSuperAdmin && (
            <>
              <div style={{ margin: '8px 12px', borderTop: '1px solid var(--border-color-2)' }} />
              <Link to="/backoffice" title={collapsed ? 'Backoffice (Admin)' : undefined} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: collapsed ? '10px 16px' : '10px 12px',
                borderRadius: 8, textDecoration: 'none',
                background: location.pathname.startsWith('/backoffice') ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                color: location.pathname.startsWith('/backoffice') ? '#10b981' : '#10b981',
                fontWeight: location.pathname.startsWith('/backoffice') ? 600 : 400, fontSize: 14,
                transition: 'all 0.15s', whiteSpace: 'nowrap', overflow: 'hidden',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
                onMouseEnter={e => { if (!location.pathname.startsWith('/backoffice')) { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'; } }}
                onMouseLeave={e => { if (!location.pathname.startsWith('/backoffice')) { e.currentTarget.style.background = 'transparent'; } }}
              >
                <Settings size={18} strokeWidth={location.pathname.startsWith('/backoffice') ? 2.5 : 1.8} style={{ flexShrink: 0 }} />
                {!collapsed && 'Backoffice (Admin)'}
              </Link>
            </>
          )}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '8px', borderTop: '1px solid var(--border-color-2)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button title={collapsed ? 'Espandi Sidebar' : 'Riduci Sidebar'} onClick={() => setCollapsed(c => !c)} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: collapsed ? '10px 0' : '10px 12px',
            borderRadius: 8, border: collapsed ? '1px solid var(--border-color)' : 'none', 
            background: collapsed ? 'var(--card-bg)' : 'transparent',
            boxShadow: collapsed ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
            color: collapsed ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
            justifyContent: collapsed ? 'center' : 'flex-start',
            whiteSpace: 'nowrap', overflow: 'hidden', width: '100%', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--border-color-2)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = collapsed ? 'var(--text-primary)' : 'var(--text-muted)'; e.currentTarget.style.background = collapsed ? 'var(--card-bg)' : 'transparent'; }}
          >
            {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Riduci</span></>}
          </button>
          <button title={collapsed ? 'Esci' : undefined} onClick={handleSignOut} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: collapsed ? '10px 16px' : '10px 12px',
            borderRadius: 8, border: 'none', background: 'transparent',
            color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
            justifyContent: collapsed ? 'center' : 'flex-start',
            whiteSpace: 'nowrap', overflow: 'hidden', width: '100%', transition: 'color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <LogOut size={18} style={{ flexShrink: 0 }} />
            {!collapsed && 'Esci'}
          </button>
          
          {/* AI Badge nel footer */}
          <button
            title={collapsed ? 'Conformità AI Act' : undefined}
            onClick={() => setShowAiModal(true)}
            style={{
              background: 'rgba(37, 99, 235, 0.05)',
              border: '1px solid rgba(37, 99, 235, 0.2)',
              borderRadius: 8,
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 12,
              color: 'var(--accent, #2563eb)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              justifyContent: collapsed ? 'center' : 'flex-start',
              width: '100%',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37, 99, 235, 0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37, 99, 235, 0.05)' }}
            title="Conforme AI Act UE 2024/1689"
          >
            <Bot size={16} style={{ flexShrink: 0 }} />
            {!collapsed && 'AI Powered'}
          </button>
        </div>
        {showAiModal && <AiComplianceModal onClose={() => setShowAiModal(false)} />}
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{ height: 64, background: 'var(--app-bg)', borderBottom: '1px solid var(--border-color-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
          {/* breadcrumb legge la label aggiornata da NAV_ITEMS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="mobile-menu-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: -8
              }}
              aria-label="Menu Mobile"
            >
              <Menu size={22} />
            </button>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>
              {NAV_ITEMS.find(n => location.pathname.startsWith(n.path))?.label ?? 'CondoFAST'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* ── Bottone Carica File (AI) ── */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-ai-dropzone'))}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px',
                background: 'linear-gradient(135deg, #7c3aed, #9061f9)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <Sparkles size={14} /> Carica File
            </button>

            {/* ── Barra di Ricerca Interattiva Topbar ── */}
            <HeaderSearchBar navigate={navigate} />

            {/* ── Campanella Notifiche ── */}
            <div style={{ position: 'relative' }}>
              <button
                id="btn-notifiche"
                onClick={() => setDropdownNotificheOpen(o => !o)}
                style={{
                  background: dropdownNotificheOpen ? 'rgba(37,99,235,0.15)' : 'none',
                  border: 'none',
                  color: dropdownNotificheOpen ? '#60a5fa' : (notificheCount > 0 ? '#f59e0b' : 'var(--text-muted)'),
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 6,
                  borderRadius: 8,
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
                aria-label={`Promemoria${notificheCount > 0 ? ` (${notificheCount} nuovi)` : ''}`}
                onMouseEnter={e => { if (!dropdownNotificheOpen) { e.currentTarget.style.background = 'var(--border-color-2)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                onMouseLeave={e => { if (!dropdownNotificheOpen) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = notificheCount > 0 ? '#f59e0b' : 'var(--text-muted)'; } }}
              >
                <Bell size={18} />
                {notificheCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2,
                    minWidth: 16, height: 16,
                    background: '#ef4444', color: '#fff',
                    borderRadius: '50%', fontSize: 9, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid var(--app-bg)',
                    lineHeight: 1,
                    animation: 'bellPulse 2s ease-in-out infinite',
                  }}>
                    {notificheCount > 9 ? '9+' : notificheCount}
                    <style>{`
                      @keyframes bellPulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.15); }
                      }
                    `}</style>
                  </span>
                )}
              </button>

              {/* Dropdown notifiche */}
              {dropdownNotificheOpen && (
                <NotificheDropdown
                  notifiche={notifiche}
                  nonLette={nonLette}
                  loading={notificheLoading}
                  onClose={() => setDropdownNotificheOpen(false)}
                  onRefresh={refreshNotifiche}
                  onSegnaLetta={segnaLetta}
                  onSegnaAllLette={segnaAllLette}
                />
              )}
            </div>

            {/* Pulsante Guida & Onboarding */}
            <button
              onClick={() => setShowGuidaModal(true)}
              title="Centro Guida Rapida & Tutorial"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--primary-color, #3b82f6)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <HelpCircle size={18} />
            </button>
            <div
              onClick={() => setDrawerOpen(true)}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e40af, #2563eb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                overflow: 'hidden',
                border: '1px solid var(--border-color)'
              }}
            >
              {profile?.logo_base64 ? (
                <img src={profile.logo_base64} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                user?.email?.[0]?.toUpperCase() ?? 'U'
              )}
            </div>
          </div>
        </header>

        {isReadOnly && (
          <div style={{
            background: 'var(--error-bg, rgba(239, 68, 68, 0.1))',
            borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            color: '#ef4444',
            fontSize: 13,
            fontWeight: 500,
            zIndex: 10
          }}>
            <span>⚠️ <strong>Account in Sola Lettura</strong> — Il tuo abbonamento è scaduto o il pagamento è fallito. Puoi consultare ed esportare i tuoi dati, ma non puoi apportare modifiche.</span>
            <Link to="/impostazioni" className="btn btn--primary btn--sm read-only-allow" style={{ padding: '4px 12px', fontSize: 12 }}>Rinnova ora</Link>
          </div>
        )}



        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {/* Barra Masterclass Operativa a 10 Step */}
          {(piano === 'trial' || isTrialActive) && (
            <MasterclassBar
              currentStep={masterclassStep}
              completedSteps={masterclassCompleted}
              activeStepData={masterclassStepData}
              totalStepsCount={masterclassTotalSteps}
              onCompleteStep={completeMasterclassStep}
              onGoToStep={goToMasterclassStep}
              onToggleGuidance={toggleMasterclassGuidance}
              onShowSpotlight={showMasterclassSpotlight}
              isGuidanceActive={masterclassActive}
            />
          )}

          <Outlet />
        </main>
      </div>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <div
          onClick={() => {
            if (!savingBranding) {
              setDrawerOpen(false);
              setIsEditing(false);
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--backdrop)',
            backdropFilter: 'blur(4px)',
            zIndex: 999,
            transition: 'opacity 0.3s ease',
          }}
        />
      )}

      {/* Drawer Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: drawerOpen ? 0 : -420,
        width: 400,
        height: '100vh',
        background: 'var(--card-bg)',
        borderLeft: '1px solid var(--border-color)',
        boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.4)',
        zIndex: 1000,
        transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        color: 'var(--text-primary)',
      }}>
        {/* Drawer Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Profilo Amministratore</h3>
          <button
            onClick={() => {
              setDrawerOpen(false);
              setIsEditing(false);
            }}
            disabled={savingBranding}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 20,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {/* User Info Header Card */}
          <div style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            background: 'var(--app-bg)',
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--border-color)',
            marginBottom: 24,
          }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1e40af, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 20,
              fontWeight: 700,
              overflow: 'hidden',
              flexShrink: 0,
            }}>
              {profile?.logo_base64 ? (
                <img src={profile.logo_base64} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                user?.email?.[0]?.toUpperCase() ?? 'U'
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {profile?.ragione_sociale || profile?.studio_nome || 'Amministrazione'}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {user?.email}
              </span>
              <div style={{ marginTop: 2 }}>
                <PlanBadge piano={piano} />
              </div>
            </div>
          </div>

          {isEditing ? (
            /* Editing Branding Form */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Modifica Dati Studio
              </h4>

              {/* Logo Preview and selector */}
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>Logo Studio</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{
                    width: 70,
                    height: 70,
                    borderRadius: 8,
                    background: 'var(--app-bg)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {logoBase64 ? (
                      <img src={logoBase64} alt="Preview Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>No Logo</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      style={{
                        background: 'var(--border-color)',
                        color: 'var(--text-primary)',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontFamily: 'Sora, sans-serif'
                      }}
                      onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                      onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                    >
                      {logoBase64 ? 'Cambia' : 'Carica'}
                    </button>
                    {logoBase64 && (
                      <button
                        onClick={() => setLogoBase64('')}
                        style={{
                          background: 'transparent',
                          color: '#ef4444',
                          border: 'none',
                          fontSize: 12,
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'Sora, sans-serif'
                        }}
                      >
                        Rimuovi
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  style={{ display: 'none' }}
                  onChange={onLogoSelected}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>Nome Studio / Amministratore</label>
                <input
                  type="text"
                  value={studioNome}
                  onChange={e => setStudioNome(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontFamily: 'Sora, sans-serif',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Es. Studio Amministrazione Rossi"
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>Ragione Sociale Azienda</label>
                <input
                  type="text"
                  value={ragioneSociale}
                  onChange={e => setRagioneSociale(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontFamily: 'Sora, sans-serif',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Es. Studio Rossi S.r.l."
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>Partita IVA</label>
                  <input
                    type="text"
                    value={partitaIva}
                    onChange={e => setPartitaIva(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 13,
                      fontFamily: 'Sora, sans-serif',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Es. 12345678901"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>Codice Fiscale</label>
                  <input
                    type="text"
                    value={codiceFiscale}
                    onChange={e => setCodiceFiscale(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 13,
                      fontFamily: 'Sora, sans-serif',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Es. RSSMRA80A01H501Z"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>Indirizzo</label>
                <input
                  type="text"
                  value={studioIndirizzo}
                  onChange={e => setStudioIndirizzo(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontFamily: 'Sora, sans-serif',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Es. Via Roma 10, 20100 Milano (MI)"
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>Contatti</label>
                <textarea
                  value={studioContatti}
                  onChange={e => setStudioContatti(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 13,
                    minHeight: 80,
                    resize: 'vertical',
                    fontFamily: 'Sora, sans-serif',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Es. Tel: 02 12345678 - info@studiorossi.it - PEC: studiorossi@pec.it"
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  onClick={handleSaveBranding}
                  disabled={savingBranding}
                  style={{
                    flex: 1,
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'Sora, sans-serif'
                  }}
                >
                  {savingBranding ? 'Salvataggio...' : 'Salva'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={savingBranding}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    borderRadius: 8,
                    padding: '10px 16px',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: 'Sora, sans-serif'
                  }}
                >
                  Annulla
                </button>
              </div>
            </div>
          ) : (
            /* Display Info */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Branding Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Dati Studio / Branding
                  </h4>
                  <button
                    onClick={startEditing}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#3b82f6',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontFamily: 'Sora, sans-serif',
                      padding: 0
                    }}
                    onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                  >
                    Modifica
                  </button>
                </div>

                <div style={{ background: 'var(--app-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {profile?.logo_base64 && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color-2)' }}>
                      <img src={profile.logo_base64} alt="Studio Logo" style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }} />
                    </div>
                  )}
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block' }}>Nome Studio / Amministratore</span>
                    <span style={{ color: 'var(--text-dark)', fontSize: 13, fontWeight: 500 }}>{profile?.studio_nome || '—'}</span>
                  </div>
                  {profile?.ragione_sociale && (
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block' }}>Ragione Sociale Azienda</span>
                      <span style={{ color: 'var(--text-dark)', fontSize: 13, fontWeight: 500 }}>{profile.ragione_sociale}</span>
                    </div>
                  )}
                  {(profile?.partita_iva || profile?.codice_fiscale) && (
                    <div style={{ display: 'flex', gap: 16 }}>
                      {profile?.partita_iva && (
                        <div style={{ flex: 1 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block' }}>Partita IVA</span>
                          <span style={{ color: 'var(--text-dark)', fontSize: 13 }}>{profile.partita_iva}</span>
                        </div>
                      )}
                      {profile?.codice_fiscale && (
                        <div style={{ flex: 1 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block' }}>Codice Fiscale</span>
                          <span style={{ color: 'var(--text-dark)', fontSize: 13 }}>{profile.codice_fiscale}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block' }}>Indirizzo</span>
                    <span style={{ color: 'var(--text-dark)', fontSize: 13 }}>{profile?.studio_indirizzo || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block' }}>Contatti</span>
                    <span style={{ color: 'var(--text-dark)', fontSize: 13, whiteSpace: 'pre-wrap' }}>{profile?.studio_contatti || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Usage & Limits Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Consumi e Limiti
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Condomini */}
                  <div style={{ background: 'var(--app-bg)', padding: 14, borderRadius: 10, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, display: 'block' }}>Condomini</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Attivi nel gestionale</span>
                    </div>
                    <span style={{ color: 'var(--text-dark)', fontSize: 15, fontWeight: 700 }}>
                      {condominiCount} <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 400 }}>/ {condominiInclusi ?? '∞'}</span>
                    </span>
                  </div>

                  {/* AI Calls */}
                  <div style={{ background: 'var(--app-bg)', padding: 14, borderRadius: 10, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, display: 'block' }}>Chiamate AI</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Mese corrente</span>
                      </div>
                      <span style={{ color: 'var(--text-dark)', fontSize: 15, fontWeight: 700 }}>
                        {aiCallsCount} <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 400 }}>/ {aiCallsLimit ?? '∞'}</span>
                      </span>
                    </div>
                    {aiCallsLimit !== null && (
                      <div style={{ height: 6, background: 'var(--border-color-2)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, (aiCallsCount / aiCallsLimit) * 100)}%`,
                          height: '100%',
                          background: aiCallsCount / aiCallsLimit > 0.8 ? '#ef4444' : '#2563eb',
                          borderRadius: 3
                        }} />
                      </div>
                    )}
                  </div>

                  {/* Trial expiration info if trial */}
                  {isTrialActive && trialEndsAt && (
                    <div style={{ background: 'rgba(37, 99, 235, 0.1)', border: '1px solid #2563eb', padding: 12, borderRadius: 8, color: '#60a5fa', fontSize: 12, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Clock size={14} /> <span>Mancano <strong>{Math.max(0, Math.ceil((new Date(trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24)))} giorni</strong> alla scadenza del trial.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Account details & Stripe */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Dettagli Account
                </h4>
                <div style={{ background: 'var(--app-bg)', padding: 14, borderRadius: 10, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>ID Account</span>
                    <span style={{ color: 'var(--text-dark)', fontFamily: 'monospace' }}>{user?.id?.slice(0, 8)}...</span>
                  </div>
                  {profile?.dpa_accepted_at && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>DPA Accettato il</span>
                      <span style={{ color: 'var(--text-dark)' }}>{new Date(profile.dpa_accepted_at).toLocaleDateString('it-IT')}</span>
                    </div>
                  )}
                </div>

                {isStripeAttivo && profile?.stripe_customer_id && (
                  <button
                    onClick={handleStripePortal}
                    disabled={loadingPortal}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontFamily: 'Sora, sans-serif',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-muted)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)' }}
                  >
                    {loadingPortal ? 'Apertura in corso...' : (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Settings size={16} /> Gestisci abbonamento e fatture
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          {isSuperAdmin && (
            <button
              onClick={() => {
                setDrawerOpen(false)
                navigate('/backoffice')
              }}
              style={{
                width: '100%',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontFamily: 'Sora, sans-serif'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#059669'}
              onMouseLeave={e => e.currentTarget.style.background = '#10b981'}
            >
              <Settings size={16} />
              Backoffice (Admin)
            </button>
          )}

          <button
            onClick={handleSignOut}
            disabled={savingBranding}
            style={{
              width: '100%',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontFamily: 'Sora, sans-serif'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
            onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
          >
            <LogOut size={16} />
            Esci dall'Account
          </button>
        </div>
      </div>

      {/* Modali Guida Rapida e Tour Guidato Onboarding */}
      <GuidaRapidaModal 
        isOpen={showGuidaModal} 
        onClose={() => setShowGuidaModal(false)} 
      />

      <OnboardingTourModal 
        isOpen={showTourModal} 
        onClose={() => setShowTourModal(false)} 
      />

      {/* Spotlight per il Tutorial Guidato */}
      {spotlightTarget && (
        <SpotlightHighlight
          targetId={spotlightTarget}
          title={masterclassStepData.title}
          desc={masterclassStepData.desc}
          onClose={hideMasterclassSpotlight}
        />
      )}

      <GlobalDropzone />

      {/* Modale Conferma Logout */}
      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 400, textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#ef4444' }}>
              <LogOut size={28} />
            </div>
            <h2 style={{ fontSize: 20, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>Uscita dall'account</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 24px 0', lineHeight: 1.5 }}>
              Sei sicuro di voler uscire da CondoSmart?
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => setShowLogoutConfirm(false)} 
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500, fontFamily: 'Sora, sans-serif' }}
              >
                Annulla
              </button>
              <button 
                onClick={confirmSignOut} 
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'Sora, sans-serif' }}
              >
                Sì, Esci
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
