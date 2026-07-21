// src/hooks/usePlan.js
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

// ── Definizione limiti per piano ──────────────────────────────────────────
export const PIANI = {
  trial: {
    label: 'Trial',
    canone: 0,
    condomini_inclusi: 50,       // trial = accesso Studio completo
    extra_per_cond: 0,
    ai_calls_mese: 500,          // trial = accesso Studio completo
    portale_condomino: true,
    rendiconto_pdf: true,
    assemblee: true,
    max_collaboratori: 0,
    storico_anni: 3,
    api_access: false,
  },
  base: {
    label: 'Base',
    canone: 129,
    condomini_inclusi: 10,       // ✅ concordato
    extra_per_cond: 7,
    ai_calls_mese: 100,          // ✅ concordato
    portale_condomino: false,
    rendiconto_pdf: false,
    assemblee: false,
    max_collaboratori: 0,
    storico_anni: 1,
    api_access: false,
  },
  studio: {
    label: 'Studio',
    canone: 249,
    condomini_inclusi: 50,       // ✅ concordato
    extra_per_cond: 6,
    ai_calls_mese: 500,          // ✅ concordato
    portale_condomino: true,
    rendiconto_pdf: true,
    assemblee: true,
    max_collaboratori: 2,
    storico_anni: 3,
    api_access: false,
  },
  professional: {
    label: 'Professional',
    canone: 399,
    condomini_inclusi: null,     // ✅ illimitati
    extra_per_cond: 0,
    ai_calls_mese: null,         // illimitato
    portale_condomino: true,
    rendiconto_pdf: true,
    assemblee: true,
    max_collaboratori: 10,
    extra_collaboratore: 29,
    storico_anni: null,          // illimitato
    api_access: true,
  },
}

// ── Feature → piani abilitati ─────────────────────────────────────────────
// Aggiungere qui ogni nuova feature gated prima di usarla in PlanGate
const FEATURE_GATES = {
  portale_condomino:   ['studio', 'professional'],  // S9
  comunicazioni_resend:['studio', 'professional'],  // S10
  pagamento_stripe:    ['studio', 'professional'],  // S10
  rendiconto_pdf:      ['studio', 'professional'],  // S13
  assemblee:           ['studio', 'professional'],  // S14
  gestione_fornitori:  ['studio', 'professional'],  // S15 (Studio+, non solo Pro)
  alert_contratti:     ['studio', 'professional'],  // S15
  notifiche_auto:      ['studio', 'professional'],  // S11
  storico_3anni:       ['studio', 'professional'],
  postbox_studio:      ['studio', 'professional'],
  multi_utente:        ['studio', 'professional'],   // Studio+ supporta ora collaboratori limitati
  api_access:          ['professional'],             // futuro
  open_banking:        ['professional'],             // S51
}

const PlanContext = createContext(null)

export function PlanProvider({ children }) {
  const { user } = useAuth()
  const [profile, setProfile]               = useState(null)
  const [condominiCount, setCondominiCount] = useState(0)
  const [aiCallsCount, setAiCallsCount]     = useState(0)
  const [loading, setLoading]               = useState(true)
  const [isCollaboratore, setIsCollaboratore] = useState(false)
  const [titolareId, setTitolareId]         = useState(null)

  // ── Carica profilo + conteggi ─────────────────────────────────────────
  const loadPlan = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setCondominiCount(0)
      setAiCallsCount(0)
      setIsCollaboratore(false)
      setTitolareId(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // 1. Verifica se l'utente è un collaboratore registrato e attivo
      const { data: collab } = await supabase
        .from('collaboratori_studio')
        .select('amministratore_id')
        .or(`utente_id.eq.${user.id},email_collaboratore.eq.${user.email}`)
        .eq('attivo', true)
        .maybeSingle()

      const targetUserId = collab ? collab.amministratore_id : user.id
      setIsCollaboratore(!!collab)
      setTitolareId(collab ? collab.amministratore_id : null)

      // Se collaboratore, aggiorna utente_id sul DB nel caso non sia settato
      if (collab && !collab.utente_id) {
        await supabase
          .from('collaboratori_studio')
          .update({ utente_id: user.id })
          .or(`utente_id.eq.${user.id},email_collaboratore.eq.${user.email}`)
      }

      // 2. Carica il profilo del titolare del piano (o il proprio se amministratore)
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select()
        .eq('id', targetUserId)
        .single()

      if (profErr) {
        console.error('DEBUG usePlan - Errore fetch profile:', profErr)
      } else {
        console.log('DEBUG usePlan - Profilo caricato:', prof)
      }

      setProfile(prof)

      // ✅ Fix: usa amministratore_id (colonna canonica su condomini)
      const { count: condCount } = await supabase
        .from('condomini')
        .select('id', { count: 'exact', head: true })
        .eq('amministratore_id', targetUserId)

      setCondominiCount(condCount || 0)

      // Conteggio AI calls mese corrente (in UTC)
      const ora = new Date()
      const inizioMese = new Date(Date.UTC(ora.getUTCFullYear(), ora.getUTCMonth(), 1, 0, 0, 0, 0))

      const { count: aiCount } = await supabase
        .from('ai_call_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', targetUserId)
        .gte('timestamp', inizioMese.toISOString())

      setAiCallsCount(aiCount || 0)
    } catch (err) {
      console.error('Errore durante caricamento piano:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadPlan() }, [loadPlan])

  const updateBranding = useCallback(async (brandingData) => {
    if (!user) return { error: new Error('Utente non autenticato') }
    try {
      const fieldsToUpdate = {}
      const textFields = [
        'studio_nome', 'studio_indirizzo', 'studio_contatti', 'logo_base64',
        'ragione_sociale', 'partita_iva', 'codice_fiscale', 'mail_invio_tipo',
        'mail_mittente_email', 'mail_mittente_nome', 'smtp_host',
        'smtp_user', 'smtp_password', 'resend_api_key',
        'partner_postale_nome', 'partner_postale_api_key', 'partner_postale_mittente_id'
      ]

      textFields.forEach(field => {
        if (brandingData[field] !== undefined) {
          fieldsToUpdate[field] = brandingData[field] || null
        }
      })

      // Gestione speciale per la porta SMTP (numero intero)
      if (brandingData.smtp_port !== undefined) {
        fieldsToUpdate.smtp_port = brandingData.smtp_port ? parseInt(brandingData.smtp_port) : null
      }

      // Evita l'azzeramento forzato di tipo invio se non specificato
      if (fieldsToUpdate.mail_invio_tipo === null) {
        fieldsToUpdate.mail_invio_tipo = 'sistema'
      }

      const { error } = await supabase
        .from('profiles')
        .update(fieldsToUpdate)
        .eq('id', user.id)

      if (error) throw error
      await loadPlan()
      return { success: true }
    } catch (err) {
      return { error: err }
    }
  }, [user, loadPlan])

  // ── Piano attivo ──────────────────────────────────────────────────────
  const piano  = profile?.piano || 'trial'
  const limiti = PIANI[piano] || PIANI.trial

  // ── Trial ─────────────────────────────────────────────────────────────
  const isTrialActive = piano === 'trial' && profile?.trial_ends_at
    ? new Date(profile.trial_ends_at) > new Date()
    : false

  const isTrialScaduto = piano === 'trial' && !isTrialActive

  // ── Stripe ────────────────────────────────────────────────────────────
  const isStripeAttivo = ['active', 'trialing'].includes(profile?.stripe_status)

  // ── Condomini ─────────────────────────────────────────────────────────
  const condominiInclusi = limiti.condomini_inclusi
  const condominiExtra   = condominiInclusi === null
    ? 0
    : Math.max(0, condominiCount - condominiInclusi)
  const costoExtraMese   = condominiExtra * (limiti.extra_per_cond || 0)

  const puoAggiungereCondominio = condominiInclusi === null
    ? true
    : piano === 'trial'
      ? condominiCount < condominiInclusi
      : true // nei piani pagati Stripe gestisce la quota extra

  // ── canUse(feature) ───────────────────────────────────────────────────
  const canUse = useCallback((feature) => {
    const pianiAbilitati = FEATURE_GATES[feature]
    if (!pianiAbilitati) return true
    if (isTrialActive) return pianiAbilitati.includes('studio')
    if (!isStripeAttivo && piano !== 'trial') return false
    return pianiAbilitati.includes(piano)
  }, [piano, isTrialActive, isStripeAttivo])

  // ── canUseAI() ────────────────────────────────────────────────────────
  const canUseAI = useCallback(() => {
    if (limiti.ai_calls_mese === null) return true
    return aiCallsCount < limiti.ai_calls_mese
  }, [limiti.ai_calls_mese, aiCallsCount])

  // ── Piano minimo per una feature ─────────────────────────────────────
  const pianoMinimoPerFeature = useCallback((feature) => {
    const piani = FEATURE_GATES[feature]
    if (!piani || piani.length === 0) return null
    return piani[0]
  }, [])

  const value = {
    loading,
    piano,
    limiti,
    profile,
    isSuperAdmin: profile?.is_superadmin === true,
    isBetaTester: profile?.is_beta_tester === true,
    isCollaboratore,
    titolareId,

    isTrialActive,
    isTrialScaduto,
    trialEndsAt: profile?.trial_ends_at,

    isStripeAttivo,
    stripeStatus: profile?.stripe_status,

    condominiCount,
    condominiInclusi,
    condominiExtra,
    costoExtraMese,
    puoAggiungereCondominio,

    aiCallsCount,
    aiCallsLimit: limiti.ai_calls_mese,
    aiCallsRimanenti: limiti.ai_calls_mese === null
      ? null
      : Math.max(0, limiti.ai_calls_mese - aiCallsCount),

    canUse,
    canUseAI,
    pianoMinimoPerFeature,
    updateBranding,
    refresh: loadPlan,
  }

  return React.createElement(PlanContext.Provider, { value }, children)
}

export function usePlan() {
  const context = useContext(PlanContext)
  if (!context) {
    throw new Error('usePlan deve essere usato all\'interno di PlanProvider')
  }
  return context
}