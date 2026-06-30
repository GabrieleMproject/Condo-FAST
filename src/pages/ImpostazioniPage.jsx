// src/pages/ImpostazioniPage.jsx
import { useState, useEffect, useRef } from 'react'
import { usePlan, PIANI } from '../hooks/usePlan'
import { PlanBadge } from '../components/PlanGate'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

// ── Stripe Checkout ───────────────────────────────────────────────────────
async function avviaCheckout({ piano, userId, userEmail }) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ piano, userId, userEmail }),
    }
  )
  const data = await res.json()
  if (data.url) window.location.href = data.url
  else throw new Error(data.error || 'Errore creazione checkout')
}

// ── Stripe Customer Portal ────────────────────────────────────────────────
async function apriPortaleStripe(customerId) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-portal`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, returnUrl: window.location.href }),
    }
  )
  const data = await res.json()
  if (data.url) window.location.href = data.url
  else throw new Error(data.error || 'Errore apertura portale')
}

// ── Logo → data-URL PNG ridimensionato (max 400px) ────────────────────────
function fileToResizedDataUrl(file, maxW = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/png'))   // PNG: preserva trasparenza del logo
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ═══════════════════════════════════════════════════════════════════════════
export default function ImpostazioniPage() {
  const { user } = useAuth()
  const {
    piano, limiti, profile,
    isTrialActive, isTrialScaduto, trialEndsAt,
    isStripeAttivo, stripeStatus,
    condominiCount, condominiInclusi, condominiExtra, costoExtraMese,
    aiCallsCount, aiCallsLimit, aiCallsRimanenti,
    updateBranding,
    refresh,
  } = usePlan()

  const [loadingCheckout, setLoadingCheckout] = useState(null)
  const [loadingPortale, setLoadingPortale]   = useState(false)
  const [error, setError]                     = useState(null)

  // ── Branding studio ───────────────────────────────────────────────────
  const logoInputRef = useRef()
  const [branding, setBranding] = useState({
    studio_nome: '', studio_indirizzo: '', studio_contatti: '', logo_base64: '',
  })
  const [savingBranding, setSavingBranding] = useState(false)
  const [brandingSaved, setBrandingSaved]   = useState(false)
  const [brandingErr, setBrandingErr]       = useState(null)

  useEffect(() => {
    if (profile) {
      setBranding({
        studio_nome:      profile.studio_nome || '',
        studio_indirizzo: profile.studio_indirizzo || '',
        studio_contatti:  profile.studio_contatti || '',
        logo_base64:      profile.logo_base64 || '',
      })
    }
  }, [profile])

  async function onLogoSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setBrandingErr('Logo: usa PNG, JPG o WEBP.'); return
    }
    try {
      const dataUrl = await fileToResizedDataUrl(file, 400)
      setBranding(b => ({ ...b, logo_base64: dataUrl }))
      setBrandingErr(null)
    } catch {
      setBrandingErr('Impossibile elaborare il logo.')
    }
  }

  async function salvaBranding() {
    setBrandingErr(null); setSavingBranding(true)
    try {
      const res = await updateBranding(branding)
      if (res.error) throw res.error
      setBrandingSaved(true)
      setTimeout(() => setBrandingSaved(false), 2500)
    } catch (e) {
      setBrandingErr(e.message)
    } finally {
      setSavingBranding(false)
    }
  }

  // ── Avvia upgrade ─────────────────────────────────────────────────────
  const handleUpgrade = async (targetPiano) => {
    setError(null)
    setLoadingCheckout(targetPiano)
    try {
      await avviaCheckout({ piano: targetPiano, userId: user.id, userEmail: user.email })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingCheckout(null)
    }
  }

  // ── Apri portale Stripe ───────────────────────────────────────────────
  const handlePortale = async () => {
    setError(null)
    setLoadingPortale(true)
    try {
      await apriPortaleStripe(profile?.stripe_customer_id)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingPortale(false)
    }
  }

  // ── Giorni rimasti trial ──────────────────────────────────────────────
  const giorniTrialRimasti = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>Impostazioni</h1>
          <p style={styles.subtitle}>Gestisci il tuo piano e la fatturazione</p>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        {/* ── PIANO ATTIVO ─────────────────────────────────────────── */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Piano attivo</h2>

          <div style={styles.pianoCard}>
            <div style={styles.pianoTop}>
              <div>
                <div style={styles.pianoNome}>
                  <PlanBadge piano={piano} />
                  {isTrialActive && (
                    <span style={styles.trialBadge}>
                      Trial — {giorniTrialRimasti} giorni rimasti
                    </span>
                  )}
                  {isTrialScaduto && (
                    <span style={styles.scadutoBadge}>Trial scaduto</span>
                  )}
                </div>
                <p style={styles.pianoDesc}>
                  {isTrialActive
                    ? 'Stai usando il piano Studio completo. Attiva un piano per continuare dopo il trial.'
                    : isStripeAttivo
                    ? `Piano attivo · ${limiti.canone}€/mese`
                    : 'Nessun piano attivo'}
                </p>
              </div>
              {isStripeAttivo && (
                <div style={styles.stripeStatus}>
                  <span style={styles.statusDot} />
                  <span style={{ color: '#4ade80', fontSize: 13 }}>Abbonamento attivo</span>
                </div>
              )}
            </div>

            {/* KPI piano */}
            <div style={styles.kpiGrid}>
              <div style={styles.kpiCard}>
                <span style={styles.kpiLabel}>Condomini</span>
                <span style={styles.kpiValue}>
                  {condominiCount}
                  <span style={styles.kpiSub}>/ {condominiInclusi === null ? '∞' : condominiInclusi} inclusi</span>
                </span>
                {condominiExtra > 0 && (
                  <span style={styles.kpiExtra}>+{condominiExtra} extra (+{costoExtraMese}€/mese)</span>
                )}
              </div>

              <div style={styles.kpiCard}>
                <span style={styles.kpiLabel}>AI calls questo mese</span>
                <span style={styles.kpiValue}>
                  {aiCallsCount}
                  <span style={styles.kpiSub}>
                    {aiCallsLimit === null ? '/ ∞' : `/ ${aiCallsLimit}`}
                  </span>
                </span>
                {aiCallsLimit !== null && (
                  <div style={styles.progressBar}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${Math.min(100, (aiCallsCount / aiCallsLimit) * 100)}%`,
                        background: aiCallsCount / aiCallsLimit > 0.8 ? '#ef4444' : '#2563eb',
                      }}
                    />
                  </div>
                )}
              </div>

              <div style={styles.kpiCard}>
                <span style={styles.kpiLabel}>Costo extra mese corrente</span>
                <span style={styles.kpiValue}>
                  {costoExtraMese > 0 ? `${costoExtraMese}€` : '—'}
                </span>
                {costoExtraMese > 0 && (
                  <span style={styles.kpiExtra}>{condominiExtra} cond. × {limiti.extra_per_cond}€</span>
                )}
              </div>

              <div style={styles.kpiCard}>
                <span style={styles.kpiLabel}>Stato Stripe</span>
                <span style={{ ...styles.kpiValue, fontSize: 14, textTransform: 'capitalize' }}>
                  {stripeStatus || 'inactive'}
                </span>
              </div>
            </div>

            {/* Azioni piano */}
            <div style={styles.pianoActions}>
              {isStripeAttivo && profile?.stripe_customer_id && (
                <button
                  style={styles.btnPortale}
                  onClick={handlePortale}
                  disabled={loadingPortale}
                >
                  {loadingPortale ? 'Caricamento…' : '⚙️ Gestisci fatturazione e metodo pagamento'}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── STUDIO / BRANDING ────────────────────────────────────── */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Studio / Branding documenti</h2>
          <p style={{ ...styles.subtitle, marginTop: -8, marginBottom: 16 }}>
            Logo e intestazione usati su consuntivi e documenti esportati (PDF/XLS).
          </p>

          <div style={styles.brandingCard}>
            <div style={styles.brandingGrid}>
              {/* Logo */}
              <div>
                <label style={styles.brandingLabel}>Logo studio</label>
                <div style={styles.logoBox}>
                  {branding.logo_base64
                    ? <img src={branding.logo_base64} alt="Logo studio" style={styles.logoImg} />
                    : <span style={{ color: '#475569', fontSize: 12 }}>Nessun logo</span>}
                </div>
                <input
                  ref={logoInputRef} type="file" accept=".png,.jpg,.jpeg,.webp"
                  style={{ display: 'none' }} onChange={onLogoSelected}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button style={styles.brandingBtnGhost} onClick={() => logoInputRef.current?.click()}>
                    {branding.logo_base64 ? 'Cambia logo' : 'Carica logo'}
                  </button>
                  {branding.logo_base64 && (
                    <button
                      style={styles.brandingBtnGhost}
                      onClick={() => setBranding(b => ({ ...b, logo_base64: '' }))}
                    >
                      Rimuovi
                    </button>
                  )}
                </div>
                <div style={{ color: '#475569', fontSize: 11, marginTop: 6 }}>
                  PNG/JPG/WEBP · ridimensionato a 400px
                </div>
              </div>

              {/* Campi testuali */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={styles.brandingLabel}>Nome studio / amministratore</label>
                  <input
                    style={styles.brandingInput}
                    placeholder="Es. Amministrazione Gemelli di Rag. Andrea Gemelli"
                    value={branding.studio_nome}
                    onChange={e => setBranding(b => ({ ...b, studio_nome: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={styles.brandingLabel}>Indirizzo</label>
                  <input
                    style={styles.brandingInput}
                    placeholder="Es. Via Canturina n° 88 – 22100 Como (CO)"
                    value={branding.studio_indirizzo}
                    onChange={e => setBranding(b => ({ ...b, studio_indirizzo: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={styles.brandingLabel}>Contatti (tel / email / PEC / P.IVA)</label>
                  <textarea
                    style={{ ...styles.brandingInput, minHeight: 80, resize: 'vertical' }}
                    placeholder={'Mobile: +39 333 1861413\ne-mail: info@...\nPEC: ...\nP.IVA: ...'}
                    value={branding.studio_contatti}
                    onChange={e => setBranding(b => ({ ...b, studio_contatti: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {brandingErr && <div style={{ ...styles.errorBox, marginTop: 16, marginBottom: 0 }}>{brandingErr}</div>}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
              {brandingSaved && <span style={{ color: '#4ade80', fontSize: 13 }}>✓ Salvato</span>}
              <button style={styles.brandingBtnSave} onClick={salvaBranding} disabled={savingBranding}>
                {savingBranding ? 'Salvataggio…' : 'Salva branding'}
              </button>
            </div>
          </div>
        </section>

        {/* ── UPGRADE PIANI ────────────────────────────────────────── */}
        {(isTrialActive || isTrialScaduto || piano !== 'professional') && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>
              {isTrialActive || isTrialScaduto ? 'Scegli il tuo piano' : 'Cambia piano'}
            </h2>

            <div style={styles.pianiGrid}>
              {Object.entries(PIANI)
                .filter(([key]) => key !== 'trial')
                .map(([key, info]) => (
                  <div
                    key={key}
                    style={{
                      ...styles.pianoOption,
                      ...(key === piano && isStripeAttivo ? styles.pianoOptionActive : {}),
                      ...(key === 'studio' ? styles.pianoOptionFeatured : {}),
                    }}
                  >
                    {key === 'studio' && (
                      <div style={styles.featuredBadge}>Più scelto</div>
                    )}

                    <div style={styles.pianoOptionHeader}>
                      <span style={styles.pianoOptionNome}>{info.label}</span>
                      <div style={styles.pianoOptionPrezzo}>
                        <span style={styles.prezzoValore}>{info.canone}€</span>
                        <span style={styles.prezzoMese}>/mese</span>
                      </div>
                      <p style={styles.pianoOptionSub}>
                        {info.condomini_inclusi} condomini inclusi
                        {info.extra_per_cond > 0 && ` · +${info.extra_per_cond}€/cond. extra`}
                      </p>
                    </div>

                    <div style={styles.pianoOptionFeatures}>
                      <FeatureRow ok label={`${info.ai_calls_mese ?? '∞'} AI calls/mese`} />
                      <FeatureRow ok={info.portale_condomino} label="Portale condomino" />
                      <FeatureRow ok={info.rendiconto_pdf} label="Rendiconto PDF automatico" />
                      <FeatureRow ok={info.assemblee} label="Assemblee e verbali AI" />
                      <FeatureRow ok={info.multi_utente} label={`Multi-utente${info.max_collaboratori ? ` (${info.max_collaboratori} collab.)` : ''}`} />
                      <FeatureRow ok={info.api_access} label="API access" />
                    </div>

                    {/* SEPA sconto */}
                    {(key === 'studio' || key === 'professional') && (
                      <div style={styles.sepaHint}>
                        💳 -5€/mese con addebito SEPA
                      </div>
                    )}

                    {key === piano && isStripeAttivo ? (
                      <div style={styles.pianoAttivoLabel}>✓ Piano attuale</div>
                    ) : (
                      <button
                        style={styles.btnUpgrade}
                        onClick={() => handleUpgrade(key)}
                        disabled={loadingCheckout === key}
                      >
                        {loadingCheckout === key
                          ? 'Caricamento…'
                          : isTrialActive || isTrialScaduto
                          ? `Attiva ${info.label}`
                          : key === 'professional' || info.canone > limiti.canone
                          ? `Passa a ${info.label}`
                          : `Passa a ${info.label}`}
                      </button>
                    )}
                  </div>
                ))}
            </div>

            <p style={styles.trialNote}>
              🔒 Pagamento sicuro via Stripe · Carta EU e SEPA Debit accettati · Disdici quando vuoi
            </p>
          </section>
        )}

        {/* ── INFO ACCOUNT ─────────────────────────────────────────── */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Account</h2>
          <div style={styles.infoCard}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Email</span>
              <span style={styles.infoValue}>{user?.email}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>ID account</span>
              <span style={{ ...styles.infoValue, fontFamily: 'monospace', fontSize: 12 }}>
                {user?.id}
              </span>
            </div>
            {profile?.dpa_accepted_at && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>DPA accettato</span>
                <span style={styles.infoValue}>
                  {new Date(profile.dpa_accepted_at).toLocaleDateString('it-IT')}
                </span>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}

// ── Componente riga feature ───────────────────────────────────────────────
function FeatureRow({ ok, label }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
      <span style={{ color: ok ? '#22c55e' : '#475569', fontSize: 13 }}>
        {ok ? '✓' : '✗'}
      </span>
      <span style={{ color: ok ? '#94a3b8' : '#475569', fontSize: 13 }}>{label}</span>
    </div>
  )
}

// ── Stili ─────────────────────────────────────────────────────────────────
const styles = {
  page: { minHeight: '100vh', background: '#0f172a', padding: '32px 24px' },
  container: { maxWidth: 960, margin: '0 auto' },
  header: { marginBottom: 32 },
  title: { color: '#e2e8f0', fontSize: 28, fontWeight: 700, margin: '0 0 6px', fontFamily: 'Sora, sans-serif' },
  subtitle: { color: '#64748b', fontSize: 15, margin: 0 },
  errorBox: {
    background: '#450a0a', border: '1px solid #991b1b', color: '#fca5a5',
    borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 14,
  },
  section: { marginBottom: 40 },
  sectionTitle: { color: '#94a3b8', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' },
  pianoCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24 },
  pianoTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pianoNome: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 },
  pianoDesc: { color: '#64748b', fontSize: 14, margin: 0 },
  trialBadge: { background: '#1e3a5f', color: '#60a5fa', border: '1px solid #2563eb', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 },
  scadutoBadge: { background: '#450a0a', color: '#f87171', border: '1px solid #991b1b', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 },
  stripeStatus: { display: 'flex', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: '50%', background: '#4ade80' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 },
  kpiCard: { background: '#0f172a', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 },
  kpiLabel: { color: '#64748b', fontSize: 12 },
  kpiValue: { color: '#e2e8f0', fontSize: 22, fontWeight: 700 },
  kpiSub: { color: '#475569', fontSize: 13, fontWeight: 400 },
  kpiExtra: { color: '#f59e0b', fontSize: 11 },
  progressBar: { height: 4, background: '#1e293b', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, transition: 'width 0.3s' },
  pianoActions: { display: 'flex', gap: 12 },
  btnPortale: {
    background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
    borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer',
  },
  // ── Branding ──
  brandingCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24 },
  brandingGrid: { display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'start' },
  brandingLabel: { display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 },
  brandingInput: {
    width: '100%', background: '#0f172a', color: '#f1f5f9',
    border: '1px solid #334155', borderRadius: 8, padding: '10px 12px',
    fontSize: 14, fontFamily: 'Sora, sans-serif', boxSizing: 'border-box',
  },
  logoBox: {
    width: '100%', height: 110, background: '#0f172a', border: '1px solid #334155',
    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  logoImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  brandingBtnGhost: {
    background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
    borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'Sora, sans-serif',
  },
  brandingBtnSave: {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif',
  },
  pianiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 },
  pianoOption: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 16,
    padding: 24, position: 'relative', display: 'flex', flexDirection: 'column',
  },
  pianoOptionActive: { border: '2px solid #2563eb' },
  pianoOptionFeatured: { border: '1px solid #7c3aed' },
  featuredBadge: {
    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
    background: '#7c3aed', color: 'white', borderRadius: 20, padding: '2px 12px',
    fontSize: 12, fontWeight: 600,
  },
  pianoOptionHeader: { marginBottom: 20 },
  pianoOptionNome: { color: '#e2e8f0', fontSize: 18, fontWeight: 700, fontFamily: 'Sora, sans-serif' },
  pianoOptionPrezzo: { display: 'flex', alignItems: 'baseline', gap: 2, margin: '8px 0 4px' },
  prezzoValore: { color: '#e2e8f0', fontSize: 32, fontWeight: 700 },
  prezzoMese: { color: '#64748b', fontSize: 14 },
  pianoOptionSub: { color: '#64748b', fontSize: 12, margin: 0 },
  pianoOptionFeatures: { flex: 1, marginBottom: 16 },
  sepaHint: { color: '#fbbf24', fontSize: 12, marginBottom: 12 },
  btnUpgrade: {
    background: '#2563eb', color: 'white', border: 'none', borderRadius: 8,
    padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%',
  },
  pianoAttivoLabel: {
    textAlign: 'center', color: '#4ade80', fontSize: 14,
    fontWeight: 600, padding: '11px 0',
  },
  trialNote: { color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 16 },
  infoCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '4px 0' },
  infoRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 20px', borderBottom: '1px solid #1e293b',
  },
  infoLabel: { color: '#64748b', fontSize: 14 },
  infoValue: { color: '#e2e8f0', fontSize: 14 },
}