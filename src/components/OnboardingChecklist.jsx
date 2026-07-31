import React, { useState, useEffect } from 'react'
import { CheckCircle2, Circle, Sparkles, ChevronRight, HelpCircle, RefreshCw, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function OnboardingChecklist({ 
  condomini = [], 
  stats = {}, 
  onStartTour, 
  onOpenGuida,
  onResetDemo 
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('condofast_onboarding_dismissed') === 'true' || localStorage.getItem('condosmart_onboarding_dismissed') === 'true'
  })
  const navigate = useNavigate()

  if (dismissed) return null

  const hasCondo = condomini.length > 0
  const demoCondo = condomini.find(c => c.is_demo) || condomini[0]

  // Calcolo dinamico degli step completati
  const step1Done = hasCondo
  const step2Done = (stats.fattureCount > 0) || (stats.speseCount > 0)
  const step3Done = (stats.movimentiCount > 0) || (stats.riconciliatiCount > 0)
  const step4Done = (stats.consuntiviGen > 0) || (stats.sollecitiCount > 0)

  const stepsList = [
    {
      id: 1,
      done: step1Done,
      title: 'Esplora il Condominio Demo o crea il tuo primo fabbricato',
      desc: 'Accedi al condominio Parco delle Rose per vedere tabelle millesimali e anagrafica.',
      actionText: demoCondo ? 'Apri Condominio Demo' : 'Nuovo Condominio',
      actionUrl: demoCondo ? `/condomini/${demoCondo.id}` : '/migrazione'
    },
    {
      id: 2,
      done: step2Done,
      title: 'Registra una Spesa o estrai una Fattura con l\'IA',
      desc: 'Prova la lettura automatica OCR di Gemini sulle fatture e distribuisci in quota.',
      actionText: demoCondo ? 'Nuova Spesa AI' : 'Importa Fattura',
      actionUrl: demoCondo ? `/condomini/${demoCondo.id}/spese` : '/spese'
    },
    {
      id: 3,
      done: step3Done,
      title: 'Sperimenta la Riconciliazione Bancaria AI',
      desc: 'Abbina i movimenti del conto corrente bancario alle rate e fatture con 1 clic.',
      actionText: demoCondo ? 'Apri Riconciliazioni' : 'Estratto Conto',
      actionUrl: demoCondo ? `/condomini/${demoCondo.id}/riconciliazioni` : '/estratto-conto'
    },
    {
      id: 4,
      done: step4Done,
      title: 'Genera il tuo primo Consuntivo PDF o Sollecito Rata',
      desc: 'Scarica il bilancio consuntivo ufficiale a norma art. 1130-bis c.c.',
      actionText: demoCondo ? 'Vedi Consuntivo' : 'Consuntivo',
      actionUrl: demoCondo ? `/condomini/${demoCondo.id}` : '/condomini'
    }
  ]

  const completedCount = stepsList.filter(s => s.done).length
  const progressPercent = Math.round((completedCount / stepsList.length) * 100)

  const handleDismiss = () => {
    localStorage.setItem('condofast_onboarding_dismissed', 'true')
    localStorage.setItem('condosmart_onboarding_dismissed', 'true')
    setDismissed(true)
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.headerTitleGroup}>
          <div style={styles.iconCircle}>
            <Sparkles size={20} color="#3b82f6" />
          </div>
          <div>
            <div style={styles.titleRow}>
              <h3 style={styles.title}>Benvenuto in CondoFAST — Prova Gratuita</h3>
              <span style={styles.percentBadge}>{progressPercent}% Completato</span>
            </div>
            <p style={styles.subtitle}>
              Completa questi 4 semplici passaggi per scoprire come l'Intelligenza Artificiale semplifica la tua gestione condominiale.
            </p>
          </div>
        </div>

        <div style={styles.headerActions}>
          {onStartTour && (
            <button onClick={onStartTour} style={styles.btnSecondary}>
              <Sparkles size={14} style={{ marginRight: 4 }} />
              Avvia Tour Guidato
            </button>
          )}
          {onOpenGuida && (
            <button onClick={onOpenGuida} style={styles.btnSecondary}>
              <HelpCircle size={14} style={{ marginRight: 4 }} />
              Centro Guida
            </button>
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)} 
            style={styles.btnIcon}
            title={collapsed ? 'Espandi Onboarding' : 'Riduci Onboarding'}
          >
            {collapsed ? '+' : '-'}
          </button>
          <button 
            onClick={handleDismiss} 
            style={styles.btnIcon}
            title="Chiudi guida rapida"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressBar, width: `${progressPercent}%` }} />
      </div>

      {!collapsed && (
        <div style={styles.stepsGrid}>
          {stepsList.map(step => (
            <div 
              key={step.id} 
              style={{
                ...styles.stepCard,
                borderColor: step.done ? 'rgba(34, 197, 94, 0.4)' : 'var(--border-color)'
              }}
            >
              <div style={styles.stepHeader}>
                {step.done ? (
                  <CheckCircle2 size={22} color="#22c55e" style={{ flexShrink: 0 }} />
                ) : (
                  <Circle size={22} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                )}
                <span style={styles.stepNumber}>Step {step.id}</span>
              </div>

              <h4 style={{ 
                ...styles.stepTitle, 
                textDecoration: step.done ? 'line-through' : 'none',
                opacity: step.done ? 0.8 : 1
              }}>
                {step.title}
              </h4>
              <p style={styles.stepDesc}>{step.desc}</p>

              <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
                <button 
                  onClick={() => navigate(step.actionUrl)}
                  style={{
                    ...styles.stepBtn,
                    background: step.done ? 'var(--card-bg)' : 'var(--primary-color, #2563eb)',
                    color: step.done ? 'var(--text-primary)' : '#ffffff',
                    border: step.done ? '1px solid var(--border-color)' : 'none'
                  }}
                >
                  <span>{step.actionText}</span>
                  <ChevronRight size={14} style={{ marginLeft: 4 }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  card: {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '28px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap'
  },
  headerTitleGroup: {
    display: 'flex',
    gap: '14px',
    alignItems: 'flex-start',
    flex: '1 1 300px'
  },
  iconCircle: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    background: 'rgba(59, 130, 246, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  percentBadge: {
    background: 'rgba(34, 197, 94, 0.15)',
    color: '#22c55e',
    fontSize: '12px',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '12px'
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: 'var(--text-secondary)'
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  btnSecondary: {
    background: 'var(--app-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  },
  btnIcon: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '6px'
  },
  progressTrack: {
    width: '100%',
    height: '6px',
    background: 'var(--app-bg)',
    borderRadius: '3px',
    margin: '16px 0',
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #3b82f6 0%, #22c55e 100%)',
    borderRadius: '3px',
    transition: 'width 0.4s ease'
  },
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
    marginTop: '16px'
  },
  stepCard: {
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'all 0.2s ease'
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px'
  },
  stepNumber: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase'
  },
  stepTitle: {
    margin: '0 0 6px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    lineHeight: '1.3'
  },
  stepDesc: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4'
  },
  stepBtn: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
}
