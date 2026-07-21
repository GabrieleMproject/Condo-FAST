import React from 'react'
import { LogOut } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function WaitlistPage() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      padding: '24px',
      fontFamily: 'Sora, sans-serif'
    }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '40px',
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{
          width: '64px',
          height: '64px',
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px'
        }}>
          <span style={{ fontSize: '32px' }}>🚧</span>
        </div>
        
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px' }}>
          Accesso in Closed Beta
        </h1>
        
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '32px' }}>
          Attualmente CondoSmart è in fase di testing limitata ai Beta Tester. 
          Il tuo account è stato registrato ed inserito nella lista d'attesa. 
          Ti contatteremo non appena l'accesso sarà abilitato per il tuo profilo!
        </p>

        <button 
          onClick={handleLogout}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            padding: '12px 24px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
        >
          <LogOut size={16} />
          Disconnettiti
        </button>
      </motion.div>
    </div>
  )
}
