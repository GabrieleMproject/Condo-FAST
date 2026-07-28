import React, { useState } from 'react'
import { Sparkles, X, ChevronRight, ChevronLeft, CheckCircle, Building2, FolderSync, FileText, Landmark, PieChart, MessageSquare } from 'lucide-react'

export default function OnboardingTourModal({ isOpen, onClose }) {
  const [currentStep, setCurrentStep] = useState(0)

  if (!isOpen) return null

  const tourSteps = [
    {
      title: 'Benvenuto in CondoSmart!',
      subtitle: 'Il gestionale condominiale potenziato dall\'Intelligenza Artificiale.',
      desc: 'In questo breve tour di 60 secondi ti mostreremo dove trovare i comandi principali per semplificare e velocizzare la gestione del tuo studio.',
      badge: 'PROVA GRATUITA',
      icon: Sparkles
    },
    {
      title: 'Header & Esercizio Amministrativo',
      subtitle: 'Passaggio istantaneo tra esercizi contabili.',
      desc: 'In alto a destra nell\'header trovi la selezione rapida dell\'Esercizio Amministrativo (es. 2026 Ordinario). Cambiandolo, tutti i dati di spese, rate e bilanci si sincronizzano all\'istante senza ricaricare la pagina.',
      badge: 'NAVIGAZIONE',
      icon: Building2
    },
    {
      title: 'Migrazione AI & Anagrafica',
      subtitle: 'Carica i tuoi vecchi file Excel/PDF in 1 click.',
      desc: 'Dalla barra laterale accedi a "Migrazione AI": carica l\'anagrafica del tuo vecchio gestionale o i dati catastali. L\'IA riconoscerà automaticamente condomòni, unità e millesimi.',
      badge: 'INTELLIGENZA ARTIFICIALE',
      icon: FolderSync
    },
    {
      title: 'Registrazione Spese & Lettura Fatture',
      subtitle: 'Lettura automatica di PDF, immagini e scontrini.',
      desc: 'Nel tab Spese puoi trascinare qualsiasi fattura o scontrino: Gemini estrarrà in automatico fornitore, data, importo e suggerirà la tabella millesimale corretta.',
      badge: 'AUTOMAZIONE',
      icon: FileText
    },
    {
      title: 'Estratto Conto & Riconciliazione Bancaria',
      subtitle: 'Riconcilia entrate ed uscite senza errori.',
      desc: 'Collega i movimenti del conto bancario o carica il file CSV/Excel per abbinare automaticamente le rate dei condòmini e i pagamenti ai fornitori.',
      badge: 'BANCA & INCASSI',
      icon: Landmark
    },
    {
      title: 'Consuntivo PDF & Solleciti Rate',
      subtitle: 'Bilanci trasparenti e gestione della morosità.',
      desc: 'Genera il consuntivo di legge ex Art. 1130-bis c.c. con branding del tuo studio in formato PDF landscape o invia solleciti integrati via email in 1 click.',
      badge: 'DOCUMENTI & COMUNICAZIONE',
      icon: PieChart
    },
    {
      title: 'Assistente AI & Chatbot 24/7',
      subtitle: 'Supporto immediato in basso a destra.',
      desc: 'Hai dubbi su dove trovare una funzione? Clicca sul pulsante della chat in basso a destra: il nostro assistente AI conosce l\'intero software ed è pronto a guidarti!',
      badge: 'ASSISTENZA',
      icon: MessageSquare
    }
  ]

  const step = tourSteps[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === tourSteps.length - 1
  const StepIcon = step.icon || Sparkles

  const handleNext = () => {
    if (isLast) {
      onClose()
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStep(prev => prev - 1)
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <span style={styles.badge}>{step.badge}</span>
          <button onClick={onClose} style={styles.btnClose}>
            <X size={18} />
          </button>
        </div>

        <div style={styles.modalBody}>
          <div style={styles.iconBox}>
            <StepIcon size={28} color="#3b82f6" />
          </div>
          <h2 style={styles.title}>{step.title}</h2>
          <h4 style={styles.subtitle}>{step.subtitle}</h4>
          <p style={styles.desc}>{step.desc}</p>
        </div>

        <div style={styles.dotsRow}>
          {tourSteps.map((_, idx) => (
            <div 
              key={idx} 
              style={{
                ...styles.dot,
                background: idx === currentStep ? 'var(--primary-color, #2563eb)' : 'var(--border-color)',
                width: idx === currentStep ? '20px' : '8px'
              }}
            />
          ))}
        </div>

        <div style={styles.modalFooter}>
          {!isFirst ? (
            <button onClick={handlePrev} style={styles.btnSecondary}>
              <ChevronLeft size={16} style={{ marginRight: 4 }} />
              Indietro
            </button>
          ) : (
            <button onClick={onClose} style={styles.btnLink}>
              Salta Tour
            </button>
          )}

          <button onClick={handleNext} style={styles.btnPrimary}>
            {isLast ? (
              <>
                <span>Inizia a Usare CondoSmart</span>
                <CheckCircle size={16} style={{ marginLeft: 6 }} />
              </>
            ) : (
              <>
                <span>Avanti</span>
                <ChevronRight size={16} style={{ marginLeft: 4 }} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(4px)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
  },
  modalCard: {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    maxWidth: '520px',
    width: '100%',
    padding: '28px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  badge: {
    background: 'rgba(59, 130, 246, 0.15)',
    color: 'var(--primary-color, #3b82f6)',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.6px',
    padding: '4px 12px',
    borderRadius: '20px'
  },
  btnClose: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px'
  },
  modalBody: {
    textAlign: 'center',
    marginBottom: '24px'
  },
  iconBox: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'rgba(59, 130, 246, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px auto'
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '0 0 6px 0'
  },
  subtitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--primary-color, #3b82f6)',
    margin: '0 0 14px 0'
  },
  desc: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    margin: 0
  },
  dotsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    marginBottom: '24px'
  },
  dot: {
    height: '8px',
    borderRadius: '4px',
    transition: 'all 0.3s ease'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px'
  },
  btnPrimary: {
    background: 'var(--primary-color, #2563eb)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: 'auto'
  },
  btnSecondary: {
    background: 'var(--app-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  },
  btnLink: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: 'none',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '8px'
  }
}
