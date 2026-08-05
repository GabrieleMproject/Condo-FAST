import React from 'react';
import { Bell, CreditCard, FileText, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCondominoDati } from '../hooks/useCondominoDati';

export default function HomePage() {
  const { persona, condominio, rate, assemblee, loading, error } = useCondominoDati();

  if (loading) {
    return <div className="min-h-full bg-gray-50 flex items-center justify-center p-8 text-indigo-600 font-bold">Caricamento dati in corso...</div>;
  }
  
  if (error) {
    return <div className="min-h-full bg-gray-50 flex items-center justify-center p-8 text-red-600">Errore: {error}</div>;
  }

  const nomeCondomino = persona?.nome || "Demo User";
  const nomeCondominio = condominio?.nome || "Condominio Demo";
  
  // Dati di sintesi reali
  const rateDaPagare = rate?.filter(r => r.stato !== 'pagata' && r.stato !== 'sovra_pagata') || [];
  const rateInScadenza = rateDaPagare.length;
  
  const assembleaAttiva = assemblee?.find(a => a.stato === 'convocata' || a.stato === 'in_corso');
  const prossimeAssemblee = assembleaAttiva ? 1 : 0;

  return (
    <div className="min-h-full bg-gray-50 pb-20">
      {/* Header Esteso */}
      <div className="bg-indigo-600 rounded-b-[2.5rem] pt-14 pb-20 px-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20"></div>
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <p className="text-indigo-200 font-medium text-sm">Bentornato,</p>
            <h1 className="text-3xl font-extrabold tracking-tight mt-1">{nomeCondomino}</h1>
            <p className="text-white mt-1 text-sm font-medium opacity-90 flex items-center">
              {nomeCondominio}
            </p>
          </div>
          <button className="bg-white/10 p-2.5 rounded-full backdrop-blur-md relative">
            <Bell size={22} className="text-white" />
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-indigo-600 rounded-full"></span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="-mt-12 px-4 relative z-20 space-y-4">
        
        {/* Status Card Finale */}
        <div className="bg-white rounded-3xl p-5 shadow-xl shadow-indigo-900/5 border border-gray-50">
          <h2 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4">Stato Contabile</h2>
          
          {rateInScadenza > 0 ? (
            <div className="flex items-center">
              <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shrink-0 mr-4">
                <AlertTriangle size={28} />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-gray-900">1 Rata in scadenza</h3>
                <p className="text-sm text-gray-500 mt-0.5">Scade il 15 Agosto</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shrink-0 mr-4">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-gray-900">Tutto in regola</h3>
                <p className="text-sm text-gray-500 mt-0.5">Nessuna pendenza attiva</p>
              </div>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-gray-100">
            <Link to="/pagamenti" className="flex items-center justify-between text-indigo-600 font-bold text-sm hover:text-indigo-700">
              <span>Gestisci Pagamenti</span>
              <ChevronRight size={18} />
            </Link>
          </div>
        </div>

        {/* Action Card: Assemblea */}
        {prossimeAssemblee > 0 && (
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden">
            <div className="absolute right-0 bottom-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mb-10"></div>
            <div className="relative z-10 flex items-center justify-between mb-4">
              <span className="bg-white/20 px-3 py-1 rounded-lg text-xs font-bold backdrop-blur-md">Oggi, 18:00</span>
            </div>
            <h3 className="text-lg font-bold mb-1 relative z-10">Assemblea Ordinaria</h3>
            <p className="text-indigo-100 text-sm mb-4 relative z-10">Partecipa per votare il bilancio consuntivo.</p>
            
            <Link to="/assemblee" className="bg-white text-indigo-600 px-4 py-2.5 rounded-xl font-bold text-sm inline-flex items-center relative z-10 shadow-sm active:scale-95 transition-transform">
              Entra in Teleassemblea <ChevronRight size={16} className="ml-1" />
            </Link>
          </div>
        )}

        {/* Shortcuts */}
        <h2 className="text-gray-900 font-bold text-lg mt-8 mb-3 px-1">Accesso Rapido</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/documenti" className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors">
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-3">
              <FileText size={24} />
            </div>
            <span className="font-bold text-gray-900 text-sm">Bacheca e<br/>Documenti</span>
          </Link>
          
          <Link to="/pagamenti" className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-3">
              <CreditCard size={24} />
            </div>
            <span className="font-bold text-gray-900 text-sm">I miei<br/>Versamenti</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
