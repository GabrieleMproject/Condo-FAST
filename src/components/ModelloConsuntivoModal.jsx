// src/components/ModelloConsuntivoModal.jsx
import React from 'react'
import { FileText, Sparkles, CheckCircle2, ShieldCheck, ArrowRight, X, LayoutList } from 'lucide-react'

export default function ModelloConsuntivoModal({ isOpen, onClose, fileNome, struttura, onConfirm, loading }) {
  if (!isOpen || !struttura) return null

  const dati = struttura.dati || struttura
  const etichette = dati.etichette_categorie || {}
  const etichetteCount = Object.keys(etichette).length
  const motivazione = dati.motivazione_condosmart || 'Garantisce piena conformità all\'art. 1130-bis c.c. con rendiconto economico, riparto, situazione di cassa e registro fatture/F24.'

  return (
    <div style={st.overlay}>
      <div style={st.modal}>
        {/* Header */}
        <div style={st.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={st.iconCircle}>
              <Sparkles size={20} color="#60a5fa" />
            </div>
            <div>
              <h3 style={st.title}>Apprendimento Modello Consuntivo</h3>
              <p style={st.subtitle}>L'AI ha analizzato il tuo documento. Scegli l'impostazione che preferisci applicare.</p>
            </div>
          </div>
          <button style={st.closeBtn} onClick={onClose} disabled={loading} title="Chiudi">
            <X size={18} />
          </button>
        </div>

        {/* Options grid */}
        <div style={st.grid}>
          {/* Card 1: Modello Identico */}
          <div style={st.card}>
            <div style={st.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="#94a3b8" />
                <span style={st.cardBadgeGray}>Da File Originale</span>
              </div>
              <h4 style={st.cardTitle}>Modello Identico</h4>
            </div>

            <p style={st.cardDesc}>
              Mantiene la nomenclatura, le etichette delle categorie e l'impostazione del tuo documento originale.
            </p>

            <div style={st.fileBox}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={13} color="#60a5fa" /> {fileNome || 'Documento di riferimento'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Rilevate {etichetteCount} categorie personalizzate
              </div>
              {etichetteCount > 0 && (
                <div style={st.tagsList}>
                  {Object.values(etichette).slice(0, 4).map((lbl, idx) => (
                    <span key={idx} style={st.tag}>{String(lbl).toUpperCase()}</span>
                  ))}
                  {etichetteCount > 4 && <span style={st.tagMore}>+{etichetteCount - 4} altre</span>}
                </div>
              )}
            </div>

            <ul style={st.featureList}>
              <li style={st.featureItem}>
                <CheckCircle2 size={14} color="#10b981" />
                <span>Conserva le etichette storiche dello studio</span>
              </li>
              <li style={st.featureItem}>
                <CheckCircle2 size={14} color="#10b981" />
                <span>Mantiene l'ordine delle voci lette nel file</span>
              </li>
              <li style={st.featureItem}>
                <CheckCircle2 size={14} color="#10b981" />
                <span>Design pulito in stile CondoFAST</span>
              </li>
            </ul>

            <button
              style={st.btnSecondary}
              onClick={() => onConfirm('identico', dati)}
              disabled={loading}
            >
              {loading ? 'Applicazione...' : 'Applica Modello Identico'}
            </button>
          </div>

          {/* Card 2: Modello CondoFAST */}
          <div style={{ ...st.card, ...st.cardRecommended }}>
            <div style={st.recBadge}>
              <ShieldCheck size={13} /> RACCOMANDATO
            </div>

            <div style={st.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color="#3b82f6" />
                <span style={st.cardBadgeBlue}>Standard Art. 1130-bis c.c.</span>
              </div>
              <h4 style={st.cardTitle}>Modello CondoFAST</h4>
            </div>

            <p style={st.cardDesc}>
              Struttura ottimizzata e uniforme per la massima chiarezza ex art. 1130-bis c.c., organizzata in 5 sezioni chiare.
            </p>

            <div style={st.aiBox}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <LayoutList size={13} /> Suggerimento CondoFAST AI:
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {motivazione}
              </div>
            </div>

            <ul style={st.featureList}>
              <li style={st.featureItem}>
                <CheckCircle2 size={14} color="#3b82f6" />
                <span>5 Sezioni A→E + Nota Sintetica completa</span>
              </li>
              <li style={st.featureItem}>
                <CheckCircle2 size={14} color="#3b82f6" />
                <span>Quadratura cassa e situazione fatture/F24</span>
              </li>
              <li style={st.featureItem}>
                <CheckCircle2 size={14} color="#3b82f6" />
                <span>Confronto preventivo vs consuntivo automatico</span>
              </li>
            </ul>

            <button
              style={st.btnPrimary}
              onClick={() => onConfirm('condosmart', dati)}
              disabled={loading}
            >
              {loading ? 'Applicazione...' : 'Applica Modello CondoFAST'}
              <ArrowRight size={14} />
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
    maxWidth: 780,
    padding: 24,
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
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
    background: 'rgba(37, 99, 235, 0.15)',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
  },
  card: {
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 14,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  cardRecommended: {
    border: '1.5px solid #3b82f6',
    background: 'linear-gradient(180deg, rgba(37,99,235,0.06) 0%, var(--app-bg) 100%)',
  },
  recBadge: {
    position: 'absolute',
    top: -11,
    right: 16,
    background: '#2563eb',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 9px',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    letterSpacing: '0.04em',
  },
  cardHeader: {
    marginBottom: 8,
  },
  cardBadgeGray: {
    fontSize: 10.5,
    fontWeight: 600,
    color: 'var(--text-muted)',
    background: 'var(--border-color)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  cardBadgeBlue: {
    fontSize: 10.5,
    fontWeight: 600,
    color: '#60a5fa',
    background: 'rgba(37,99,235,0.15)',
    padding: '2px 8px',
    borderRadius: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '8px 0 0 0',
  },
  cardDesc: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    marginBottom: 14,
  },
  fileBox: {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  aiBox: {
    background: 'rgba(37,99,235,0.1)',
    border: '1px solid rgba(37,99,235,0.25)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  tagsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  tag: {
    fontSize: 9.5,
    fontWeight: 600,
    background: 'var(--app-bg)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    padding: '2px 6px',
    borderRadius: 4,
  },
  tagMore: {
    fontSize: 9.5,
    color: 'var(--text-muted)',
    padding: '2px 4px',
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 18px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 'auto',
  },
  featureItem: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  btnPrimary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif',
    width: '100%',
    transition: 'background 0.2s',
  },
  btnSecondary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif',
    width: '100%',
  },
}
