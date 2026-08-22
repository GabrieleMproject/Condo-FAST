import React, { useState, useEffect, useRef } from 'react';
import { useCondominoDati } from '../hooks/useCondominoDati';
import { supabase } from '../lib/supabase';
import {
  Users, Check, X, Minus, MessageSquarePlus, Clock, ChevronDown,
  Video, MapPin, Send, AlertCircle, ShieldCheck, CheckCircle2,
  Calendar, ArrowRight, Sparkles, Scale, Radio, Zap, UserCheck, KeyRound, Copy, Share2
} from 'lucide-react';

export default function AssembleePage() {
  const { persona, condominio, unita, assemblee, proposte, inviaPropostaOdG, isDemo, loading, error } = useCondominoDati();
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'deleghe' | 'proposte'

  // Stato Realtime Live Sincronizzato con l'Amministratore
  const [realtimeOdgList, setRealtimeOdgList] = useState(null);
  const [realtimeActiveOdgId, setRealtimeActiveOdgId] = useState(null);
  const [mieiVoti, setMieiVoti] = useState({});
  const [votoInviato, setVotoInviato] = useState(null);
  const [isVoting, setIsVoting] = useState(false);
  const [expandedOdg, setExpandedOdg] = useState(null);
  const [isLiveConnected, setIsLiveConnected] = useState(true);
  const channelRef = useRef(null);

  // Stato Deleghe
  const [miaDelegaCreata, setMiaDelegaCreata] = useState(null);
  const [delegheRiscattate, setDelegheRiscattate] = useState([
    // Esempio iniziale se riscattata
  ]);
  const [codiceDaRiscattare, setCodiceDaRiscattare] = useState('');
  const [riscattoLoading, setRiscattoLoading] = useState(false);
  const [riscattoSuccess, setRiscattoSuccess] = useState(null);
  const [riscattoError, setRiscattoError] = useState(null);
  const [copiedDelega, setCopiedDelega] = useState(false);

  // Stato Form Proposte OdG
  const [titoloProposta, setTitoloProposta] = useState('');
  const [descrizioneProposta, setDescrizioneProposta] = useState('');
  const [categoriaProposta, setCategoriaProposta] = useState('manutenzione');
  const [prioritaProposta, setPrioritaProposta] = useState('normale');
  const [invioPropostaLoading, setInvioPropostaLoading] = useState(false);
  const [propostaSuccess, setPropostaSuccess] = useState(false);

  // Trova assemblea attiva base
  const assembleaAttiva = assemblee?.find(a => a.stato === 'in_corso') || assemblee?.find(a => a.stato === 'convocata') || assemblee?.[0];
  const fallbackOdgList = assembleaAttiva?.odg || [];

  // Calcolo millesimi totali rappresentati (propri + deleghe riscattate)
  const mieiMillesimiBase = unita[0]?.millesimi_proprieta || 54.50;
  const millesimiDelegheExtra = delegheRiscattate.reduce((acc, d) => acc + (d.millesimi || 0), 0);
  const totaleMillesimiVotabili = mieiMillesimiBase + millesimiDelegheExtra;

  // Lista OdG effettiva (priorità assoluta allo stato realtime broadcast/SSE)
  const currentOdgList = realtimeOdgList || fallbackOdgList;
  const odgInVotazione = currentOdgList.find(o => o.stato_votazione === 'in_corso');

  // MOTORE 1 & 2: Stream SSE Ultra-Rapido + Supabase Realtime
  useEffect(() => {
    // 0. Auto-riscatto se presente parametro delega nell'URL o in sessionStorage
    const pendingCode = sessionStorage.getItem('pending_delega');
    if (pendingCode) {
      sessionStorage.removeItem('pending_delega');
      const mockDelegato = {
        id: 'del-' + Date.now(),
        codice: pendingCode,
        delegante_nome: 'Marco Rossi (Int. 4)',
        millesimi: 54.50,
        data_riscatto: new Date().toISOString()
      };
      setDelegheRiscattate(prev => {
        if (!prev.some(d => d.codice === pendingCode)) {
          return [...prev, mockDelegato];
        }
        return prev;
      });
      setRiscattoSuccess(`🎉 Delega ${pendingCode} accettata! Rappresenti in assemblea ${mockDelegato.delegante_nome}.`);
      
      try {
        fetch('/api/live-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delegaRiscattata: mockDelegato })
        }).catch(() => {});
      } catch (e) {}
    }

    let es;
    try {
      es = new EventSource('/api/live-sync/sse');
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.odgList && Array.isArray(data.odgList)) {
            setRealtimeOdgList(data.odgList);
            if (data.activeOdgId) setRealtimeActiveOdgId(data.activeOdgId);
            if (data.voti) {
              const mioVotoObj = {};
              Object.entries(data.voti).forEach(([oId, uMap]) => {
                if (uMap && uMap['u-4']) mioVotoObj[oId] = uMap['u-4'];
              });
              setMieiVoti(prev => ({ ...prev, ...mioVotoObj }));
            }
            setIsLiveConnected(true);
          }
        } catch (e) {}
      };
    } catch (e) {}

    const channel = supabase.channel('condofast_live_assembly_channel', {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'odg_state_change' }, (msg) => {
        const { odgList, activeOdgId, voti } = msg.payload || {};
        if (odgList && Array.isArray(odgList)) {
          setRealtimeOdgList(odgList);
          if (activeOdgId) setRealtimeActiveOdgId(activeOdgId);
          if (voti) {
            const mioVotoObj = {};
            Object.entries(voti).forEach(([oId, uMap]) => {
              if (uMap && uMap['u-4']) mioVotoObj[oId] = uMap['u-4'];
            });
            setMieiVoti(prev => ({ ...prev, ...mioVotoObj }));
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsLiveConnected(true);
          channel.send({
            type: 'broadcast',
            event: 'request_initial_state',
            payload: {}
          });
        }
      });

    channelRef.current = channel;

    return () => {
      if (es) es.close();
      supabase.removeChannel(channel);
    };
  }, []);

  // Gestione Creazione Codice Delega
  const handleCreaCodiceDelega = async () => {
    const randomCode = 'DEL-' + Math.floor(1000 + Math.random() * 9000);
    const newDelega = {
      codice: randomCode,
      delegante: persona ? `${persona.nome} ${persona.cognome}` : 'Marco Rossi',
      unita: unita[0]?.nome || 'Int. 4',
      millesimi: mieiMillesimiBase,
      data_creazione: new Date().toISOString()
    };

    setMiaDelegaCreata(newDelega);

    // Invia al backend locale / Supabase se attivo
    try {
      fetch('/api/live-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuovaDelega: newDelega })
      }).catch(() => {});
    } catch (e) {}
  };

  // Gestione Riscatto Codice Delega
  const handleRiscattaDelega = async (e) => {
    e.preventDefault();
    setRiscattoError(null);
    setRiscattoSuccess(null);
    setRiscattoLoading(true);

    const cleanCode = codiceDaRiscattare.trim().toUpperCase();
    if (!cleanCode) {
      setRiscattoLoading(false);
      return;
    }

    try {
      // Mock / RPC Validation
      if (cleanCode.startsWith('DEL-') || cleanCode.length >= 6) {
        const mockDelegato = {
          id: 'del-' + Date.now(),
          codice: cleanCode,
          delegante_nome: cleanCode === 'DEL-101' ? 'Giuseppe Verdi' : 'Mario Bianchi (Int. 1)',
          millesimi: cleanCode === 'DEL-101' ? 80.50 : 95.00,
          data_riscatto: new Date().toISOString()
        };

        setDelegheRiscattate(prev => [...prev, mockDelegato]);
        setRiscattoSuccess(`Delega ${cleanCode} collegata con successo! Rappresenti anche ${mockDelegato.delegante_nome} (+${mockDelegato.millesimi.toFixed(2)} ‰).`);
        setCodiceDaRiscattare('');

        // Notifica l'amministratore
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'delega_riscattata',
            payload: {
              delega: mockDelegato,
              rappresentanteId: persona?.id || 'p-4'
            }
          });
        }
      } else {
        throw new Error('Formato codice delega non valido (es. DEL-7489)');
      }
    } catch (err) {
      setRiscattoError(err.message);
    } finally {
      setRiscattoLoading(false);
    }
  };

  const handleVota = async (odgId, votoStr) => {
    setIsVoting(true);
    try {
      setMieiVoti(prev => ({ ...prev, [odgId]: votoStr }));
      setVotoInviato(votoStr);
      setTimeout(() => setVotoInviato(null), 3000);

      // Invia voto con totale millesimi accorpati
      const payloadVoto = {
        odgId,
        unitaId: unita[0]?.id || 'u-4',
        personaId: persona?.id || 'p-4',
        voto: votoStr,
        millesimiTotali: totaleMillesimiVotabili,
        delegheExtra: delegheRiscattate.map(d => d.codice),
        timestamp: Date.now()
      };

      fetch('/api/live-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadVoto)
      }).catch(() => {});

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'condomino_vote',
          payload: payloadVoto
        });
      }

      if (!isDemo && persona?.id && unita.length > 0) {
        await supabase
          .from('assemblee_voti')
          .upsert({
            odg_id: odgId,
            persona_id: persona.id,
            unita_id: unita[0].id,
            voto: votoStr
          }, { onConflict: 'odg_id,unita_id,persona_id' });
      }
    } catch (err) {
      console.error('Errore voto:', err);
    } finally {
      setIsVoting(false);
    }
  };

  const handleInviaProposta = async (e) => {
    e.preventDefault();
    if (!titoloProposta.trim() || !descrizioneProposta.trim()) return;

    setInvioPropostaLoading(true);
    try {
      await inviaPropostaOdG({
        titolo: titoloProposta,
        descrizione: descrizioneProposta,
        categoria: categoriaProposta,
        priorita: prioritaProposta
      });

      setTitoloProposta('');
      setDescrizioneProposta('');
      setPropostaSuccess(true);
      setTimeout(() => setPropostaSuccess(false), 3500);
    } catch (err) {
      alert('Errore inserimento proposta: ' + err.message);
    } finally {
      setInvioPropostaLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50 flex items-center justify-center p-8 text-indigo-600 font-bold">
        Caricamento assemblee...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-slate-50 flex items-center justify-center p-8 text-red-600">
        Errore: {error}
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 pb-24 relative font-sans">
      {/* Header Esteso */}
      <div className="bg-indigo-600 rounded-b-[2.5rem] pt-12 pb-20 px-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5">
              <Users size={18} className="text-indigo-200" />
              <span className="text-xs uppercase font-bold tracking-wider text-indigo-200">{condominio?.nome || 'Condominio'}</span>
            </div>

            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white/15 px-2.5 py-0.5 rounded-full backdrop-blur-md text-white">
              <Zap size={11} className="text-emerald-300 animate-pulse" />
              <span>Ultra-Live Sincronizzato</span>
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Assemblee & Voto Live</h1>
          <p className="text-indigo-100 text-sm mt-1">Vota in diretta, genera codici delega o proponi argomenti</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="-mt-10 px-4 relative z-20 max-w-lg mx-auto space-y-4">
        {/* Toggle Tabs a 3 sezioni */}
        <div className="bg-white rounded-2xl p-1.5 flex shadow-sm border border-slate-200/80">
          <button
            onClick={() => setActiveTab('live')}
            className={`flex-1 py-2 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${activeTab === 'live' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Users size={13} /> Voto Live
            {odgInVotazione && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>}
          </button>

          <button
            onClick={() => setActiveTab('deleghe')}
            className={`flex-1 py-2 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${activeTab === 'deleghe' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <KeyRound size={13} /> Deleghe ({delegheRiscattate.length})
          </button>

          <button
            onClick={() => setActiveTab('proposte')}
            className={`flex-1 py-2 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${activeTab === 'proposte' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <MessageSquarePlus size={13} /> Proposte ({proposte?.length || 0})
          </button>
        </div>

        {/* TAB 1: ASSEMBLEA LIVE & VOTAZIONE */}
        {activeTab === 'live' && (
          <div className="space-y-4">
            {/* Info Deleghe Collegate */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  <UserCheck size={16} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Il tuo stato di partecipazione</span>
                  <span className="text-xs font-bold text-slate-800">
                    {delegheRiscattate.length === 0 ? (
                      'Partecipazione diretta (Proprietario)'
                    ) : (
                      <span>
                        Partecipi per te e per <strong>{delegheRiscattate.map(d => d.delegante_nome).join(', ')}</strong>
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {delegheRiscattate.length > 0 && (
                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                  {delegheRiscattate.length} {delegheRiscattate.length === 1 ? 'Delega attiva' : 'Deleghe attive'}
                </span>
              )}
            </div>

            {/* Banner Assemblea */}
            {assembleaAttiva && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${assembleaAttiva.stato === 'in_corso' || odgInVotazione ? 'bg-emerald-100 text-emerald-700 animate-pulse' : 'bg-indigo-100 text-indigo-700'}`}>
                      {assembleaAttiva.stato === 'in_corso' || odgInVotazione ? 'In Corso Ora' : 'Convocata'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {assembleaAttiva.tipo === 'straordinaria' ? 'Straordinaria' : 'Ordinaria'}
                    </span>
                  </div>
                  {assembleaAttiva.link_video && (
                    <a
                      href={assembleaAttiva.link_video}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100"
                    >
                      <Video size={13} /> Teleassemblea
                    </a>
                  )}
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-1">{assembleaAttiva.titolo}</h3>
                <div className="text-xs text-slate-500 flex items-center gap-4 mt-2">
                  {assembleaAttiva.data_inizio && (
                    <span className="flex items-center gap-1">
                      <Calendar size={13} /> {new Date(assembleaAttiva.data_inizio).toLocaleString('it-IT')}
                    </span>
                  )}
                  {assembleaAttiva.luogo && (
                    <span className="flex items-center gap-1">
                      <MapPin size={13} /> {assembleaAttiva.luogo}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* BANNER VOTAZIONE APERTA ORA IN TEMPO REALE */}
            {odgInVotazione ? (
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl border-2 border-indigo-500 relative overflow-hidden transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span className="text-[11px] font-extrabold tracking-wider uppercase text-emerald-400">
                      VOTAZIONE APERTA IN DIRETTA
                    </span>
                  </div>
                  <span className="text-xs bg-white/10 px-2.5 py-0.5 rounded-md font-semibold text-slate-300">
                    Punto #{odgInVotazione.numero_ordine}
                  </span>
                </div>

                <h2 className="text-lg font-extrabold text-white mb-2 leading-tight">
                  {odgInVotazione.titolo}
                </h2>
                {odgInVotazione.descrizione && (
                  <p className="text-xs text-slate-300 mb-5 leading-relaxed">
                    {odgInVotazione.descrizione}
                  </p>
                )}

                {/* Pulsanti Voto */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button
                    onClick={() => handleVota(odgInVotazione.id, 'favorevole')}
                    disabled={isVoting}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl font-bold transition-all active:scale-95 ${mieiVoti[odgInVotazione.id] === 'favorevole' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-white scale-102' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'}`}
                  >
                    <Check size={24} className="mb-1" />
                    <span className="text-xs">A Favore</span>
                  </button>

                  <button
                    onClick={() => handleVota(odgInVotazione.id, 'contrario')}
                    disabled={isVoting}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl font-bold transition-all active:scale-95 ${mieiVoti[odgInVotazione.id] === 'contrario' ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 ring-2 ring-white scale-102' : 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40'}`}
                  >
                    <X size={24} className="mb-1" />
                    <span className="text-xs">Contrario</span>
                  </button>

                  <button
                    onClick={() => handleVota(odgInVotazione.id, 'astenuto')}
                    disabled={isVoting}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl font-bold transition-all active:scale-95 ${mieiVoti[odgInVotazione.id] === 'astenuto' ? 'bg-slate-400 text-slate-950 shadow-lg ring-2 ring-white scale-102' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'}`}
                  >
                    <Minus size={24} className="mb-1" />
                    <span className="text-xs">Astenuto</span>
                  </button>
                </div>

                {mieiVoti[odgInVotazione.id] && (
                  <div className="mt-4 pt-3 border-t border-indigo-800 text-center text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={15} />
                    <span>Hai votato: {mieiVoti[odgInVotazione.id].toUpperCase()} {delegheRiscattate.length > 0 ? '(incluso delegati)' : ''}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-6 text-center shadow-sm border border-slate-200/80">
                <Clock size={36} className="text-indigo-400 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">In attesa dell'apertura della votazione</h4>
                <p className="text-xs text-slate-500 mt-1">
                  L'amministratore aprirà il voto sul prossimo punto all'ordine del giorno a breve.
                </p>
              </div>
            )}

            {/* LISTA COMPLETA PUNTI ORDINE DEL GIORNO */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider px-1">
                Tutti i punti all'Ordine del Giorno ({currentOdgList.length})
              </h4>

              {currentOdgList.map((item) => {
                const isCurrent = item.id === odgInVotazione?.id;
                const isConcluso = item.stato_votazione === 'chiusa' && item.esito && item.esito !== 'non_votato';
                const isApprovato = item.esito === 'approvato';
                const mioVoto = mieiVoti[item.id];

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${isCurrent ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200/80'}`}
                  >
                    <div
                      className="flex justify-between items-start cursor-pointer"
                      onClick={() => setExpandedOdg(expandedOdg === item.id ? null : item.id)}
                    >
                      <div className="flex-1 pr-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-400">#{item.numero_ordine}</span>
                          {isCurrent && (
                            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider animate-pulse">
                              In Votazione
                            </span>
                          )}
                          {isConcluso && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${isApprovato ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {isApprovato ? 'Approvato' : 'Respinto'}
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-sm text-slate-900">{item.titolo}</h3>
                      </div>
                      <ChevronDown size={18} className={`text-slate-400 transition-transform ${expandedOdg === item.id ? 'rotate-180' : ''}`} />
                    </div>

                    {expandedOdg === item.id && item.descrizione && (
                      <div className="mt-3 text-xs text-slate-600 pt-3 border-t border-slate-100 leading-relaxed">
                        {item.descrizione}
                      </div>
                    )}

                    {mioVoto && (
                      <div className="mt-2 text-[11px] font-semibold text-slate-500">
                        Il tuo voto: <strong className="text-indigo-600 uppercase">{mioVoto}</strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: SEZIONE GESTIONE DELEGHE DIGITALI (Art. 67 disp. att. c.c.) */}
        {activeTab === 'deleghe' && (
          <div className="space-y-4">
            {/* Box 1: Non puoi partecipare? Crea Codice Delega */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Non puoi partecipare?</h3>
                  <p className="text-xs text-slate-500">Genera un codice delega per farti rappresentare da un vicino.</p>
                </div>
              </div>

              {!miaDelegaCreata ? (
                <div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    Ai sensi dell'<strong>art. 67 disp. att. c.c.</strong>, la delega scritta creata tramite la tua area riservata è legalmente valida e attribuisce i tuoi millesimi ({mieiMillesimiBase.toFixed(2)} ‰) al condomino di tua fiducia.
                  </p>
                  <button
                    onClick={handleCreaCodiceDelega}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <KeyRound size={15} />
                    <span>Genera Codice Delega Digitale</span>
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-2xl p-4 border border-indigo-200 text-center space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    Codice Delega Attivo
                  </span>
                  <div className="text-2xl font-mono font-extrabold text-slate-900 tracking-wider">
                    {miaDelegaCreata.codice}
                  </div>
                  <p className="text-xs text-slate-500">
                    Comunica questo codice al condomino che parteciperà all'assemblea per collegare la tua delega.
                  </p>

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const link = `${window.location.origin}/?delega=${miaDelegaCreata.codice}`;
                          navigator.clipboard.writeText(link);
                          setCopiedDelega(true);
                          setTimeout(() => setCopiedDelega(false), 2000);
                        }}
                        className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 hover:bg-slate-50 shadow-sm"
                      >
                        {copiedDelega ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        <span>{copiedDelega ? 'Link Copiato!' : 'Copia Link 1-Click'}</span>
                      </button>

                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Ciao! Ti lascio la mia delega per la prossima assemblea di condominio. Clicca su questo link: una volta entrato troverai la mia delega già caricata automaticamente con i miei millesimi: ${window.location.origin}/?delega=${miaDelegaCreata.codice}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Share2 size={14} />
                        <span>Invia su WhatsApp</span>
                      </a>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Al tuo vicino basterà cliccare sul link per trovare i tuoi millesimi già accorpati al suo voto.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Box 2: Hai ricevuto un Codice Delega? Riscattalo */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Hai una Delega da riscattare?</h3>
                  <p className="text-xs text-slate-500">Inserisci il codice ricevuto per votare per conto del delegante.</p>
                </div>
              </div>

              {riscattoSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-xs font-bold mb-3 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{riscattoSuccess}</span>
                </div>
              )}

              {riscattoError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-bold mb-3 flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{riscattoError}</span>
                </div>
              )}

              <form onSubmit={handleRiscattaDelega} className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Es. DEL-8492 o DEL-101"
                    value={codiceDaRiscattare}
                    onChange={(e) => setCodiceDaRiscattare(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono uppercase tracking-wider placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={riscattoLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <UserCheck size={14} />
                  <span>{riscattoLoading ? 'Verifica in corso...' : 'Collega Delega al Tuo Account'}</span>
                </button>
              </form>

              {/* Elenco deleghe collegate */}
              {delegheRiscattate.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Deleghe Riconosciute e Collegate ({delegheRiscattate.length})
                  </span>
                  {delegheRiscattate.map((d, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 flex justify-between items-center text-xs">
                      <div>
                        <strong className="text-slate-800">{d.delegante_nome}</strong>
                        <span className="text-[11px] text-slate-400 block font-mono">Codice: {d.codice}</span>
                      </div>
                      <span className="font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md text-[11px] flex items-center gap-1">
                        <Check size={12} /> Delega Attiva
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Note Legali Box */}
            <div className="bg-slate-100 rounded-2xl p-4 text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <ShieldCheck size={14} className="text-indigo-600" />
                <span>Validità Giuridica (Art. 67 disp. att. c.c.)</span>
              </div>
              <p>
                • <strong>Forma scritta:</strong> La delega informatica rilasciata tramite accesso autenticato soddisfa il requisito di legge della forma scritta.
              </p>
              <p>
                • <strong>Divieto di delega all'amministratore:</strong> All'amministratore non possono essere conferite deleghe per la partecipazione a qualunque assemblea.
              </p>
              <p>
                • <strong>Limiti numerici:</strong> Se i condòmini sono più di 20, il delegato non può rappresentare più di 1/5 dei condòmini e più di 1/5 del valore dell'edificio (200 millesimi).
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: CASSETTO PROPOSTE ODG CONDÒMINI */}
        {activeTab === 'proposte' && (
          <div className="space-y-4">
            {/* Form Inserimento Nuova Proposta */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <MessageSquarePlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Proponi un argomento all'OdG</h3>
                  <p className="text-[11px] text-slate-500">L'amministratore valuterà la richiesta per la prossima assemblea.</p>
                </div>
              </div>

              {propostaSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-xs font-bold mb-4 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Proposta inviata con successo all'amministratore!</span>
                </div>
              )}

              <form onSubmit={handleInviaProposta} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                    Titolo dell'Argomento *
                  </label>
                  <input
                    type="text"
                    required
                    value={titoloProposta}
                    onChange={(e) => setTitoloProposta(e.target.value)}
                    placeholder="Es. Installazione rastrelliera biciclette nel cortile"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                      Categoria
                    </label>
                    <select
                      value={categoriaProposta}
                      onChange={(e) => setCategoriaProposta(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="manutenzione">Manutenzione</option>
                      <option value="spese">Spese / Bilancio</option>
                      <option value="regolamento">Regolamento</option>
                      <option value="servizi">Servizi Comuni</option>
                      <option value="altro">Altro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                      Priorità
                    </label>
                    <select
                      value={prioritaProposta}
                      onChange={(e) => setPrioritaProposta(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="normale">Normale</option>
                      <option value="urgente">Urgente</option>
                      <option value="bassa">Bassa</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                    Motivazione e Dettagli *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={descrizioneProposta}
                    onChange={(e) => setDescrizioneProposta(e.target.value)}
                    placeholder="Spiega per quale motivo ritieni utile inserire questo punto e quale soluzione proponi..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={invioPropostaLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <Send size={14} />
                  <span>{invioPropostaLoading ? 'Invio in corso...' : 'Invia Proposta all\'Amministratore'}</span>
                </button>
              </form>
            </div>

            {/* Elenco Proposte Inviate */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider px-1">
                Le tue proposte registrate ({proposte?.length || 0})
              </h4>

              {(!proposte || proposte.length === 0) ? (
                <div className="bg-white rounded-2xl p-6 text-center border border-slate-100">
                  <MessageSquarePlus size={32} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">Non hai ancora inviato proposte</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Usa il modulo in alto per proporre un punto per la prossima assemblea.</p>
                </div>
              ) : (
                proposte.map(p => {
                  const isInAttesa = p.stato === 'in_attesa';
                  const isAccolta = p.stato === 'inserita_odg' || p.stato === 'approvata';

                  return (
                    <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${isAccolta ? 'bg-emerald-100 text-emerald-700' : isInAttesa ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                          {isAccolta ? 'Accolta nell\'OdG' : isInAttesa ? 'In Valutazione' : 'Archiviata'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {p.created_at ? new Date(p.created_at).toLocaleDateString('it-IT') : ''}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-slate-900 mb-1">{p.titolo}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">{p.descrizione}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
