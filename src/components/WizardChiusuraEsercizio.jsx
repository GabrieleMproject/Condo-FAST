import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, ArrowRight, Save, X, CalendarCheck, FileText, Landmark, FileBarChart } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';

export default function WizardChiusuraEsercizio({ condominioId, esercizio, onSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Dati mock / stati temporanei per la UI del Wizard
  const [datiVerifica, setDatiVerifica] = useState({
    speseNonPagate: 2,
    incassiDaRiconciliare: 0,
    saldiQuadri: true
  });

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const onClose = () => setIsOpen(false);

  const handleChiudi = async () => {
    setIsProcessing(true);
    try {
      await new Promise(r => setTimeout(r, 1500)); // Simulazione
      toast.success('Esercizio chiuso con successo! Saldi riportati al nuovo anno.');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error('Errore durante la chiusura: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (esercizio?.stato === 'chiuso') {
    return (
      <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, color: '#059669', fontSize: 14, fontWeight: 500 }}>
        <CheckCircle2 size={20} /> Questo esercizio è stato chiuso in modo definitivo.
      </div>
    );
  }

  return (
    <>
      <div 
        onClick={() => setIsOpen(true)}
        style={{
          background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '16px 24px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)', transition: 'all 0.2s'
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
      >
         <div style={{ flex: '1 1 auto' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
               <FileBarChart size={18} style={{ color: '#7c3aed' }} /> Chiusura Esercizio {esercizio?.etichetta || ''}
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
               Clicca per avviare le verifiche contabili e chiudere l'anno.
            </p>
         </div>
         <div style={{ flex: '0 1 300px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
               <span>Fase {step} di 4</span>
               <span>{Math.round((step / 4) * 100)}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--app-bg)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-color-2)' }}>
               <div style={{ height: '100%', background: 'linear-gradient(90deg, #7c3aed, #9333ea)', width: `${(step / 4) * 100}%`, transition: 'width 0.3s' }} />
            </div>
         </div>
         <ArrowRight size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>

      {isOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.header}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Wizard Chiusura Esercizio</h2>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
                  Flusso guidato in 4 fasi per chiudere l'anno contabile.
                </p>
              </div>
              <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
            </div>

            {/* Stepper Progress */}
            <div style={styles.stepperContainer}>
              {[1, 2, 3, 4].map(num => (
                <div key={num} style={styles.stepIndicator(step >= num)}>
                  {step > num ? <CheckCircle2 size={16} /> : num}
                </div>
              ))}
            </div>
            <div style={styles.stepLabel}>
              {step === 1 && "Fase 1: Verifica Spese e Fatture"}
              {step === 2 && "Fase 2: Riconciliazione Incassi"}
              {step === 3 && "Fase 3: Calcolo Conguagli"}
              {step === 4 && "Fase 4: Chiusura Definitiva"}
            </div>

            <div style={styles.contentArea}>
              {step === 1 && (
                <div style={styles.stepContent}>
                  <FileText size={48} style={{ color: '#3b82f6', marginBottom: 16 }} />
                  <h3 style={{ margin: '0 0 16px' }}>Ci sono spese in sospeso?</h3>
                  <div style={styles.alertBox(datiVerifica.speseNonPagate > 0 ? 'warning' : 'success')}>
                    <AlertTriangle size={20} />
                    <span>Hai <strong>{datiVerifica.speseNonPagate}</strong> fatture registrate ma non ancora pagate. Vuoi riportarle come debiti verso fornitori nell'esercizio successivo?</span>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div style={styles.stepContent}>
                  <Landmark size={48} style={{ color: '#10b981', marginBottom: 16 }} />
                  <h3 style={{ margin: '0 0 16px' }}>Quadratura Incassi</h3>
                  <div style={styles.alertBox(datiVerifica.incassiDaRiconciliare > 0 ? 'warning' : 'success')}>
                    <CheckCircle2 size={20} />
                    <span>Tutti gli incassi dell'estratto conto sembrano riconciliati con le rate dei condòmini. Nessun movimento anomalo rilevato.</span>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div style={styles.stepContent}>
                  <CalendarCheck size={48} style={{ color: '#f59e0b', marginBottom: 16 }} />
                  <h3 style={{ margin: '0 0 16px' }}>Calcolo dei Conguagli</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Verrà generato il riparto consuntivo definitivo per calcolare i saldi di ogni condòmino (Quote versate - Spese di competenza).
                  </p>
                  <div style={{ background: 'var(--app-bg)', padding: 16, borderRadius: 8, textAlign: 'left', border: '1px solid var(--border-color)', width: '100%', maxWidth: 400 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                      <span>Spese Totali Esercizio:</span> <strong>€ 12.450,00</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                      <span>Quote Versate dai Condòmini:</span> <strong>€ 11.200,00</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontSize: 14 }}>
                      <span>Conguaglio Complessivo:</span> <strong>€ 1.250,00 (da incassare)</strong>
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div style={styles.stepContent}>
                  <CheckCircle2 size={56} style={{ color: '#7c3aed', marginBottom: 16 }} />
                  <h3 style={{ margin: '0 0 8px' }}>Tutto pronto per la chiusura</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Questa operazione congelerà l'esercizio corrente e genererà automaticamente 
                    un nuovo esercizio per l'anno successivo, riportando i saldi e i debiti.
                  </p>
                </div>
              )}
            </div>

            <div style={styles.footer}>
              <button 
                onClick={step === 1 ? onClose : handlePrev} 
                style={styles.btnSecondary}
                disabled={isProcessing}
              >
                {step === 1 ? 'Annulla' : 'Indietro'}
              </button>
              
              {step < 4 ? (
                <button onClick={handleNext} style={styles.btnPrimary}>
                  Prosegui <ArrowRight size={16} />
                </button>
              ) : (
                <button onClick={handleChiudi} style={styles.btnSuccess} disabled={isProcessing}>
                  {isProcessing ? 'Chiusura in corso...' : 'Conferma Chiusura'} <Save size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999
  },
  modal: {
    background: 'var(--card-bg)',
    width: '100%', maxWidth: 600,
    borderRadius: 16,
    boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column'
  },
  header: {
    padding: '24px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
  },
  closeBtn: {
    background: 'transparent', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', padding: 4, display: 'flex'
  },
  stepperContainer: {
    display: 'flex', gap: 12, padding: '24px 24px 8px', justifyContent: 'center'
  },
  stepIndicator: (active) => ({
    width: 32, height: 32, borderRadius: '50%',
    background: active ? '#7c3aed' : 'var(--app-bg)',
    color: active ? '#fff' : 'var(--text-muted)',
    border: `2px solid ${active ? '#7c3aed' : 'var(--border-color)'}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 'bold', fontSize: 14, transition: 'all 0.2s'
  }),
  stepLabel: {
    textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
    marginBottom: 24
  },
  contentArea: {
    padding: '0 32px 32px', flex: 1
  },
  stepContent: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    animation: 'fadeIn 0.3s'
  },
  alertBox: (type) => ({
    display: 'flex', gap: 12, alignItems: 'flex-start',
    padding: 16, borderRadius: 12, textAlign: 'left',
    background: type === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
    color: type === 'warning' ? '#d97706' : '#059669',
    border: `1px solid ${type === 'warning' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
    width: '100%'
  }),
  footer: {
    padding: '20px 24px',
    borderTop: '1px solid var(--border-color)',
    background: 'var(--app-bg)',
    display: 'flex', justifyContent: 'space-between', gap: 16
  },
  btnSecondary: {
    padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-color)',
    background: 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer',
    fontWeight: 600
  },
  btnPrimary: {
    padding: '10px 24px', borderRadius: 8, border: 'none',
    background: 'var(--accent)', color: '#fff', cursor: 'pointer',
    fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
  },
  btnSuccess: {
    padding: '10px 24px', borderRadius: 8, border: 'none',
    background: '#10b981', color: '#fff', cursor: 'pointer',
    fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
  }
};
