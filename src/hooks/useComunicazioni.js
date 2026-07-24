import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usePlan } from './usePlan'

export function useComunicazioni() {
  const { canUse } = usePlan()
  const [comunicazioni, setComunicazioni] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchComunicazioni = useCallback(async (condominioId = null) => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('comunicazioni')
        .select('*')
        .order('created_at', { ascending: false })

      if (condominioId) {
        query = query.eq('condominio_id', condominioId)
      }

      const { data, error: fetchErr } = await query
      if (fetchErr) throw fetchErr

      setComunicazioni(data || [])
      return data || []
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const inviaComunicazione = useCallback(async ({ condominioId, destinatari, oggetto, messaggio, tipo, allegati, skipFetch = false }) => {
    if (!canUse('comunicazioni_resend')) {
      const msg = 'L\'invio di comunicazioni via email è riservato ai piani Studio e Professional.'
      setError(msg)
      throw new Error(msg)
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('invia-comunicazione', {
        body: {
          condominio_id: condominioId,
          destinatari,
          oggetto,
          messaggio,
          tipo,
          allegati,
        },
      })

      if (invokeErr) throw invokeErr
      if (data?.error) throw new Error(data.error)

      // Ricarica lo storico dopo l'invio (se non richiesto diversamente)
      if (!skipFetch) {
        await fetchComunicazioni(condominioId)
      }
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchComunicazioni])

  return {
    comunicazioni,
    loading,
    error,
    fetchComunicazioni,
    inviaComunicazione,
  }
}
