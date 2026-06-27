// src/hooks/useSaldiIniziali.js
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useSaldiIniziali(condominioId) {
  const [saldi, setSaldi] = useState([])          // righe saldi_iniziali_unita dell'esercizio
  const [saldoCassa, setSaldoCassa] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // ── Carica saldi per un esercizio + esercizi.saldo_iniziale_cassa ──────────
  const fetch = useCallback(async (esercizioId) => {
    if (!condominioId || !esercizioId) return
    setLoading(true); setError(null)
    try {
      const [{ data: si, error: e1 }, { data: es, error: e2 }] = await Promise.all([
        supabase.from('saldi_iniziali_unita')
          .select('id, unita_id, saldo, note')
          .eq('esercizio_id', esercizioId),
        supabase.from('esercizi')
          .select('saldo_iniziale_cassa')
          .eq('id', esercizioId)
          .single(),
      ])
      if (e1) throw e1
      if (e2) throw e2
      setSaldi(si || [])
      setSaldoCassa(es?.saldo_iniziale_cassa ?? null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [condominioId])

  // ── Upsert saldi per unità: valori = [{ unita_id, saldo, note }] ───────────
  const salvaSaldi = useCallback(async (esercizioId, valori) => {
    setLoading(true); setError(null)
    try {
      const records = valori
        .filter(v => v.unita_id)
        .map(v => {
          const n = parseFloat(v.saldo)
          return {
            esercizio_id:  esercizioId,
            condominio_id: condominioId,
            unita_id:      v.unita_id,
            saldo:         Number.isFinite(n) ? Math.round(n * 100) / 100 : 0,
            note:          v.note?.trim() || null,
          }
        })
      const { data, error } = await supabase
        .from('saldi_iniziali_unita')
        .upsert(records, { onConflict: 'esercizio_id,unita_id' })
        .select('id, unita_id, saldo, note')
      if (error) throw error
      setSaldi(data || [])
      return data
    } catch (e) {
      setError(e.message); throw e
    } finally {
      setLoading(false)
    }
  }, [condominioId])

  // ── Salva fondo cassa riportato su esercizi.saldo_iniziale_cassa ───────────
  const salvaSaldoCassa = useCallback(async (esercizioId, importo) => {
    const n = parseFloat(importo)
    const val = Number.isFinite(n) ? Math.round(n * 100) / 100 : null
    const { error } = await supabase
      .from('esercizi')
      .update({ saldo_iniziale_cassa: val })
      .eq('id', esercizioId)
    if (error) throw error
    setSaldoCassa(val)
    return val
  }, [])

  // ── Auto-riporto: saldo finale per unità dell'esercizio precedente ─────────
  // saldo_finale = saldo_iniziale(prec) + versato − dovuto
  //   dovuto  = Σ rate_unita.importo        (piano)
  //   versato = Σ rate_unita.importo_pagato (incassato)
  // Segno coerente con la convenzione DB: >0 credito condòmino, <0 debito.
  const calcolaDaEsercizio = useCallback(async (esercizioPrecId) => {
    const [{ data: rate, error: e1 }, { data: siPrec, error: e2 }] = await Promise.all([
      supabase.from('rate')
        .select('id, rate_unita(unita_id, importo, importo_pagato)')
        .eq('esercizio_id', esercizioPrecId),
      supabase.from('saldi_iniziali_unita')
        .select('unita_id, saldo')
        .eq('esercizio_id', esercizioPrecId),
    ])
    if (e1) throw e1
    if (e2) throw e2

    const acc = {} // unita_id → { dovuto, versato }
    ;(rate || []).forEach(r => {
      ;(r.rate_unita || []).forEach(cell => {
        const a = acc[cell.unita_id] || { dovuto: 0, versato: 0 }
        a.dovuto  += parseFloat(cell.importo || 0)
        a.versato += parseFloat(cell.importo_pagato || 0)
        acc[cell.unita_id] = a
      })
    })
    const iniz = {}
    ;(siPrec || []).forEach(s => { iniz[s.unita_id] = parseFloat(s.saldo || 0) })

    const ids = new Set([...Object.keys(acc), ...Object.keys(iniz)])
    return Array.from(ids).map(uid => {
      const a = acc[uid] || { dovuto: 0, versato: 0 }
      const saldo = Math.round(((iniz[uid] || 0) + a.versato - a.dovuto) * 100) / 100
      return { unita_id: uid, saldo }
    })
  }, [])

  return { saldi, saldoCassa, loading, error, fetch, salvaSaldi, salvaSaldoCassa, calcolaDaEsercizio }
}