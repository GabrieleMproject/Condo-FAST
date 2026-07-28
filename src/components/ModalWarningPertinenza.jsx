import React from 'react';
import { AlertTriangle, ArrowRight, Check, X, Building, FileText } from 'lucide-react';

/**
 * ModalWarningPertinenza.jsx
 * Modale di avviso quando l'AI rileva una discrepanza tra il documento caricato,
 * lo slot di destinazione (es. Fattura in Estratto Conto) o il condominio attivo.
 *
 * Rispettando il principio "Propone -> Conferma", l'azione di reindirizzamento/spostamento
 * è il pulsante principale visivamente prominente, mentre "Procedi comunque" è un'azione
 * secondaria di dimensioni ridotte.
 */
export default function ModalWarningPertinenza({
  isOpen,
  onClose,
  warning,
  onSposta,
  onProcediComunque,
  isProcessing = false
}) {
  if (!isOpen || !warning) return null;

  const { slotErrato, condominioErrato, avvisi = [] } = warning;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-slate-900 border border-amber-500/30 shadow-2xl shadow-amber-950/40 text-slate-100">
        
        {/* Intestazione Warning */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-amber-200">
                Verifica Pertinenza Documento
              </h3>
              <p className="text-xs text-slate-400">
                L'IA ha rilevato una possibile discrepanza prima dell'importazione
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo del messaggio */}
        <div className="p-6 space-y-4">
          {/* Discrepanza Slot */}
          {slotErrato && (
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
              <div className="flex items-start gap-2 text-amber-300 font-medium text-sm">
                <FileText className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                <span>Possibile slot di caricamento errato</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed pl-6">
                Il file caricato sembra essere un <strong className="text-amber-200">{slotErrato.tipoRilevato || 'documento di diverso tipo'}</strong>, ma lo stai inserendo nello slot <strong className="text-slate-200">{slotErrato.slotAtteso}</strong>.
              </p>
            </div>
          )}

          {/* Discrepanza Condominio */}
          {condominioErrato && (
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
              <div className="flex items-start gap-2 text-amber-300 font-medium text-sm">
                <Building className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                <span>Intestazione Condominio non coincidente</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed pl-6">
                {condominioErrato.motivoDiscrepanza || (
                  <>
                    Il documento risulta intestato a <strong className="text-amber-200">{condominioErrato.intestatarioRilevato || 'un altro condominio'}</strong>, mentre la scheda attiva è <strong className="text-slate-200">{condominioErrato.condominioAttivoNome}</strong>.
                  </>
                )}
              </p>
            </div>
          )}

          {/* Avvisi generici aggiuntivi se presenti */}
          {avvisi.length > 0 && !slotErrato && !condominioErrato && (
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
              {avvisi.map((msg, idx) => (
                <p key={idx} className="text-xs text-slate-300 leading-relaxed">
                  • {msg}
                </p>
              ))}
            </div>
          )}

          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 text-[11px] text-slate-400 flex items-center gap-2">
            <span className="shrink-0 text-indigo-400 font-semibold">Consiglio:</span>
            <span>Verifica i dati estratti prima di procedere per evitare disallineamenti in contabilità.</span>
          </div>
        </div>

        {/* Footer con Gerarchia Visiva Bottoni */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Tasto "Procedi comunque" -> VISIVAMENTE SECONDARIO / PICCOLO */}
          <button
            type="button"
            onClick={onProcediComunque}
            disabled={isProcessing}
            className="order-2 sm:order-1 text-[11px] text-slate-400 hover:text-amber-300 hover:underline underline-offset-4 px-2 py-1 transition-colors flex items-center gap-1.5 opacity-80 hover:opacity-100"
            title="Ignora l'avviso e carica comunque i dati estratti su questo slot/condominio"
          >
            <Check className="w-3 h-3 text-slate-500" />
            <span>Procedi comunque su questo slot</span>
          </button>

          {/* Azioni Principali */}
          <div className="order-1 sm:order-2 flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Annulla
            </button>

            {/* Tasto "Sposta / Reindirizza" -> VISIVAMENTE PRIMARIO / PROMINENTE E GRANDE */}
            {onSposta && (
              <button
                type="button"
                onClick={onSposta}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 group"
              >
                <span>Sposta nel modulo corretto</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
