import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

/**
 * Custom hook per la gestione centralizzata dell'esercizio attivo in un condominio.
 * Sincronizza l'esercizio selezionato direttamente nei parametri URL (?esercizio=...)
 * garantendo la memoria del contesto anche dopo il refresh della pagina.
 */
export function useEsercizioCorrente(condominioId) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [esercizi, setEsercizi] = useState([])
  const [esercizioAttivo, setEsercizioAttivo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const urlEsercizioId = searchParams.get('esercizio')

  const fetchEsercizi = useCallback(async () => {
    if (!condominioId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('esercizi')
        .select('*')
        .eq('condominio_id', condominioId)
        .order('anno', { ascending: false })

      if (error) throw error

      const lista = data || []
      setEsercizi(lista)

      if (lista.length > 0) {
        // 1. Cerca se l'URL ha un ID valido
        let selezionato = urlEsercizioId ? lista.find(e => e.id === urlEsercizioId) : null
        
        // 2. Se non c'è in URL o non è valido, prendi quello 'aperto' o il primo (più recente)
        if (!selezionato) {
          selezionato = lista.find(e => e.stato === 'aperto') || lista[0]
        }

        setEsercizioAttivo(selezionato)

        // 3. Sincronizza l'URL se diverso da quello corrente per evitare perdite al refresh
        if (selezionato && urlEsercizioId !== selezionato.id) {
          setSearchParams((prevParams) => {
            const newParams = new URLSearchParams(prevParams)
            newParams.set('esercizio', selezionato.id)
            return newParams
          }, { replace: true })
        }
      } else {
        setEsercizioAttivo(null)
      }
    } catch (e) {
      console.error('Errore nel recupero degli esercizi:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [condominioId, urlEsercizioId, setSearchParams])

  useEffect(() => {
    fetchEsercizi()
  }, [condominioId]) // ricarica al cambio condominio

  // Sincronizza l'esercizio attivo se l'URL cambia e gli esercizi sono già caricati
  useEffect(() => {
    if (!esercizi.length) return
    if (urlEsercizioId) {
      const match = esercizi.find(e => e.id === urlEsercizioId)
      if (match && match.id !== esercizioAttivo?.id) {
        setEsercizioAttivo(match)
      }
    }
  }, [urlEsercizioId, esercizi, esercizioAttivo?.id])

  // Seleziona manualmente un nuovo esercizio dall'UI e aggiorna l'URL
  const setEsercizioId = useCallback((nuovoId) => {
    const trovato = esercizi.find(e => e.id === nuovoId)
    if (trovato) {
      setEsercizioAttivo(trovato)
      setSearchParams((prevParams) => {
        const newParams = new URLSearchParams(prevParams)
        newParams.set('esercizio', nuovoId)
        return newParams
      }, { replace: true })
    }
  }, [esercizi, setSearchParams])

  const isChiuso = esercizioAttivo?.stato === 'chiuso'

  return {
    esercizi,
    esercizioAttivo,
    esercizioId: esercizioAttivo?.id || null,
    setEsercizioId,
    isChiuso,
    loading,
    error,
    refreshEsercizi: fetchEsercizi
  }
}
