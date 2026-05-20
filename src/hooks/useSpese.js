// src/hooks/useSpese.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useSpese(condominioId) {
  const [spese, setSpese]           = useState([])
  const [esercizi, setEsercizi]     = useState([])
  const [esercizioAttivo, setEsercizioAttivo] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  // ── Fetch esercizi ─────────────────────────────────────────────────────
  const fetchEsercizi = useCallback(async () => {
    if (!condominioId) return
    const { data, error } = await supabase
      .from('esercizi')
      .select('*')
      .eq('condominio_id', condominioId)
      .order('data_inizio', { ascending: false })
    if (error) throw error
    setEsercizi(data || [])
    // Seleziona automaticamente l'esercizio aperto più recente
    const aperto = (data || []).find(e => e.stato === 'aperto')
    if (aperto && !esercizioAttivo) setEsercizioAttivo(aperto)
  }, [condominioId])

  // ── Fetch spese esercizio attivo ───────────────────────────────────────
  const fetchSpese = useCallback(async () => {
    if (!esercizioAttivo?.id) { setSpese([]); setLoading(false); return }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('spese')
        .select('*, tabelle_millesimali(id, nome, codice)')
        .eq('esercizio_id', esercizioAttivo.id)
        .order('categoria')
        .order('created_at')
      if (error) throw error
      setSpese(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [esercizioAttivo?.id])

  useEffect(() => { fetchEsercizi() }, [fetchEsercizi])
  useEffect(() => { fetchSpese() },   [fetchSpese])

  // ── Crea esercizio ─────────────────────────────────────────────────────
  const createEsercizio = async (data) => {
    const { data: row, error } = await supabase
      .from('esercizi')
      .insert([{ ...data, condominio_id: condominioId }])
      .select().single()
    if (error) throw error
    await fetchEsercizi()

    // Genera automaticamente le 4 rate trimestrali
    const inizio = new Date(data.data_inizio)
    const rate = [1, 2, 3, 4].map(n => {
      const scad = new Date(inizio)
      scad.setMonth(scad.getMonth() + (n - 1) * 3)
      return {
        esercizio_id: row.id,
        condominio_id: condominioId,
        numero: n,
        scadenza: scad.toISOString().split('T')[0],
        descrizione: `${n}ª rata trimestrale`,
        perc_importo: 25,
        stato: 'attesa',
      }
    })
    await supabase.from('rate').insert(rate)
    return row
  }

  // ── Crea spesa ─────────────────────────────────────────────────────────
  const createSpesa = async (spesaData) => {
    const { data, error } = await supabase
      .from('spese')
      .insert([{
        ...spesaData,
        esercizio_id: esercizioAttivo.id,
        condominio_id: condominioId,
      }])
      .select().single()
    if (error) throw error
    await fetchSpese()
    return data
  }

  // ── Aggiorna spesa ─────────────────────────────────────────────────────
  const updateSpesa = async (id, updates) => {
    const { data, error } = await supabase
      .from('spese')
      .update(updates).eq('id', id).select().single()
    if (error) throw error
    await fetchSpese()
    return data
  }

  // ── Elimina spesa ──────────────────────────────────────────────────────
  const deleteSpesa = async (id) => {
    const { error } = await supabase.from('spese').delete().eq('id', id)
    if (error) throw error
    await fetchSpese()
  }

  // ── Totale spese esercizio ─────────────────────────────────────────────
  const totaleEsercizio = spese.reduce((s, sp) => s + Number(sp.importo_totale), 0)
  const totalePerCategoria = spese.reduce((acc, sp) => {
    acc[sp.categoria] = (acc[sp.categoria] || 0) + Number(sp.importo_totale)
    return acc
  }, {})

  return {
    spese, esercizi, esercizioAttivo, loading, error,
    setEsercizioAttivo,
    fetchSpese, fetchEsercizi,
    createEsercizio, createSpesa, updateSpesa, deleteSpesa,
    totaleEsercizio, totalePerCategoria,
  }
}
