import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useEsercizi(condominioId) {
  const [esercizi, setEsercizi] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    if (!condominioId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('esercizi')
        .select(`*, rate(*)`)
        .eq('condominio_id', condominioId)
        .order('anno', { ascending: false })
      if (error) throw error
      setEsercizi(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [condominioId])

  const crea = useCallback(async (payload) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('esercizi')
        .insert({ ...payload, condominio_id: condominioId })
        .select(`*, rate(*)`)
        .single()
      if (error) throw error
      // Le rate vengono generate automaticamente dal trigger Postgres
      setEsercizi(prev => [data, ...prev])
      return data
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [condominioId])

  const aggiorna = useCallback(async (id, payload) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('esercizi')
        .update(payload)
        .eq('id', id)
        .select(`*, rate(*)`)
        .single()
      if (error) throw error
      setEsercizi(prev => prev.map(e => e.id === id ? data : e))
      return data
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const elimina = useCallback(async (id) => {
    setLoading(true)
    try {
      const { error } = await supabase.from('esercizi').delete().eq('id', id)
      if (error) throw error
      setEsercizi(prev => prev.filter(e => e.id !== id))
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const aggiornaRata = useCallback(async (rataId, payload) => {
    const { data, error } = await supabase
      .from('rate')
      .update(payload)
      .eq('id', rataId)
      .select()
      .single()
    if (error) throw error
    setEsercizi(prev => prev.map(e => ({
      ...e,
      rate: e.rate?.map(r => r.id === rataId ? data : r)
    })))
    return data
  }, [])

  return { esercizi, loading, error, fetch, crea, aggiorna, elimina, aggiornaRata }
}
