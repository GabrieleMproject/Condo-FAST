import React, { useEffect, useState } from 'react'
import { LogOut, RefreshCw, Construction } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../hooks/usePlan'

export default function WaitlistPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isBetaTester, isSuperAdmin, refresh, loading: planLoading } = usePlan()
  const [checking, setChecking] = useState(false)

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.error('Errore durante il logout:', e)
    } finally {
      navigate('/login')
    }
  }

  const handleCheckStatus = async () => {
    setChecking(true)
    try {
      await refresh()
    } catch (e) {
      console.error(e)
    } finally {
      // Diamo un feedback visivo minimo
      setTimeout(() => setChecking(false), 800)
    }
  }

  // Reindirizzamento automatico se abilitato come beta tester o superadmin
  useEffect(() => {
    if (isBetaTester || isSuperAdmin) {
      navigate('/dashboard', { replace: true })
    }
  }, [isBetaTester, isSuperAdmin, navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      color: 'var(--text)',
      padding: '24px',
      fontFamily: 'Sora, sans-serif'
    }}>
      <div 
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '40px',
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          boxShadow: 'var(--shadow)'
        }}
      >
        <div style={{
          width: '64px',
          height: '64px',
          background: 'var(--accent-glow)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px'
        }}>
          <Construction size={32} color="var(--primary)" />
        </div>
        
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px' }}>
          Accesso in Closed Beta
        </h1>
        
        <p style={{ color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '32px' }}>
          Attualmente CondoSmart è in fase di testing
          limitata ai Beta Tester. Il tuo account è stato
          registrato ed inserito nella lista d'attesa. Ti
          contatteremo non appena l'accesso sarà abilitato
          per il tuo profilo!
        </p>

        {/* --- BLOCCO DEBUG (Solo in ambiente di sviluppo - GDPR Compliance) --- */}
        {import.meta.env.DEV && (
          <div style={{ marginBottom: 32, padding: 15, background: 'var(--bg-3)', borderRadius: 8, fontSize: 12, textAlign: 'left', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            <strong style={{ display: 'block', marginBottom: 8, color: 'var(--text)' }}>Diagnostic Info (DEV Only):</strong>
            <div>User ID: {user?.id || 'N/A'}</div>
            <div>Email: {user?.email || 'N/A'}</div>
            <div>isBetaTester: {String(isBetaTester)}</div>
            <div>isSuperAdmin: {String(isSuperAdmin)}</div>
          </div>
        )}
        {/* -------------------- */}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button 
            onClick={handleCheckStatus}
            disabled={checking || planLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              cursor: (checking || planLoading) ? 'wait' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              transition: 'all 0.2s',
              opacity: (checking || planLoading) ? 0.7 : 1
            }}
            onMouseOver={(e) => { if (!checking && !planLoading) e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseOut={(e) => { if (!checking && !planLoading) e.currentTarget.style.background = 'var(--accent)' }}
          >
            <RefreshCw size={16} style={{ animation: (checking || planLoading) ? 'spin 1s linear infinite' : 'none' }} />
            Verifica Abilitazione
          </button>

          <button 
            onClick={handleLogout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-3)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              padding: '12px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'var(--border)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-3)'}
          >
            <LogOut size={16} />
            Disconnettiti
          </button>
        </div>
      </div>
    </div>
  )
}


