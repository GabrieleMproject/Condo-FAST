// src/components/AppLayout.jsx
import { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { path: '/condomini',    label: 'Condomini',     icon: Building2 },
  { path: '/anagrafica',   label: 'Anagrafica',    icon: Users },
  { path: '/spese',        label: 'Spese',         icon: Receipt },
  { path: '/archivio',     label: 'Archivio',      icon: Archive },
  { path: '/impostazioni', label: 'Impostazioni',  icon: Settings },  // ← AGGIUNTO
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
      <span>
        🤖 <strong>CondoAI utilizza intelligenza artificiale</strong> (Anthropic Claude) per
        alcune funzioni. I suggerimenti AI sono indicativi e vanno sempre verificati
        dall'amministratore. Conforme AI Act UE 2024/1689.
      </span>
      <button
        onClick={() => setDismissed(true)}
        style={{
          marginLeft: 16,
          background: 'none',
          border: 'none',
          color: '#60a5fa',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          flexShrink: 0,
          padding: '0 4px',
        }}
        aria-label="Chiudi banner"
      >
        ✕
      </button>
    </div>
  );
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          borderBottom: '1px solid #1e293b',
          gap: 10,
          overflow: 'hidden',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Building2 size={18} color="#fff" />
          </div>
          {!collapsed && (
            <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 18, whiteSpace: 'nowrap' }}>
              CondoAI
            </span>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: collapsed ? '10px 16px' : '10px 12px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  background: active ? 'rgba(37,99,235,0.15)' : 'transparent',
                  color: active ? '#60a5fa' : '#94a3b8',
                  fontWeight: active ? 600 : 400,
                  fontSize: 14,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
                onMouseEnter={e => {
                  if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  if (!active) e.currentTarget.style.color = '#cbd5e1';
                }}
                onMouseLeave={e => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                  if (!active) e.currentTarget.style.color = '#94a3b8';
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} style={{ flexShrink: 0 }} />
                {!collapsed && label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: collapse + signout */}
        <div style={{ padding: '8px', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: collapsed ? '10px 16px' : '10px 12px',
              borderRadius: 8, border: 'none', background: 'transparent',
              color: '#475569', cursor: 'pointer', fontSize: 14,
              justifyContent: collapsed ? 'center' : 'flex-start',
              whiteSpace: 'nowrap', overflow: 'hidden',
              width: '100%',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}
          >
            {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Riduci</span></>}
          </button>

          <button
            onClick={handleSignOut}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: collapsed ? '10px 16px' : '10px 12px',
              borderRadius: 8, border: 'none', background: 'transparent',
              color: '#475569', cursor: 'pointer', fontSize: 14,
              justifyContent: collapsed ? 'center' : 'flex-start',
              whiteSpace: 'nowrap', overflow: 'hidden',
              width: '100%',
              transition: 'color 0.15s',
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
        <header style={{
          height: 64,
          background: '#0f172a',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          flexShrink: 0,
        }}>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>
            {NAV_ITEMS.find(n => location.pathname.startsWith(n.path))?.label ?? 'CondoAI'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', display: 'flex' }}>
              <Bell size={18} />
            </button>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1e40af, #2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 13, fontWeight: 600,
            }}>
              {user?.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
          </div>
        </header>

        {/* ── Banner AI Act ── */}
        <AiBanner />

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}