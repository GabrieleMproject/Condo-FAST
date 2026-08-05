import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAssembleaLive(assembleaId) {
  const [presenze, setPresenze] = useState([])
  const [voti, setVoti] = useState([])
  const [odg, setOdg] = useState([])
  const odgRef = useRef([])

  useEffect(() => {
    odgRef.current = odg
  }, [odg])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchInitialData = useCallback(async () => {
    if (!assembleaId) return
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch OdG
      const { data: odgData, error: odgError } = await supabase
        .from('assemblee_odg')
        .select('*')
        .eq('assemblea_id', assembleaId)
        .order('numero_ordine', { ascending: true })
      if (odgError) throw odgError
      setOdg(odgData || [])

      // 2. Fetch Presenze
      const { data: presenzeData, error: presenzeError } = await supabase
        .from('assemblee_presenze')
        .select('*, unita(id, nome, scala, piano), persona:persona_id(id, nome, cognome), delegato:delegato_a_persona_id(id, nome, cognome)')
        .eq('assemblea_id', assembleaId)
      if (presenzeError) throw presenzeError
      setPresenze(presenzeData || [])

      // 3. Fetch Voti (solo per i punti OdG di questa assemblea)
      if (odgData && odgData.length > 0) {
        const odgIds = odgData.map(o => o.id)
        const { data: votiData, error: votiError } = await supabase
          .from('assemblee_voti')
          .select('*')
          .in('odg_id', odgIds)
        if (votiError) throw votiError
        setVoti(votiData || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [assembleaId])

  useEffect(() => {
    if (!assembleaId) return

    fetchInitialData()

    // Sottoscrizione Realtime
    const channel = supabase.channel(`assemblea_${assembleaId}`)
      
      // Ascolta cambiamenti su OdG
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assemblee_odg', filter: `assemblea_id=eq.${assembleaId}` }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setOdg(prev => prev.map(o => o.id === payload.new.id ? payload.new : o))
        }
      })
      
      // Ascolta cambiamenti su Presenze
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assemblee_presenze', filter: `assemblea_id=eq.${assembleaId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          // Re-fetch singolo non ideale, ma semplice. Per MVP facciamo re-fetch o aggiungiamo
          fetchInitialData() // Refresh sicuro per avere le relazioni (unita, persone)
        } else if (payload.eventType === 'UPDATE') {
          setPresenze(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p))
        } else if (payload.eventType === 'DELETE') {
          setPresenze(prev => prev.filter(p => p.id !== payload.old.id))
        }
      })
      
      // Ascolta cambiamenti su Voti (non possiamo filtrare direttamente per assemblea_id qui, quindi ascoltiamo tutto e filtriamo in JS, 
      // oppure filtriamo in base agli odg_id. Per semplicità ascoltiamo la tabella se non è immensa, o filtriamo se possibile)
      // Supabase consiglia di non esagerare coi canali.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assemblee_voti' }, (payload) => {
        // Verifica se il voto appartiene a uno dei nostri OdG
        const isOurOdg = odgRef.current.some(o => o.id === (payload.new?.odg_id || payload.old?.odg_id))
        if (isOurOdg) {
          if (payload.eventType === 'INSERT') {
            setVoti(prev => [...prev, payload.new])
          } else if (payload.eventType === 'UPDATE') {
            setVoti(prev => prev.map(v => v.id === payload.new.id ? payload.new : v))
          } else if (payload.eventType === 'DELETE') {
            setVoti(prev => prev.filter(v => v.id !== payload.old.id))
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [assembleaId, fetchInitialData])

  const togglePresenza = async (unitaId, personaId, presente, delegatoA = null) => {
    // Upsert presenza
    const payload = {
      assemblea_id: assembleaId,
      unita_id: unitaId,
      persona_id: personaId,
      presente: presente,
      delegato_a_persona_id: delegatoA
    }
    
    // Controlliamo se esiste già
    const existing = presenze.find(p => p.unita_id === unitaId && p.persona_id === personaId)
    
    if (existing) {
      await supabase.from('assemblee_presenze').update({ presente, delegato_a_persona_id: delegatoA }).eq('id', existing.id)
    } else {
      await supabase.from('assemblee_presenze').insert(payload)
    }
  }

  const registraVoto = async (odgId, unitaId, personaId, votoStr) => {
    const payload = {
      odg_id: odgId,
      unita_id: unitaId,
      persona_id: personaId,
      voto: votoStr
    }
    
    const existing = voti.find(v => v.odg_id === odgId && v.unita_id === unitaId && v.persona_id === personaId)
    
    if (existing) {
      await supabase.from('assemblee_voti').update({ voto: votoStr }).eq('id', existing.id)
    } else {
      await supabase.from('assemblee_voti').insert(payload)
    }
  }

  const cambiaStatoOdg = async (odgId, stato_votazione) => {
    await supabase.from('assemblee_odg').update({ stato_votazione }).eq('id', odgId)
  }

  return { 
    odg, presenze, voti, loading, error, 
    togglePresenza, registraVoto, cambiaStatoOdg 
  }
}
