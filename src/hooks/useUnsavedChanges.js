// src/hooks/useUnsavedChanges.js
import { useEffect, useCallback } from 'react'

/**
 * Hook per proteggere l'utente dalla chiusura involontaria della scheda o refresh
 * quando ci sono modifiche non salvate.
 * 
 * @param {boolean} isDirty - Indica se ci sono modifiche non salvate nella form
 * @param {string} message - Messaggio opzionale personalizzato
 */
export function useUnsavedChanges(isDirty = false, message = 'Ci sono modifiche non salvate nella form. Sei sicuro di voler uscire?') {
  useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = message
      return message
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isDirty, message])

  // Helper per confermare l'uscita prima di navigare programmaticamente via React Router
  const confirmLeave = useCallback(() => {
    if (!isDirty) return true
    return window.confirm(message)
  }, [isDirty, message])

  return { confirmLeave }
}
