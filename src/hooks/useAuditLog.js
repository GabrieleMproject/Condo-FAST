// src/hooks/useAuditLog.js
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAuditLog(condominioId_default) {
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(false)
  const [totale, setTotale] = useState(0)

  const fetch = useCallback(async (params = {}) => {
    setLoading(true)
    try {
      const {
        condominioId,
        categoria,
        azione,
        dataDal,
        dataAl,
        cerca,
        pagina = 0,
        perPagina = 50
      } = params

      // the actual table might be audit_logs based on BackofficePage.jsx and StoricoOperazioniPage.jsx logic
      let query = supabase.from('audit_logs').select('*, condomini(nome)', { count: 'exact' })

      const finalCondominioId = condominioId || condominioId_default
      if (finalCondominioId) {
        query = query.eq('condominio_id', finalCondominioId)
      }
      if (categoria) {
        query = query.eq('categoria', categoria)
      }
      if (azione) {
        query = query.eq('azione', azione)
      }
      if (dataDal) {
        query = query.gte('created_at', dataDal + 'T00:00:00')
      }
      if (dataAl) {
        query = query.lte('created_at', dataAl + 'T23:59:59')
      }
      if (cerca) {
        query = query.ilike('tabella_modificata', `%${cerca}%`)
      }

      const from = pagina * perPagina
      const to = from + perPagina - 1
      query = query.order('created_at', { ascending: false }).range(from, to)

      const { data, count, error } = await query
      
      if (error) {
        console.warn('Errore query audit_logs:', error)
        throw error
      }
      
      setLog(data || [])
      setTotale(count || 0)
    } catch (e) {
      console.warn('Impossibile caricare audit logs:', e)
      setLog([])
      setTotale(0)
    } finally {
      setLoading(false)
    }
  }, [condominioId_default])

  // Backward compatibility aliases if any other components still use old names
  const fetchLogs = fetch
  const logs = log

  const logEvento = useCallback(async (azione, entita, idEntita = null, dettagli = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from('audit_log').insert({
        condominio_id: condominioId_default || null,
        user_id: user.id,
        azione,
        entita,
        id_entita: idEntita ? String(idEntita) : null,
        dettagli,
      })
    } catch (e) {
      console.warn('Errore tracciamento audit log:', e)
    }
  }, [condominioId_default])

  return { log, logs, loading, totale, fetch, fetchLogs, logEvento }
}
