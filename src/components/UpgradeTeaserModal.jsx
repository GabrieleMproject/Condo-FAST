import React from 'react'
import { X, Zap, Sparkles, CheckCircle2, ShieldCheck, ArrowRight, Lock } from 'lucide-react'

export default function UpgradeTeaserModal({
  isOpen,
  onClose,
  title = 'Funzionalità Avanzata Studio',
  description = 'Passa al piano superiore per sbloccare questa funzionalità e velocizzare la gestione dello studio.',
  pianoRichiesto = 'studio', // 'studio' | 'professional'
  badgeText = null,
  features = [
    'Automatizza i processi ripetitivi di studio',
    'Risparmia fino all\'80% del tempo di ricerca contabile',
    'Assistente AI dedicato con risorse potenziate'
  ],
  ctaText = null
}) {
  if (!isOpen) return null

  const isPro = pianoRichiesto === 'professional'
  const computedBadge = badgeText || (isPro ? 'ESCLUSIVO PROFESSIONAL' : 'ESCLUSIVO PIANO STUDIO')
  const defaultCtaText = isPro ? 'Passa a Professional (399€/m)' : 'Passa al Piano Studio (249€/m)'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: 'var(--card-bg)',
        border: `1px solid ${isPro ? 'rgba(245, 158, 11, 0.4)' : 'rgba(124, 58, 237, 0.4)'}`,
        borderRadius: 20, maxWidth: 500, width: '100%', padding: 28,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center',
        position: 'relative'
      }}>
        {/* Pulsante di chiusura X */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16, background: 'transparent',
            border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4
          }}
        >
          <X size={20} />
        </button>

        {/* Icona Header in Evidenza */}
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: isPro
            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.2))'
            : 'linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(37, 99, 235, 0.2))',
          color: isPro ? '#fbbf24' : '#a78bfa',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto'
        }}>
          <Sparkles size={28} />
        </div>

        {/* Testi ed Intestazione */}
        <div>
          <span style={{
            fontSize: 11,
            background: isPro ? 'rgba(245, 158, 11, 0.2)' : 'rgba(124, 58, 237, 0.2)',
            color: isPro ? '#fbbf24' : '#a78bfa',
            border: `1px solid ${isPro ? 'rgba(245, 158, 11, 0.4)' : 'rgba(124, 58, 237, 0.4)'}`,
            padding: '4px 12px', borderRadius: 16, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            display: 'inline-flex', alignItems: 'center', gap: 5
          }}>
            <Lock size={11} /> {computedBadge}
          </span>
          <h3 style={{ fontSize: 20, fontWeight: 800, margin: '12px 0 8px', color: 'var(--text-primary)' }}>
            {title}
          </h3>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {description}
          </p>
        </div>

        {/* Lista Vantaggi */}
        <div style={{
          background: 'var(--app-bg)', border: '1px solid var(--border-color)',
          borderRadius: 12, padding: 16, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10
        }}>
          {features.map((feat, idx) => (
            <div key={idx} style={{ fontSize: 12.5, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={16} style={{ color: isPro ? '#fbbf24' : '#34d399', flexShrink: 0 }} />
              <span>{feat}</span>
            </div>
          ))}
        </div>

        {/* Pulsanti di Azione */}
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1, padding: '12px 16px', background: 'transparent',
              border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
              borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Chiudi
          </button>
          <a
            href="/impostazioni#piani-abbonamento"
            style={{
              flex: 1.3, padding: '12px 16px',
              background: isPro
                ? 'linear-gradient(135deg, #d97706, #f59e0b)'
                : 'linear-gradient(135deg, #7c3aed, #2563eb)',
              color: '#fff', textDecoration: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: isPro ? '0 4px 14px rgba(245, 158, 11, 0.35)' : '0 4px 14px rgba(124, 58, 237, 0.35)'
            }}
          >
            <span>{ctaText || defaultCtaText}</span>
            <ArrowRight size={15} />
          </a>
        </div>
      </div>
    </div>
  )
}
