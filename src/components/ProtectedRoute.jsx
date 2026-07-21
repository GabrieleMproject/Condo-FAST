import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../hooks/usePlan'

export default function ProtectedRoute() {
  const { user, loading: authLoading } = useAuth()
  const { isBetaTester, isSuperAdmin, loading: planLoading } = usePlan()

  if (authLoading || (user && planLoading)) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0f1117',
        color: 'var(--text-secondary)',
        fontFamily: 'Sora, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32,
            border: '2px solid #1e293b',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }} />
          <p>Caricamento…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Blocco beta tester (solo se non sei superadmin e non sei beta tester)
  if (!isBetaTester && !isSuperAdmin) {
    return <Navigate to="/waitlist" replace />
  }

  return <Outlet />
}
