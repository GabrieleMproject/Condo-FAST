// src/hooks/useUnita.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useUnita(condominioId = null) {
  const [unita, setUnita]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // ── FETCH ──────────────────────────────────────────────────────────────
  const fetchUnita = useCallback(async () => {
    if (!condominioId) { setUnita([]); setLoading(false); return }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('unita')
        .select(`
          *,
          occupanti_unita (
            id, ruolo, attivo,
            persone (id, nome, cognome, email, telefono, indirizzo, citta)
          )
        `)
        .eq('condominio_id', condominioId)
        .order('scala', { ascending: true, nullsFirst: true })
        .order('piano', { ascending: true, nullsFirst: true })
        .order('numero', { ascending: true })

      if (error) throw error
      setUnita(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [condominioId])

  useEffect(() => { fetchUnita() }, [fetchUnita])

  // ── CREATE ─────────────────────────────────────────────────────────────
  const createUnita = async (unitaData) => {
    const { data, error } = await supabase
      .from('unita')
      .insert([{ ...unitaData, condominio_id: condominioId }])
      .select()
      .single()
    if (error) throw error
    await fetchUnita()
    return data
  }

  // ── UPDATE ─────────────────────────────────────────────────────────────
  const updateUnita = async (id, updates) => {
    const { data, error } = await supabase
      .from('unita')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    await fetchUnita()
    return data
  }

  // ── DELETE ─────────────────────────────────────────────────────────────
  const deleteUnita = async (id) => {
    const { error } = await supabase.from('unita').delete().eq('id', id)
    if (error) throw error
    await fetchUnita()
  }

  // ── HELPERS ────────────────────────────────────────────────────────────
  const getProprietario = (unita) =>
    unita.occupanti_unita?.find(o => o.ruolo === 'proprietario' && o.attivo)?.persone || null

  const getInquilino = (unita) =>
    unita.occupanti_unita?.find(o => o.ruolo === 'inquilino' && o.attivo)?.persone || null

  return {
    unita, loading, error,
    fetchUnita, createUnita, updateUnita, deleteUnita,
    getProprietario, getInquilino,
  }
}
