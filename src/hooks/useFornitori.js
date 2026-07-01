import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useFornitori() {
  const [fornitori, setFornitori] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchFornitori = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('fornitori')
        .select('*')
        .order('ragione_sociale', { ascending: true })

      if (error) throw error
      setFornitori(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFornitori()
  }, [fetchFornitori])

  const createFornitore = async (fornitoreData) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('fornitori')
      .insert([{ ...fornitoreData, user_id: user.id }])
      .select()
      .single()

    if (error) throw error
    await fetchFornitori()
    return data
  }

  const updateFornitore = async (id, updates) => {
    const { data, error } = await supabase
      .from('fornitori')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    await fetchFornitori()
    return data
  }

  const deleteFornitore = async (id) => {
    const { error } = await supabase
      .from('fornitori')
      .delete()
      .eq('id', id)

    if (error) throw error
    await fetchFornitori()
  }

  return {
    fornitori,
    loading,
    error,
    fetchFornitori,
    createFornitore,
    updateFornitore,
    deleteFornitore
  }
}
