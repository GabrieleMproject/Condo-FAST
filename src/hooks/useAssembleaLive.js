import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useAssembleaLive(assembleaId) {
  const [assemblea, setAssemblea] = useState(null);
  const [condominio, setCondominio] = useState(null);
  const [presenze, setPresenze] = useState([]);
  const [voti, setVoti] = useState([]);
  const [odg, setOdg] = useState([]);
  const [unitaList, setUnitaList] = useState([]);
  const [personeList, setPersoneList] = useState([]);

  const odgRef = useRef([]);
  useEffect(() => {
    odgRef.current = odg;
  }, [odg]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInitialData = useCallback(async () => {
    if (!assembleaId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Assemblea & Condominio
      const { data: assData, error: assErr } = await supabase
        .from('assemblee')
        .select('*, condominio:condomini(*)')
        .eq('id', assembleaId)
        .single();
      if (assErr) throw assErr;
      setAssemblea(assData);
      setCondominio(assData?.condominio || null);

      const condId = assData.condominio_id;

      // 2. Fetch Unità e Persone del Condominio per calcoli precisi dei Quorum
      const { data: uData } = await supabase
        .from('unita')
        .select('*')
        .eq('condominio_id', condId);
      setUnitaList(uData || []);

      const { data: pData } = await supabase
        .from('persone')
        .select('*')
        .eq('condominio_id', condId);
      setPersoneList(pData || []);

      // 3. Fetch OdG
      const { data: odgData, error: odgError } = await supabase
        .from('assemblee_odg')
        .select('*')
        .eq('assemblea_id', assembleaId)
        .order('numero_ordine', { ascending: true });
      if (odgError) throw odgError;
      setOdg(odgData || []);

      // 4. Fetch Presenze
      const { data: presenzeData, error: presenzeError } = await supabase
        .from('assemblee_presenze')
        .select('*, unita(id, nome, scala, piano, millesimi_proprieta), persona:persona_id(id, nome, cognome), delegato:delegato_a_persona_id(id, nome, cognome)')
        .eq('assemblea_id', assembleaId);
      if (presenzeError) throw presenzeError;
      setPresenze(presenzeData || []);

      // 5. Fetch Voti
      if (odgData && odgData.length > 0) {
        const odgIds = odgData.map(o => o.id);
        const { data: votiData, error: votiError } = await supabase
          .from('assemblee_voti')
          .select('*')
          .in('odg_id', odgIds);
        if (votiError) throw votiError;
        setVoti(votiData || []);
      }
    } catch (err) {
      console.error('Errore fetch assemblea live:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [assembleaId]);

  useEffect(() => {
    if (!assembleaId) return;

    fetchInitialData();

    // Sottoscrizione Realtime su canali live
    const channel = supabase.channel(`assemblea_live_${assembleaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assemblee_odg', filter: `assemblea_id=eq.${assembleaId}` }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setOdg(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
        } else if (payload.eventType === 'INSERT') {
          setOdg(prev => [...prev, payload.new]);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assemblee_presenze', filter: `assemblea_id=eq.${assembleaId}` }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
          fetchInitialData();
        } else if (payload.eventType === 'UPDATE') {
          setPresenze(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assemblee_voti' }, (payload) => {
        const isOurOdg = odgRef.current.some(o => o.id === (payload.new?.odg_id || payload.old?.odg_id));
        if (isOurOdg) {
          if (payload.eventType === 'INSERT') {
            setVoti(prev => {
              const filtered = prev.filter(v => !(v.odg_id === payload.new.odg_id && v.unita_id === payload.new.unita_id && v.persona_id === payload.new.persona_id));
              return [...filtered, payload.new];
            });
          } else if (payload.eventType === 'UPDATE') {
            setVoti(prev => prev.map(v => v.id === payload.new.id ? payload.new : v));
          } else if (payload.eventType === 'DELETE') {
            setVoti(prev => prev.filter(v => v.id !== payload.old.id));
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assembleaId, fetchInitialData]);

  const togglePresenza = async (unitaId, personaId, presente, delegatoA = null) => {
    const payload = {
      assemblea_id: assembleaId,
      unita_id: unitaId,
      persona_id: personaId,
      presente: presente,
      delegato_a_persona_id: delegatoA
    };
    
    const existing = presenze.find(p => p.unita_id === unitaId && p.persona_id === personaId);
    if (existing) {
      await supabase.from('assemblee_presenze').update({ presente, delegato_a_persona_id: delegatoA }).eq('id', existing.id);
    } else {
      await supabase.from('assemblee_presenze').insert(payload);
    }
  };

  const registraVoto = async (odgId, unitaId, personaId, votoStr) => {
    const payload = {
      odg_id: odgId,
      unita_id: unitaId,
      persona_id: personaId,
      voto: votoStr
    };
    
    const existing = voti.find(v => v.odg_id === odgId && v.unita_id === unitaId && v.persona_id === personaId);
    if (existing) {
      await supabase.from('assemblee_voti').update({ voto: votoStr }).eq('id', existing.id);
    } else {
      await supabase.from('assemblee_voti').insert(payload);
    }
  };

  const cambiaStatoOdg = async (odgId, stato_votazione, extraFields = {}) => {
    await supabase.from('assemblee_odg').update({ stato_votazione, ...extraFields }).eq('id', odgId);
  };

  const aggiornaQuorumOdg = async (odgId, tipoQuorum, millesimiRichiesti) => {
    await supabase.from('assemblee_odg').update({
      tipo_quorum: tipoQuorum,
      quorum_millesimi_richiesto: millesimiRichiesti
    }).eq('id', odgId);
  };

  return { 
    assemblea,
    condominio,
    odg, 
    presenze, 
    voti, 
    unitaList, 
    personeList,
    loading, 
    error, 
    refetch: fetchInitialData,
    togglePresenza, 
    registraVoto, 
    cambiaStatoOdg,
    aggiornaQuorumOdg
  };
}
