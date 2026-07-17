// src/components/PlanGate.jsx
import { usePlan, PIANI } from '../hooks/usePlan'
import { Zap, Building2, Rocket, Lock, Check } from 'lucide-react'

// ── Icone piani ───────────────────────────────────────────────────────────
function renderPianoIcon(piano, size = 32) {
  switch(piano) {
    case 'base': return <Zap size={size} style={{ color: '#fbbf24' }} />;
    case 'studio': return <Building2 size={size} style={{ color: '#3b82f6' }} />;
    case 'professional': return <Rocket size={size} style={{ color: '#8b5cf6' }} />;
    default: return <Lock size={size} style={{ color: 'var(--text-muted)' }} />;
  }
}

// ── Componente UpgradePrompt ──────────────────────────────────────────────
function UpgradePrompt({ feature, pianoMinimo, compact = false }) {
  const info = PIANI[pianoMinimo]

  if (compact) {
    return (
      <div style={styles.compactPrompt}>
        <Lock size={12} style={{ color: '#f59e0b', marginRight: 6 }} />
        <span style={styles.compactText}>
          Funzione {info?.label || pianoMinimo} — 
          <a href="/impostazioni#piani-abbonamento" style={styles.upgradeLink}> Aggiorna piano</a>
        </span>
      </div>
    )
  }

  return (
    <div style={styles.upgradeBox}>
      <div style={styles.upgradeIcon}>{renderPianoIcon(pianoMinimo)}</div>
      <h3 style={styles.upgradeTitle}>
        Funzione disponibile nel piano {info?.label || pianoMinimo}
      </h3>
      <p style={styles.upgradeDesc}>
        {getFeatureDesc(feature)}
      </p>
      <div style={styles.upgradeDetails}>
        <div style={styles.upgradePrice}>
          <span style={styles.priceLabel}>A partire da</span>
          <span style={styles.priceValue}>{info?.canone}€<span style={styles.pricePer}>/mese</span></span>
        </div>
        <div style={styles.upgradeFeatures}>
          {getUpgradeFeatures(pianoMinimo).map((f, i) => (
            <div key={i} style={styles.upgradeFeatureItem}>
              <Check size={14} style={{ color: '#22c55e', marginRight: 4, flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
      <a href="/impostazioni#piani-abbonamento" style={styles.upgradeBtn}>
        {feature === 'postbox_studio' ? 'Passa a Studio' : `Aggiorna a ${info?.label} →`}
      </a>
      <p style={styles.trialNote}>Sei in trial? Attiva un piano per sbloccare tutte le funzioni.</p>
    </div>
  )
}

// ── Descrizioni feature ───────────────────────────────────────────────────
function getFeatureDesc(feature) {
  const descs = {
    portale_condomino:    'Offri ai condomini un portale personale per visualizzare rate, documenti e comunicazioni — e pagare online.',
    comunicazioni_resend: 'Invia avvisi di rata, solleciti e comunicazioni personalizzate ai condomini via email.',
    pagamento_stripe:     'Permetti ai condomini di pagare le rate direttamente online con carta o SEPA.',
    rendiconto_pdf:       'Genera automaticamente il rendiconto annuale in PDF con ripartizione spese e estratto conto.',
    assemblee:            'Gestisci assemblee, presenze, deleghe, calcolo quorum e genera verbali con AI.',
    gestione_fornitori:   'Gestisci anagrafica fornitori, contratti, scadenze e storico fatture per condominio.',
    notifiche_auto:       'Invia automaticamente avvisi di rate scadute, solleciti e promemoria assemblea.',
    postbox_studio:       'Gestisci centralmente tutta la posta dello studio: ricevi spese ed estrai i dati con l\'AI, gestisci subentri anagrafici e calcola i conguagli finanziari in due tempi inviando lettere di benvenuto, e archivia la cronologia di tutte le comunicazioni ricevute dai condòmini.',
    multi_utente:         'Aggiungi fino a 5 collaboratori con ruoli personalizzati (admin, collaboratore, sola lettura).',
    api_access:           'Accedi alle API per integrare con altri software gestionali.',
  }
  return descs[feature] || 'Questa funzione è disponibile in un piano superiore.'
}

function getUpgradeFeatures(piano) {
  const features = {
    studio: [
      'Portale condomino con pagamenti Stripe',
      'Comunicazioni email via Resend',
      'Rendiconto annuale PDF automatico',
      'Assemblee e verbali AI',
      'Notifiche automatiche rate scadute',
      '500 AI calls/mese',           // ✅ concordato
      '50 condomini inclusi',        // ✅ concordato
    ],
    professional: [
      'Multi-utente fino a 5 collaboratori',
      'Gestione fornitori e contratti',
      'Alert scadenze automatici',
      'AI calls illimitate',
      'Condomini illimitati',        // ✅ concordato
      'API access + SLA dedicato',
    ],
  }
  return features[piano] || []
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPALE PlanGate
// ═══════════════════════════════════════════════════════════════════════════
/**
 * PlanGate — wrappa qualsiasi funzione e mostra UpgradePrompt se non disponibile.
 *
 * Props:
 *   feature     {string}  — nome feature da controllare (es. 'portale_condomino')
 *   compact     {boolean} — mostra prompt compatto inline invece del box completo
 *   fallback    {node}    — componente alternativo (default: UpgradePrompt)
 *   children    {node}    — contenuto da mostrare se il piano lo consente
 */
export default function PlanGate({ feature, compact = false, fallback, children }) {
  const { canUse, pianoMinimoPerFeature, loading, isTrialScaduto } = usePlan()

  if (loading) return null

  // Trial scaduto → blocca tutto tranne funzioni base
  if (isTrialScaduto && feature) {
    const pianoMinimo = pianoMinimoPerFeature(feature) || 'base'
    if (fallback) return fallback
    return <UpgradePrompt feature={feature} pianoMinimo={pianoMinimo} compact={compact} />
  }

  if (!canUse(feature)) {
    const pianoMinimo = pianoMinimoPerFeature(feature) || 'base'
    if (fallback) return fallback
    return <UpgradePrompt feature={feature} pianoMinimo={pianoMinimo} compact={compact} />
  }

  return children
}

// ── Componente badge "Piano X" da usare inline ────────────────────────────
export function PlanBadge({ piano }) {
  const colors = {
    trial:        { bg: '#1e3a5f', text: '#60a5fa', border: '#2563eb' },
    base:         { bg: '#1e3a2f', text: '#4ade80', border: '#16a34a' },
    studio:       { bg: '#2e1f5e', text: '#a78bfa', border: '#7c3aed' },
    professional: { bg: '#1e2f3a', text: '#38bdf8', border: '#0284c7' },
  }
  const c = colors[piano] || colors.base
  return (
    <span style={{
      background: c.bg, color: c.text,
      border: `1px solid ${c.border}`,
      borderRadius: 20, padding: '2px 10px',
      fontSize: 12, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      {renderPianoIcon(piano, 12)} {PIANI[piano]?.label || piano}
    </span>
  )
}


// ── Stili ─────────────────────────────────────────────────────────────────
const styles = {
  upgradeBox: {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 16,
    padding: '32px',
    textAlign: 'center',
    maxWidth: 480,
    margin: '0 auto',
  },
  upgradeIcon: { fontSize: 48, marginBottom: 16 },
  upgradeTitle: {
    color: 'var(--text-primary)', fontSize: 18, fontWeight: 700,
    margin: '0 0 10px', fontFamily: 'Sora, sans-serif',
  },
  upgradeDesc: {
    color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6,
    margin: '0 0 24px',
  },
  upgradeDetails: {
    background: 'var(--app-bg)', borderRadius: 10,
    padding: '16px 20px', marginBottom: 24,
    display: 'flex', gap: 24, alignItems: 'flex-start',
    textAlign: 'left',
  },
  upgradePrice: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    minWidth: 80,
  },
  priceLabel: { color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 },
  priceValue: { color: 'var(--text-primary)', fontSize: 28, fontWeight: 700 },
  pricePer: { fontSize: 14, color: 'var(--text-muted)' },
  upgradeFeatures: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  upgradeFeatureItem: { display: 'flex', gap: 8, alignItems: 'center' },
  upgradeBtn: {
    display: 'inline-block',
    background: '#2563eb', color: 'white',
    borderRadius: 8, padding: '10px 24px',
    fontSize: 14, fontWeight: 600,
    textDecoration: 'none',
    marginBottom: 12,
  },
  trialNote: { color: 'var(--text-muted)', fontSize: 12, margin: 0 },
  compactPrompt: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'var(--card-bg)', border: '1px solid var(--border-color)',
    borderRadius: 6, padding: '4px 10px',
  },
  lockIcon: { fontSize: 12 },
  compactText: { color: 'var(--text-muted)', fontSize: 12 },
  upgradeLink: { color: '#3b82f6', textDecoration: 'none' },
}
