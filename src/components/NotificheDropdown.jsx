// src/components/NotificheDropdown.jsx
// Pannello dropdown notifiche/promemoria temporali.
// Si apre dalla campanella nella topbar di AppLayout.

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, RefreshCw, CheckCheck, AlertCircle,
  AlertTriangle, Info, X, ArrowRight, FileText,
  Calendar, CreditCard, Activity
} from 'lucide-react'

const ICONE_TIPO = {
  f24_ritenute: CreditCard,
  rate_scadute: AlertCircle,
  esercizio_in_scadenza: Calendar,
  movimenti_non_riconciliati: Activity,
}

const COLORI_SEVERITA = {
  error:   { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  icon: '#ef4444', badge: '#ef4444' },
  warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', icon: '#f59e0b', badge: '#f59e0b' },
  info:    { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', icon: '#3b82f6', badge: '#3b82f6' },
}

function IconaTipo({ tipo, severita, size = 18 }) {
  const Icon = ICONE_TIPO[tipo] || Bell
  const colori = COLORI_SEVERITA[severita] || COLORI_SEVERITA.info
  return <Icon size={size} color={colori.icon} strokeWidth={2} />
}

function ItemNotifica({ notifica, letta, onSegna, onNavigate }) {
  const colori = COLORI_SEVERITA[notifica.severita] || COLORI_SEVERITA.info
  const navigate = useNavigate()

  const handleVai = () => {
    onSegna(notifica.id)
    if (notifica.link) {
      navigate(notifica.link)
      onNavigate()
    }
  }

  return (
    <div style={{
      padding: '14px 16px',
      borderBottom: '1px solid #1e293b',
      background: letta ? 'transparent' : colori.bg,
      borderLeft: letta ? '3px solid transparent' : `3px solid ${colori.border}`,
      transition: 'background 0.2s',
      opacity: letta ? 0.55 : 1,
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Icona */}
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: letta ? '#1e293b' : colori.bg,
          border: `1px solid ${letta ? '#334155' : colori.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconaTipo tipo={notifica.tipo} severita={notifica.severita} size={16} />
        </div>

        {/* Testo */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
            <span style={{
              color: letta ? '#475569' : '#e2e8f0',
              fontSize: 13, fontWeight: 600, lineHeight: 1.3,
            }}>
              {notifica.titolo}
            </span>
            {!letta && (
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: COLORI_SEVERITA[notifica.severita]?.badge || '#3b82f6',
                flexShrink: 0, marginTop: 4,
              }} />
            )}
          </div>

          {notifica.condominioNome && (
            <span style={{
              fontSize: 11, color: '#3b82f6', fontWeight: 600,
              background: 'rgba(59,130,246,0.1)', padding: '1px 7px',
              borderRadius: 4, display: 'inline-block', marginBottom: 6,
            }}>
              {notifica.condominioNome}
            </span>
          )}

          <p style={{
            color: letta ? '#475569' : '#94a3b8',
            fontSize: 12, margin: 0, lineHeight: 1.5,
          }}>
            {notifica.messaggio}
          </p>

          {/* Azioni */}
          <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
            {notifica.link && (
              <button
                onClick={handleVai}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'transparent', border: 'none',
                  color: COLORI_SEVERITA[notifica.severita]?.icon || '#3b82f6',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0,
                  fontFamily: 'Sora, sans-serif',
                }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
              >
                Vai <ArrowRight size={12} />
              </button>
            )}
            {!letta && (
              <button
                onClick={() => onSegna(notifica.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'transparent', border: 'none',
                  color: '#475569', fontSize: 12, cursor: 'pointer', padding: 0,
                  fontFamily: 'Sora, sans-serif',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                onMouseLeave={e => e.currentTarget.style.color = '#475569'}
              >
                <X size={11} /> Segna letto
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NotificheDropdown({
  notifiche,
  nonLette,
  loading,
  onClose,
  onRefresh,
  onSegnaLetta,
  onSegnaAllLette,
}) {
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  // Chiudi su click fuori
  useEffect(() => {
    function onClickFuori(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose()
      }
    }
    function onEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onClickFuori)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickFuori)
      document.removeEventListener('keydown', onEsc)
    }
  }, [onClose])

  const nonLetteIds = new Set(nonLette.map(n => n.id))
  const haLette = notifiche.some(n => !nonLetteIds.has(n.id))

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: 52,
        right: 0,
        width: 380,
        maxHeight: '80vh',
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'dropdownFadeIn 0.15s ease',
      }}
      role="dialog"
      aria-label="Pannello promemoria"
    >
      <style>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '16px 18px 12px',
        borderBottom: '1px solid #334155',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bell size={16} color="#94a3b8" />
          <span style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 700 }}>
            Promemoria
          </span>
          {nonLette.length > 0 && (
            <span style={{
              background: '#ef4444', color: '#fff',
              fontSize: 11, fontWeight: 700,
              padding: '1px 7px', borderRadius: 10,
              minWidth: 20, textAlign: 'center',
            }}>
              {nonLette.length}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {nonLette.length > 0 && (
            <button
              onClick={onSegnaAllLette}
              title="Segna tutti come letti"
              style={{
                background: 'transparent', border: 'none',
                color: '#475569', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 12, padding: '4px 8px', borderRadius: 6,
                fontFamily: 'Sora, sans-serif',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#334155'; e.currentTarget.style.color = '#94a3b8' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569' }}
            >
              <CheckCheck size={13} /> Tutti letti
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Aggiorna promemoria"
            style={{
              background: 'transparent', border: 'none',
              color: '#475569', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center',
              padding: '4px 8px', borderRadius: 6,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#334155'; e.currentTarget.style.color = '#94a3b8' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569' }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              color: '#475569', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              padding: '4px 8px', borderRadius: 6,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#334155'; e.currentTarget.style.color = '#e2e8f0' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Lista notifiche */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && notifiche.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
            <p style={{ fontSize: 13, margin: 0 }}>Calcolo promemoria…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : notifiche.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <CheckCheck size={22} color="#22c55e" />
            </div>
            <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, margin: '0 0 6px' }}>
              Tutto in ordine!
            </p>
            <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>
              Nessun promemoria attivo al momento.
            </p>
          </div>
        ) : (
          <>
            {/* Non lette prima */}
            {notifiche
              .filter(n => nonLetteIds.has(n.id))
              .map(n => (
                <ItemNotifica
                  key={n.id}
                  notifica={n}
                  letta={false}
                  onSegna={onSegnaLetta}
                  onNavigate={onClose}
                />
              ))
            }
            {/* Lette dopo, collassate */}
            {haLette && (
              <>
                {nonLette.length > 0 && (
                  <div style={{
                    padding: '8px 16px',
                    background: '#0f172a',
                    color: '#334155',
                    fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    Già letti
                  </div>
                )}
                {notifiche
                  .filter(n => !nonLetteIds.has(n.id))
                  .map(n => (
                    <ItemNotifica
                      key={n.id}
                      notifica={n}
                      letta={true}
                      onSegna={onSegnaLetta}
                      onNavigate={onClose}
                    />
                  ))
                }
              </>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid #1e293b',
        flexShrink: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: '#334155', fontSize: 11 }}>
          {notifiche.length} promemori{notifiche.length === 1 ? 'o' : 'a'} totali
        </span>
        <a
          href="/impostazioni"
          onClick={e => {
            e.preventDefault()
            navigate('/impostazioni')
            onClose()
            // Scroll sull'anchor dopo il render della pagina
            setTimeout(() => {
              document.getElementById('notifiche')?.scrollIntoView({ behavior: 'smooth' })
            }, 100)
          }}
          style={{
            color: '#475569', fontSize: 11, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
          onMouseLeave={e => e.currentTarget.style.color = '#475569'}
        >
          <FileText size={11} /> Impostazioni notifiche
        </a>
      </div>
    </div>
  )
}
