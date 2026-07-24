import React, { useState } from 'react'
import { Sparkles, CheckCircle2, ChevronRight, Target, Unlock, Lock, ChevronDown, ChevronUp, Award, Download } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { scaricaFatturaPdfDemo, scaricaEstrattoContoCsvDemo } from '../lib/demoFilesGenerator'

export default function MasterclassBar({
  currentStep,
  completedSteps = [],
  activeStepData,
  totalStepsCount,
  onCompleteStep,
  onGoToStep,
  onToggleGuidance,
  onShowSpotlight,
  isGuidanceActive
}) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  if (!isGuidanceActive) {
    return (
      <div style={styles.miniBar}>
        <div style={styles.miniBarLeft}>
          <Award size={16} color="#3b82f6" />
          <span style={styles.miniText}>Modalità Tutorial Guidato Disattivata (Tutte le funzioni sbloccate)</span>
        </div>
        <button onClick={() => onToggleGuidance(true)} style={styles.btnMiniLink}>
          <Unlock size={14} style={{ marginRight: 4 }} />
          Riattiva Tutorial Guidato
        </button>
      </div>
    )
  }

  const progressPercent = Math.round(((completedSteps.length) / totalStepsCount) * 100)
  const isStepCompleted = completedSteps.includes(activeStepData.id)

  const handleNavigateAndSpotlight = () => {
    if (activeStepData.pageUrl && !location.pathname.startsWith(activeStepData.pageUrl)) {
      navigate(activeStepData.pageUrl)
    }
    if (onShowSpotlight && activeStepData.target) {
      setTimeout(() => {
        onShowSpotlight(activeStepData.target)
      }, 200)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div style={styles.leftGroup}>
          <div style={styles.badge}>
            <Sparkles size={14} style={{ marginRight: 4 }} />
            TUTORIAL GUIDATO {activeStepData?.id ?? 0}/9
          </div>
          <h4 style={styles.stepTitle}>{activeStepData?.title}</h4>
        </div>

        <div style={styles.rightGroup}>
          {activeStepData?.id === 5 && (
            <button onClick={scaricaFatturaPdfDemo} style={styles.btnDownloadDemo} title="Scarica un PDF di fattura fittizio per provare l'OCR AI">
              <Download size={14} style={{ marginRight: 4 }} />
              Scarica Fattura PDF di Prova
            </button>
          )}

          {activeStepData?.id === 6 && (
            <button onClick={scaricaEstrattoContoCsvDemo} style={styles.btnDownloadDemo} title="Scarica un CSV bancario di prova per la riconciliazione">
              <Download size={14} style={{ marginRight: 4 }} />
              Scarica CSV Banca di Prova
            </button>
          )}

          <button onClick={handleNavigateAndSpotlight} style={styles.btnSpotlight}>
            <Target size={15} style={{ marginRight: 6 }} />
            Mostrami dove cliccare
          </button>

          {!isStepCompleted ? (
            <button onClick={() => onCompleteStep(activeStepData?.id)} style={styles.btnComplete}>
              <CheckCircle2 size={15} style={{ marginRight: 6 }} />
              Spunta completato
            </button>
          ) : (
            <span style={styles.completedBadge}>
              <CheckCircle2 size={14} style={{ marginRight: 4 }} />
              Completato
            </span>
          )}

          <button onClick={() => setExpanded(!expanded)} style={styles.btnIcon}>
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      <p style={styles.desc}>{activeStepData?.desc}</p>

      {/* Progress Bar */}
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressBar, width: `${progressPercent}%` }} />
      </div>

      {/* Dropdown lista tutti i 10 step */}
      {expanded && (
        <div style={styles.stepsDropdown}>
          <div style={styles.dropdownHeader}>
            <span style={styles.dropdownTitle}>Percorso Operativo Condominiale (Tutti i 10 Step):</span>
            <button onClick={() => onToggleGuidance(false)} style={styles.btnToggleOff}>
              <Lock size={13} style={{ marginRight: 4 }} />
              Disattiva Guida (Sblocca Tutto)
            </button>
          </div>

          <div style={styles.stepsGrid}>
            {Array.from({ length: totalStepsCount }).map((_, idx) => {
              const isDone = completedSteps.includes(idx)
              const isActive = currentStep === idx
              return (
                <button
                  key={idx}
                  onClick={() => onGoToStep(idx)}
                  style={{
                    ...styles.stepChip,
                    borderColor: isActive ? 'var(--primary-color, #2563eb)' : 'var(--border-color)',
                    background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'var(--app-bg)',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
                  }}
                >
                  {isDone ? (
                    <CheckCircle2 size={14} color="#22c55e" style={{ marginRight: 6 }} />
                  ) : (
                    <span style={styles.chipNum}>{idx}</span>
                  )}
                  <span style={styles.chipText}>Step {idx}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '14px',
    padding: '14px 20px',
    marginBottom: '20px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
    color: 'var(--text-primary)'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px'
  },
  leftGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap'
  },
  badge: {
    background: 'var(--primary-color, #2563eb)',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '700',
    padding: '3px 10px',
    borderRadius: '20px',
    display: 'inline-flex',
    alignItems: 'center'
  },
  stepTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  rightGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  btnSpotlight: {
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
    border: '1px solid rgba(96, 165, 250, 0.4)',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  },
  btnDownloadDemo: {
    background: 'rgba(234, 179, 8, 0.15)',
    color: '#eab308',
    border: '1px solid rgba(234, 179, 8, 0.4)',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  },
  btnComplete: {
    background: '#22c55e',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  },
  completedBadge: {
    background: 'rgba(34, 197, 94, 0.15)',
    color: '#22c55e',
    fontSize: '12px',
    fontWeight: '600',
    padding: '6px 10px',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center'
  },
  btnIcon: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px'
  },
  desc: {
    margin: '8px 0 10px 0',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4'
  },
  progressTrack: {
    width: '100%',
    height: '4px',
    background: 'var(--app-bg)',
    borderRadius: '2px',
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #3b82f6 0%, #22c55e 100%)',
    borderRadius: '2px',
    transition: 'width 0.3s ease'
  },
  stepsDropdown: {
    marginTop: '14px',
    paddingTop: '14px',
    borderTop: '1px solid var(--border-color)'
  },
  dropdownHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },
  dropdownTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-muted)'
  },
  btnToggleOff: {
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  },
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: '6px'
  },
  stepChip: {
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '6px 8px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  chipNum: {
    background: 'var(--border-color)',
    borderRadius: '50%',
    width: '16px',
    height: '16px',
    fontSize: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '6px'
  },
  miniBar: {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '8px 16px',
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  miniBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  miniText: {
    fontSize: '12px',
    color: 'var(--text-secondary)'
  },
  btnMiniLink: {
    background: 'transparent',
    border: 'none',
    color: '#3b82f6',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  }
}
