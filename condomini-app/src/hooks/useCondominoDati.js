import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Dati dimostrativi realistici per la modalità demo / test immediato
const MOCK_DEMO_DATA = {
  persona: {
    id: 'demo-persona-1',
    nome: 'Marco',
    cognome: 'Rossi',
    codice_fiscale: 'RSSMRC80A01F205Z',
    email: 'demo@condofast.it'
  },
  condominio: {
    id: 'demo-condo-1',
    nome: 'Condominio Parco delle Rose',
    indirizzo: 'Via Dante Alighieri 14',
    citta: 'Milano',
    cap: '20121',
    codice_fiscale: '97854120154',
    iban: 'IT60X0542811101000000123456',
    codice_app: 'ROSE26'
  },
  altriCondomini: [
    { id: 'p-1', nome: 'Mario Bianchi', unita: 'Int. 1', piano: '1°' },
    { id: 'p-2', nome: 'Laura Verdi', unita: 'Int. 2', piano: '1°' },
    { id: 'p-3', nome: 'Giuseppe Ferrari', unita: 'Int. 3', piano: '2°' },
    { id: 'p-5', nome: 'Anna Neri', unita: 'Int. 5', piano: '3°' },
    { id: 'p-6', nome: 'Roberto Galli', unita: 'Int. 6', piano: '3°' },
  ],
  unita: [
    {
      id: 'demo-unita-1',
      nome: 'Appartamento Int. 4',
      scala: 'A',
      piano: '2',
      interno: '4',
      millesimi_proprieta: 54.50
    }
  ],
  delegheRicevute: [
    {
      id: 'del-ricevuta-demo',
      codice: 'DEL-8492',
      delegante_nome: 'Mario Bianchi',
      delegante_unita: 'Int. 1',
      millesimi: 95.00,
      stato: 'in_attesa_accettazione',
      data_invio: new Date().toISOString(),
      note: 'Ciao Marco, non potrò esserci. Ti affido la mia delega per votare il bilancio!'
    }
  ],
  delegheInviate: [],
  rate: [
    {
      id: 'demo-rata-1',
      numero_rata: 3,
      descrizione: 'Rata Ordinaria 3° Trimestre 2026',
      importo: 185.50,
      importo_pagato: 0,
      stato: 'da_pagare',
      data_scadenza: '2026-09-15',
      unita_id: 'demo-unita-1'
    },
    {
      id: 'demo-rata-2',
      numero_rata: 4,
      descrizione: 'Rata Ordinaria 4° Trimestre 2026',
      importo: 185.50,
      importo_pagato: 0,
      stato: 'da_pagare',
      data_scadenza: '2026-12-15',
      unita_id: 'demo-unita-1'
    },
    {
      id: 'demo-rata-3',
      numero_rata: 2,
      descrizione: 'Rata Ordinaria 2° Trimestre 2026',
      importo: 185.50,
      importo_pagato: 185.50,
      stato: 'pagata',
      data_pagamento: '2026-06-10',
      data_scadenza: '2026-06-15',
      unita_id: 'demo-unita-1'
    }
  ],
  documenti: [
    {
      id: 'demo-doc-1',
      nome: 'Regolamento di Condominio Contrattuale',
      tipo: 'regolamento',
      created_at: '2026-01-10T10:00:00Z',
      note: 'Documento originale depositato dal costruttore',
      visibile_condomini: true
    },
    {
      id: 'demo-doc-2',
      nome: 'Tabella Millesimale Generale di Proprietà',
      tipo: 'tabella_millesimale_doc',
      created_at: '2026-01-10T10:00:00Z',
      note: 'Tabella approvata all\'unanimità',
      visibile_condomini: true
    },
    {
      id: 'demo-doc-3',
      nome: 'Verbale Assemblea Ordinaria 2025',
      tipo: 'verbale',
      created_at: '2025-11-20T18:30:00Z',
      note: 'Approvazione consuntivo 2025 e nomina amministratore',
      visibile_condomini: true
    },
    {
      id: 'demo-doc-4',
      nome: 'Polizza Globale Fabbricati - Generali Assicurazioni',
      tipo: 'sinistro',
      created_at: '2026-02-01T09:00:00Z',
      note: 'Copertura danni acqua condotta, incendio e RC terzi',
      visibile_condomini: true
    }
  ],
  assemblee: [
    {
      id: 'demo-assemblea-live',
      titolo: 'Assemblea Ordinaria Esercizio 2026',
      tipo: 'ordinaria',
      tipo_convocazione: 'seconda',
      stato: 'in_corso',
      data_inizio: new Date().toISOString(),
      luogo: 'Studio Amministratore / Teleassemblea Meet',
      link_video: 'https://meet.google.com/abc-defg-hij',
      odg: [
        {
          id: 'demo-odg-1',
          numero_ordine: 1,
          titolo: 'Approvazione Rendiconto Consuntivo 2025 e Riparto Spese',
          descrizione: 'Esame della gestione ordinaria e approvazione saldi.',
          stato_votazione: 'in_corso',
          tipo_quorum: 'ordinaria_maggioranza',
          quorum_millesimi_richiesto: 333.33,
          esito: 'non_votato'
        },
        {
          id: 'demo-odg-2',
          numero_ordine: 2,
          titolo: 'Conferma o Nomina Amministratore e compenso professionale',
          descrizione: 'Rinnovo incarico di gestione per l\'esercizio corrente.',
          stato_votazione: 'chiusa',
          tipo_quorum: 'straordinaria_500',
          quorum_millesimi_richiesto: 500.00,
          esito: 'non_votato'
        },
        {
          id: 'demo-odg-3',
          numero_ordine: 3,
          titolo: 'Sostituzione corpi illuminanti androne con tecnologia LED',
          descrizione: 'Proposta avanzata dal condomino per efficientamento energetico.',
          stato_votazione: 'chiusa',
          tipo_quorum: 'ordinaria_maggioranza',
          quorum_millesimi_richiesto: 333.33,
          esito: 'non_votato'
        }
      ]
    }
  ],
  proposte: [
    {
      id: 'demo-prop-1',
      titolo: 'Installazione rastrelliera biciclette nel cortile interno',
      descrizione: 'Richiesta di posizionare un supporto per le bici nell\'angolo nord del cortile comune.',
      categoria: 'servizi',
      priorita: 'normale',
      stato: 'in_attesa',
      created_at: '2026-07-14T15:20:00Z'
    },
    {
      id: 'demo-prop-2',
      titolo: 'Sostituzione corpi illuminanti androne con tecnologia LED',
      descrizione: 'Proposta di passare a sensori di presenza per risparmiare sulla bolletta parti comuni.',
      categoria: 'manutenzione',
      priorita: 'normale',
      stato: 'inserita_odg',
      created_at: '2026-06-02T11:00:00Z'
    }
  ]
};

export function useCondominoDati() {
  const [data, setData] = useState({
    loading: true,
    error: null,
    persona: null,
    condominio: null,
    altriCondomini: [],
    unita: [],
    delegheRicevute: [],
    delegheInviate: [],
    rate: [],
    documenti: [],
    assemblee: [],
    proposte: [],
    isDemo: false
  });

  const fetchData = useCallback(async () => {
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError) throw authError;

      // Se non c'è sessione autenticata o è loggato come demo, usiamo i mock realistici
      if (!session?.user || session.user.email === 'demo@condofast.it') {
        setData({
          loading: false,
          error: null,
          ...MOCK_DEMO_DATA,
          isDemo: true
        });
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
        setData({
          loading: false,
          error: null,
          ...MOCK_DEMO_DATA,
          isDemo: true
        });
        return;
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

      // 3. Recupera altri condomini dello stesso stabile
      const { data: altriP } = await supabase
        .from('persone')
        .select('id, nome, cognome')
        .eq('condominio_id', condominioId)
        .neq('id', persona.id);

      const altriCondomini = (altriP || []).map(p => ({
        id: p.id,
        nome: `${p.cognome} ${p.nome}`,
        unita: 'Condòmino'
      }));

      // 4. Recupera Unità Immobiliari
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

      // 5. Recupera Rate
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

      // 6. Recupera Assemblee (con odg)
      const { data: assemblee, error: errAss } = await supabase
        .from('assemblee')
        .select('*, odg:assemblee_odg(*)')
        .eq('condominio_id', condominioId)
        .order('data_inizio', { ascending: false });
      if (errAss) throw errAss;

      // 7. Recupera Documenti Condominio
      const { data: documenti, error: errDoc } = await supabase
        .from('documenti_condominio')
        .select('*')
        .eq('condominio_id', condominioId)
        .neq('visibile_condomini', false)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (errDoc) throw errDoc;

      // 8. Recupera Proposte OdG
      const { data: proposte, error: errProp } = await supabase
        .from('assemblee_proposte_odg')
        .select('*')
        .eq('condominio_id', condominioId)
        .order('created_at', { ascending: false });

      // 9. Recupera Deleghe Dirette Ricevute & Inviate
      const { data: dRicevute } = await supabase
        .from('assemblee_deleghe')
        .select('*')
        .eq('delegato_persona_id', persona.id);

      const { data: dInviate } = await supabase
        .from('assemblee_deleghe')
        .select('*')
        .eq('delegante_persona_id', persona.id);

      setData({
        loading: false,
        error: null,
        persona,
        condominio,
        altriCondomini,
        unita: unitaList,
        delegheRicevute: dRicevute || [],
        delegheInviate: dInviate || [],
        rate: rateFinali,
        assemblee: assemblee || [],
        documenti: documenti || [],
        proposte: proposte || [],
        isDemo: false
      });
    } catch (err) {
      console.error('Errore useCondominoDati:', err);
      setData(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const accettaDelegaRicevuta = async (delegaId) => {
    setData(prev => ({
      ...prev,
      delegheRicevute: prev.delegheRicevute.map(d => d.id === delegaId ? { ...d, stato: 'riscattata' } : d)
    }));

    if (!data.isDemo) {
      await supabase
        .from('assemblee_deleghe')
        .update({ stato: 'riscattata', riscattata_at: new Date().toISOString() })
        .eq('id', delegaId);
    }
  };

  const rifiutaDelegaRicevuta = async (delegaId) => {
    setData(prev => ({
      ...prev,
      delegheRicevute: prev.delegheRicevute.filter(d => d.id !== delegaId)
    }));

    if (!data.isDemo) {
      await supabase
        .from('assemblee_deleghe')
        .update({ stato: 'rifiutata' })
        .eq('id', delegaId);
    }
  };

  const inviaPropostaOdG = async ({ titolo, descrizione, categoria = 'manutenzione', priorita = 'normale' }) => {
    if (data.isDemo) {
      const mockProp = {
        id: 'mock-' + Date.now(),
        titolo,
        descrizione,
        categoria,
        priorita,
        stato: 'in_attesa',
        created_at: new Date().toISOString()
      };
      setData(prev => ({
        ...prev,
        proposte: [mockProp, ...prev.proposte]
      }));
      return mockProp;
    }

    const { data: newProp, error } = await supabase
      .from('assemblee_proposte_odg')
      .insert({
        condominio_id: data.condominio?.id,
        persona_id: data.persona?.id,
        unita_id: data.unita[0]?.id || null,
        titolo,
        descrizione,
        categoria,
        priorita,
        stato: 'in_attesa'
      })
      .select()
      .single();

    if (error) throw error;

    setData(prev => ({
      ...prev,
      proposte: [newProp, ...prev.proposte]
    }));

    return newProp;
  };

  return {
    ...data,
    refetch: fetchData,
    inviaPropostaOdG,
    accettaDelegaRicevuta,
    rifiutaDelegaRicevuta
  };
}
