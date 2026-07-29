// src/hooks/useAuditLog.js
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAuditLog(condominioId) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100)
      if (condominioId) {
        query = query.eq('condominio_id', condominioId)
      }
      const { data } = await query
      setLogs(data || [])
    } catch (e) {
      console.warn('Impossibile caricare audit log:', e)
    } finally {
      setLoading(false)
    }
  }, [condominioId])

  const logEvento = useCallback(async (azione, entita, idEntita = null, dettagli = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from('audit_log').insert({
        condominio_id: condominioId || null,
        user_id: user.id,
        azione,
        entita,
        id_entita: idEntita ? String(idEntita) : null,
        dettagli,
      })
    } catch (e) {
      console.warn('Errore tracciamento audit log:', e)
    }
  }, [condominioId])

  return { logs, loading, fetchLogs, logEvento }
}
