import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Building2, LogOut, LayoutDashboard, Users, FileText, Wrench, Settings, Bell } from 'lucide-react'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    toast.success('Disconnesso')
    navigate('/login')
  }

  const userName = user?.user_metadata?.full_name || user?.email || 'Amministratore'

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Building2 size={24} />
          <span>CondoAI</span>
        </div>

        <nav className="sidebar-nav">
          {[
            { icon: LayoutDashboard, label: 'Dashboard', active: true },
            { icon: Building2, label: 'Condomini' },
            { icon: Users, label: 'Condòmini' },
            { icon: FileText, label: 'Contabilità' },
            { icon: Wrench, label: 'Fornitori' },
            { icon: Bell, label: 'Comunicazioni' },
            { icon: Settings, label: 'Impostazioni' },
          ].map(({ icon: Icon, label, active }) => (
            <button key={label} className={`nav-item ${active ? 'nav-item--active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <button className="sidebar-logout" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Esci</span>
        </button>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <header className="topbar">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Benvenuto, {userName}</p>
          </div>
        </header>

        <div className="dashboard-grid">
          {/* Stats placeholder */}
          {[
            { label: 'Condomini gestiti', value: '—', color: '#3b82f6' },
            { label: 'Condòmini totali', value: '—', color: '#10b981' },
            { label: 'Pratiche aperte', value: '—', color: '#f59e0b' },
            { label: 'Scadenze questo mese', value: '—', color: '#ef4444' },
          ].map(({ label, value, color }) => (
            <div key={label} className="stat-card">
              <div className="stat-accent" style={{ background: color }} />
              <p className="stat-label">{label}</p>
              <p className="stat-value">{value}</p>
            </div>
          ))}
        </div>

        <div className="coming-soon">
          <Building2 size={48} opacity={0.2} />
          <h3>Sessione 1 completata ✓</h3>
          <p>Auth funzionante. Nelle prossime sessioni costruiremo tutte le funzionalità.</p>
        </div>
      </main>
    </div>
  )
}
