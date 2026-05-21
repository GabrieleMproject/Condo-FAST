import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAuditLog() {
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [totale, setTotale] = useState(0)

  const fetch = useCallback(async ({
    condominioId = null,
    categoria = null,
    azione = null,
    dataDal = null,
    dataAl = null,
    cerca = '',
    pagina = 0,
    perPagina = 50,
  } = {}) => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('audit_log')
        .select('*, condomini(nome)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(pagina * perPagina, (pagina + 1) * perPagina - 1)

      if (condominioId) query = query.eq('condominio_id', condominioId)
      if (categoria) query = query.eq('categoria', categoria)
      if (azione) query = query.eq('azione', azione)
      if (dataDal) query = query.gte('created_at', dataDal)
      if (dataAl) query = query.lte('created_at', dataAl + 'T23:59:59')
      if (cerca) query = query.or(`tabella_modificata.ilike.%${cerca}%,note.ilike.%${cerca}%`)

      const { data, error, count } = await query
      if (error) throw error
      setLog(data || [])
      setTotale(count || 0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch log per un record specifico (es. storico di una singola unità)
  const fetchRecord = useCallback(async (recordId) => {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  }, [])

  return { log, loading, error, totale, fetch, fetchRecord }
}
