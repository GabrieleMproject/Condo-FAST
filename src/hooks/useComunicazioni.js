import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useComunicazioni() {
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

  const inviaComunicazione = useCallback(async ({ condominioId, destinatari, oggetto, messaggio, tipo }) => {
    setLoading(true)
    setError(null)
    try {
      // Ottieni l'utente corrente per la sua email (da usare come reply_to)
      const { data: { user } } = await supabase.auth.getUser()
      const adminEmail = user?.email || ''

      const { data, error: invokeErr } = await supabase.functions.invoke('invia-comunicazione', {
        body: {
          condominio_id: condominioId,
          destinatari,
          oggetto,
          messaggio,
          tipo,
          admin_email: adminEmail,
        },
      })

      if (invokeErr) throw invokeErr
      if (data?.error) throw new Error(data.error)

      // Ricarica lo storico dopo l'invio
      await fetchComunicazioni(condominioId)
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
