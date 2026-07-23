import React, { useState, useEffect } from 'react'
import { Sparkles, X, ChevronRight } from 'lucide-react'

export default function SpotlightHighlight({ targetId, title, desc, onClose, onNextStep }) {
  const [coords, setCoords] = useState(null)

  useEffect(() => {
    if (!targetId) return

    const updatePosition = () => {
      // Cerca l'elemento nel DOM tramite data-tour-target o ID
      const element = document.querySelector(`[data-tour-target="${targetId}"]`) || document.getElementById(targetId)

      if (element) {
        const rect = element.getBoundingClientRect()
        setCoords({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        })

        // Scroll morbido per mettere a fuoco l'elemento
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      } else {
        setCoords(null)
      }
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [targetId])

  if (!targetId || !coords) return null

  const popoverTop = Math.min(coords.top + coords.height + 14, window.innerHeight - 200)
  const popoverLeft = Math.max(16, Math.min(coords.left, window.innerWidth - 340))

  return (
    <>
      {/* Target Glowing Spotlight Box */}
      <div
        style={{
          position: 'fixed',
          top: coords.top - 6,
          left: coords.left - 6,
          width: coords.width + 12,
          height: coords.height + 12,
          borderRadius: '10px',
          boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.75), 0 0 20px 4px #3b82f6',
          border: '2px solid #3b82f6',
          pointerEvents: 'none',
          zIndex: 99998,
          transition: 'all 0.3s ease'
        }}
      />

      {/* Popover Card */}
      <div
        style={{
          position: 'fixed',
          top: popoverTop,
          left: popoverLeft,
          width: '320px',
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--primary-color, #2563eb)',
          borderRadius: '14px',
          padding: '16px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
          zIndex: 99999,
          color: 'var(--text-primary)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={16} color="#3b82f6" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>
              Guida Chirurgica
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
          {title}
        </h4>
        <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          {desc}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {onNextStep && (
            <button
              onClick={onNextStep}
              style={{
                background: 'var(--primary-color, #2563eb)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              <span>Capito, Prosegui</span>
              <ChevronRight size={14} style={{ marginLeft: 4 }} />
            </button>
          )}
        </div>
      </div>
    </>
  )
}
