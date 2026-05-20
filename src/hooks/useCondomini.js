import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

export function useCondomini() {
  const { user } = useAuth()
  const [condomini, setCondomini] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCondomini = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('condomini')
        .select('*')
        .order('nome', { ascending: true })

      if (error) throw error
      setCondomini(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchCondomini()
  }, [fetchCondomini])

  const createCondominio = async (formData) => {
    const { data, error } = await supabase
      .from('condomini')
      .insert([{ ...formData, amministratore_id: user.id }])
      .select()
      .single()

    if (error) throw error
    setCondomini(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)))
    return data
  }

  const updateCondominio = async (id, formData) => {
    const { data, error } = await supabase
      .from('condomini')
      .update(formData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    setCondomini(prev => prev.map(c => c.id === id ? data : c))
    return data
  }

  const deleteCondominio = async (id) => {
    const { error } = await supabase
      .from('condomini')
      .delete()
      .eq('id', id)

    if (error) throw error
    setCondomini(prev => prev.filter(c => c.id !== id))
  }

  const archiviaCondominio = async (id) => {
    return updateCondominio(id, { stato: 'archiviato' })
  }

  return {
    condomini,
    loading,
    error,
    refetch: fetchCondomini,
    createCondominio,
    updateCondominio,
    deleteCondominio,
    archiviaCondominio,
  }
}
