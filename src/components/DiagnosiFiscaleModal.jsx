// src/components/DiagnosiFiscaleModal.jsx
import React, { useState } from 'react'
import { ShieldCheck, AlertCircle, AlertTriangle, CheckCircle2, X, Activity, ExternalLink } from 'lucide-react'

export default function DiagnosiFiscaleModal({ isOpen, onClose, condominioNome, diagnosiResult }) {
  const [filtroSelezionato, setFiltroSelezionato] = useState('tutti') // tutti | errore | warning

  if (!isOpen || !diagnosiResult) return null

  const { score, livello, anomalie = [], controlliSuperati, totaleControlli } = diagnosiResult

  const getLivelloBadge = () => {
    switch (livello) {
      case 'eccellente':
        return { label: 'Eccellente - In Regola', color: '#10b981', bg: '#10b98120' }
      case 'buono':
        return { label: 'Buono - Piccole integrazioni consigliate', color: '#3b82f6', bg: '#3b82f620' }
      case 'attenzione':
        return { label: 'Attenzione - Anomalie da verificare', color: '#f59e0b', bg: '#f59e0b20' }
      case 'critico':
      default:
        return { label: 'Critico - Azione immediata richiesta', color: '#ef4444', bg: '#ef444420' }
    }
  }

  const badgeInfo = getLivelloBadge()

  const anomalieFiltrate = anomalie.filter(a => {
    if (filtroSelezionato === 'errore') return a.tipo === 'errore'
    if (filtroSelezionato === 'warning') return a.tipo === 'warning'
    return true
  })

  const numErrori = anomalie.filter(a => a.tipo === 'errore').length
  const numWarning = anomalie.filter(a => a.tipo === 'warning').length

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
    }}>
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16,
        width: '100%', maxWidth: 650, maxHeight: '90vh', overflowY: 'auto', padding: 28,
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', fontFamily: 'Sora, sans-serif'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#2563eb20', padding: 10, borderRadius: 10 }}>
              <Activity size={24} color="#60a5fa" />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Diagnosi Conformità Fiscale
              </h3>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {condominioNome || 'Condominio'}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Score & Health Bar */}
        <div style={{
          background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 12,
          padding: 20, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20
        }}>
          {/* Circular Score Gauge */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: `conic-gradient(${badgeInfo.color} ${score * 3.6}deg, var(--border-color) 0deg)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <div style={{
              width: 66, height: 66, borderRadius: '50%', background: 'var(--card-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 20, color: badgeInfo.color
            }}>
              {score}%
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ background: badgeInfo.bg, color: badgeInfo.color, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                {badgeInfo.label}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Superati <b>{controlliSuperati}</b> su <b>{totaleControlli}</b> controlli di completezza anagrafica, bancaria e fiscale.
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { id: 'tutti', label: `Tutti i rilievi (${anomalie.length})` },
            { id: 'errore', label: `Errori Bloccanti (${numErrori})`, color: numErrori > 0 ? '#ef4444' : undefined },
            { id: 'warning', label: `Avvisi (${numWarning})`, color: numWarning > 0 ? '#f59e0b' : undefined }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFiltroSelezionato(f.id)}
              style={{
                background: filtroSelezionato === f.id ? 'var(--card-bg)' : 'var(--app-bg)',
                color: f.color || (filtroSelezionato === f.id ? 'var(--text-primary)' : 'var(--text-muted)'),
                border: '1px solid var(--border-color)', borderRadius: 6,
                padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Issues List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {anomalieFiltrate.length === 0 ? (
            <div style={{ background: '#10b98110', border: '1px dashed #10b98140', padding: 24, borderRadius: 10, textAlign: 'center', color: '#10b981', fontSize: 14 }}>
              <CheckCircle2 size={28} style={{ marginBottom: 6 }} />
              <div>Nessuna anomalia rilevata per i filtri selezionati. Il condominio è in regola!</div>
            </div>
          ) : (
            anomalieFiltrate.map((ano) => (
              <div
                key={ano.id}
                style={{
                  background: ano.tipo === 'errore' ? '#ef444408' : '#f59e0b08',
                  borderLeft: `4px solid ${ano.tipo === 'errore' ? '#ef4444' : '#f59e0b'}`,
                  border: '1px solid var(--border-color)',
                  borderLeftWidth: 4,
                  borderRadius: 8, padding: 14
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {ano.tipo === 'errore' ? <AlertCircle size={16} color="#ef4444" /> : <AlertTriangle size={16} color="#f59e0b" />}
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{ano.titolo}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {ano.descrizione}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
              padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer'
            }}
          >
            Chiudi Diagnosi
          </button>
        </div>
      </div>
    </div>
  )
}
