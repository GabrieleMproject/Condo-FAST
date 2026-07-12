import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { usePlan } from '../hooks/usePlan'

export default function SuperAdminGuard() {
  const { isSuperAdmin, loading } = usePlan()

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--app-bg)', color: 'var(--text-muted)' }}>
        <p>Verifica permessi...</p>
      </div>
    )
  }

  // Se non è superadmin, rimanda alla dashboard
  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
