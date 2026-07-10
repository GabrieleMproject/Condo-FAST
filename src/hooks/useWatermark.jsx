import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Download, Lock } from 'lucide-react'
import { usePlan } from './usePlan'

export function useWatermark() {
  const { piano } = usePlan()
  const navigate = useNavigate()
  const [modalState, setModalState] = useState({ isOpen: false, onProceed: null })

  // Funzione da chiamare al click del pulsante Export
  const checkWatermark = useCallback((onProceed) => {
    // Se il piano è "free" (o non definito/trial scaduto ecc), mostra il popup
    // Assumiamo che i piani a pagamento siano diversi da 'free'
    if (!piano || piano === 'free') {
      setModalState({ isOpen: true, onProceed })
    } else {
      // Piano premium: procedi senza filigrana
      onProceed(false)
    }
  }, [piano])

  const handleProceed = () => {
    if (modalState.onProceed) {
      modalState.onProceed(true) // Passa true per indicare "con filigrana"
    }
    setModalState({ isOpen: false, onProceed: null })
  }

  const handleUpgrade = () => {
    setModalState({ isOpen: false, onProceed: null })
    navigate('/impostazioni')
  }

  const handleClose = () => {
    setModalState({ isOpen: false, onProceed: null })
  }

  const WatermarkModal = () => {
    if (!modalState.isOpen) return null

    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <div style={styles.iconContainer}>
            <Sparkles size={32} color="#f59e0b" />
          </div>
          
          <h2 style={styles.title}>Scopri quanto tempo risparmieresti con la versione Pro!</h2>
          <p style={styles.desc}>
            Stai utilizzando la versione gratuita di CondoSmart. Il documento PDF generato riporterà una <b>filigrana in sovraimpressione</b>.
          </p>
          <p style={styles.desc}>
            Passa a uno dei piani Premium per rimuovere la filigrana, personalizzare i PDF con il logo del tuo studio e sbloccare tutte le automazioni dell'Intelligenza Artificiale.
          </p>

          <div style={styles.actions}>
            <button onClick={handleUpgrade} style={styles.btnPrimary}>
              <Lock size={16} />
              Scopri i Piani Premium
            </button>
            <button onClick={handleProceed} style={styles.btnSecondary}>
              <Download size={16} />
              Scarica con Filigrana
            </button>
          </div>
          
          <button onClick={handleClose} style={styles.btnClose}>Annulla</button>
        </div>
      </div>
    )
  }

  return { checkWatermark, WatermarkModal }
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(15, 23, 42, 0.8)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  },
  modal: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 16,
    padding: '32px',
    width: '100%',
    maxWidth: 480,
    textAlign: 'center',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
  },
  iconContainer: {
    width: 64, height: 64,
    borderRadius: 32,
    background: '#fef3c7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px auto'
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 12,
    lineHeight: 1.3
  },
  desc: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 1.5,
    marginBottom: 16
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 24,
    marginBottom: 16
  },
  btnPrimary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: '#f59e0b',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '12px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  btnSecondary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'transparent',
    color: '#cbd5e1',
    border: '1px solid #475569',
    borderRadius: 8,
    padding: '12px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  btnClose: {
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    fontSize: 13,
    cursor: 'pointer',
    textDecoration: 'underline'
  }
}
