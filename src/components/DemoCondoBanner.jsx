import React, { useState } from 'react'
import { Sparkles, Trash2, Plus, AlertCircle } from 'lucide-react'
import { eliminaCondominioDemo } from '../lib/demoSeed'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function DemoCondoBanner({ condominio, onDeleteSuccess }) {
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()

  if (!condominio?.is_demo) return null

  const handleEliminaDemo = async () => {
    if (!window.confirm('Sei sicuro di voler rimuovere il Condominio Demo di prova?')) return
    setDeleting(true)
    try {
      await eliminaCondominioDemo(supabase, condominio.id)
      if (onDeleteSuccess) onDeleteSuccess()
      navigate('/dashboard')
    } catch (err) {
      alert('Errore durante la rimozione del demo: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={styles.bannerContainer}>
      <div style={styles.leftCol}>
        <div style={styles.badge}>
          <Sparkles size={16} style={{ marginRight: 6 }} />
          <span>AMBIENTE DI PROVA DEMO</span>
        </div>
        <h4 style={styles.title}>Stai esplorando il Condominio Demo ({condominio.nome})</h4>
        <p style={styles.desc}>
          Questo condominio è stato creato automaticamente per farti provare l'IA, la registrazione fatture e la riconciliazione bancaria in totale sicurezza.
        </p>
      </div>

      <div style={styles.rightCol}>
        <button 
          onClick={() => navigate('/migrazione')} 
          style={styles.btnPrimary}
        >
          <Plus size={16} style={{ marginRight: 6 }} />
          Importa i tuoi dati reali
        </button>
        <button 
          onClick={handleEliminaDemo} 
          disabled={deleting}
          style={styles.btnDanger}
          title="Rimuovi questo condominio di prova"
        >
          <Trash2 size={16} style={{ marginRight: 4 }} />
          {deleting ? 'Eliminazione...' : 'Rimuovi Demo'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  bannerContainer: {
    background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '12px',
    padding: '16px 20px',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap'
  },
  leftCol: {
    flex: '1 1 320px'
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'var(--primary-color, #2563eb)',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.5px',
    padding: '3px 10px',
    borderRadius: '20px',
    marginBottom: '8px'
  },
  title: {
    margin: '0 0 4px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)'
  },
  desc: {
    margin: 0,
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4'
  },
  rightCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap'
  },
  btnPrimary: {
    background: 'var(--primary-color, #2563eb)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  },
  btnDanger: {
    background: 'transparent',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  }
}
