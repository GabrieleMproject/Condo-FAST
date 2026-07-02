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
            id, ruolo, attivo, data_inizio, data_fine,
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

  // ── SANITIZZA PAYLOAD ──────────────────────────────────────────────────
  const cleanUnitaPayload = (d) => {
    const out = { ...d }
    delete out.millesimi // I millesimi appartengono a millesimi_unita, inviarli a unita genera errore PostgREST
    if (out.piano !== undefined && out.piano !== null && out.piano !== '') {
      const p = Number(String(out.piano).replace(/,/g, '.').replace(/[^0-9.-]/g, ''))
      out.piano = isNaN(p) ? null : p
    } else if (out.piano === '') {
      out.piano = null
    }
    if (out.mq !== undefined && out.mq !== null && out.mq !== '') {
      const m = Number(String(out.mq).replace(/,/g, '.').replace(/[^0-9.-]/g, ''))
      out.mq = isNaN(m) ? null : m
    } else if (out.mq === '') {
      out.mq = null
    }
    return out
  }

  // ── CREATE ─────────────────────────────────────────────────────────────
  const createUnita = async (unitaData) => {
    const cleanData = cleanUnitaPayload(unitaData)
    const { data, error } = await supabase
      .from('unita')
      .insert([{ ...cleanData, condominio_id: condominioId }])
      .select()
      .single()
    if (error) throw error
    await fetchUnita()
    return data
  }

  // ── UPDATE ─────────────────────────────────────────────────────────────
  const updateUnita = async (id, updates) => {
    const cleanData = cleanUnitaPayload(updates)
    const { data, error } = await supabase
      .from('unita')
      .update(cleanData)
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
