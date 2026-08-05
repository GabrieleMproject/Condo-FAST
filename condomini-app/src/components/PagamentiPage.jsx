import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CreditCard, CheckCircle2, Clock, AlertCircle, Copy, X, ArrowRight, Wallet, Check } from 'lucide-react';

import { useCondominoDati } from '../hooks/useCondominoDati';

export default function PagamentiPage() {
  const [activeTab, setActiveTab] = useState('da_pagare');
  const [selectedRata, setSelectedRata] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  
  const { persona, condominio, rate, loading, error } = useCondominoDati();

  if (loading) {
    return <div className="min-h-full bg-gray-50 flex items-center justify-center p-8 text-indigo-600 font-bold">Caricamento pagamenti...</div>;
  }
  
  if (error) {
    return <div className="min-h-full bg-gray-50 flex items-center justify-center p-8 text-red-600">Errore: {error}</div>;
  }

  const nomePersona = persona ? `${persona.nome} ${persona.cognome}` : 'Condòmino';

  const rateFormattate = (rate || []).map(r => ({
    ...r,
    descrizione: r.descrizione || `Rata ${r.numero_rata || 'Extra'}`,
    condominio: {
      nome: condominio?.nome || 'Condominio',
      iban: condominio?.iban || 'IBAN non configurato'
    },
    causale: (r.descrizione || `Rata ${r.numero_rata || ''}`) + ` - ${nomePersona}`
  }));

  const rateDaPagare = rateFormattate.filter(r => r.stato !== 'pagata' && r.stato !== 'sovra_pagata');
  const ratePagate = rateFormattate.filter(r => r.stato === 'pagata' || r.stato === 'sovra_pagata');

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="min-h-full bg-gray-50 pb-20 relative">
      {/* Header */}
      <div className="bg-indigo-600 rounded-b-[2rem] pt-12 pb-24 px-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-white opacity-5 mix-blend-overlay"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight">Le tue Rate</h1>
          <p className="text-indigo-100 mt-2 font-medium">Gestisci le spese del tuo condominio</p>
        </div>
      </div>

      {/* Main Content (overlapping header) */}
      <div className="-mt-16 px-4 relative z-20">
        
        {/* Toggle Tabs */}
        <div className="bg-white rounded-2xl p-1.5 flex shadow-sm border border-gray-100 mb-6">
          <button 
            onClick={() => setActiveTab('da_pagare')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'da_pagare' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500'}`}
          >
            Da Pagare
            {rateDaPagare.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center bg-red-500 text-white text-[10px] w-5 h-5 rounded-full">
                {rateDaPagare.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('storico')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'storico' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500'}`}
          >
            Storico
          </button>
        </div>

        {/* List */}
        <div className="space-y-4">
          {/* Banner Rate Scadute */}
          {activeTab === 'da_pagare' && rateDaPagare.filter(r => r.stato === 'scaduta').length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-3xl p-4 flex items-start shadow-sm mb-2">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5 mr-3" size={20} />
              <div>
                <h3 className="text-red-800 font-bold text-sm">Hai delle rate arretrate</h3>
                <p className="text-red-600 text-xs mt-1 mb-3">
                  Ti invitiamo a regolarizzare i pagamenti scaduti il prima possibile. 
                  Il totale arretrato ammonta a <strong>€ {rateDaPagare.filter(r => r.stato === 'scaduta').reduce((acc, r) => acc + r.importo, 0).toFixed(2)}</strong>.
                </p>
                <button 
                  onClick={() => setSelectedRata({
                    isGlobale: true,
                    descrizione: 'Saldo Globale Posizione',
                    importo: rateDaPagare.reduce((acc, r) => acc + r.importo, 0),
                    stato: 'scaduta',
                    condominio: rateDaPagare[0].condominio,
                    causale: `Saldo globale posizione - ${nomePersona}`
                  })}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-red-700 active:scale-95 transition-all w-full flex items-center justify-center"
                >
                  <Wallet size={16} className="mr-2" /> Paga l'intero Saldo (€ {rateDaPagare.reduce((acc, r) => acc + r.importo, 0).toFixed(2)})
                </button>
              </div>
            </div>
          )}

          {(activeTab === 'da_pagare' ? rateDaPagare : ratePagate).map((rata) => (
            <div key={rata.id} className="bg-white rounded-3xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-50">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{rata.descrizione}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{rata.condominio.nome}</p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-xl text-gray-900">€ {rata.importo.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6">
                <div className="flex items-center space-x-2">
                  {rata.stato === 'pagata' ? (
                    <div className="flex items-center text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg text-xs font-bold">
                      <CheckCircle2 size={14} className="mr-1.5" /> 
                      {rata.data_pagamento ? `Pagata il ${new Date(rata.data_pagamento).toLocaleDateString()}` : 'Pagata'}
                    </div>
                  ) : rata.stato === 'scaduta' ? (
                    <div className="flex items-center text-red-600 bg-red-50 px-2.5 py-1 rounded-lg text-xs font-bold">
                      <AlertCircle size={14} className="mr-1.5" /> Scaduta
                    </div>
                  ) : (
                    <div className="flex items-center text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg text-xs font-bold">
                      <Clock size={14} className="mr-1.5" /> Scade il {new Date(rata.data_scadenza).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {rata.stato !== 'pagata' && (
                  <button 
                    onClick={() => setSelectedRata(rata)}
                    className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-gray-800 transition-colors flex items-center"
                  >
                    Paga <ArrowRight size={16} className="ml-2" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {(activeTab === 'da_pagare' ? rateDaPagare : ratePagate).length === 0 && (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Tutto in regola!</h3>
              <p className="text-gray-500 text-sm">Non ci sono rate in questa sezione.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Bottom Sheet per il Bonifico */}
      {selectedRata && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedRata(null)}
          ></div>
          
          <div className="relative bg-white w-full rounded-t-[2.5rem] shadow-2xl p-6 pt-8 pb-10 animate-in slide-in-from-bottom-full duration-300">
            <button 
              onClick={() => setSelectedRata(null)}
              className="absolute top-6 right-6 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200"
            >
              <X size={18} />
            </button>
            
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900">Dati per il bonifico</h2>
              <p className="text-gray-500 mt-2 text-sm">Copia questi dati per fare il bonifico. La tua rata risulterà pagata non appena l'amministratore riceverà l'accredito.</p>
            </div>

            <div className="mb-6 pb-6 border-b border-gray-100 text-center">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold mb-2 ${selectedRata.stato === 'scaduta' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                {selectedRata.stato === 'scaduta' ? 'Rata Arretrata' : 'In scadenza'}
              </span>
              <h3 className="text-xl font-bold text-gray-900">{selectedRata.descrizione}</h3>
              <p className="text-sm text-gray-500">{selectedRata.condominio.nome}</p>
            </div>

            <div className="space-y-4">
              {/* Box Importo */}
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Importo esatto</p>
                  <p className="text-xl font-extrabold text-gray-900">€ {selectedRata.importo.toFixed(2)}</p>
                </div>
                <button 
                  onClick={() => copyToClipboard(selectedRata.importo.toString(), 'importo')}
                  className="flex items-center text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg"
                >
                  {copiedField === 'importo' ? <><Check size={16} className="mr-1.5"/> Copiato</> : <><Copy size={16} className="mr-1.5"/> Copia</>}
                </button>
              </div>

              {/* Box IBAN */}
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex justify-between items-center">
                <div className="overflow-hidden mr-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">IBAN Condominio</p>
                  <p className="text-sm font-bold text-gray-900 font-mono tracking-tight truncate">{selectedRata.condominio.iban}</p>
                </div>
                <button 
                  onClick={() => copyToClipboard(selectedRata.condominio.iban, 'iban')}
                  className="flex items-center text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg shrink-0"
                >
                  {copiedField === 'iban' ? <><Check size={16} className="mr-1.5"/> Copiato</> : <><Copy size={16} className="mr-1.5"/> Copia</>}
                </button>
              </div>

              {/* Box Causale */}
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex justify-between items-center">
                <div className="overflow-hidden mr-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Causale (Importante)</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{selectedRata.causale}</p>
                </div>
                <button 
                  onClick={() => copyToClipboard(selectedRata.causale, 'causale')}
                  className="flex items-center text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg shrink-0"
                >
                  {copiedField === 'causale' ? <><Check size={16} className="mr-1.5"/> Copiato</> : <><Copy size={16} className="mr-1.5"/> Copia</>}
                </button>
              </div>
            </div>

            <button 
              onClick={() => setSelectedRata(null)}
              className="w-full bg-gray-900 text-white font-bold text-lg p-4 rounded-xl mt-8 shadow-lg shadow-gray-900/20 active:scale-[0.98] transition-all"
            >
              Chiudi finestra
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
