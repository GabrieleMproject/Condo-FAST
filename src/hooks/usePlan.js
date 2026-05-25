// src/hooks/usePlan.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

// ── Definizione limiti per piano ──────────────────────────────────────────
export const PIANI = {
  trial: {
    label: 'Trial',
    canone: 0,
    condomini_inclusi: 5,
    extra_per_cond: 0,
    ai_calls_mese: 600, // accesso piano Studio durante trial
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
    condomini_inclusi: 15,
    extra_per_cond: 7,
    ai_calls_mese: 200,
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
    condomini_inclusi: 35,
    extra_per_cond: 6,
    ai_calls_mese: 600,
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
    condomini_inclusi: 70,
    extra_per_cond: 5,
    ai_calls_mese: null, // illimitato
    portale_condomino: true,
    rendiconto_pdf: true,
    assemblee: true,
    multi_utente: true,
    max_collaboratori: 5,
    extra_collaboratore: 29,
    storico_anni: null, // illimitato
    api_access: true,
  },
}

// ── Feature → piano minimo richiesto ─────────────────────────────────────
const FEATURE_GATES = {
  portale_condomino: ['studio', 'professional'],
  rendiconto_pdf:    ['studio', 'professional'],
  assemblee:         ['studio', 'professional'],
  multi_utente:      ['professional'],
  api_access:        ['professional'],
  gestione_fornitori:['professional'],
  alert_contratti:   ['professional'],
  notifiche_auto:    ['studio', 'professional'],
  storico_3anni:     ['studio', 'professional'],
}

export function usePlan() {
  const { user } = useAuth()
  const [profile, setProfile]             = useState(null)
  const [condominiCount, setCondominiCount] = useState(0)
  const [aiCallsCount, setAiCallsCount]   = useState(0)
  const [loading, setLoading]             = useState(true)

  // ── Carica profilo + conteggi ─────────────────────────────────────────
  const loadPlan = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      // Profilo
      const { data: prof } = await supabase
        .from('profiles')
        .select('piano, stripe_customer_id, stripe_subscription_id, stripe_status, trial_ends_at')
        .eq('id', user.id)
        .single()

      setProfile(prof)

      // Conteggio condomini
      const { count: condCount } = await supabase
        .from('condomini')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

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
  const piano = profile?.piano || 'trial'
  const limiti = PIANI[piano] || PIANI.trial

  // ── Trial attivo? ─────────────────────────────────────────────────────
  const isTrialActive = piano === 'trial' && profile?.trial_ends_at
    ? new Date(profile.trial_ends_at) > new Date()
    : false

  const isTrialScaduto = piano === 'trial' && !isTrialActive

  // ── Stripe attivo? ────────────────────────────────────────────────────
  const isStripeAttivo = ['active', 'trialing'].includes(profile?.stripe_status)

  // ── Condomini extra ───────────────────────────────────────────────────
  const condominiExtra = Math.max(0, condominiCount - limiti.condomini_inclusi)
  const costoExtraMese = condominiExtra * limiti.extra_per_cond

  // ── Può aggiungere un altro condominio? ───────────────────────────────
  const puoAggiungereCondominio = piano === 'trial'
    ? condominiCount < 5
    : true // nei piani pagati Stripe gestisce la quota extra

  // ── canUse(feature) ───────────────────────────────────────────────────
  const canUse = useCallback((feature) => {
    // Trial: accesso completo piano Studio
    if (isTrialActive) {
      const studioFeatures = FEATURE_GATES[feature] || []
      return studioFeatures.includes('studio') || studioFeatures.includes('professional')
        ? true
        : !FEATURE_GATES[feature] // feature senza gate → sempre disponibile
    }

    // Piano pagato scaduto/inattivo
    if (!isStripeAttivo && piano !== 'trial') return false

    const pianiAbilitati = FEATURE_GATES[feature]
    if (!pianiAbilitati) return true // feature senza gate → sempre disponibile
    return pianiAbilitati.includes(piano)
  }, [piano, isTrialActive, isStripeAttivo])

  // ── AI calls: può fare un'altra chiamata? ─────────────────────────────
  const canUseAI = useCallback(() => {
    if (limiti.ai_calls_mese === null) return true // illimitato
    return aiCallsCount < limiti.ai_calls_mese
  }, [limiti.ai_calls_mese, aiCallsCount])

  // ── Piano minimo per una feature ─────────────────────────────────────
  const pianoMinimoPerFeature = useCallback((feature) => {
    const piani = FEATURE_GATES[feature]
    if (!piani || piani.length === 0) return null
    return piani[0] // primo piano abilitato
  }, [])

  return {
    // Stato
    loading,
    piano,
    limiti,
    profile,

    // Trial
    isTrialActive,
    isTrialScaduto,
    trialEndsAt: profile?.trial_ends_at,

    // Stripe
    isStripeAttivo,
    stripeStatus: profile?.stripe_status,

    // Condomini
    condominiCount,
    condominiInclusi: limiti.condomini_inclusi,
    condominiExtra,
    costoExtraMese,
    puoAggiungereCondominio,

    // AI calls
    aiCallsCount,
    aiCallsLimit: limiti.ai_calls_mese,
    aiCallsRimanenti: limiti.ai_calls_mese === null
      ? null
      : Math.max(0, limiti.ai_calls_mese - aiCallsCount),

    // Funzioni
    canUse,
    canUseAI,
    pianoMinimoPerFeature,
    refresh: loadPlan,
  }
}
