import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAssemblee(condominioId) {
  const [assemblee, setAssemblee] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    if (!condominioId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('assemblee')
        .select(`
          *,
          assemblee_odg (
            id, numero_ordine, titolo, descrizione, tabella_millesimale_id, stato_votazione
          )
        `)
        .eq('condominio_id', condominioId)
        .order('data_inizio', { ascending: false })
      if (error) throw error
      setAssemblee(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [condominioId])

  const crea = useCallback(async (payload, odgList = []) => {
    setLoading(true)
    setError(null)
    try {
      const { data: assemblea, error } = await supabase
        .from('assemblee')
        .insert({ ...payload, condominio_id: condominioId })
        .select()
        .single()
      
      if (error) throw error

      let odgData = []
      if (odgList.length > 0) {
        const { data: odgInsert, error: odgError } = await supabase
          .from('assemblee_odg')
          .insert(odgList.map((odg, idx) => ({
            ...odg,
            assemblea_id: assemblea.id,
            numero_ordine: idx + 1
          })))
          .select()
        if (odgError) throw odgError
        odgData = odgInsert
      }

      const fullAssemblea = { ...assemblea, assemblee_odg: odgData }
      setAssemblee(prev => [fullAssemblea, ...prev])
      return fullAssemblea
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
        .from('assemblee')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      
      setAssemblee(prev => prev.map(a => a.id === id ? { ...a, ...data } : a))
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
      const { error } = await supabase.from('assemblee').delete().eq('id', id)
      if (error) throw error
      setAssemblee(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const aggiornaOdg = useCallback(async (odgId, payload) => {
    const { data, error } = await supabase
      .from('assemblee_odg')
      .update(payload)
      .eq('id', odgId)
      .select()
      .single()
    if (error) throw error
    setAssemblee(prev => prev.map(a => ({
      ...a,
      assemblee_odg: a.assemblee_odg?.map(o => o.id === odgId ? { ...o, ...data } : o)
    })))
    return data
  }, [])

  return { assemblee, loading, error, fetch, crea, aggiorna, elimina, aggiornaOdg }
}
