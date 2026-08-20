// src/hooks/useNotifiche.js
// Hook React per il sistema di promemoria temporali di CondoFAST.
// Carica i dati necessari dal DB, li passa al motore di calcolo,
// e gestisce lo stato "letto" tramite localStorage.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from './usePlan'
import { calcolaNotifiche } from '../lib/notificheEngine'

const LS_KEY_PREFIX = 'condofast_notifiche_lette_'
const LS_KEY_PREFIX_OLD = 'condosmart_notifiche_lette_'

function getLetteKey(userId) {
  return `${LS_KEY_PREFIX}${userId}`
}

function caricaLette(userId) {
  try {
    const raw = localStorage.getItem(getLetteKey(userId)) || localStorage.getItem(`${LS_KEY_PREFIX_OLD}${userId}`)
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

      // Pre-fetch condomini dell'amministratore per mapping nomi e filtro id
      const { data: cData } = await supabase
        .from('condomini')
        .select('id, nome')
        .eq('amministratore_id', user.id)

      const condominiList = cData || []
      const condominiMap = new Map(condominiList.map(c => [c.id, c.nome]))
      const condominiIds = condominiList.map(c => c.id)

      if (condominiIds.length === 0) {
        setNotifiche([])
        return
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
              .select('id, condominio_id, ritenuta_acconto, stato, ritenuta_pagata, data_pagamento')
              .in('condominio_id', condominiIds)
              .gt('ritenuta_acconto', 0)
              .neq('ritenuta_pagata', true)
          : Promise.resolve({ data: [] }),

        // Rate scadute non pagate
        settings.rate_scadute?.enabled
          ? supabase
              .from('rate_unita')
              .select(`
                id, stato, importo, importo_pagato, condominio_id,
                rate:rata_id(
                  id, data_scadenza,
                  esercizi(
                    id, anno, condominio_id
                  )
                )
              `)
              .in('condominio_id', condominiIds)
              .neq('stato', 'pagata')
          : Promise.resolve({ data: [] }),

        // Esercizi aperti con data_fine
        settings.esercizio_in_scadenza?.enabled
          ? supabase
              .from('esercizi')
              .select('id, anno, condominio_id, data_fine')
              .not('data_fine', 'is', null)
              .in('condominio_id', condominiIds)
          : Promise.resolve({ data: [] }),

        // Movimenti non riconciliati
        settings.movimenti_non_riconciliati?.enabled
          ? supabase
              .from('estratto_conto')
              .select('id, condominio_id, data_movimento, importo, riconciliato')
              .in('condominio_id', condominiIds)
              .eq('riconciliato', false)
              .not('data_movimento', 'is', null)
          : Promise.resolve({ data: [] }),
      ])

      const dati = {
        fatture: (fatture || []).map(f => ({
          ...f,
          f24_presentato: f.ritenuta_pagata,
          condomini: { nome: condominiMap.get(f.condominio_id) || 'Condominio' }
        })),
        rateUnita: (rateUnita || []).map(ru => ({
          ...ru,
          scadenza: ru.rate?.data_scadenza,
          dovuto: ru.importo,
          rate: {
            ...ru.rate,
            esercizi: {
              ...ru.rate?.esercizi,
              condomini: { nome: condominiMap.get(ru.condominio_id || ru.rate?.esercizi?.condominio_id) || 'Condominio' }
            }
          }
        })),
        esercizi: (esercizi || []).map(e => ({
          ...e,
          condomini: { nome: condominiMap.get(e.condominio_id) || 'Condominio' }
        })),
        movimenti: (movimenti || []).map(m => ({
          ...m,
          data: m.data_movimento,
          condomini: { nome: condominiMap.get(m.condominio_id) || 'Condominio' }
        })),
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
