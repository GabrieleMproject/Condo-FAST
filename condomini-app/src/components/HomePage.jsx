import React from 'react';
import { Bell, CreditCard, FileText, ChevronRight, AlertTriangle, CheckCircle2, Users, MessageSquarePlus, Landmark, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCondominoDati } from '../hooks/useCondominoDati';

export default function HomePage() {
  const { persona, condominio, unita, rate, assemblee, proposte, isDemo, loading, error } = useCondominoDati();

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50 flex items-center justify-center p-8 text-indigo-600 font-bold">
        Caricamento dati in corso...
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

  const nomeCondomino = persona ? `${persona.nome} ${persona.cognome}`.trim() : "Marco Rossi";
  const nomeCondominio = condominio?.nome || "Condominio Parco delle Rose";
  const unitaDesc = unita[0]?.nome || `Scala ${unita[0]?.scala || 'A'} - Int. ${unita[0]?.interno || '4'}`;
  
  // Dati di sintesi reali
  const rateDaPagare = rate?.filter(r => r.stato !== 'pagata' && r.stato !== 'sovra_pagata') || [];
  const rateInScadenza = rateDaPagare.length;
  const totaleDaPagare = rateDaPagare.reduce((acc, r) => acc + (parseFloat(r.importo) || 0), 0);
  
  const assembleaAttiva = assemblee?.find(a => a.stato === 'in_corso') || assemblee?.find(a => a.stato === 'convocata');
  const prossimeAssemblee = assembleaAttiva ? 1 : 0;

  return (
    <div className="min-h-full bg-slate-50 pb-24 font-sans">
      {/* Header Esteso */}
      <div className="bg-indigo-600 rounded-b-[2.5rem] pt-12 pb-20 px-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20"></div>
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-1.5 text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-1">
              <Landmark size={14} />
              <span>{nomeCondominio}</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">{nomeCondomino}</h1>
            <p className="text-indigo-100 text-xs font-medium mt-0.5 opacity-90">
              {unitaDesc}
            </p>
          </div>
          <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
            <Sparkles size={20} className="text-amber-300" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="-mt-10 px-4 relative z-20 max-w-lg mx-auto space-y-4">
        
        {/* Banner Assemblea in Corso */}
        {assembleaAttiva && (
          <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-5 shadow-xl border border-indigo-500/50 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${assembleaAttiva.stato === 'in_corso' ? 'bg-emerald-500 text-white animate-pulse' : 'bg-indigo-500 text-white'}`}>
                {assembleaAttiva.stato === 'in_corso' ? 'Assemblea in Corso Ora' : 'Assemblea Convocata'}
              </span>
              <span className="text-[11px] text-slate-300">
                {assembleaAttiva.tipo === 'straordinaria' ? 'Straordinaria' : 'Ordinaria'}
              </span>
            </div>

            <h3 className="text-base font-bold text-white mb-1">{assembleaAttiva.titolo}</h3>
            <p className="text-xs text-indigo-200 mb-4">
              {assembleaAttiva.stato === 'in_corso' ? 'Vota in tempo reale per le delibere all\'ordine del giorno.' : 'Consulta i punti all\'ordine del giorno in discussione.'}
            </p>
            
            <Link
              to="/assemblee"
              className="bg-white text-indigo-900 hover:bg-indigo-50 px-4 py-2.5 rounded-xl font-bold text-xs inline-flex items-center shadow-md active:scale-95 transition-all"
            >
              <span>{assembleaAttiva.stato === 'in_corso' ? 'Entra e Vota in Diretta' : 'Consulta Assemblea'}</span>
              <ChevronRight size={15} className="ml-1" />
            </Link>
          </div>
        )}

        {/* Status Card Contabilità / Rate */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80">
          <h2 className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-3">Stato Rate & Spese</h2>
          
          {rateInScadenza > 0 ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {rateInScadenza} {rateInScadenza === 1 ? 'Rata da pagare' : 'Rate da pagare'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Totale dovuto: <strong>€ {totaleDaPagare.toFixed(2)}</strong>
                  </p>
                </div>
              </div>

              <Link
                to="/pagamenti"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-xl shrink-0 active:scale-95 transition-all"
              >
                Paga con 1-Click
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shrink-0">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Tutto in regola</h3>
                <p className="text-xs text-slate-500 mt-0.5">Nessuna rata condominiale insoluta.</p>
              </div>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
            <span>IBAN Condominio configurato</span>
            <Link to="/pagamenti" className="text-indigo-600 font-bold hover:underline flex items-center">
              Dettagli versamenti <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* 4 Quick Access Grid */}
        <div>
          <h2 className="text-slate-900 font-bold text-sm mb-3 px-1">Servizi del Tuo Stabile</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/pagamenti"
              className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors"
            >
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-2">
                <CreditCard size={20} />
              </div>
              <span className="font-bold text-slate-900 text-xs">Rate & QR Code</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Copia dati bonifico</span>
            </Link>
            
            <Link
              to="/assemblee"
              className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors"
            >
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-2">
                <Users size={20} />
              </div>
              <span className="font-bold text-slate-900 text-xs">Voto Assemblea</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Diretta live & OdG</span>
            </Link>

            <Link
              to="/documenti"
              className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-2">
                <FileText size={20} />
              </div>
              <span className="font-bold text-slate-900 text-xs">Documenti Studio</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Verbali, polizze, bilanci</span>
            </Link>

            <Link
              to="/assemblee"
              className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors"
            >
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-2">
                <MessageSquarePlus size={20} />
              </div>
              <span className="font-bold text-slate-900 text-xs">Proponi OdG</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Richieste 365 giorni</span>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
