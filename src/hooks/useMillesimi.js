import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useMillesimi(condominioId) {
  const [tabelle, setTabelle] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    if (!condominioId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('tabelle_millesimali')
        .select(`*, millesimi_unita(*, unita(id, interno, piano, tipo))`)
        .eq('condominio_id', condominioId)
        .order('nome')
      if (error) throw error
      setTabelle(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [condominioId])

  const creaTabella = useCallback(async (payload) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tabelle_millesimali')
        .insert({ ...payload, condominio_id: condominioId })
        .select()
        .single()
      if (error) throw error
      setTabelle(prev => [...prev, { ...data, millesimi_unita: [] }])
      return data
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [condominioId])

  const aggiornaTabella = useCallback(async (id, payload) => {
    const { data, error } = await supabase
      .from('tabelle_millesimali')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setTabelle(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
    return data
  }, [])

  const eliminaTabella = useCallback(async (id) => {
    const { error } = await supabase.from('tabelle_millesimali').delete().eq('id', id)
    if (error) throw error
    setTabelle(prev => prev.filter(t => t.id !== id))
  }, [])

  // Salva i millesimi per tutte le unità di una tabella (upsert bulk)
  const salvaMillesimi = useCallback(async (tabellaId, valori) => {
    // valori: [{ unita_id, valore }]
    setLoading(true)
    try {
      const records = valori.map(v => ({
        tabella_id: tabellaId,
        unita_id: v.unita_id,
        valore: parseFloat(v.valore) || 0
      }))

      const { data, error } = await supabase
        .from('millesimi_unita')
        .upsert(records, { onConflict: 'tabella_id,unita_id' })
        .select()
      if (error) throw error

      // Aggiorna stato locale
      setTabelle(prev => prev.map(t => {
        if (t.id !== tabellaId) return t
        const existingMap = {}
        t.millesimi_unita?.forEach(m => { existingMap[m.unita_id] = m })
        data.forEach(m => { existingMap[m.unita_id] = { ...existingMap[m.unita_id], ...m } })
        return { ...t, millesimi_unita: Object.values(existingMap) }
      }))

      return data
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  // Ottieni millesimi di una specifica unità per tabella
  const getMillesimiUnita = useCallback((tabellaId, unitaId) => {
    const tabella = tabelle.find(t => t.id === tabellaId)
    return tabella?.millesimi_unita?.find(m => m.unita_id === unitaId)?.valore || 0
  }, [tabelle])

  // Somma totale millesimi di una tabella
  const getTotaleTabella = useCallback((tabellaId) => {
    const tabella = tabelle.find(t => t.id === tabellaId)
    return tabella?.millesimi_unita?.reduce((sum, m) => sum + parseFloat(m.valore || 0), 0) || 0
  }, [tabelle])

  return {
    tabelle, loading, error,
    fetch, creaTabella, aggiornaTabella, eliminaTabella,
    salvaMillesimi, getMillesimiUnita, getTotaleTabella
  }
}
