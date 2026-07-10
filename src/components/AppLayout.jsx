// src/components/AppLayout.jsx
import { useState, useRef } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { useNotifiche } from '../hooks/useNotifiche';
import { PlanBadge } from './PlanGate';
import { toast } from 'react-hot-toast';
import BrandLogo from './BrandLogo';
import NotificheDropdown from './NotificheDropdown';
import { supabase } from '../lib/supabaseClient';
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
  Bot
} from 'lucide-react';


// ── Logo → data-URL PNG ridimensionato (max 400px) ────────────────────────
function fileToResizedDataUrl(file, maxW = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Stripe Customer Portal ────────────────────────────────────────────────
async function apriPortaleStripe(customerId) {
  const { data, error } = await supabase.functions.invoke('stripe-portal', {
    body: { customerId, returnUrl: window.location.href },
  })
  if (error) throw new Error(error.message || 'Errore apertura portale')
  if (data?.url) window.location.href = data.url
  else throw new Error(data?.error || 'Errore apertura portale')
}

const NAV_ITEMS = [
  { path: '/dashboard',    label: 'Dashboard',            icon: LayoutDashboard },
  { path: '/condomini',    label: 'Condomini',             icon: Building2 },
  { path: '/anagrafica',   label: 'Anagrafica',            icon: Users },
  { path: '/spese',        label: 'Spese',                 icon: Receipt },
  { path: '/comunicazioni', label: 'Comunicazioni',        icon: Send },
  { path: '/fiscale',      label: 'Certificazioni',        icon: Landmark },
  { path: '/archivio',     label: 'Storico operazioni',    icon: Archive }, // ✅ rinominato
  { path: '/migrazione',   label: 'Migra gestionale',      icon: ArrowLeftRight, badge: 'NEW' },
  { path: '/assistenza',   label: 'Assistenza',            icon: LifeBuoy },
  { path: '/impostazioni', label: 'Impostazioni',          icon: Settings },
];


// ── Banner AI Act ────────────────────────────────────────────────────────────
function AiBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 20px',
      background: '#0c2340',
      borderBottom: '1px solid #1d4ed8',
      color: '#93c5fd',
      fontSize: 12,
      lineHeight: 1.5,
      flexShrink: 0,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Bot size={16} style={{ flexShrink: 0 }} /> <span><strong>CondoSmart utilizza intelligenza artificiale</strong> (Anthropic Claude) per alcune funzioni. I suggerimenti AI sono indicativi e vanno sempre verificati dall'amministratore. Conforme AI Act UE 2024/1689.</span>
      </span>
      <button
        onClick={() => setDismissed(true)}
        style={{ marginLeft: 16, background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0, padding: '0 4px' }}
        aria-label="Chiudi banner"
      >✕</button>
    </div>
  );
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // ── Gestione Piano e Profilo ──────────────────────────────────────────
  const {
    piano, limiti, profile,
    isTrialActive, isTrialScaduto, trialEndsAt,
    isStripeAttivo, stripeStatus,
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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);

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

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: 'Sora, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 64 : 240,
        background: '#0f172a',
        borderRight: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ height: 64, display: 'flex', alignItems: 'center', padding: collapsed ? '0 16px' : '0 20px', borderBottom: '1px solid #1e293b', gap: 10, overflow: 'hidden' }}>
          <BrandLogo size={32} showText={!collapsed} variant="sidebar" />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(({ path, label, icon: Icon, badge }) => {
            const active = location.pathname.startsWith(path);
            return (
              <Link key={path} to={path} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: collapsed ? '10px 16px' : '10px 12px',
                borderRadius: 8, textDecoration: 'none',
                background: active ? 'rgba(37,99,235,0.15)' : 'transparent',
                color: active ? '#60a5fa' : '#94a3b8',
                fontWeight: active ? 600 : 400, fontSize: 14,
                transition: 'all 0.15s', whiteSpace: 'nowrap', overflow: 'hidden',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#cbd5e1'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; } }}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} style={{ flexShrink: 0 }} />
                {!collapsed && label}
                {!collapsed && badge && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    color: '#fff', borderRadius: 4, padding: '2px 5px',
                    letterSpacing: '0.05em',
                  }}>{badge}</span>
                )}
              </Link>
            );
          })}

          
          {isSuperAdmin && (
            <>
              <div style={{ margin: '8px 12px', borderTop: '1px solid #1e293b' }} />
              <Link to="/backoffice" style={{
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
        <div style={{ padding: '8px', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button onClick={() => setCollapsed(c => !c)} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: collapsed ? '10px 16px' : '10px 12px',
            borderRadius: 8, border: 'none', background: 'transparent',
            color: '#475569', cursor: 'pointer', fontSize: 14,
            justifyContent: collapsed ? 'center' : 'flex-start',
            whiteSpace: 'nowrap', overflow: 'hidden', width: '100%', transition: 'color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}
          >
            {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Riduci</span></>}
          </button>
          <button onClick={handleSignOut} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: collapsed ? '10px 16px' : '10px 12px',
            borderRadius: 8, border: 'none', background: 'transparent',
            color: '#475569', cursor: 'pointer', fontSize: 14,
            justifyContent: collapsed ? 'center' : 'flex-start',
            whiteSpace: 'nowrap', overflow: 'hidden', width: '100%', transition: 'color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}
          >
            <LogOut size={18} style={{ flexShrink: 0 }} />
            {!collapsed && 'Esci'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{ height: 64, background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
          {/* ✅ breadcrumb legge la label aggiornata da NAV_ITEMS */}
          <div style={{ color: '#94a3b8', fontSize: 13 }}>
            {NAV_ITEMS.find(n => location.pathname.startsWith(n.path))?.label ?? 'CondoSmart'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* ── Campanella Notifiche ── */}
            <div style={{ position: 'relative' }}>
              <button
                id="btn-notifiche"
                onClick={() => setDropdownNotificheOpen(o => !o)}
                style={{
                  background: dropdownNotificheOpen ? 'rgba(37,99,235,0.15)' : 'none',
                  border: 'none',
                  color: dropdownNotificheOpen ? '#60a5fa' : (notificheCount > 0 ? '#f59e0b' : '#475569'),
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 6,
                  borderRadius: 8,
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
                aria-label={`Promemoria${notificheCount > 0 ? ` (${notificheCount} nuovi)` : ''}`}
                onMouseEnter={e => { if (!dropdownNotificheOpen) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; } }}
                onMouseLeave={e => { if (!dropdownNotificheOpen) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = notificheCount > 0 ? '#f59e0b' : '#475569'; } }}
              >
                <Bell size={18} />
                {notificheCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2,
                    minWidth: 16, height: 16,
                    background: '#ef4444', color: '#fff',
                    borderRadius: '50%', fontSize: 9, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid #0f172a',
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
                border: '1px solid #334155'
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

        <AiBanner />

        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
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
            background: 'rgba(15, 23, 42, 0.65)',
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
        background: '#1e293b',
        borderLeft: '1px solid #334155',
        boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.4)',
        zIndex: 1000,
        transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        color: '#f1f5f9',
      }}>
        {/* Drawer Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>Profilo Amministratore</h3>
          <button
            onClick={() => {
              setDrawerOpen(false);
              setIsEditing(false);
            }}
            disabled={savingBranding}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: 20,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
          >
            ✕
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {/* User Info Header Card */}
          <div style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            background: '#0f172a',
            padding: 16,
            borderRadius: 12,
            border: '1px solid #334155',
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
              <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 15, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {profile?.ragione_sociale || profile?.studio_nome || 'Amministrazione'}
              </span>
              <span style={{ color: '#64748b', fontSize: 12, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
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
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Logo Studio</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{
                    width: 70,
                    height: 70,
                    borderRadius: 8,
                    background: '#0f172a',
                    border: '1px solid #334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {logoBase64 ? (
                      <img src={logoBase64} alt="Preview Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ color: '#475569', fontSize: 10 }}>No Logo</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      style={{
                        background: '#334155',
                        color: '#f1f5f9',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontFamily: 'Sora, sans-serif'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#475569'}
                      onMouseLeave={e => e.currentTarget.style.background = '#334155'}
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
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Nome Studio / Amministratore</label>
                <input
                  type="text"
                  value={studioNome}
                  onChange={e => setStudioNome(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#f1f5f9',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontFamily: 'Sora, sans-serif',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Nome dello studio"
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Ragione Sociale Azienda</label>
                <input
                  type="text"
                  value={ragioneSociale}
                  onChange={e => setRagioneSociale(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#f1f5f9',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontFamily: 'Sora, sans-serif',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Ragione Sociale dell'azienda di gestione"
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Partita IVA</label>
                  <input
                    type="text"
                    value={partitaIva}
                    onChange={e => setPartitaIva(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#0f172a',
                      color: '#f1f5f9',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 13,
                      fontFamily: 'Sora, sans-serif',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Numero P.IVA"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Codice Fiscale</label>
                  <input
                    type="text"
                    value={codiceFiscale}
                    onChange={e => setCodiceFiscale(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#0f172a',
                      color: '#f1f5f9',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 13,
                      fontFamily: 'Sora, sans-serif',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Codice Fiscale"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Indirizzo</label>
                <input
                  type="text"
                  value={studioIndirizzo}
                  onChange={e => setStudioIndirizzo(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#f1f5f9',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontFamily: 'Sora, sans-serif',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Via, civico, CAP, città"
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Contatti</label>
                <textarea
                  value={studioContatti}
                  onChange={e => setStudioContatti(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#f1f5f9',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 13,
                    minHeight: 80,
                    resize: 'vertical',
                    fontFamily: 'Sora, sans-serif',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Telefono, email, PEC, P.IVA"
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
                    border: '1px solid #334155',
                    color: '#94a3b8',
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
                  <h4 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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

                <div style={{ background: '#0f172a', padding: 16, borderRadius: 12, border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {profile?.logo_base64 && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', borderBottom: '1px solid #1e293b' }}>
                      <img src={profile.logo_base64} alt="Studio Logo" style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }} />
                    </div>
                  )}
                  <div>
                    <span style={{ color: '#64748b', fontSize: 11, display: 'block' }}>Nome Studio / Amministratore</span>
                    <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 500 }}>{profile?.studio_nome || '—'}</span>
                  </div>
                  {profile?.ragione_sociale && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: 11, display: 'block' }}>Ragione Sociale Azienda</span>
                      <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 500 }}>{profile.ragione_sociale}</span>
                    </div>
                  )}
                  {(profile?.partita_iva || profile?.codice_fiscale) && (
                    <div style={{ display: 'flex', gap: 16 }}>
                      {profile?.partita_iva && (
                        <div style={{ flex: 1 }}>
                          <span style={{ color: '#64748b', fontSize: 11, display: 'block' }}>Partita IVA</span>
                          <span style={{ color: '#cbd5e1', fontSize: 13 }}>{profile.partita_iva}</span>
                        </div>
                      )}
                      {profile?.codice_fiscale && (
                        <div style={{ flex: 1 }}>
                          <span style={{ color: '#64748b', fontSize: 11, display: 'block' }}>Codice Fiscale</span>
                          <span style={{ color: '#cbd5e1', fontSize: 13 }}>{profile.codice_fiscale}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <span style={{ color: '#64748b', fontSize: 11, display: 'block' }}>Indirizzo</span>
                    <span style={{ color: '#cbd5e1', fontSize: 13 }}>{profile?.studio_indirizzo || '—'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: 11, display: 'block' }}>Contatti</span>
                    <span style={{ color: '#cbd5e1', fontSize: 13, whiteSpace: 'pre-wrap' }}>{profile?.studio_contatti || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Usage & Limits Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Consumi e Limiti
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Condomini */}
                  <div style={{ background: '#0f172a', padding: 14, borderRadius: 10, border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500, display: 'block' }}>Condomini</span>
                      <span style={{ color: '#64748b', fontSize: 11 }}>Attivi nel gestionale</span>
                    </div>
                    <span style={{ color: '#cbd5e1', fontSize: 15, fontWeight: 700 }}>
                      {condominiCount} <span style={{ color: '#475569', fontSize: 12, fontWeight: 400 }}>/ {condominiInclusi ?? '∞'}</span>
                    </span>
                  </div>

                  {/* AI Calls */}
                  <div style={{ background: '#0f172a', padding: 14, borderRadius: 10, border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500, display: 'block' }}>Chiamate AI</span>
                        <span style={{ color: '#64748b', fontSize: 11 }}>Mese corrente</span>
                      </div>
                      <span style={{ color: '#cbd5e1', fontSize: 15, fontWeight: 700 }}>
                        {aiCallsCount} <span style={{ color: '#475569', fontSize: 12, fontWeight: 400 }}>/ {aiCallsLimit ?? '∞'}</span>
                      </span>
                    </div>
                    {aiCallsLimit !== null && (
                      <div style={{ height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
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
                    <div style={{ background: 'rgba(37, 99, 235, 0.1)', border: '1px solid #2563eb', padding: 12, borderRadius: 8, color: '#60a5fa', fontSize: 12, textAlign: 'center' }}>
                      ⏳ Mancano <strong>{Math.max(0, Math.ceil((new Date(trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24)))} giorni</strong> alla scadenza del trial.
                    </div>
                  )}
                </div>
              </div>

              {/* Account details & Stripe */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Dettagli Account
                </h4>
                <div style={{ background: '#0f172a', padding: 14, borderRadius: 10, border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#64748b' }}>ID Account</span>
                    <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{user?.id?.slice(0, 8)}...</span>
                  </div>
                  {profile?.dpa_accepted_at && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#64748b' }}>DPA Accettato il</span>
                      <span style={{ color: '#cbd5e1' }}>{new Date(profile.dpa_accepted_at).toLocaleDateString('it-IT')}</span>
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
                      border: '1px solid #334155',
                      color: '#94a3b8',
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontFamily: 'Sora, sans-serif',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#f1f5f9'; e.currentTarget.style.borderColor = '#475569' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#334155' }}
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
          borderTop: '1px solid #334155',
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
    </div>
  );
}
