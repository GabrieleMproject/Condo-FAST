// src/hooks/useFormShortcuts.js
import { useEffect } from 'react'

/**
 * Hook per abilitare scorciatoie da tastiera power-user su form e modali.
 * - Cmd+S / Ctrl+S: Salva
 * - Esc: Annulla / Chiudi
 * 
 * @param {object} params
 * @param {function} params.onSave - Callback al salvataggio
 * @param {function} params.onCancel - Callback all'annullamento/chiusura
 * @param {boolean} params.isEnabled - Se le scorciatoie sono attive
 */
export function useFormShortcuts({ onSave, onCancel, isEnabled = true }) {
  useEffect(() => {
    if (!isEnabled) return

    const handleKeyDown = (e) => {
      // 1. Salva con Cmd+S (Mac) o Ctrl+S (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        if (typeof onSave === 'function') {
          onSave()
        }
      }

      // 2. Annulla con Escape (solo se non all'interno di un menu a tendina aperto o se richiesto)
      if (e.key === 'Escape') {
        if (typeof onCancel === 'function') {
          onCancel()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onSave, onCancel, isEnabled])
}
