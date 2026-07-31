import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

export const MASTERCLASS_STEPS = [
  {
    id: 0,
    key: 'profilo_studio',
    title: 'Step 0: Profilo Studio & Branding Logo',
    desc: 'Inserisci la Ragione Sociale, P.IVA/CF e carica il Logo del tuo Studio per personalizzare tutti i PDF e le email.',
    target: 'studio-branding-form',
    pageUrl: '/impostazioni',
    checkCondition: (profile) => !!(profile?.ragione_sociale || profile?.studio_nome)
  },
  {
    id: 1,
    key: 'creazione_condominio',
    title: 'Step 1: Creazione Condominio & Tabelle Millesimali',
    desc: 'Crea un nuovo condominio inserendo nome, indirizzo e la prima tabella millesimale (Proprietà Generale).',
    target: 'btn-nuovo-condominio',
    pageUrl: '/condomini',
    checkCondition: (condomini) => condomini && condomini.length > 0
  },
  {
    id: 2,
    key: 'anagrafica_unita',
    title: 'Step 2: Anagrafica Unità, Residenti & Dati Catastali',
    desc: 'Inserisci le unità (subalterni, mq, piano) con i relativi millesimi ed abbina i proprietari con dati catastali (Art. 1130 c.c.).',
    target: 'tab-anagrafica-unita',
    pageUrl: '/condomini',
    checkCondition: (stats) => (stats?.unitaCount > 0) && (stats?.personeCount > 0)
  },
  {
    id: 3,
    key: 'apertura_esercizio',
    title: 'Step 3: Apertura Esercizio Amministrativo & Saldi Iniziali',
    desc: 'Imposta le date del periodo contabile (es. 01/01/2026 - 31/12/2026) e registra i saldi iniziali di cassa e dei condòmini.',
    target: 'header-esercizio-selector',
    pageUrl: '/condomini',
    checkCondition: (stats) => stats?.eserciziCount > 0
  },
  {
    id: 4,
    key: 'preventivo_rate',
    title: 'Step 4: Preventivo di Spesa & Piano Rateizzazione',
    desc: 'Inserisci le voci di spesa di previsione, ripartiscile in quota e genera le scadenze rate per ciascuna unità.',
    target: 'tab-preventivo-rate',
    pageUrl: '/condomini',
    checkCondition: (stats) => stats?.preventivoVociCount > 0
  },
  {
    id: 5,
    key: 'spese_fatture_ocr',
    title: 'Step 5: Registrazione Spese & Lettura OCR Fatture AI',
    desc: 'Carica le fatture dei fornitori: l\'IA legge in automatico importi, fornitori e la Ritenuta d\'Acconto 4% F24.',
    target: 'tab-spese-fatture',
    pageUrl: '/condomini',
    checkCondition: (stats) => stats?.speseCount > 0
  },
  {
    id: 6,
    key: 'estratto_conto_riconciliazione',
    title: 'Step 6: Estratto Conto Bancario & Riconciliazione AI',
    desc: 'Carica i movimenti del conto corrente bancario ed abbina con 1 clic incassi ↔ rate ed uscite ↔ fatture.',
    target: 'tab-estratto-conto',
    pageUrl: '/condomini',
    checkCondition: (stats) => stats?.riconciliatiCount > 0
  },
  {
    id: 7,
    key: 'morosita_solleciti',
    title: 'Step 7: Gestione Morosità & Invio Solleciti Rate',
    desc: 'Controlla le rate scadute da oltre 10 giorni ed invia lettere di sollecito personalizzate via email o PDF.',
    target: 'btn-solleciti-massivi',
    pageUrl: '/condomini',
    checkCondition: (stats) => stats?.sollecitiInviatiCount > 0
  },
  {
    id: 8,
    key: 'consuntivo_pdf',
    title: 'Step 8: Rendiconto Ufficiale & Consuntivo PDF (Art. 1130-bis)',
    desc: 'Verifica la quadratura di cassa (sez. D) e genera il bilancio consuntivo ufficiale completo in PDF col tuo logo.',
    target: 'tab-consuntivo-pdf',
    pageUrl: '/condomini',
    checkCondition: (stats) => stats?.consuntivoStampato === true
  },
  {
    id: 9,
    key: 'verbali_chiusura',
    title: 'Step 9: Verbali Assemblea & Passaggio all\'Esercizio Successivo',
    desc: 'Upload del verbale dell\'assemblea approvata, archiviazione con ricerca AI e riporto saldi al nuovo anno contabile.',
    target: 'tab-verbali-assemblea',
    pageUrl: '/condomini',
    checkCondition: (stats) => stats?.verbaliCount > 0
  }
]

export function useMasterclass() {
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState([])
  const [isGuidanceActive, setIsGuidanceActive] = useState(true)
  const [spotlightTarget, setSpotlightTarget] = useState(null)
  const [savingProgress, setSavingProgress] = useState(false)

  // Caricamento iniziale dello stato da localStorage e Supabase
  useEffect(() => {
    if (!user) return

    const localSaved = localStorage.getItem(`condofast_masterclass_${user.id}`) || localStorage.getItem(`condosmart_masterclass_${user.id}`)
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved)
        setCurrentStep(parsed.currentStep ?? 0)
        setCompletedSteps(parsed.completedSteps ?? [])
        setIsGuidanceActive(parsed.isGuidanceActive ?? true)
      } catch {
        // Fallback silente
      }
    }

    async function fetchFromDb() {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_state')
          .eq('id', user.id)
          .single()

        if (profile?.onboarding_state) {
          const state = profile.onboarding_state
          if (state.currentStep !== undefined) setCurrentStep(state.currentStep)
          if (state.completedSteps) setCompletedSteps(state.completedSteps)
          if (state.isGuidanceActive !== undefined) setIsGuidanceActive(state.isGuidanceActive)
        }
      } catch (err) {
        console.error('Errore nel recupero dello stato masterclass da DB:', err)
      }
    }

    fetchFromDb()
  }, [user])

  // Salva i progressi su DB e localStorage ad ogni cambio di stato
  const saveProgress = useCallback(async (newStep, newCompleted, newActiveState) => {
    if (!user) return
    const stepToSave = newStep !== undefined ? newStep : currentStep
    const completedToSave = newCompleted !== undefined ? newCompleted : completedSteps
    const activeToSave = newActiveState !== undefined ? newActiveState : isGuidanceActive

    const payload = {
      currentStep: stepToSave,
      completedSteps: completedToSave,
      isGuidanceActive: activeToSave,
      updated_at: new Date().toISOString()
    }

    // Salva in localStorage per reattività istantanea
    localStorage.setItem(`condofast_masterclass_${user.id}`, JSON.stringify(payload))
    localStorage.setItem(`condosmart_masterclass_${user.id}`, JSON.stringify(payload))

    // Salva su Supabase DB in background
    setSavingProgress(true)
    try {
      await supabase
        .from('profiles')
        .update({ onboarding_state: payload })
        .eq('id', user.id)
    } catch (err) {
      console.error('Errore durante il salvataggio dei progressi Masterclass su DB:', err)
    } finally {
      setSavingProgress(false)
    }
  }, [user, currentStep, completedSteps, isGuidanceActive])

  // Marca uno step come completato e passa al successivo
  const completeStep = useCallback((stepId) => {
    setCompletedSteps(prev => {
      if (prev.includes(stepId)) return prev
      const nextCompleted = [...prev, stepId]
      const nextStep = Math.min(stepId + 1, MASTERCLASS_STEPS.length - 1)
      setCurrentStep(nextStep)
      saveProgress(nextStep, nextCompleted, isGuidanceActive)

      // Se tutti gli step (0-9) sono completati, assegna il bonus +100 crediti AI!
      if (nextCompleted.length === MASTERCLASS_STEPS.length && user) {
        supabase
          .rpc('reward_masterclass_bonus', { target_user_id: user.id })
          .then(({ error }) => {
            alert('Complimenti! Hai completato l\'intero Tutorial Guidato Condominiale! Ti sono stati accreditati +100 crediti AI bonus gratuiti!')
          })
          .catch(() => {
            alert('Complimenti! Hai completato l\'intero Tutorial Guidato Condominiale!')
          })
      }

      return nextCompleted
    })
  }, [isGuidanceActive, saveProgress, user])

  // Cambia manualmente step attivo (solo se sbloccato o precedente)
  const goToStep = useCallback((stepId) => {
    const maxUnlocked = Math.max(0, ...completedSteps, completedSteps.length)
    if (stepId >= 0 && stepId <= maxUnlocked && stepId < MASTERCLASS_STEPS.length) {
      setCurrentStep(stepId)
      saveProgress(stepId, completedSteps, isGuidanceActive)
    }
  }, [completedSteps, isGuidanceActive, saveProgress])

  // Attiva/disattiva guida
  const toggleGuidance = useCallback((active) => {
    const nextState = active !== undefined ? active : !isGuidanceActive
    setIsGuidanceActive(nextState)
    saveProgress(currentStep, completedSteps, nextState)
  }, [currentStep, completedSteps, isGuidanceActive, saveProgress])

  // Attiva spotlight su elemento targhettizzato
  const showSpotlight = useCallback((targetId) => {
    setSpotlightTarget(null)
    setTimeout(() => {
      setSpotlightTarget(targetId)
    }, 50)
  }, [])

  const hideSpotlight = useCallback(() => {
    setSpotlightTarget(null)
  }, [])

  return {
    currentStep,
    completedSteps,
    isGuidanceActive,
    spotlightTarget,
    savingProgress,
    activeStepData: MASTERCLASS_STEPS[currentStep] || MASTERCLASS_STEPS[0],
    totalStepsCount: MASTERCLASS_STEPS.length,
    completeStep,
    goToStep,
    toggleGuidance,
    showSpotlight,
    hideSpotlight,
    steps: MASTERCLASS_STEPS
  }
}
