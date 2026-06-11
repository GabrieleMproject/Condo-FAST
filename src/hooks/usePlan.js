// src/hooks/usePlan.js
import { useState, useEffect, useCallback } from 'react'
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
    multi_utente: false,
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
    multi_utente: false,
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
    multi_utente: false,
    max_collaboratori: 0,
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
    multi_utente: true,
    max_collaboratori: 5,
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
  multi_utente:        ['professional'],             // S20
  api_access:          ['professional'],             // futuro
}

export function usePlan() {
  const { user } = useAuth()
  const [profile, setProfile]               = useState(null)
  const [condominiCount, setCondominiCount] = useState(0)
  const [aiCallsCount, setAiCallsCount]     = useState(0)
  const [loading, setLoading]               = useState(true)

  // ── Carica profilo + conteggi ─────────────────────────────────────────
  const loadPlan = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('piano, stripe_customer_id, stripe_subscription_id, stripe_status, trial_ends_at')
        .eq('id', user.id)
        .single()

      setProfile(prof)

      // ✅ Fix: usa amministratore_id (colonna canonica su condomini)
      const { count: condCount } = await supabase
        .from('condomini')
        .select('id', { count: 'exact', head: true })
        .eq('amministratore_id', user.id)

      setCondominiCount(condCount || 0)

      // Conteggio AI calls mese corrente
      const inizioMese = new Date()
      inizioMese.setDate(1)
      inizioMese.setHours(0, 0, 0, 0)

      const { count: aiCount } = await supabase
        .from('ai_call_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('timestamp', inizioMese.toISOString())

      setAiCallsCount(aiCount || 0)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadPlan() }, [loadPlan])

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
  const condominiInclusi = limiti.condomini_inclusi  // null = illimitati (Professional)
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
    // Feature senza gate → sempre disponibile
    const pianiAbilitati = FEATURE_GATES[feature]
    if (!pianiAbilitati) return true

    // Trial attivo → accesso Studio completo
    if (isTrialActive) return pianiAbilitati.includes('studio')

    // Piano scaduto/Stripe inattivo → blocca tutto
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

  return {
    loading,
    piano,
    limiti,
    profile,

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
    refresh: loadPlan,
  }
}