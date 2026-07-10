// src/hooks/usePersone.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function usePersone() {
  const [persone, setPersone]  = useState([])
  const [loading, setLoading]  = useState(true)
  const [error, setError]      = useState(null)

  // ── FETCH ALL ──────────────────────────────────────────────────────────
  const fetchPersone = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('persone')
        .select(`
          *,
          occupanti_unita (
            id, ruolo, attivo,
            unita (id, numero, tipo, scala, piano, condominio_id,
              condomini (id, nome)
            )
          )
        `)
        .order('cognome', { ascending: true })
        .order('nome', { ascending: true })

      if (error) throw error
      setPersone(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPersone() }, [fetchPersone])

  // ── CREATE PERSONA ──────────────────────────────────────────────────────
  const createPersona = async (personaData) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('persone')
      .insert([{ ...personaData, user_id: user.id }])
      .select()
      .single()
    if (error) throw error
    await fetchPersone()
    return data
  }

  // ── UPDATE PERSONA ──────────────────────────────────────────────────────
  const updatePersona = async (id, updates) => {
    const { data, error } = await supabase
      .from('persone')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    await fetchPersone()
    return data
  }

  // ── DELETE PERSONA ──────────────────────────────────────────────────────
  const deletePersona = async (id) => {
    const { error } = await supabase.from('persone').delete().eq('id', id)
    if (error) throw error
    await fetchPersone()
  }

  // ── ASSEGNA A UNITÀ ─────────────────────────────────────────────────────
  // Crea o aggiorna il legame occupante ↔ unità
  const assegnaPersona = async (unitaId, personaId, ruolo, dataInizio = null) => {
    const dataInizioVal = dataInizio || new Date().toISOString().split('T')[0];
    // Calcola data_fine come dataInizio meno 1 giorno
    let dataFine = null;
    try {
      const d = new Date(dataInizioVal);
      d.setDate(d.getDate() - 1);
      dataFine = d.toISOString().split('T')[0];
    } catch (e) {
      console.error('[usePersone] Errore calcolo dataFine:', e);
    }

    // Disattiva eventuale occupante precedente dello stesso ruolo
    await supabase
      .from('occupanti_unita')
      .update({ 
        attivo: false,
        data_fine: dataFine
      })
      .eq('unita_id', unitaId)
      .eq('ruolo', ruolo)
      .eq('attivo', true)

    // Inserisce nuovo legame
    const { data, error } = await supabase
      .from('occupanti_unita')
      .insert([{
        unita_id: unitaId,
        persona_id: personaId,
        ruolo,
        attivo: true,
        data_inizio: dataInizioVal,
      }])
      .select()
      .single()
    if (error) throw error
    return data
  }

  // ── RIMUOVI DA UNITÀ ────────────────────────────────────────────────────
  const rimuoviPersona = async (occupanteId) => {
    const { error } = await supabase
      .from('occupanti_unita')
      .update({ attivo: false })
      .eq('id', occupanteId)
    if (error) throw error
    await fetchPersone()
  }

  // ── IMPORT BULK ─────────────────────────────────────────────────────────
  // Inserisce un array di persone + opzionalmente le assegna a unità
  const importPersone = async (personeArray) => {
    const { data: { user } } = await supabase.auth.getUser()
    const results = { created: 0, errors: [] }

    for (const p of personeArray) {
      try {
        // Crea persona
        const { data: persona, error: pErr } = await supabase
          .from('persone')
          .insert([{
            user_id: user.id,
            nome: p.nome || '',
            cognome: p.cognome || '',
            email: p.email || null,
            telefono: p.telefono || null,
            indirizzo: p.indirizzo || null,
            citta: p.citta || null,
            cap: p.cap || null,
            provincia: p.provincia || null,
            codice_fiscale: p.codice_fiscale || null,
          }])
          .select()
          .single()
        if (pErr) throw pErr

        // Se ha unita_id e ruolo → assegna
        if (p.unita_id && p.ruolo) {
          await assegnaPersona(p.unita_id, persona.id, p.ruolo)
        }
        results.created++
      } catch (err) {
        results.errors.push({ row: p, error: err.message })
      }
    }

    await fetchPersone()
    return results
  }

  return {
    persone, loading, error,
    fetchPersone, createPersona, updatePersona, deletePersona,
    assegnaPersona, rimuoviPersona, importPersone,
  }
}
