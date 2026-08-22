import React, { useState } from 'react';
import { useCondominoDati } from '../hooks/useCondominoDati';
import { CreditCard, CheckCircle2, Clock, AlertCircle, Copy, Check, QrCode, ArrowRight, ShieldCheck, Landmark } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

export default function PagamentiPage() {
  const [activeTab, setActiveTab] = useState('da_pagare'); // 'da_pagare' | 'storico'
  const [selectedRata, setSelectedRata] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [showQrModal, setShowQrModal] = useState(null);

  const { persona, condominio, unita, rate, loading, error } = useCondominoDati();

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50 flex items-center justify-center p-8 text-indigo-600 font-bold">
        Caricamento pagamenti...
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

  const nomePersona = persona ? `${persona.cognome} ${persona.nome}`.trim() : 'Condòmino';
  const nomeCondo = condominio?.nome || 'Condominio';
  const ibanCondo = condominio?.iban || 'IT60X0542811101000000123456';
  const unitRef = unita[0]?.nome || `Int. ${unita[0]?.interno || '1'}`;

  // Formatta le rate con causali standardizzate
  const rateFormattate = (rate || []).map(r => {
    const descRata = r.descrizione || `Rata ${r.numero_rata || 'Ordinaria'}`;
    const causale = `${descRata} - ${nomeCondo} - ${unitRef} - ${nomePersona}`;
    return {
      ...r,
      descrizione: descRata,
      condominio: {
        nome: nomeCondo,
        iban: ibanCondo
      },
      causale
    };
  });

  const rateDaPagare = rateFormattate.filter(r => r.stato !== 'pagata' && r.stato !== 'sovra_pagata');
  const ratePagate = rateFormattate.filter(r => r.stato === 'pagata' || r.stato === 'sovra_pagata');

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyTuttoPerHomeBanking = (r) => {
    const text = `BENEFICIARIO: ${nomeCondo}\nIBAN: ${ibanCondo}\nIMPORTO: € ${Number(r.importo).toFixed(2)}\nCAUSALE: ${r.causale}`;
    navigator.clipboard.writeText(text);
    setCopiedField(`tutto_${r.id}`);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Genera stringa EPC QR Code Standard Europeo (SEPA SCT)
  const generaStringaEpc = (r) => {
    const cleanIban = ibanCondo.replace(/\s+/g, '').toUpperCase();
    const formattedAmount = `EUR${Number(r.importo).toFixed(2)}`;
    // Standard EPC069-12
    return [
      'BCD',
      '002',
      '1',
      'SCT',
      '',
      nomeCondo.substring(0, 70),
      cleanIban,
      formattedAmount,
      '',
      r.causale.substring(0, 140),
      ''
    ].join('\n');
  };

  return (
    <div className="min-h-full bg-slate-50 pb-24 relative font-sans">
      {/* Header Esteso */}
      <div className="bg-indigo-600 rounded-b-[2.5rem] pt-12 pb-20 px-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Landmark size={18} className="text-indigo-200" />
            <span className="text-xs uppercase font-bold tracking-wider text-indigo-200">{nomeCondo}</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Le tue Rate</h1>
          <p className="text-indigo-100 text-sm mt-1">Copia i dati del bonifico con 1 click o inquadra l'EPC QR Code</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="-mt-10 px-4 relative z-20 max-w-lg mx-auto space-y-4">
        {/* Toggle Tabs */}
        <div className="bg-white rounded-2xl p-1.5 flex shadow-sm border border-slate-200/80">
          <button
            onClick={() => setActiveTab('da_pagare')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'da_pagare' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Da Pagare
            {rateDaPagare.length > 0 && (
              <span className="inline-flex items-center justify-center bg-red-500 text-white text-[10px] w-5 h-5 rounded-full font-bold">
                {rateDaPagare.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('storico')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${activeTab === 'storico' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Storico Saldate ({ratePagate.length})
          </button>
        </div>

        {/* Lista Rate */}
        <div className="space-y-4">
          {(activeTab === 'da_pagare' ? rateDaPagare : ratePagate).length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-slate-100">
              <CheckCircle2 size={44} className="text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">
                {activeTab === 'da_pagare' ? 'Nessuna rata da pagare!' : 'Nessun pagamento storico'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {activeTab === 'da_pagare' ? 'Sei in perfetto pari con i versamenti condominiali.' : 'I pagamenti registrati appariranno qui.'}
              </p>
            </div>
          ) : (
            (activeTab === 'da_pagare' ? rateDaPagare : ratePagate).map((r) => {
              const isPagata = r.stato === 'pagata' || r.stato === 'sovra_pagata';
              const isScaduta = !isPagata && r.data_scadenza && new Date(r.data_scadenza) < new Date();

              return (
                <div
                  key={r.id}
                  className={`bg-white rounded-3xl p-5 shadow-sm border transition-all ${isScaduta ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200/80'}`}
                >
                  {/* Testata Rata */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${isPagata ? 'bg-emerald-100 text-emerald-700' : isScaduta ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {isPagata ? 'Saldata' : isScaduta ? 'Scaduta' : 'In Scadenza'}
                        </span>
                        {r.data_scadenza && (
                          <span className="text-[11px] text-slate-400">
                            Scadenza: {new Date(r.data_scadenza).toLocaleDateString('it-IT')}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900">{r.descrizione}</h3>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-extrabold text-slate-900">
                        € {Number(r.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Sezione Bonifico & Copia Rapida (solo se da pagare) */}
                  {!isPagata && (
                    <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70 space-y-2.5 mb-4">
                      {/* Riga IBAN */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">IBAN Condominio</span>
                          <span className="text-xs font-mono font-semibold text-slate-800 truncate block select-all">
                            {ibanCondo}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(ibanCondo, `iban_${r.id}`)}
                          className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1 shrink-0"
                        >
                          {copiedField === `iban_${r.id}` ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          <span>{copiedField === `iban_${r.id}` ? 'Copiato!' : 'Copia IBAN'}</span>
                        </button>
                      </div>

                      {/* Riga Importo */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Importo Esatto</span>
                          <span className="text-xs font-mono font-bold text-slate-800 block select-all">
                            € {Number(r.importo).toFixed(2)}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(Number(r.importo).toFixed(2), `imp_${r.id}`)}
                          className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1 shrink-0"
                        >
                          {copiedField === `imp_${r.id}` ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          <span>{copiedField === `imp_${r.id}` ? 'Copiato!' : 'Copia Importo'}</span>
                        </button>
                      </div>

                      {/* Riga Causale */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Causale Bonifico</span>
                          <span className="text-xs font-medium text-slate-700 truncate block select-all" title={r.causale}>
                            {r.causale}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(r.causale, `cau_${r.id}`)}
                          className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1 shrink-0"
                        >
                          {copiedField === `cau_${r.id}` ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          <span>{copiedField === `cau_${r.id}` ? 'Copiato!' : 'Copia Causale'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bottoni Azione Rapida */}
                  {!isPagata ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyTuttoPerHomeBanking(r)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
                      >
                        {copiedField === `tutto_${r.id}` ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedField === `tutto_${r.id}` ? 'Dati Copiati!' : 'Copia Tutto per Home Banking'}</span>
                      </button>

                      <button
                        onClick={() => setShowQrModal(r)}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition-all"
                        title="Mostra QR Code Bancario EPC"
                      >
                        <QrCode size={16} />
                        <span>EPC QR</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 pt-2">
                      <CheckCircle2 size={16} />
                      <span>Pagamento registrato e riconciliato</span>
                      {r.data_pagamento && (
                        <span className="text-slate-400 font-normal">il {new Date(r.data_pagamento).toLocaleDateString('it-IT')}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal QR Code Bancario EPC */}
      {showQrModal && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowQrModal(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inline-flex p-3 rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
              <QrCode size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">QR Code Bancario Europeo</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Inquadra questo QR dall'app della tua banca (Intesa, UniCredit, Poste, Revolut...) per pre-compilare il bonifico istantaneo.
            </p>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 inline-block mb-4">
              <QRCodeCanvas
                value={generaStringaEpc(showQrModal)}
                size={200}
                level="M"
                includeMargin={true}
              />
            </div>

            <div className="text-left bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 mb-4 space-y-1">
              <div><strong>Beneficiario:</strong> {nomeCondo}</div>
              <div><strong>Importo:</strong> € {Number(showQrModal.importo).toFixed(2)}</div>
              <div className="truncate"><strong>Causale:</strong> {showQrModal.causale}</div>
            </div>

            <button
              onClick={() => setShowQrModal(null)}
              className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl text-xs hover:bg-slate-800 transition-all"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
