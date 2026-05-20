// src/hooks/useRipartizioni.js
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

// ═══════════════════════════════════════════════════════════════════════════
// MOTORE DI CALCOLO RIPARTIZIONI
// Supporta: millesimi | quota_fissa | mista
// Chi paga: proprietario | inquilino (per unità, con fallback su spesa)
// ═══════════════════════════════════════════════════════════════════════════
export function calcolaRipartizione(spesa, unita, millesimi_map, config_pagante_map) {
  const risultati = []
  const n = unita.length

  for (const u of unita) {
    let quota = 0

    if (spesa.criterio === 'quota_fissa') {
      quota = spesa.importo_totale / n

    } else if (spesa.criterio === 'millesimi') {
      const mill = millesimi_map[u.id] ?? 0
      const totale_mill = Object.values(millesimi_map).reduce((a, b) => a + b, 0)
      quota = totale_mill > 0 ? (spesa.importo_totale * mill) / totale_mill : 0

    } else if (spesa.criterio === 'mista') {
      const perc = (spesa.perc_millesimi ?? 100) / 100
      // Quota parte millesimi
      const mill = millesimi_map[u.id] ?? 0
      const totale_mill = Object.values(millesimi_map).reduce((a, b) => a + b, 0)
      const quota_mill = totale_mill > 0
        ? (spesa.importo_totale * perc * mill) / totale_mill
        : 0
      // Quota parte fissa
      const quota_fissa = spesa.importo_totale * (1 - perc) / n
      quota = quota_mill + quota_fissa
    }

    // Chi paga: straordinarie → sempre proprietario
    // ordinarie → config per unità o default spesa
    let pagante = spesa.pagante_default
    if (spesa.forza_proprietario || spesa.categoria === 'straordinaria') {
      pagante = 'proprietario'
    } else if (config_pagante_map[u.id]) {
      pagante = config_pagante_map[u.id]
    }

    // Persona concreta che paga ora
    const occupanti = u.occupanti_unita || []
    const occupante = occupanti.find(o => o.ruolo === pagante && o.attivo)
    const persona_id = occupante?.persona_id || null

    risultati.push({
      unita_id:       u.id,
      spesa_id:       spesa.id,
      esercizio_id:   spesa.esercizio_id,
      pagante,
      persona_id,
      importo_quota:  Math.round(quota * 100) / 100,
      millesimi_usati: millesimi_map[u.id] ?? null,
      calcolato_il:   new Date().toISOString(),
    })
  }

  return risultati
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════
export function useRipartizioni(condominioId, esercizioId) {
  const [ripartizioni, setRipartizioni] = useState([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)

  // ── Fetch ripartizioni esistenti ──────────────────────────────────────
  const fetchRipartizioni = useCallback(async () => {
    if (!esercizioId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('ripartizioni')
        .select(`
          *,
          unita (id, numero, tipo, scala, piano),
          spese (id, descrizione, categoria, importo_totale, criterio),
          persone (id, nome, cognome, email)
        `)
        .eq('esercizio_id', esercizioId)
        .order('unita_id')
      if (error) throw error
      setRipartizioni(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [esercizioId])

  // ── Ricalcola tutto l'esercizio ───────────────────────────────────────
  // Chiamata ogni volta che cambia anagrafica o spese
  const ricalcolaEsercizio = useCallback(async () => {
    if (!condominioId || !esercizioId) return
    setLoading(true)
    setError(null)

    try {
      // 1. Carica unità con occupanti
      const { data: unita } = await supabase
        .from('unita')
        .select(`
          id, numero, tipo, scala, piano, millesimi,
          occupanti_unita (id, ruolo, attivo, persona_id, persone(id, nome, cognome))
        `)
        .eq('condominio_id', condominioId)
        .eq('stato', 'attiva')

      // 2. Carica spese dell'esercizio
      const { data: spese } = await supabase
        .from('spese')
        .select('*, tabelle_millesimali(id, codice)')
        .eq('esercizio_id', esercizioId)

      // 3. Carica tabelle millesimali e valori
      const { data: millesimi_rows } = await supabase
        .from('millesimi_unita')
        .select('tabella_millesimale_id, unita_id, valore')
        .in('unita_id', (unita || []).map(u => u.id))

      // 4. Carica config pagante per unità
      const { data: config_rows } = await supabase
        .from('config_pagante_unita')
        .select('unita_id, pagante')
        .eq('esercizio_id', esercizioId)

      // Mappa config pagante
      const config_map = {}
      for (const c of config_rows || []) config_map[c.unita_id] = c.pagante

      // 5. Per ogni spesa, calcola e upsert ripartizioni
      const tutte = []
      for (const spesa of spese || []) {
        // Costruisci millesimi_map per questa spesa (tabella specifica o fallback unita.millesimi)
        const mill_map = {}
        for (const u of unita || []) {
          if (spesa.tabella_millesimale_id) {
            const row = (millesimi_rows || []).find(
              m => m.tabella_millesimale_id === spesa.tabella_millesimale_id && m.unita_id === u.id
            )
            mill_map[u.id] = row?.valore ?? 0
          } else {
            mill_map[u.id] = u.millesimi ?? 0
          }
        }

        const righe = calcolaRipartizione(spesa, unita || [], mill_map, config_map)
        tutte.push(...righe)
      }

      // 6. Upsert (cancella vecchie, inserisce nuove)
      if (tutte.length > 0) {
        await supabase.from('ripartizioni').delete().eq('esercizio_id', esercizioId)
        const { error: upsertErr } = await supabase.from('ripartizioni').insert(tutte)
        if (upsertErr) throw upsertErr
      }

      await fetchRipartizioni()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [condominioId, esercizioId, fetchRipartizioni])

  // ── Segna rata come pagata ────────────────────────────────────────────
  const segnaComePagato = async (ripartizione_id) => {
    const { error } = await supabase
      .from('ripartizioni')
      .update({ pagato: true, data_pagamento: new Date().toISOString().split('T')[0] })
      .eq('id', ripartizione_id)
    if (error) throw error
    await fetchRipartizioni()
  }

  // ── Totali per unità ──────────────────────────────────────────────────
  const getTotalePerUnita = (unitaId) => {
    const righe = ripartizioni.filter(r => r.unita_id === unitaId)
    return {
      totale:  righe.reduce((s, r) => s + Number(r.importo_quota), 0),
      pagato:  righe.filter(r => r.pagato).reduce((s, r) => s + Number(r.importo_quota), 0),
      residuo: righe.filter(r => !r.pagato).reduce((s, r) => s + Number(r.importo_quota), 0),
    }
  }

  // ── Totali per rata trimestrale ───────────────────────────────────────
  const getTotalePerRata = (percRata = 25) =>
    ripartizioni.reduce((s, r) => s + Number(r.importo_quota), 0) * (percRata / 100)

  return {
    ripartizioni, loading, error,
    fetchRipartizioni, ricalcolaEsercizio,
    segnaComePagato, getTotalePerUnita, getTotalePerRata,
  }
}
