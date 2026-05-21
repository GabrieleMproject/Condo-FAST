import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useSpese(condominioId, esercizioId) {
  const [spese, setSpese] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    if (!condominioId) return
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('spese')
        .select(`
          *,
          tabelle_millesimali(id, nome),
          ripartizioni(
            id, unita_id, importo, millesimi_usati,
            importo_override, note_subentro, subentro_segnalato,
            unita(id, interno, piano)
          )
        `)
        .eq('condominio_id', condominioId)
        .order('data_spesa', { ascending: false })

      if (esercizioId) query = query.eq('esercizio_id', esercizioId)

      const { data, error } = await query
      if (error) throw error
      setSpese(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [condominioId, esercizioId])

  const crea = useCallback(async (payload, ripartizioniCalcolate) => {
    setLoading(true)
    setError(null)
    try {
      // Setta user_id per audit log
      await supabase.rpc('set_config', {
        setting: 'app.current_user_id',
        value: (await supabase.auth.getUser()).data.user?.id || ''
      }).catch(() => {})

      const { data: spesa, error: spesaError } = await supabase
        .from('spese')
        .insert({ ...payload, condominio_id: condominioId })
        .select()
        .single()
      if (spesaError) throw spesaError

      // Salva ripartizioni se fornite
      if (ripartizioniCalcolate?.length > 0) {
        const records = ripartizioniCalcolate.map(r => ({
          spesa_id: spesa.id,
          unita_id: r.unita_id,
          importo: r.importo,
          millesimi_usati: r.millesimi_usati || null,
          criterio_applicato: payload.criterio,
        }))
        const { error: ripartErr } = await supabase.from('ripartizioni').insert(records)
        if (ripartErr) throw ripartErr
      }

      await fetch()
      return spesa
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [condominioId, fetch])

  const aggiorna = useCallback(async (id, payload, ripartizioniCalcolate) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('spese')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      // Ricalcola ripartizioni se fornite
      if (ripartizioniCalcolate) {
        await supabase.from('ripartizioni').delete().eq('spesa_id', id)
        if (ripartizioniCalcolate.length > 0) {
          const records = ripartizioniCalcolate.map(r => ({
            spesa_id: id,
            unita_id: r.unita_id,
            importo: r.importo,
            millesimi_usati: r.millesimi_usati || null,
            criterio_applicato: payload.criterio || data.criterio,
          }))
          await supabase.from('ripartizioni').insert(records)
        }
      }

      await fetch()
      return data
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [fetch])

  const elimina = useCallback(async (id) => {
    setLoading(true)
    try {
      const { error } = await supabase.from('spese').delete().eq('id', id)
      if (error) throw error
      setSpese(prev => prev.filter(s => s.id !== id))
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  // Segna subentro su una ripartizione specifica
  const segnalaSubentro = useCallback(async (ripartizioneId, importoOverride, noteSubentro) => {
    const { data, error } = await supabase
      .from('ripartizioni')
      .update({
        importo_override: importoOverride,
        note_subentro: noteSubentro,
        subentro_segnalato: true,
      })
      .eq('id', ripartizioneId)
      .select()
      .single()
    if (error) throw error
    await fetch()
    return data
  }, [fetch])

  // Calcola ripartizioni lato client (senza salvarle)
  const calcolaRipartizioni = useCallback((spesa, tabellaMill, unita) => {
    const { importo, criterio, percentuale_millesimi = 100 } = spesa

    if (criterio === 'quota_fissa') {
      const nUnita = unita.length
      const quota = nUnita > 0 ? importo / nUnita : 0
      return unita.map(u => ({
        unita_id: u.id,
        unita,
        importo: Math.round(quota * 100) / 100,
        millesimi_usati: null,
      }))
    }

    if (criterio === 'millesimi' || criterio === 'mista') {
      if (!tabellaMill?.millesimi_unita?.length) return []

      const totaleMillesimi = tabellaMill.millesimi_unita.reduce(
        (sum, m) => sum + parseFloat(m.valore || 0), 0
      )
      if (totaleMillesimi === 0) return []

      const importoMillesimi = criterio === 'mista'
        ? importo * (percentuale_millesimi / 100)
        : importo
      const importoFisso = importo - importoMillesimi
      const nUnita = unita.length

      return unita.map(u => {
        const mill = tabellaMill.millesimi_unita.find(m => m.unita_id === u.id)
        const valMill = parseFloat(mill?.valore || 0)
        const quotaMill = totaleMillesimi > 0 ? (valMill / totaleMillesimi) * importoMillesimi : 0
        const quotaFissa = nUnita > 0 ? importoFisso / nUnita : 0
        return {
          unita_id: u.id,
          unita: u,
          importo: Math.round((quotaMill + quotaFissa) * 100) / 100,
          millesimi_usati: valMill,
        }
      })
    }

    return []
  }, [])

  // Rileva spese con subentri non gestiti per un'unità
  const getSpesePendentiSubentro = useCallback((unitaId) => {
    return spese.filter(s =>
      s.ripartizioni?.some(r => r.unita_id === unitaId && r.subentro_segnalato && !r.importo_override)
    )
  }, [spese])

  return {
    spese, loading, error,
    fetch, crea, aggiorna, elimina,
    calcolaRipartizioni, segnalaSubentro, getSpesePendentiSubentro
  }
}
