// src/hooks/useAutoDraft.js
import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook per salvare automaticamente e ripristinare le bozze di form non salvate in sessionStorage.
 * 
 * @param {string} draftKey - Chiave univoca per identificare la bozza (es. 'draft_spesa_new' o 'draft_condominio_123')
 * @param {object} formState - Lo stato corrente della form
 * @param {function} setFormState - Funzione di aggiornamento dello stato della form
 * @param {boolean} isEnabled - Se l'auto-draft è attivo (disabilitabile ad es. in sola lettura)
 */
export function useAutoDraft(draftKey, formState, setFormState, isEnabled = true) {
  const [hasDraft, setHasDraft] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [isDraftSaving, setIsDraftSaving] = useState(false)
  const initialLoadDone = useRef(false)
  const timerRef = useRef(null)

  // 1. All'avvio, controlla se esiste una bozza precedente salvata
  useEffect(() => {
    if (!draftKey || !isEnabled) return

    try {
      const savedRaw = sessionStorage.getItem(draftKey)
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw)
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          // Se la bozza ha campi compilati
          setHasDraft(true)
          setLastSavedAt(new Date())
        }
      }
    } catch (e) {
      console.warn('Errore lettura bozza da sessionStorage:', e)
    }
  }, [draftKey, isEnabled])

  // 2. Salva in debounced sessionStorage ogni volta che formState cambia
  useEffect(() => {
    if (!draftKey || !isEnabled) return

    // Non sovrascrivere alla prima renderizzazione prima dell'inizializzazione
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      return
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    setIsDraftSaving(true)
    timerRef.current = setTimeout(() => {
      try {
        if (formState && Object.keys(formState).length > 0) {
          sessionStorage.setItem(draftKey, JSON.stringify(formState))
          setHasDraft(true)
          setLastSavedAt(new Date())
        }
      } catch (e) {
        console.warn('Errore salvataggio bozza in sessionStorage:', e)
      } finally {
        setIsDraftSaving(false)
      }
    }, 400) // 400ms debounce

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [draftKey, formState, isEnabled])

  // 3. Funzione per ripristinare manualmente la bozza salvata
  const restoreDraft = useCallback(() => {
    if (!draftKey) return false
    try {
      const savedRaw = sessionStorage.getItem(draftKey)
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw)
        if (parsed) {
          setFormState(prev => ({
            ...prev,
            ...parsed
          }))
          return true
        }
      }
    } catch (e) {
      console.error('Errore durante ripristino bozza:', e)
    }
    return false
  }, [draftKey, setFormState])

  // 4. Funzione per eliminare la bozza (da chiamare al submit completato o annullamento)
  const clearDraft = useCallback(() => {
    if (!draftKey) return
    try {
      sessionStorage.removeItem(draftKey)
      setHasDraft(false)
      setLastSavedAt(null)
    } catch (e) {
      console.warn('Errore pulizia bozza:', e)
    }
  }, [draftKey])

  return {
    hasDraft,
    restoreDraft,
    clearDraft,
    lastSavedAt,
    isDraftSaving
  }
}
