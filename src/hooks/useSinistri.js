import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useSinistri(condominioId) {
  const [sinistri, setSinistri] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchSinistri = useCallback(async () => {
    if (!condominioId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('sinistri')
        .select(`
          *,
          unita:unita_origine_id (
            id,
            scala,
            numero,
            piano,
            occupanti_unita (
              id, ruolo, attivo,
              persone (id, nome, cognome)
            )
          )
        `)
        .eq('condominio_id', condominioId)
        .order('data_evento', { ascending: false })

      if (error) throw error
      setSinistri(data || [])
    } catch (e) {
      setError(e.message)
      console.error('Errore fetchSinistri:', e)
    } finally {
      setLoading(false)
    }
  }, [condominioId])

  const creaSinistro = useCallback(async (sinistroData) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('sinistri')
        .insert({
          ...sinistroData,
          condominio_id: condominioId,
        })
        .select()
        .single()

      if (error) throw error
      await fetchSinistri() // Ricarica la lista per popolare le relazioni complete
      return data
    } catch (e) {
      setError(e.message)
      console.error('Errore creaSinistro:', e)
      throw e
    } finally {
      setLoading(false)
    }
  }, [condominioId, fetchSinistri])

  const aggiornaSinistro = useCallback(async (id, modifiche) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('sinistri')
        .update(modifiche)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      await fetchSinistri() // Ricarica la lista per aggiornare tutte le relazioni
      return data
    } catch (e) {
      setError(e.message)
      console.error('Errore aggiornaSinistro:', e)
      throw e
    } finally {
      setLoading(false)
    }
  }, [fetchSinistri])

  const eliminaSinistro = useCallback(async (id) => {
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase
        .from('sinistri')
        .delete()
        .eq('id', id)

      if (error) throw error
      setSinistri(prev => prev.filter(s => s.id !== id))
    } catch (e) {
      setError(e.message)
      console.error('Errore eliminaSinistro:', e)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSpeseCollegate = useCallback(async (sinistroId) => {
    try {
      const { data, error } = await supabase
        .from('spese')
        .select('*')
        .eq('sinistro_id', sinistroId)
        .order('data_spesa', { ascending: false })

      if (error) throw error
      return data || []
    } catch (e) {
      console.error('Errore fetchSpeseCollegate:', e)
      throw e
    }
  }, [])

  const fetchSpeseNonCollegate = useCallback(async () => {
    if (!condominioId) return []
    try {
      const { data, error } = await supabase
        .from('spese')
        .select('*')
        .eq('condominio_id', condominioId)
        .is('sinistro_id', null)
        .order('data_spesa', { ascending: false })

      if (error) throw error
      return data || []
    } catch (e) {
      console.error('Errore fetchSpeseNonCollegate:', e)
      throw e
    }
  }, [condominioId])

  const collegaSpesa = useCallback(async (spesaId, sinistroId) => {
    try {
      const { data, error } = await supabase
        .from('spese')
        .update({ sinistro_id: sinistroId })
        .eq('id', spesaId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (e) {
      console.error('Errore collegaSpesa:', e)
      throw e
    }
  }, [])

  const scollegaSpesa = useCallback(async (spesaId) => {
    try {
      const { data, error } = await supabase
        .from('spese')
        .update({ sinistro_id: null })
        .eq('id', spesaId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (e) {
      console.error('Errore scollegaSpesa:', e)
      throw e
    }
  }, [])

  return {
    sinistri,
    loading,
    error,
    fetchSinistri,
    creaSinistro,
    aggiornaSinistro,
    eliminaSinistro,
    fetchSpeseCollegate,
    fetchSpeseNonCollegate,
    collegaSpesa,
    scollegaSpesa,
  }
}
