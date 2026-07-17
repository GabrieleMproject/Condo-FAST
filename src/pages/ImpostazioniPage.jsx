// src/pages/ImpostazioniPage.jsx
import { useState, useEffect, useRef } from 'react'
import { usePlan, PIANI } from '../hooks/usePlan'
import { useCondomini } from '../hooks/useCondomini'
import { PlanBadge } from '../components/PlanGate'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import { generaExportGDPR } from '../lib/exportDatiGdpr'
import { Settings, Check, Trash2, AlertTriangle, CreditCard, Lock, Bell, Gift, Copy, ExternalLink, Sun, Moon, Building2 } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

// ── Stripe Checkout ───────────────────────────────────────────────────────
async function avviaCheckout({ piano, userId, userEmail }) {
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: { piano, userId, userEmail },
  })
  if (error) throw new Error(error.message || 'Errore creazione checkout')
  if (data?.url) window.location.href = data.url
  else throw new Error(data?.error || 'Errore creazione checkout')
}

// ── Stripe Customer Portal ────────────────────────────────────────────────
async function apriPortaleStripe(customerId) {
  const { data, error } = await supabase.functions.invoke('stripe-portal', {
    body: { customerId, returnUrl: window.location.href },
  })
  if (error) throw new Error(error.message || 'Errore apertura portale')
  if (data?.url) window.location.href = data.url
  else throw new Error(data?.error || 'Errore apertura portale')
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

// ── Configurazione Notifiche & Promemoria default ────────────────────────
const DEFAULT_NOTIFICHE = {
  f24_ritenute:               { enabled: true },
  rate_scadute:               { enabled: true,  giorni_dopo_scadenza: 10 },
  esercizio_in_scadenza:      { enabled: true,  giorni_prima: 30 },
  movimenti_non_riconciliati: { enabled: false, giorni_tolleranza: 15 },
}

// ═══════════════════════════════════════════════════════════════════════════
export default function ImpostazioniPage() {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const {
    piano, limiti, profile,
    isTrialActive, isTrialScaduto, trialEndsAt,
    isStripeAttivo, stripeStatus,
    condominiCount, condominiInclusi, condominiExtra, costoExtraMese,
    aiCallsCount, aiCallsLimit, aiCallsRimanenti,
    updateBranding,
    refresh,
    isCollaboratore,
  } = usePlan()

  const [loadingCheckout, setLoadingCheckout] = useState(null)
  const [loadingPortale, setLoadingPortale]   = useState(false)
  const [error, setError]                     = useState(null)

  // Stati Collaboratori
  const [collaboratori, setCollaboratori] = useState([])
  const [emailNuovoCollab, setEmailNuovoCollab] = useState('')
  const [savingCollab, setSavingCollab] = useState(false)
  const [collabErr, setCollabErr] = useState(null)
  const [collabSuccess, setCollabSuccess] = useState(null)
  const [selectedCollabForCondos, setSelectedCollabForCondos] = useState(null)

  // Stati Referral Program
  const [userReferrals, setUserReferrals] = useState([])
  const [activeCampagna, setActiveCampagna] = useState(null)
  const [loadingReferrals, setLoadingReferrals] = useState(true)
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    if (user?.id) {
      fetchReferralData()
      if (!isCollaboratore) {
        fetchCollaboratori()
      }
    }
  }, [user, isCollaboratore])

  async function fetchCollaboratori() {
    try {
      const { data, error: err } = await supabase
        .from('collaboratori_studio')
        .select('*')
        .eq('amministratore_id', user.id)
        .order('created_at', { ascending: false })
      if (err) throw err
      setCollaboratori(data || [])
    } catch (e) {
      console.error('Errore caricamento collaboratori:', e)
    }
  }

  async function fetchReferralData() {
    try {
      const { data: refs, error: refsErr } = await supabase
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (refsErr) throw refsErr
      setUserReferrals(refs || [])

      const { data: camp, error: campErr } = await supabase
        .from('referral_campaigns')
        .select('*')
        .eq('attiva', true)
        .maybeSingle()

      if (campErr) throw campErr
      setActiveCampagna(camp || null)
    } catch (e) {
      console.error('Errore caricamento dati referral:', e)
    } finally {
      setLoadingReferrals(false)
    }
  }

  function formattaEmailMascherata(email) {
    if (!email) return ''
    const parts = email.split('@')
    if (parts.length !== 2) return email
    const name = parts[0]
    const domain = parts[1]
    
    let maskedName = ''
    if (name.length <= 2) {
      maskedName = `${name[0]}***`
    } else {
      maskedName = `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}`
    }

    const domParts = domain.split('.')
    let maskedDomain = domain
    if (domParts.length >= 2) {
      const domName = domParts[0]
      const domExt = domParts.slice(1).join('.')
      let maskedDomName = ''
      if (domName.length <= 2) {
        maskedDomName = `${domName[0]}***`
      } else {
        maskedDomName = `${domName[0]}${'*'.repeat(domName.length - 2)}${domName[domName.length - 1]}`
      }
      maskedDomain = `${maskedDomName}.${domExt}`
    }

    return `${maskedName}@${maskedDomain}`
  }

  // Stati GDPR Oblio e Portabilità
  const [isExporting, setIsExporting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmWord, setDeleteConfirmWord] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  // ── Branding studio ───────────────────────────────────────────────────
  const logoInputRef = useRef()
  const [branding, setBranding] = useState({
    studio_nome: '', studio_indirizzo: '', studio_contatti: '', logo_base64: '',
    ragione_sociale: '', partita_iva: '', codice_fiscale: '',
  })
  const [savingBranding, setSavingBranding] = useState(false)
  const [brandingSaved, setBrandingSaved]   = useState(false)
  const [brandingErr, setBrandingErr]       = useState(null)

  // ── Configurazione Email ──────────────────────────────────────────────
  const [emailConfig, setEmailConfig] = useState({
    mail_invio_tipo: 'sistema',
    mail_mittente_email: '',
    mail_mittente_nome: '',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    resend_api_key: '',
  })
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailSaved, setEmailSaved]   = useState(false)
  const [emailErr, setEmailErr]       = useState(null)

  // ── Configurazione Partner Postale ──────────────────────────────────────
  const [partnerConfig, setPartnerConfig] = useState({
    partner_postale_nome: 'nessuno',
    partner_postale_api_key: '',
    partner_postale_mittente_id: '',
  })
  const [savingPartner, setSavingPartner] = useState(false)
  const [partnerSaved, setPartnerSaved]   = useState(false)
  const [partnerErr, setPartnerErr]       = useState(null)

  // ── Configurazione Notifiche & Promemoria ────────────────────────────────
  const [notificheConfig, setNotificheConfig] = useState(DEFAULT_NOTIFICHE)
  const [savingNotifiche, setSavingNotifiche] = useState(false)
  const [notificheSaved, setNotificheSaved]   = useState(false)
  const [notificheErr, setNotificheErr]       = useState(null)

  useEffect(() => {
    if (profile) {
      setBranding({
        studio_nome:      profile.studio_nome || '',
        studio_indirizzo: profile.studio_indirizzo || '',
        studio_contatti:  profile.studio_contatti || '',
        logo_base64:      profile.logo_base64 || '',
        ragione_sociale:  profile.ragione_sociale || '',
        partita_iva:      profile.partita_iva || '',
        codice_fiscale:   profile.codice_fiscale || '',
      })
      setEmailConfig({
        mail_invio_tipo:  profile.mail_invio_tipo || 'sistema',
        mail_mittente_email: profile.mail_mittente_email || '',
        mail_mittente_nome:  profile.mail_mittente_nome || '',
        smtp_host:        profile.smtp_host || '',
        smtp_port:        profile.smtp_port || '587',
        smtp_user:        profile.smtp_user || '',
        smtp_password:    profile.smtp_password || '',
        resend_api_key:   profile.resend_api_key || '',
      })
      setPartnerConfig({
        partner_postale_nome: profile.partner_postale_nome || 'nessuno',
        partner_postale_api_key: profile.partner_postale_api_key || '',
        partner_postale_mittente_id: profile.partner_postale_mittente_id || '',
      })
      // Carica impostazioni notifiche con fallback ai default
      if (profile.notification_settings) {
        setNotificheConfig(prev => ({
          ...DEFAULT_NOTIFICHE,
          ...profile.notification_settings,
        }))
      }
    }
  }, [profile])

  useEffect(() => {
    if (window.location.hash === '#piani-abbonamento') {
      const timer = setTimeout(() => {
        const element = document.getElementById('piani-abbonamento')
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' })
        }
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [])

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

  async function salvaEmailConfig() {
    setEmailErr(null); setSavingEmail(true)
    try {
      const res = await updateBranding(emailConfig)
      if (res.error) throw res.error
      setEmailSaved(true)
      setTimeout(() => setEmailSaved(false), 2500)
    } catch (e) {
      setEmailErr(e.message)
    } finally {
      setSavingEmail(false)
    }
  }

  async function salvaPartnerConfig() {
    setPartnerErr(null); setSavingPartner(true)
    try {
      const res = await updateBranding(partnerConfig)
      if (res.error) throw res.error
      setPartnerSaved(true)
      setTimeout(() => setPartnerSaved(false), 2500)
    } catch (e) {
      setPartnerErr(e.message)
    } finally {
      setSavingPartner(false)
    }
  }

  async function salvaNotificheConfig() {
    setNotificheErr(null); setSavingNotifiche(true)
    try {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) throw new Error('Utente non autenticato')
      const { error } = await supabase
        .from('profiles')
        .update({ notification_settings: notificheConfig })
        .eq('id', u.id)
      if (error) throw error
      await refresh()
      setNotificheSaved(true)
      setTimeout(() => setNotificheSaved(false), 2500)
    } catch (e) {
      setNotificheErr(e.message)
    } finally {
      setSavingNotifiche(false)
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

  async function aggiungiCollaboratore(e) {
    if (e) e.preventDefault()
    setCollabErr(null)
    setCollabSuccess(null)
    if (!emailNuovoCollab.trim()) return

    const maxCollab = limiti.max_collaboratori || 0
    if (collaboratori.length >= maxCollab) {
      setCollabErr(`Hai raggiunto il limite massimo di collaboratori (${maxCollab}) per il tuo piano attuale. Fai l'upgrade per aggiungere altre utenze.`)
      return
    }

    setSavingCollab(true)
    try {
      // Tenta di cercare se esiste già un profilo utente con questa email
      const { data: utenteEsistente } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', emailNuovoCollab.trim().toLowerCase())
        .maybeSingle()

      const { error: err } = await supabase
        .from('collaboratori_studio')
        .insert({
          amministratore_id: user.id,
          email_collaboratore: emailNuovoCollab.trim().toLowerCase(),
          utente_id: utenteEsistente ? utenteEsistente.id : null,
          attivo: true
        })

      if (err) {
        if (err.code === '23505') {
          throw new Error('Questo collaboratore è già stato invitato o aggiunto al tuo studio.')
        }
        throw err
      }

      setCollabSuccess('Collaboratore aggiunto con successo! Potrà accedere usando la sua email.')
      setEmailNuovoCollab('')
      await fetchCollaboratori()
    } catch (err) {
      setCollabErr(err.message)
    } finally {
      setSavingCollab(false)
    }
  }

  async function eliminaCollaboratore(id) {
    if (!window.confirm('Sei sicuro di voler rimuovere questo collaboratore dallo studio?')) return
    try {
      const { error: err } = await supabase
        .from('collaboratori_studio')
        .delete()
        .eq('id', id)
        .eq('amministratore_id', user.id)
      if (err) throw err
      toast.success('Collaboratore rimosso.')
      await fetchCollaboratori()
    } catch (e) {
      toast.error('Errore durante la rimozione: ' + e.message)
    }
  }

  // ── GDPR Handlers ─────────────────────────────────────────────────────
  const handleExportGDPR = async () => {
    setIsExporting(true)
    try {
      await generaExportGDPR()
      toast.success('Dati esportati con successo!')
    } catch (e) {
      toast.error('Errore durante l\'esportazione dati: ' + e.message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmWord !== 'ELIMINA') {
      toast.error('Devi digitare ELIMINA per confermare.')
      return
    }
    setIsDeletingAccount(true)
    try {
      const { data, error } = await supabase.functions.invoke('delete-account')
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      
      toast.success('Account eliminato. Addio!')
      setTimeout(() => {
        supabase.auth.signOut()
        window.location.href = '/'
      }, 2000)
    } catch (e) {
      toast.error('Errore durante l\'eliminazione: ' + e.message)
      setIsDeletingAccount(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>Impostazioni</h1>
          <p style={styles.subtitle}>
            {isCollaboratore ? 'Gestisci il tuo profilo account' : 'Gestisci il tuo piano e la fatturazione'}
          </p>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        {isCollaboratore && (
          <section style={styles.section}>
            <div style={styles.brandingCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Lock size={20} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 16 }}>Account Collaboratore</h3>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
                Questo account è associato come collaboratore dello studio. Le impostazioni di fatturazione, branding e abbonamento sono gestite direttamente dall'amministratore principale.
              </p>
            </div>
          </section>
        )}

        {!isCollaboratore && (
          <>
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
                  {loadingPortale ? 'Caricamento…' : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Settings size={14} /> Gestisci fatturazione e metodo pagamento
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── REFERRAL PROGRAM / PORTA UN AMICO ────────────────────────── */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Porta un amico</h2>
          <p style={{ ...styles.subtitle, marginTop: -8, marginBottom: 16 }}>
            Invita un collega ad iscriversi a CondoSmart. Ricevi uno sconto sulla tua prossima fatturazione per ogni amico abbonato.
          </p>

          <div style={styles.brandingCard}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Box Campagna Attiva */}
              {activeCampagna ? (
                <div style={{ background: 'var(--card-bg)', border: '1px dashed #3b82f6', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: '#1e3a8a', padding: 10, borderRadius: 8, color: '#3b82f6' }}>
                    <Gift size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Campagna Promozionale Attiva: {activeCampagna.nome}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Ottieni <strong style={{ color: '#10b981' }}>{activeCampagna.sconto_importo}€</strong> di sconto sul tuo abbonamento per ogni amministratore invitato che attiva un piano.
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: 'var(--border-color)', padding: 10, borderRadius: 8, color: 'var(--text-secondary)' }}>
                    <Gift size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Nessuna campagna attiva al momento
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Puoi comunque condividere il tuo link di invito. Gli sconti verranno applicati in base alle future campagne promozionali.
                    </div>
                  </div>
                </div>
              )}

              {/* Link di invito */}
              <div>
                <label style={styles.brandingLabel}>Il tuo link di invito unico</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/register?ref=${profile?.referral_code || ''}`}
                    style={{ ...styles.brandingInput, flex: 1, fontFamily: 'monospace', color: '#3b82f6', background: 'var(--input-bg)' }}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/register?ref=${profile?.referral_code || ''}`)
                      setCopiedLink(true)
                      toast.success('Link copiato negli appunti!')
                      setTimeout(() => setCopiedLink(false), 2000)
                    }}
                    style={{
                      ...styles.brandingBtn,
                      background: copiedLink ? '#10b981' : '#2563eb',
                      width: 120,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                    {copiedLink ? 'Copiato' : 'Copia'}
                  </button>
                </div>
              </div>

              {/* Tabella Storico Inviti */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Storico dei tuoi inviti</h3>
                
                {loadingReferrals ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '10px 0' }}>Caricamento inviti...</div>
                ) : userReferrals.length > 0 ? (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--app-bg)', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Amico Invitato</th>
                          <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Stato</th>
                          <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Sconto Valore</th>
                          <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Invitato il</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userReferrals.map(ref => (
                          <tr key={ref.id} style={{ borderBottom: '1px solid var(--border-color-2)' }}>
                            <td style={{ padding: '12px', fontSize: 13, color: 'var(--text-primary)' }}>
                              {formattaEmailMascherata(ref.referred_email)}
                            </td>
                            <td style={{ padding: '12px', fontSize: 13 }}>
                              {ref.stato === 'registrato' && (
                                <span style={{ color: 'var(--text-muted)', background: 'var(--border-color-2)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>Registrato</span>
                              )}
                              {ref.stato === 'convalidato' && (
                                <span style={{ color: 'var(--accent)', background: 'var(--accent-glow)', border: '1px solid var(--accent)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>Abbonato (In attesa)</span>
                              )}
                              {ref.stato === 'applicato' && (
                                <span style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.15)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>Sconto Applicato</span>
                              )}
                            </td>
                            <td style={{ padding: '12px', fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                              {ref.sconto_valore}€
                            </td>
                            <td style={{ padding: '12px', fontSize: 12, color: 'var(--text-muted)' }}>
                              {new Date(ref.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ background: 'var(--app-bg)', padding: 20, borderRadius: 8, textAlign: 'center', border: '1px solid var(--border-color-2)' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Non hai ancora invitato nessun amico. Condividi il tuo link per iniziare a risparmiare!</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </section>

        {/* ── ASPETTO & TEMA ───────────────────────────────────────── */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Aspetto &amp; Tema</h2>
          <p style={{ ...styles.subtitle, marginTop: -8, marginBottom: 16 }}>
            Personalizza l'interfaccia grafica di CondoSmart scegliendo tra il tema chiaro e il tema scuro.
          </p>

          <div style={styles.brandingCard}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {/* Opzione Scuro */}
              <div
                onClick={() => setTheme('dark')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: 20,
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: theme === 'dark' ? '2px solid #2563eb' : '1px solid var(--border-color)',
                  background: theme === 'dark' ? 'rgba(37, 99, 235, 0.05)' : 'var(--app-bg)',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{
                  background: 'var(--border-color-2)',
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme === 'dark' ? '#60a5fa' : 'var(--text-secondary)',
                  flexShrink: 0,
                }}>
                  <Moon size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>Tema Scuro</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Ottimizzato per ambienti con poca luce</div>
                </div>
              </div>

              {/* Opzione Chiaro */}
              <div
                onClick={() => setTheme('light')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: 20,
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: theme === 'light' ? '2px solid #2563eb' : '1px solid var(--border-color)',
                  background: theme === 'light' ? 'rgba(37, 99, 235, 0.05)' : 'var(--app-bg)',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{
                  background: 'var(--border-color-2)',
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme === 'light' ? '#d97706' : 'var(--text-secondary)',
                  flexShrink: 0,
                }}>
                  <Sun size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>Tema Chiaro</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Massima leggibilità durante il giorno</div>
                </div>
              </div>
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
                    : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nessun logo</span>}
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
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6 }}>
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
                  <label style={styles.brandingLabel}>Ragione Sociale Azienda</label>
                  <input
                    style={styles.brandingInput}
                    placeholder="Ragione Sociale dell'azienda di gestione"
                    value={branding.ragione_sociale}
                    onChange={e => setBranding(b => ({ ...b, ragione_sociale: e.target.value }))}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.brandingLabel}>Partita IVA</label>
                    <input
                      style={styles.brandingInput}
                      placeholder="Numero P.IVA"
                      value={branding.partita_iva}
                      onChange={e => setBranding(b => ({ ...b, partita_iva: e.target.value }))}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.brandingLabel}>Codice Fiscale</label>
                    <input
                      style={styles.brandingInput}
                      placeholder="Codice Fiscale"
                      value={branding.codice_fiscale}
                      onChange={e => setBranding(b => ({ ...b, codice_fiscale: e.target.value }))}
                    />
                  </div>
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
              {brandingSaved && <span style={{ color: '#4ade80', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={14} /> Salvato</span>}
              <button style={styles.brandingBtnSave} onClick={salvaBranding} disabled={savingBranding}>
                {savingBranding ? 'Salvataggio…' : 'Salva branding'}
              </button>
            </div>
          </div>
        </section>

        {/* ── CONFIGURAZIONE INVIO EMAIL ───────────────────────────────── */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Configurazione invio e-mail</h2>
          <p style={{ ...styles.subtitle, marginTop: -8, marginBottom: 16 }}>
            Configura come vengono inviati i solleciti e gli avvisi condominiali (SMTP o Resend personalizzato).
          </p>

          <div style={styles.brandingCard}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={styles.brandingLabel}>Canale di invio</label>
                <select
                  style={styles.brandingInput}
                  value={emailConfig.mail_invio_tipo}
                  onChange={e => setEmailConfig(c => ({ ...c, mail_invio_tipo: e.target.value }))}
                >
                  <option value="sistema">Sistema CondoSmart (Default, onboarding@resend.dev)</option>
                  <option value="smtp">SMTP Personalizzato (Consigliato per caselle proprie)</option>
                  <option value="resend_custom">Resend Personalizzato (Richiede API Key & Dominio proprio)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={styles.brandingLabel}>Nome Mittente</label>
                  <input
                    style={styles.brandingInput}
                    placeholder="Es. Studio Rossi"
                    value={emailConfig.mail_mittente_nome}
                    onChange={e => setEmailConfig(c => ({ ...c, mail_mittente_nome: e.target.value }))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.brandingLabel}>Email Mittente / Alias</label>
                  <input
                    style={styles.brandingInput}
                    placeholder="Es. studio@studioamministratore.it"
                    value={emailConfig.mail_mittente_email}
                    onChange={e => setEmailConfig(c => ({ ...c, mail_mittente_email: e.target.value }))}
                  />
                </div>
              </div>

              {emailConfig.mail_invio_tipo === 'smtp' && (
                <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '0 0 4px', fontWeight: 700, letterSpacing: '0.05em' }}>PARAMETRI SERVER SMTP</p>
                  
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 2 }}>
                      <label style={styles.brandingLabel}>Host SMTP</label>
                      <input
                        style={styles.brandingInput}
                        placeholder="Es. smtp.studioamministratore.it"
                        value={emailConfig.smtp_host}
                        onChange={e => setEmailConfig(c => ({ ...c, smtp_host: e.target.value }))}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.brandingLabel}>Porta SMTP</label>
                      <input
                        style={styles.brandingInput}
                        type="number"
                        placeholder="Es. 587"
                        value={emailConfig.smtp_port}
                        onChange={e => setEmailConfig(c => ({ ...c, smtp_port: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.brandingLabel}>Username SMTP</label>
                      <input
                        style={styles.brandingInput}
                        placeholder="Username o email di accesso"
                        value={emailConfig.smtp_user}
                        onChange={e => setEmailConfig(c => ({ ...c, smtp_user: e.target.value }))}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.brandingLabel}>Password SMTP</label>
                      <input
                        style={styles.brandingInput}
                        type="password"
                        placeholder="••••••••••••"
                        value={emailConfig.smtp_password}
                        onChange={e => setEmailConfig(c => ({ ...c, smtp_password: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {emailConfig.mail_invio_tipo === 'resend_custom' && (
                <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '0 0 4px', fontWeight: 700, letterSpacing: '0.05em' }}>PARAMETRI RESEND</p>
                  <div>
                    <label style={styles.brandingLabel}>API Key Resend Personalizzata</label>
                    <input
                      style={styles.brandingInput}
                      type="password"
                      placeholder="re_••••••••••••"
                      value={emailConfig.resend_api_key}
                      onChange={e => setEmailConfig(c => ({ ...c, resend_api_key: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {emailErr && <div style={{ ...styles.errorBox, marginTop: 16, marginBottom: 0 }}>{emailErr}</div>}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
              {emailSaved && <span style={{ color: '#4ade80', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={14} /> Impostazioni email salvate</span>}
              <button style={styles.brandingBtnSave} onClick={salvaEmailConfig} disabled={savingEmail}>
                {savingEmail ? 'Salvataggio…' : 'Salva configurazione email'}
              </button>
            </div>
          </div>
        </section>

        {/* ── CONFIGURAZIONE PARTNER POSTALE ───────────────────────────── */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Spedizione cartacea & Partner postale</h2>
          <p style={{ ...styles.subtitle, marginTop: -8, marginBottom: 16 }}>
            Configura un partner postale opzionale per l'invio fisico dei solleciti cartacei direttamente dal gestionale.
          </p>

          <div style={styles.brandingCard}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={styles.brandingLabel}>Seleziona Partner Postale</label>
                <select
                  style={styles.brandingInput}
                  value={partnerConfig.partner_postale_nome}
                  onChange={e => setPartnerConfig(c => ({ ...c, partner_postale_nome: e.target.value }))}
                >
                  <option value="nessuno">Nessuno (Solo generazione PDF cumulativo da stampare manuale)</option>
                  <option value="multidialogo_simulato">Multidialogo (Simulazione per test / Nessun costo)</option>
                  <option value="multidialogo">Multidialogo (Account reale / Spedizioni fisiche)</option>
                </select>
              </div>

              {partnerConfig.partner_postale_nome !== 'nessuno' && (
                <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '0 0 4px', fontWeight: 700, letterSpacing: '0.05em' }}>PARAMETRI PARTNER POSTALE</p>
                  
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 2 }}>
                      <label style={styles.brandingLabel}>Chiave API (Token di Autenticazione)</label>
                      <input
                        style={styles.brandingInput}
                        type="password"
                        placeholder="re_•••••••••••• o token..."
                        value={partnerConfig.partner_postale_api_key}
                        onChange={e => setPartnerConfig(c => ({ ...c, partner_postale_api_key: e.target.value }))}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.brandingLabel}>ID Mittente Registrato</label>
                      <input
                        style={styles.brandingInput}
                        placeholder="Es. MIT-98124"
                        value={partnerConfig.partner_postale_mittente_id}
                        onChange={e => setPartnerConfig(c => ({ ...c, partner_postale_mittente_id: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {partnerErr && <div style={{ ...styles.errorBox, marginTop: 16, marginBottom: 0 }}>{partnerErr}</div>}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
              {partnerSaved && <span style={{ color: '#4ade80', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={14} /> Impostazioni partner postale salvate</span>}
              <button style={styles.brandingBtnSave} onClick={salvaPartnerConfig} disabled={savingPartner}>
                {savingPartner ? 'Salvataggio…' : 'Salva impostazioni partner'}
              </button>
            </div>
          </div>
        </section>

        {/* ── NOTIFICHE & PROMEMORIA ─────────────────────────────────────── */}
        <section id="notifiche" style={styles.section}>
          <h2 style={styles.sectionTitle}>Notifiche &amp; Promemoria</h2>
          <p style={{ ...styles.subtitle, marginTop: -8, marginBottom: 16 }}>
            Configura i promemoria automatici che appaiono nella campanella 🔔 del gestionale.
          </p>

          <div style={styles.brandingCard}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* ─ Riga promemoria: helper */}
              {[
                {
                  key: 'f24_ritenute',
                  label: 'Promemoria F24 — Ritenute d\'acconto',
                  desc: 'Appare dal 1° al 16 del mese successivo se ci sono fatture pagate con ritenuta e F24 non ancora presentato. La scadenza è fissa per legge (art. 25 DPR 600/73).',
                  timing: null,
                  timingLabel: null,
                },
                {
                  key: 'rate_scadute',
                  label: 'Verifica pagamenti rate',
                  desc: 'Avvisa quando una rata risulta scaduta da più di N giorni senza risultare pagata. Suggerisce di aggiornare l\'estratto conto.',
                  timing: 'giorni_dopo_scadenza',
                  timingLabel: 'Giorni di attesa dalla scadenza',
                  min: 1, max: 60,
                },
                {
                  key: 'esercizio_in_scadenza',
                  label: 'Esercizio in scadenza',
                  desc: 'Avvisa quando la data di fine esercizio si avvicina. Ottimo per prepararsi in anticipo con il consuntivo.',
                  timing: 'giorni_prima',
                  timingLabel: 'Giorni di anticipo rispetto alla data di fine',
                  min: 7, max: 90,
                },
                {
                  key: 'movimenti_non_riconciliati',
                  label: 'Movimenti bancari non riconciliati',
                  desc: 'Avvisa se ci sono movimenti bancari nell\'estratto conto rimasti orfani (non riconciliati) per più di N giorni.',
                  timing: 'giorni_tolleranza',
                  timingLabel: 'Giorni di tolleranza prima dell\'avviso',
                  min: 1, max: 60,
                },
              ].map(({ key, label, desc, timing, timingLabel, min, max }) => {
                const cfg = notificheConfig[key] || {}
                const enabled = cfg.enabled === true
                const giorni = timing ? (cfg[timing] ?? 10) : null

                return (
                  <div
                    key={key}
                    style={{
                      background: 'var(--app-bg)',
                      border: `1px solid ${enabled ? 'var(--accent)' : 'var(--border-color-2)'}`,
                      borderRadius: 12,
                      padding: 20,
                      transition: 'border-color 0.2s',
                    }}
                  >
                    {/* Intestazione toggle */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: desc ? 8 : 0 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Bell size={14} color={enabled ? 'var(--accent)' : 'var(--text-muted)'} />
                          <span style={{ color: enabled ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>
                            {label}
                          </span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0, lineHeight: 1.5 }}>{desc}</p>
                      </div>

                      {/* Toggle switch */}
                      <button
                        onClick={() => setNotificheConfig(prev => ({
                          ...prev,
                          [key]: { ...prev[key], enabled: !enabled },
                        }))}
                        style={{
                          width: 44, height: 24, borderRadius: 12,
                          background: enabled ? 'var(--accent)' : 'var(--border-color)',
                          border: 'none', cursor: 'pointer', position: 'relative',
                          flexShrink: 0, transition: 'background 0.2s',
                          padding: 0,
                        }}
                        aria-label={enabled ? `Disabilita ${label}` : `Abilita ${label}`}
                        role="switch"
                        aria-checked={enabled}
                      >
                        <span style={{
                          position: 'absolute',
                          top: 3, left: enabled ? 23 : 3,
                          width: 18, height: 18, borderRadius: '50%',
                          background: '#fff',
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }} />
                      </button>
                    </div>

                    {/* Slider giorni (solo se la notifica ha timing configurabile) */}
                    {timing && enabled && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-color-2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{timingLabel}</label>
                          <span style={{
                            background: 'var(--border-color-2)', color: 'var(--accent)',
                            padding: '2px 10px', borderRadius: 6,
                            fontSize: 13, fontWeight: 700,
                          }}>
                            {giorni} {giorni === 1 ? 'giorno' : 'giorni'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          value={giorni}
                          onChange={e => setNotificheConfig(prev => ({
                            ...prev,
                            [key]: { ...prev[key], [timing]: parseInt(e.target.value) },
                          }))}
                          style={{
                            width: '100%', accentColor: 'var(--accent)',
                            height: 4, cursor: 'pointer',
                          }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--border-color)', fontSize: 11, marginTop: 4 }}>
                          <span>{min} gg</span>
                          <span>{max} gg</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {notificheErr && <div style={{ ...styles.errorBox, marginTop: 16, marginBottom: 0 }}>{notificheErr}</div>}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              {notificheSaved && (
                <span style={{ color: '#4ade80', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Check size={14} /> Impostazioni notifiche salvate
                </span>
              )}
              <button style={styles.brandingBtnSave} onClick={salvaNotificheConfig} disabled={savingNotifiche}>
                {savingNotifiche ? 'Salvataggio…' : 'Salva impostazioni notifiche'}
              </button>
            </div>
          </div>
        </section>

        {/* ── COLLABORATORI STUDIO ────────────────────────────────────── */}
        {!isCollaboratore && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Collaboratori Studio (Multi-utente)</h2>
            <div style={styles.brandingCard}>
              {limiti.max_collaboratori === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 12, fontSize: 14 }}>
                    La gestione dei collaboratori (multi-utente) non è inclusa nel tuo piano attuale ({limiti.label}).
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
                    Effettua l'upgrade al piano <strong>Studio</strong> (fino a 2 collaboratori) o <strong>Professional</strong> (fino a 10 collaboratori) per abilitare la multi-utenza in ufficio.
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
                    Gestisci i membri del tuo team che possono accedere e operare sui condomini del tuo studio. (Attivi: {collaboratori.length} di {limiti.max_collaboratori})
                  </p>
                  
                  {collaboratori.length < limiti.max_collaboratori ? (
                    <form onSubmit={aggiungiCollaboratore} style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <label style={styles.brandingLabel}>Email del collaboratore</label>
                        <input
                          type="email"
                          required
                          value={emailNuovoCollab}
                          onChange={e => setEmailNuovoCollab(e.target.value)}
                          placeholder="collaboratore@studio.it"
                          style={styles.brandingInput}
                        />
                      </div>
                      <button type="submit" disabled={savingCollab} style={styles.brandingBtnSave}>
                        {savingCollab ? 'Aggiunta…' : 'Aggiungi'}
                      </button>
                    </form>
                  ) : (
                    <p style={{ color: '#f59e0b', fontSize: 13, marginBottom: 20, fontWeight: 600 }}>
                      Hai raggiunto il limite massimo di collaboratori per questo piano. Fai l'upgrade per aggiungerne altri.
                    </p>
                  )}

                  {collabErr && <div style={{ ...styles.errorBox, marginBottom: 16 }}>{collabErr}</div>}
                  {collabSuccess && <div style={{ color: '#4ade80', fontSize: 13, marginBottom: 16 }}>{collabSuccess}</div>}

                  {collaboratori.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic', margin: 0 }}>Nessun collaboratore aggiunto.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {collaboratori.map(col => (
                        <div key={col.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--app-bg)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                          <div>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>{col.email_collaboratore}</span>
                            <span style={{
                              marginLeft: 12, fontSize: 11, padding: '2px 8px', borderRadius: 6,
                              background: col.utente_id ? '#1e3a8a' : 'var(--border-color)',
                              color: col.utente_id ? '#93c5fd' : 'var(--text-secondary)'
                            }}>
                              {col.utente_id ? 'Attivo' : 'Invito inviato'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <button 
                              onClick={() => setSelectedCollabForCondos(col)} 
                              title="Gestisci condomini assegnati"
                              style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}
                            >
                              <Building2 size={16} />
                            </button>
                            <button onClick={() => eliminaCollaboratore(col.id)} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── UPGRADE PIANI ────────────────────────────────────────── */}
        {(isTrialActive || isTrialScaduto || piano !== 'professional') && (
          <section id="piani-abbonamento" style={styles.section}>
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
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CreditCard size={12} />
                          <span>-5€/mese con addebito SEPA</span>
                        </span>
                      </div>
                    )}

                    {key === piano && isStripeAttivo ? (
                      <div style={{ ...styles.pianoAttivoLabel, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Check size={14} /> Piano attuale
                      </div>
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Lock size={12} /> Pagamento sicuro via Stripe · Carta EU e SEPA Debit accettati · Disdici quando vuoi
              </span>
            </p>
          </section>
        )}
      </>
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

        {/* ── DATI E PRIVACY (GDPR) ─────────────────────────────────── */}
        {!isCollaboratore && (
          <section style={{ ...styles.section, marginTop: 40 }}>
            <h2 style={{ ...styles.sectionTitle, color: '#f87171' }}>Dati e Privacy (GDPR)</h2>
            <div style={{ ...styles.pianoCard, border: '1px solid #7f1d1d' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <h3 style={{ color: 'var(--text-primary)', fontSize: 16, margin: '0 0 4px' }}>Esporta i tuoi dati (Art. 20 GDPR)</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>Scarica una copia JSON di tutte le anagrafiche, condomini e spese collegate al tuo account.</p>
                </div>
                <button 
                  onClick={handleExportGDPR} 
                  disabled={isExporting}
                  style={{ background: 'var(--border-color)', color: 'var(--text-primary)', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
                >
                  {isExporting ? 'Generazione in corso...' : '📥 Esporta Dati'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ color: '#f87171', fontSize: 16, margin: '0 0 4px' }}>Diritto all'Oblio (Art. 17 GDPR)</h3>
                  <p style={{ color: '#fca5a5', fontSize: 13, margin: 0 }}>Elimina definitivamente il tuo account e tutti i condomini. <strong>Azione irreversibile.</strong></p>
                </div>
                <button 
                  onClick={() => setShowDeleteModal(true)} 
                  style={{ background: '#7f1d1d', color: '#fecaca', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Trash2 size={16} /> Elimina Account</span>
                </button>
              </div>

            </div>
          </section>
        )}

        {/* ── MODALE DOPPIA CONFERMA ELIMINAZIONE ───────────────────── */}
        {showDeleteModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: 'var(--card-bg)', width: 440, borderRadius: 16, padding: 32, border: '1px solid #7f1d1d', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
              
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#450a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <AlertTriangle size={24} style={{ color: '#ef4444' }} />
              </div>
              
              <h2 style={{ color: '#f87171', fontSize: 22, margin: '0 0 12px', textAlign: 'center', fontFamily: 'Sora, sans-serif' }}>Danger Zone</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', lineHeight: 1.5, marginBottom: 24 }}>
                Stai per eliminare il tuo account. Verranno distrutti <strong>immediatamente</strong> e <strong>definitivamente</strong> tutti i condomini, i pagamenti e le anagrafiche legate al tuo profilo.
              </p>
              
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>
                  Digita <strong>ELIMINA</strong> per confermare:
                </label>
                <input 
                  type="text" 
                  value={deleteConfirmWord}
                  onChange={e => setDeleteConfirmWord(e.target.value)}
                  placeholder="ELIMINA"
                  style={{ width: '100%', background: 'var(--app-bg)', border: '1px solid #7f1d1d', borderRadius: 8, padding: '12px', color: '#f87171', fontSize: 16, textAlign: 'center', outline: 'none', fontWeight: 600, textTransform: 'uppercase', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  onClick={() => { setShowDeleteModal(false); setDeleteConfirmWord(''); }}
                  style={{ flex: 1, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: 12, borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                >
                  Annulla
                </button>
                <button 
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount || deleteConfirmWord !== 'ELIMINA'}
                  style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', padding: 12, borderRadius: 8, cursor: (isDeletingAccount || deleteConfirmWord !== 'ELIMINA') ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: (isDeletingAccount || deleteConfirmWord !== 'ELIMINA') ? 0.5 : 1 }}
                >
                  {isDeletingAccount ? 'Distruzione in corso...' : 'Sì, distruggi dati'}
                </button>
              </div>

            </div>
          </div>
        )}

        {selectedCollabForCondos && (
          <AssegnaCondominiModal 
            collaboratore={selectedCollabForCondos} 
            onClose={() => setSelectedCollabForCondos(null)} 
          />
        )}

      </div>
    </div>
  )
}

// ── Componente riga feature ───────────────────────────────────────────────
function FeatureRow({ ok, label }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
      <span style={{ color: ok ? '#22c55e' : '#475569', fontSize: 13, display: 'flex', alignItems: 'center' }}>
        {ok ? <Check size={14} /> : <span style={{ fontFamily: 'monospace', width: 14, textAlign: 'center' }}>✗</span>}
      </span>
      <span style={{ color: ok ? '#94a3b8' : '#475569', fontSize: 13 }}>{label}</span>
    </div>
  )
}

// ── Stili ─────────────────────────────────────────────────────────────────
const styles = {
  page: { minHeight: '100vh', background: 'var(--app-bg)', padding: '32px 24px' },
  container: { maxWidth: 960, margin: '0 auto' },
  header: { marginBottom: 32 },
  title: { color: 'var(--text-primary)', fontSize: 28, fontWeight: 700, margin: '0 0 6px', fontFamily: 'Sora, sans-serif' },
  subtitle: { color: 'var(--text-muted)', fontSize: 15, margin: 0 },
  errorBox: {
    background: '#450a0a', border: '1px solid #991b1b', color: '#fca5a5',
    borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 14,
  },
  section: { marginBottom: 40 },
  sectionTitle: { color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' },
  pianoCard: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24 },
  pianoTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pianoNome: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 },
  pianoDesc: { color: 'var(--text-muted)', fontSize: 14, margin: 0 },
  trialBadge: { background: '#1e3a5f', color: '#60a5fa', border: '1px solid #2563eb', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 },
  scadutoBadge: { background: '#450a0a', color: '#f87171', border: '1px solid #991b1b', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 },
  stripeStatus: { display: 'flex', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: '50%', background: '#4ade80' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 },
  kpiCard: { background: 'var(--app-bg)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 },
  kpiLabel: { color: 'var(--text-muted)', fontSize: 12 },
  kpiValue: { color: 'var(--text-primary)', fontSize: 22, fontWeight: 700 },
  kpiSub: { color: 'var(--text-muted)', fontSize: 13, fontWeight: 400 },
  kpiExtra: { color: '#f59e0b', fontSize: 11 },
  progressBar: { height: 4, background: 'var(--border-color-2)', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, transition: 'width 0.3s' },
  pianoActions: { display: 'flex', gap: 12 },
  btnPortale: {
    background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
    borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer',
  },
  // ── Branding ──
  brandingCard: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24 },
  brandingGrid: { display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'start' },
  brandingLabel: { display: 'block', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 },
  brandingInput: {
    width: '100%', background: 'var(--input-bg)', color: 'var(--text-primary)',
    border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px',
    fontSize: 14, fontFamily: 'Sora, sans-serif', boxSizing: 'border-box',
  },
  logoBox: {
    width: '100%', height: 110, background: 'var(--input-bg)', border: '1px solid var(--border-color)',
    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  logoImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  brandingBtnGhost: {
    background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
    borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'Sora, sans-serif',
  },
  brandingBtnSave: {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif',
  },
  pianiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 },
  pianoOption: {
    background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16,
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
  pianoOptionNome: { color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, fontFamily: 'Sora, sans-serif' },
  pianoOptionPrezzo: { display: 'flex', alignItems: 'baseline', gap: 2, margin: '8px 0 4px' },
  prezzoValore: { color: 'var(--text-primary)', fontSize: 32, fontWeight: 700 },
  prezzoMese: { color: 'var(--text-muted)', fontSize: 14 },
  pianoOptionSub: { color: 'var(--text-muted)', fontSize: 12, margin: 0 },
  pianoOptionFeatures: { flex: 1, marginBottom: 16 },
  sepaHint: { color: 'var(--sepa-yellow)', fontSize: 12, marginBottom: 12 },
  btnUpgrade: {
    background: '#2563eb', color: 'white', border: 'none', borderRadius: 8,
    padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%',
  },
  pianoAttivoLabel: {
    textAlign: 'center', color: '#4ade80', fontSize: 14,
    fontWeight: 600, padding: '11px 0',
  },
  trialNote: { color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 16 },
  infoCard: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '4px 0' },
  infoRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 20px', borderBottom: '1px solid var(--border-color-2)',
  },
  infoLabel: { color: 'var(--text-muted)', fontSize: 14 },
  infoValue: { color: 'var(--text-primary)', fontSize: 14 },
}

// ── Modale Assegnazione Condomini ai Collaboratori ────────────────────────
function AssegnaCondominiModal({ collaboratore, onClose }) {
  const { condomini, loading: loadingCondos } = useCondomini()
  const [assignedCondoIds, setAssignedCondoIds] = useState([])
  const [loadingAssigned, setLoadingAssigned] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchAssignedCondos()
  }, [collaboratore.id])

  async function fetchAssignedCondos() {
    setLoadingAssigned(true)
    try {
      const { data, error } = await supabase
        .from('collaboratori_condomini')
        .select('condominio_id')
        .eq('collaboratore_id', collaboratore.id)
      if (error) throw error
      setAssignedCondoIds(data.map(item => item.condominio_id))
    } catch (e) {
      console.error('Errore caricamento condomini assegnati:', e)
      toast.error('Errore nel caricamento dei condomini assegnati.')
    } finally {
      setLoadingAssigned(false)
    }
  }

  async function handleToggleCondo(condoId, isChecked) {
    setSaving(true)
    try {
      if (isChecked) {
        const { error } = await supabase
          .from('collaboratori_condomini')
          .insert({
            collaboratore_id: collaboratore.id,
            condominio_id: condoId
          })
        if (error) throw error
        setAssignedCondoIds(prev => [...prev, condoId])
      } else {
        const { error } = await supabase
          .from('collaboratori_condomini')
          .delete()
          .eq('collaboratore_id', collaboratore.id)
          .eq('condominio_id', condoId)
        if (error) throw error
        setAssignedCondoIds(prev => prev.filter(id => id !== condoId))
      }
    } catch (e) {
      console.error('Errore durante l\'assegnazione del condominio:', e)
      toast.error('Impossibile salvare l\'assegnazione.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'var(--card-bg)', width: 480, borderRadius: 16, padding: 32, border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: 20, margin: '0 0 8px', fontFamily: 'Sora, sans-serif' }}>Assegna Condomini</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20, lineHeight: 1.4 }}>
          Seleziona a quali condomini del tuo studio può accedere <strong>{collaboratore.email_collaboratore}</strong>.
        </p>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 8 }}>
          {loadingCondos || loadingAssigned ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Caricamento...</p>
          ) : condomini.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>Nessun condominio creato nello studio.</p>
          ) : (
            condomini.map(condo => {
              const isChecked = assignedCondoIds.includes(condo.id)
              return (
                <label key={condo.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s' }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={saving}
                    onChange={e => handleToggleCondo(condo.id, e.target.checked)}
                    style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 500 }}>{condo.nome}</span>
                </label>
              )
            })
          )}
        </div>

        <button 
          onClick={onClose}
          style={{ width: '100%', background: 'var(--border-color)', color: 'var(--text-primary)', border: 'none', padding: 12, borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
        >
          Chiudi
        </button>
      </div>
    </div>
  )
}