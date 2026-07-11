// src/hooks/useNotifiche.js
// Hook React per il sistema di promemoria temporali di CondoSmart.
// Carica i dati necessari dal DB, li passa al motore di calcolo,
// e gestisce lo stato "letto" tramite localStorage.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from './usePlan'
import { calcolaNotifiche } from '../lib/notificheEngine'

const LS_KEY_PREFIX = 'condosmart_notifiche_lette_'

function getLetteKey(userId) {
  return `${LS_KEY_PREFIX}${userId}`
}

function caricaLette(userId) {
  try {
    const raw = localStorage.getItem(getLetteKey(userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function salvaLette(userId, ids) {
  try {
    localStorage.setItem(getLetteKey(userId), JSON.stringify(ids))
  } catch { /* ignora errori storage */ }
}

export function useNotifiche() {
  const { user } = useAuth()
  const { profile } = usePlan()

  const [notifiche, setNotifiche]       = useState([])
  const [notificheLette, setNotificheLette] = useState([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)

  // Carica le notifiche lette da localStorage al mount
  useEffect(() => {
    if (user?.id) {
      setNotificheLette(caricaLette(user.id))
    }
  }, [user?.id])

  const fetchNotifiche = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)

    try {
      const settings = profile?.notification_settings || {}

      // Pre-fetch IDs condomini dell'amministratore (necessario per il .in() su esercizi).
      // Estratto prima di Promise.all per evitare await annidato che rompe la parallelizzazione.
      let condominiIds = []
      if (settings.esercizio_in_scadenza?.enabled) {
        const { data: cData } = await supabase
          .from('condomini')
          .select('id')
          .eq('amministratore_id', user.id)
        condominiIds = (cData || []).map(c => c.id)
      }

      // Query parallele read-only sui dati necessari
      const [
        { data: fatture },
        { data: rateUnita },
        { data: esercizi },
        { data: movimenti },
      ] = await Promise.all([
        // F24: fatture con ritenuta, pagate, F24 non ancora presentato
        settings.f24_ritenute?.enabled
          ? supabase
              .from('fatture_fornitori')
              .select('id, condominio_id, ritenuta_acconto, stato, f24_presentato, data_pagamento, condomini(nome)')
              .eq('amministratore_id', user.id)
              .gt('ritenuta_acconto', 0)
              .neq('f24_presentato', true)
          : Promise.resolve({ data: [] }),

        // Rate scadute non pagate
        settings.rate_scadute?.enabled
          ? supabase
              .from('rate_unita')
              .select(`
                id, stato, scadenza, dovuto, condominio_id,
                rate(
                  id,
                  esercizi(
                    id, anno, condominio_id,
                    condomini(nome)
                  )
                )
              `)
              .neq('stato', 'pagata')
              .not('scadenza', 'is', null)
          : Promise.resolve({ data: [] }),

        // Esercizi aperti con data_fine (usa condominiIds pre-calcolati fuori da Promise.all)
        settings.esercizio_in_scadenza?.enabled && condominiIds.length > 0
          ? supabase
              .from('esercizi')
              .select('id, anno, condominio_id, data_fine, condomini(nome)')
              .not('data_fine', 'is', null)
              .in('condominio_id', condominiIds)
          : Promise.resolve({ data: [] }),

        // Movimenti non riconciliati
        settings.movimenti_non_riconciliati?.enabled
          ? supabase
              .from('estratto_conto')
              .select('id, condominio_id, data, importo, riconciliato, condomini(nome)')
              .eq('riconciliato', false)
              .not('data', 'is', null)
          : Promise.resolve({ data: [] }),
      ])

      const dati = {
        fatture: fatture || [],
        rateUnita: rateUnita || [],
        esercizi: esercizi || [],
        movimenti: movimenti || [],
      }

      const calcolate = calcolaNotifiche(settings, dati, new Date())
      setNotifiche(calcolate)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user?.id, profile?.notification_settings])

  // Fetch al mount e quando cambia il profilo (es. dopo aver salvato le impostazioni)
  useEffect(() => {
    if (profile !== null) {
      fetchNotifiche()
    }
  }, [fetchNotifiche, profile])

  // Segna una singola notifica come letta
  const segnaLetta = useCallback((id) => {
    if (!user?.id) return
    setNotificheLette(prev => {
      if (prev.includes(id)) return prev
      const nuove = [...prev, id]
      salvaLette(user.id, nuove)
      return nuove
    })
  }, [user?.id])

  // Segna tutte le notifiche correnti come lette
  const segnaAllLette = useCallback(() => {
    if (!user?.id) return
    const ids = notifiche.map(n => n.id)
    setNotificheLette(prev => {
      const nuove = Array.from(new Set([...prev, ...ids]))
      salvaLette(user.id, nuove)
      return nuove
    })
  }, [user?.id, notifiche])

  // Notifiche non ancora lette
  const nonLette = notifiche.filter(n => !notificheLette.includes(n.id))

  return {
    notifiche,
    nonLette,
    count: nonLette.length,
    loading,
    error,
    refresh: fetchNotifiche,
    segnaLetta,
    segnaAllLette,
  }
}
