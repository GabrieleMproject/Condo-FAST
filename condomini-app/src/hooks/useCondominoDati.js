import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useCondominoDati() {
  const [data, setData] = useState({
    loading: true,
    error: null,
    persona: null,
    condominio: null,
    unita: [],
    rate: [],
    documenti: [],
    assemblee: []
  });

  useEffect(() => {
    let isMounted = true;
    
    async function fetchData() {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        
        if (authError) throw authError;
        
        // Se non c'è sessione ma stiamo usando il mock "demo@condofast.it" (che è bypass in App.jsx), 
        // non possiamo estrarre i dati reali. Gesteremo questo nel componente, oppure simuliamo.
        // Ma qui assumiamo di avere una sessione Supabase reale.
        if (!session?.user) {
          // Modalità demo o non loggato
          if (isMounted) setData(prev => ({ ...prev, loading: false }));
          return;
        }

        const userId = session.user.id;

        // 1. Recupera la persona
        const { data: persone, error: errPersone } = await supabase
          .from('persone')
          .select('*')
          .eq('user_id', userId)
          .limit(1);

        if (errPersone) throw errPersone;
        if (!persone || persone.length === 0) {
          throw new Error('Nessuna anagrafica condomino trovata per questo utente.');
        }

        const persona = persone[0];
        const condominioId = persona.condominio_id;

        // 2. Recupera Condominio
        const { data: condominio, error: errCondominio } = await supabase
          .from('condomini')
          .select('*')
          .eq('id', condominioId)
          .single();
        if (errCondominio) throw errCondominio;

        // 3. Recupera Unità Immobiliari tramite occupanti_unita
        const { data: occupazioni, error: errOcc } = await supabase
          .from('occupanti_unita')
          .select('unita:unita(*)')
          .eq('persona_id', persona.id);
        if (errOcc) throw errOcc;
        
        const unitaMap = new Map();
        occupazioni?.forEach(o => {
          if (o.unita) unitaMap.set(o.unita.id, o.unita);
        });
        const unitaList = Array.from(unitaMap.values());
        const unitaIds = unitaList.map(u => u.id);

        // 4. Recupera Rate (rate_unita join rate)
        let rateFinali = [];
        if (unitaIds.length > 0) {
          const { data: rateUnita, error: errRate } = await supabase
            .from('rate_unita')
            .select(`
              id,
              importo,
              importo_pagato,
              stato,
              data_pagamento,
              unita_id,
              rata:rate(id, numero_rata, descrizione, data_scadenza)
            `)
            .in('unita_id', unitaIds)
            .order('data_scadenza', { referencedTable: 'rate', ascending: true });
            
          if (errRate) throw errRate;
          
          rateFinali = (rateUnita || []).map(ru => ({
            id: ru.id,
            importo: ru.importo,
            importo_pagato: ru.importo_pagato,
            stato: ru.stato,
            data_pagamento: ru.data_pagamento,
            unita_id: ru.unita_id,
            numero_rata: ru.rata?.numero_rata,
            descrizione: ru.rata?.descrizione,
            data_scadenza: ru.rata?.data_scadenza,
            rata_id: ru.rata?.id
          }));
        }

        // 5. Recupera Assemblee (con odg)
        const { data: assemblee, error: errAss } = await supabase
          .from('assemblee')
          .select('*, odg:assemblee_odg(*)')
          .eq('condominio_id', condominioId)
          .order('data_inizio', { ascending: false });
        if (errAss) throw errAss;

        // 6. Recupera Documenti Condominio
        const { data: documenti, error: errDoc } = await supabase
          .from('documenti_condominio')
          .select('*')
          .eq('condominio_id', condominioId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        if (errDoc) throw errDoc;

        if (isMounted) {
          setData({
            loading: false,
            error: null,
            persona,
            condominio,
            unita: unitaList,
            rate: rateFinali,
            assemblee: assemblee || [],
            documenti: documenti || []
          });
        }
      } catch (err) {
        console.error('Errore useCondominoDati:', err);
        if (isMounted) {
          setData(prev => ({ ...prev, loading: false, error: err.message }));
        }
      }
    }

    fetchData();

    return () => { isMounted = false; };
  }, []);

  return data;
}
