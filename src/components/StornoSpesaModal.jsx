// src/components/StornoSpesaModal.jsx
import React from 'react'
import { RotateCcw, FileText, CheckCircle2, ShieldAlert, ArrowRight, X } from 'lucide-react'

export default function StornoSpesaModal({ isOpen, onClose, spesa, onConfirmStorno, onConfirmRiapri, loading }) {
  if (!isOpen || !spesa) return null

  const isRiconciliata = spesa.riconciliata || false
  const isPagata = spesa.stato === 'pagata' || spesa.data_pagamento != null
  const haQuietanzaF24 = spesa.f24_url != null || spesa.ritenuta_pagata === true

  return (
    <div style={st.overlay}>
      <div style={st.modal}>
        {/* Header */}
        <div style={st.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={st.iconCircle}>
              <ShieldAlert size={20} color="#f59e0b" />
            </div>
            <div>
              <h3 style={st.title}>Gestione Storno Contabile Spesa</h3>
              <p style={st.subtitle}>Questa spesa risulta contabilmente registrata o saldata. Seleziona la procedura da applicare.</p>
            </div>
          </div>
          <button style={st.closeBtn} onClick={onClose} disabled={loading} title="Chiudi">
            <X size={18} />
          </button>
        </div>

        {/* Info Box spesa */}
        <div style={st.infoBox}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
            {spesa.descrizione || 'Spesa registrata'} — € {Number(spesa.importo || spesa.importo_totale || 0).toFixed(2)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>Fornitore: <b>{spesa.fornitore || '—'}</b></span>
            <span>Stato: <b style={{ color: isPagata ? '#10b981' : '#f59e0b' }}>{isPagata ? 'Pagata' : 'In attesa'}</b></span>
            {isRiconciliata && <span style={{ color: '#a855f7', fontWeight: 600 }}>Riconciliata in c/c</span>}
            {haQuietanzaF24 && <span style={{ color: '#3b82f6', fontWeight: 600 }}>F24 Presentato</span>}
          </div>
        </div>

        {/* Options grid */}
        <div style={st.grid}>
          {/* Option 1: Nota di Credito / Storno Contabile */}
          <div style={{ ...st.card, border: '1.5px solid #2563eb' }}>
            <div style={st.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={16} color="#3b82f6" />
                <span style={st.cardBadgeBlue}>Procedura Consigliata</span>
              </div>
              <h4 style={st.cardTitle}>Registra Nota di Credito / Storno</h4>
            </div>
            <p style={st.cardDesc}>
              Mantiene la tracciabilità ex art. 1130-bis c.c. registrando uno storno contabile inverso pari a € {Number(spesa.importo || 0).toFixed(2)}.
            </p>
            <ul style={st.featureList}>
              <li style={st.featureItem}><CheckCircle2 size={13} color="#10b981" /> <span>Preserva la quadratura storica del rendiconto</span></li>
              <li style={st.featureItem}><CheckCircle2 size={13} color="#10b981" /> <span>Tracciabilità fiscale a prova di revisione contabile</span></li>
            </ul>
            <button style={st.btnPrimary} onClick={() => onConfirmStorno(spesa)} disabled={loading}>
              {loading ? 'Elaborazione...' : 'Registra Storno Contabile'}
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Option 2: Riapertura Controllata */}
          <div style={st.card}>
            <div style={st.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <RotateCcw size={16} color="#f59e0b" />
                <span style={st.cardBadgeGray}>Modifica Controllata</span>
              </div>
              <h4 style={st.cardTitle}>Riapri Spesa e Sblocca Stato</h4>
            </div>
            <p style={st.cardDesc}>
              Rimuove lo stato di saldata e dissocia gli abbinamenti non ancora consolidati alla banca, riaprendo il form di modifica.
            </p>
            {haQuietanzaF24 && (
              <div style={st.warnNote}>
                <ShieldAlert size={13} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>Attenzione: L'F24 associato è già stato presentato. I dati fiscali rimarranno tracciati per la CU.</span>
              </div>
            )}
            <button style={st.btnSecondary} onClick={() => onConfirmRiapri(spesa)} disabled={loading}>
              {loading ? 'Elaborazione...' : 'Riapri per Modifica'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const st = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },
  modal: {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 16,
    width: '100%',
    maxWidth: 720,
    padding: 24,
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    fontFamily: 'Sora, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: 'rgba(245, 158, 11, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  subtitle: {
    fontSize: 12.5,
    color: 'var(--text-secondary)',
    margin: '4px 0 0 0',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBox: {
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    padding: 12,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 14,
  },
  card: {
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
  },
  cardHeader: {
    marginBottom: 8,
  },
  cardBadgeBlue: {
    fontSize: 10.5,
    fontWeight: 600,
    color: '#60a5fa',
    background: 'rgba(37,99,235,0.15)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  cardBadgeGray: {
    fontSize: 10.5,
    fontWeight: 600,
    color: 'var(--text-muted)',
    background: 'var(--border-color)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '6px 0 0 0',
  },
  cardDesc: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    marginBottom: 12,
  },
  warnNote: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    borderRadius: 8,
    padding: 8,
    fontSize: 11,
    color: '#ef4444',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 16px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 'auto',
  },
  featureItem: {
    fontSize: 11.5,
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  btnPrimary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '9px 14px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif',
    width: '100%',
  },
  btnSecondary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    background: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '9px 14px',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif',
    width: '100%',
    marginTop: 'auto',
  },
}
