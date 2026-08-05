import React, { useState } from 'react';
import { Video, CheckCircle2, Clock, Check, X, Minus, ChevronDown, AlignLeft } from 'lucide-react';

import { useCondominoDati } from '../hooks/useCondominoDati';
import { supabase } from '../lib/supabase';

export default function AssembleePage() {
  const { assemblee, persona, unita, loading, error } = useCondominoDati();
  const [votoInviato, setVotoInviato] = useState(false);
  const [expandedOdg, setExpandedOdg] = useState(null);
  const [isVoting, setIsVoting] = useState(false);

  if (loading) {
    return <div className="min-h-full bg-gray-50 flex items-center justify-center p-8 text-indigo-600 font-bold">Caricamento assemblea...</div>;
  }
  
  if (error) {
    return <div className="min-h-full bg-gray-50 flex items-center justify-center p-8 text-red-600">Errore: {error}</div>;
  }

  // Prendi la prima assemblea non conclusa o l'ultima
  const assembleaAttiva = assemblee?.find(a => a.stato !== 'conclusa') || assemblee?.[0];

  const handleVota = async (odgId, voto) => {
    // In produzione: update del voto sul database
    if (!persona || unita.length === 0) return;
    setIsVoting(true);
    try {
      await supabase.from('assemblee_voti').insert({
        odg_id: odgId,
        persona_id: persona.id,
        unita_id: unita[0].id, // Prende la prima unità posseduta per il voto
        voto: voto
      });
      setVotoInviato(voto);
      setTimeout(() => setVotoInviato(null), 2000);
    } catch(err) {
      console.error(err);
      alert('Si è verificato un errore durante l\\'invio del voto. Riprova.');
    } finally {
      setIsVoting(false);
    }
  };

  const OdgItem = ({ item }) => {
    const isDiscussione = item.stato === 'in_discussione';
    const isVotato = item.stato === 'votato';
    
    return (
      <div 
        className={`bg-white rounded-2xl p-4 shadow-sm border transition-all mb-3
          ${isDiscussione ? 'border-indigo-500 shadow-indigo-100 ring-4 ring-indigo-50' : 'border-gray-100'}`}
      >
        <div className="flex justify-between items-start cursor-pointer" onClick={() => setExpandedOdg(expandedOdg === item.id ? null : item.id)}>
          <div className="flex-1 pr-3">
            <div className="flex items-center space-x-2 mb-1.5">
              {isDiscussione && <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider animate-pulse">Ora in discussione</span>}
              {isVotato && <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">Concluso</span>}
            </div>
            <h3 className={`font-bold text-base ${isVotato ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{item.titolo}</h3>
          </div>
          <ChevronDown size={18} className={`text-gray-400 transition-transform ${expandedOdg === item.id ? 'rotate-180' : ''}`} />
        </div>
        
        {expandedOdg === item.id && (
          <div className="mt-3 text-sm text-gray-500 pt-3 border-t border-gray-50">
            {item.descrizione}
          </div>
        )}

        {/* Pannello Votazione per il punto attivo */}
        {isDiscussione && (
          <div className="mt-5 pt-4 border-t border-indigo-50">
            <p className="text-xs font-bold text-gray-500 mb-3 text-center uppercase tracking-wider">Esprimi il tuo voto</p>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => handleVota('favorevole')}
                disabled={isVoting}
                className={`flex flex-col items-center justify-center p-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-95 transition-all border border-emerald-100 ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Check size={20} className="mb-1" />
                <span className="text-xs font-bold">A favore</span>
              </button>
              <button 
                onClick={() => handleVota('contrario')}
                disabled={isVoting}
                className={`flex flex-col items-center justify-center p-3 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 active:scale-95 transition-all border border-red-100 ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <X size={20} className="mb-1" />
                <span className="text-xs font-bold">Contrario</span>
              </button>
              <button 
                onClick={() => handleVota('astenuto')}
                disabled={isVoting}
                className={`flex flex-col items-center justify-center p-3 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all border border-gray-200 ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Minus size={20} className="mb-1" />
                <span className="text-xs font-bold">Astenuto</span>
              </button>
            </div>
          </div>
        )}

        {/* Mostra voto effettuato */}
        {isVotato && item.mioVoto && (
          <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Il tuo voto:</span>
            <span className={`text-xs font-bold px-2 py-1 rounded-md
              ${item.mioVoto === 'favorevole' ? 'bg-emerald-50 text-emerald-600' : 
                item.mioVoto === 'contrario' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}
            >
              {item.mioVoto.toUpperCase()}
            </span>
          </div>
        )}
      </div>
    );
  };

  if (!assembleaAttiva) {
    return (
      <div className="min-h-full bg-gray-50 pb-20 relative flex flex-col">
        <div className="bg-indigo-600 pt-12 pb-8 px-6 text-white relative">
          <h1 className="text-3xl font-extrabold tracking-tight relative z-10">Teleassemblea</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 text-gray-500 text-center font-medium mt-10">
          Nessuna assemblea in programma al momento.
        </div>
      </div>
    );
  }

  const isAssembleaInCorso = assembleaAttiva.stato === 'in_corso';

  return (
    <div className="min-h-full bg-gray-50 pb-20 relative">
      {/* Feedback Overlay Animato */}
      {votoInviato && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center text-center animate-in zoom-in-50 duration-300">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4
              ${votoInviato === 'favorevole' ? 'bg-emerald-100 text-emerald-600' : 
                votoInviato === 'contrario' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-xl font-extrabold text-gray-900">Voto Registrato</h2>
            <p className="text-gray-500 text-sm mt-1">Il tuo voto è stato acquisito dall'amministratore.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-indigo-600 pt-12 pb-8 px-6 text-white relative">
        <div className="absolute top-0 left-0 w-full h-full bg-black opacity-10"></div>
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Teleassemblea</h1>
            <p className="text-indigo-100 mt-1 font-medium text-sm">Partecipa e vota dal tuo smartphone</p>
          </div>
        </div>
      </div>

      {/* Assembly Info Card */}
      <div className="px-4 -mt-4 relative z-20">
        <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            {isAssembleaInCorso ? (
              <div className="flex items-center text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
                In Corso
              </div>
            ) : (
              <div className="flex items-center text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                Programmata
              </div>
            )}
            <span className="text-sm text-gray-500 font-medium">
              {assembleaAttiva.data_inizio ? new Date(assembleaAttiva.data_inizio).toLocaleString('it-IT') : ''}
            </span>
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mb-2">{assembleaAttiva.titolo}</h2>
          <p className="text-sm text-gray-500 mb-5">{assembleaAttiva.luogo || 'Videoconferenza'}</p>
          
          {assembleaAttiva.link_video && (
            <a href={assembleaAttiva.link_video} target="_blank" rel="noreferrer" className="w-full bg-indigo-600 text-white font-bold text-sm p-3.5 rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-transform">
              <Video size={18} className="mr-2" />
              Entra nella Videochiamata
            </a>
          )}
        </div>
      </div>

      {/* Ordine del giorno List */}
      <div className="px-4 mt-8">
        <div className="flex items-center space-x-2 mb-4 px-1">
          <AlignLeft size={18} className="text-gray-400" />
          <h3 className="font-bold text-gray-900 text-lg">Ordine del Giorno</h3>
        </div>
        
        <div className="space-y-3">
          {(assembleaAttiva.odg || []).map(item => (
            <OdgItem key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
