import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, ArrowRight, Save, X, CalendarCheck, FileText, Landmark, FileBarChart, Archive, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { useConsuntivo } from '../hooks/useConsuntivo';

export default function WizardChiusuraEsercizio({ condominioId, esercizio, esercizioId, onSuccess, isOpen: controlledIsOpen, onClose: controlledOnClose, onDownloadPdf, onDownloadDossier, onNavigateToConsuntivo, hideTrigger }) {
  const navigate = useNavigate();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notaNonConformita, setNotaNonConformita] = useState('');

  const targetEsercizioId = esercizio?.id || esercizioId;
  const { data: consuntivoData, loading: loadingConsuntivo, error: errorConsuntivo, fetch: fetchConsuntivo } = useConsuntivo(condominioId, targetEsercizioId);

  const [verificandoIncassi, setVerificandoIncassi] = useState(false);
  const [datiVerifica, setDatiVerifica] = useState({
    speseNonPagate: 0,
    incassiDaRiconciliare: 0,
    saldiQuadri: true,
  });

  const isCaricamento = loadingConsuntivo || verificandoIncassi;
  const hasAnomalies = datiVerifica.speseNonPagate > 0 || datiVerifica.incassiDaRiconciliare > 0 || !datiVerifica.saldiQuadri || errorConsuntivo;
  const canConfirm = !hasAnomalies || notaNonConformita.trim().length > 5;

  useEffect(() => {
    if (isOpen && targetEsercizioId) {
      fetchConsuntivo();
    }
  }, [isOpen, targetEsercizioId, fetchConsuntivo]);

  useEffect(() => {
    if (consuntivoData) {
      setVerificandoIncassi(true);
      const speseNonPagate = consuntivoData.fatture?.rows?.filter(f => f.stato !== 'pagata').length || 0;
      const scarto = consuntivoData.cassa?.scartoQuadratura || 0;
      const saldiQuadri = Math.abs(scarto) < 0.05;
      
      const { data_inizio, data_fine } = consuntivoData.esercizio || {};
      let q = supabase.from('estratto_conto').select('id', { count: 'exact', head: true })
        .eq('condominio_id', condominioId)
        .is('spesa_id', null)
        .is('rata_unita_id', null)
        .neq('riconciliato', true);
      
      if (data_inizio) q = q.gte('data_movimento', data_inizio);
      if (data_fine) q = q.lte('data_movimento', data_fine);
      
      q.then(({ count, error }) => {
        setDatiVerifica({
          speseNonPagate,
          incassiDaRiconciliare: count || 0,
          saldiQuadri
        });
        setVerificandoIncassi(false);
      }).catch(err => {
        setVerificandoIncassi(false);
      });
    }
  }, [consuntivoData, condominioId]);

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const onClose = () => {
    if (controlledOnClose) controlledOnClose();
    setInternalIsOpen(false);
    setTimeout(() => setStep(1), 300);
  };

  const handleResolveAnomaly = (path) => {
    onClose();
    navigate(`/condomini/${condominioId}/${path}?esercizio=${targetEsercizioId}`);
  };

  const handleChiudi = async () => {
    setIsProcessing(true);
    try {
      const targetEsercizioId = esercizio?.id || esercizioId;
      if (!targetEsercizioId) throw new Error("ID Esercizio mancante.");

      const prevNote = consuntivoData?.esercizio?.note || esercizio?.note || '';
      const notaAggiuntiva = hasAnomalies ? `\n\n[CHIUSURA FORZATA - ${new Date().toLocaleDateString()}] Note di non conformità:\n${notaNonConformita}` : '';
      const newNote = (prevNote + notaAggiuntiva).trim();

      const { error } = await supabase
        .from('esercizi')
        .update({ stato: 'chiuso', note: newNote })
        .eq('id', targetEsercizioId);

      if (error) throw error;

      toast.success('Esercizio chiuso con successo! Saldi riportati al nuovo anno.');
      if (onSuccess) onSuccess();
      setStep(5); // Move to download step
    } catch (err) {
      toast.error('Errore durante la chiusura: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (esercizio?.stato === 'chiuso') {
    return (
      <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, color: '#059669', fontSize: 14, fontWeight: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CheckCircle2 size={20} /> Questo esercizio è stato chiuso in modo definitivo.
        </div>
        {(onDownloadPdf || onDownloadDossier || onNavigateToConsuntivo) && (
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            {onDownloadPdf ? (
              <button onClick={onDownloadPdf} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                <FileText size={16} /> Scarica Consuntivo PDF
              </button>
            ) : onNavigateToConsuntivo ? (
              <button onClick={() => { toast('Ti sposto nel tab Consuntivo per avviare il download...'); onNavigateToConsuntivo(); }} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                <FileText size={16} /> Scarica Consuntivo PDF
              </button>
            ) : null}
            
            {onDownloadDossier ? (
              <button onClick={onDownloadDossier} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #10b981', color: '#059669', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                <Archive size={16} /> Dossier Completo (.zip)
              </button>
            ) : onNavigateToConsuntivo ? (
              <button onClick={() => { toast('Ti sposto nel tab Consuntivo per pacchettizzare il Dossier...'); onNavigateToConsuntivo(); }} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #10b981', color: '#059669', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                <Archive size={16} /> Dossier Completo (.zip)
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {!hideTrigger && (
        <div 
          onClick={() => setInternalIsOpen(true)}
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
      )}

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
            {step < 5 && (
              <div style={styles.stepperContainer}>
                {[1, 2, 3, 4].map(num => (
                  <div key={num} style={styles.stepIndicator(step >= num)}>
                    {step > num ? <CheckCircle2 size={16} /> : num}
                  </div>
                ))}
              </div>
            )}
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
                  {isCaricamento ? (
                    <p style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Loader2 size={16} className="animate-spin" /> Verifica in corso...
                    </p>
                  ) : errorConsuntivo ? (
                    <div style={styles.alertBox('warning')}>
                      <AlertTriangle size={20} />
                      <span>Impossibile completare la verifica: {errorConsuntivo}</span>
                    </div>
                  ) : (
                    <div style={styles.alertBox(datiVerifica.speseNonPagate > 0 ? 'warning' : 'success')}>
                      {datiVerifica.speseNonPagate > 0 ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                      <div style={{ flex: 1 }}>
                        {datiVerifica.speseNonPagate > 0 ? (
                          <>
                            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Attenzione: Fatture da saldare</p>
                            <p style={{ margin: '0 0 12px', fontSize: 13 }}>
                              Risultano <strong>{datiVerifica.speseNonPagate}</strong> fatture fornitore caricate a sistema ma non ancora segnate come pagate. Se procedi, verranno automaticamente riportate come debiti verso fornitori nel nuovo bilancio.
                            </p>
                            <button onClick={() => handleResolveAnomaly('fatture')} style={styles.btnActionWarning}>
                              <ExternalLink size={14} /> Vai alla gestione fatture
                            </button>
                          </>
                        ) : (
                          <span>Tutte le fatture registrate risultano regolarmente pagate.</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div style={styles.stepContent}>
                  <Landmark size={48} style={{ color: '#10b981', marginBottom: 16 }} />
                  <h3 style={{ margin: '0 0 16px' }}>Quadratura Incassi</h3>
                  {isCaricamento ? (
                    <p style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Loader2 size={16} className="animate-spin" /> Verifica in corso...
                    </p>
                  ) : errorConsuntivo ? (
                    <div style={styles.alertBox('warning')}>
                      <AlertTriangle size={20} />
                      <span>Impossibile completare la verifica.</span>
                    </div>
                  ) : (
                    <div style={styles.alertBox(datiVerifica.incassiDaRiconciliare > 0 ? 'warning' : 'success')}>
                      {datiVerifica.incassiDaRiconciliare > 0 ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                      <div style={{ flex: 1 }}>
                        {datiVerifica.incassiDaRiconciliare > 0 ? (
                          <>
                            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Attenzione: Movimenti non riconciliati</p>
                            <p style={{ margin: '0 0 12px', fontSize: 13 }}>
                              Sono presenti <strong>{datiVerifica.incassiDaRiconciliare}</strong> movimenti nell'estratto conto bancario che non sono stati associati ad alcuna rata (incasso) o fattura (spesa). 
                            </p>
                            <button onClick={() => handleResolveAnomaly('estratto-conto')} style={styles.btnActionWarning}>
                              <ExternalLink size={14} /> Controlla l'Estratto Conto
                            </button>
                          </>
                        ) : (
                          <span>Tutti i movimenti dell'estratto conto sembrano riconciliati correttamente. Nessun movimento orfano rilevato.</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div style={styles.stepContent}>
                  <CalendarCheck size={48} style={{ color: '#f59e0b', marginBottom: 16 }} />
                  <h3 style={{ margin: '0 0 16px' }}>Calcolo dei Conguagli e Saldi</h3>
                  {isCaricamento ? (
                    <p style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Loader2 size={16} className="animate-spin" /> Calcolo in corso...
                    </p>
                  ) : errorConsuntivo ? (
                    <div style={styles.alertBox('warning')}>
                      <AlertTriangle size={20} />
                      <span>Errore nel calcolo del consuntivo. Controllare la connessione o l'integrità dei dati.</span>
                    </div>
                  ) : (
                    <>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                        Verrà generato il riparto consuntivo definitivo per calcolare i saldi di ogni condòmino (Quote versate - Spese di competenza).
                      </p>
                      <div style={{ background: 'var(--app-bg)', padding: 16, borderRadius: 8, textAlign: 'left', border: '1px solid var(--border-color)', width: '100%', maxWidth: 400, marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                          <span>Spese Totali Esercizio:</span> <strong>€ {consuntivoData?.competenza?.totSpese?.toLocaleString('it-IT', { minimumFractionDigits: 2 }) || '0,00'}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                          <span>Quote Versate dai Condòmini:</span> <strong>€ {consuntivoData?.riparto?.tot?.versato?.toLocaleString('it-IT', { minimumFractionDigits: 2 }) || '0,00'}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: consuntivoData?.riparto?.tot?.conguaglio < 0 ? '#ef4444' : '#10b981', fontSize: 14 }}>
                          <span>Conguaglio Complessivo:</span> 
                          <strong>€ {Math.abs(consuntivoData?.riparto?.tot?.conguaglio || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })} {consuntivoData?.riparto?.tot?.conguaglio < 0 ? '(da incassare)' : '(credito)'}</strong>
                        </div>
                      </div>
                      
                      {!datiVerifica.saldiQuadri && (
                        <div style={styles.alertBox('warning')}>
                          <AlertTriangle size={20} />
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Attenzione: Scarto di Quadratura Rilevato</p>
                            <p style={{ margin: '0 0 12px', fontSize: 13 }}>
                              I totali della situazione di cassa (banca) non coincidono con il totale di competenza (entrate e uscite calcolate). È presente una differenza di <strong>€ {consuntivoData?.cassa?.scartoQuadratura?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong>. Questo solitamente accade se ci sono movimenti bancari mancanti o errati.
                            </p>
                            <button onClick={() => handleResolveAnomaly('dashboard-fin')} style={styles.btnActionWarning}>
                              <ExternalLink size={14} /> Analizza la Dashboard Finanziaria
                            </button>
                          </div>
                        </div>
                      )}
                      {datiVerifica.saldiQuadri && (
                        <div style={styles.alertBox('success')}>
                          <CheckCircle2 size={20} />
                          <span>Nessuno scarto di quadratura rilevato tra cassa e competenza.</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {step === 4 && (
                <div style={styles.stepContent}>
                  <CheckCircle2 size={56} style={{ color: '#7c3aed', marginBottom: 16 }} />
                  <h3 style={{ margin: '0 0 8px' }}>Tutto pronto per la chiusura</h3>
                  
                  {isCaricamento ? (
                    <p style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
                      <Loader2 size={16} className="animate-spin" /> Attendere la fine delle verifiche...
                    </p>
                  ) : hasAnomalies ? (
                    <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.3)', padding: 20, borderRadius: 12, marginTop: 12, textAlign: 'left', width: '100%' }}>
                      <p style={{ color: '#d97706', margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>
                        <AlertTriangle size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
                        Attenzione: Sono state rilevate anomalie contabili.
                      </p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
                        Per forzare la chiusura dell'esercizio nonostante le anomalie (fatture non pagate, movimenti non riconciliati, o scarti di quadratura), devi obbligatoriamente inserire una <strong>Nota di non conformità</strong> (es. "Fatture in sospeso riportate al nuovo anno"). Questa nota verrà salvata permanentemente a registro.
                      </p>
                      <textarea 
                        value={notaNonConformita}
                        onChange={e => setNotaNonConformita(e.target.value)}
                        placeholder="Inserisci qui le motivazioni per la chiusura forzata..."
                        style={{ width: '100%', boxSizing: 'border-box', minHeight: 90, padding: 12, borderRadius: 8, border: '1px solid var(--border-color-2)', background: 'var(--app-bg)', color: 'var(--text-primary)', fontFamily: 'inherit', resize: 'vertical', fontSize: 14 }}
                      />
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)' }}>
                      Questa operazione congelerà l'esercizio corrente in modo definitivo e riporterà i saldi.
                    </p>
                  )}
                </div>
              )}

              {step === 5 && (
                <div style={styles.stepContent}>
                  <CheckCircle2 size={64} style={{ color: '#10b981', marginBottom: 16 }} />
                  <h3 style={{ margin: '0 0 8px', fontSize: 24 }}>Chiusura Completata!</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                    L'esercizio è stato chiuso con successo. Ora puoi scaricare il consuntivo e il dossier con tutte le fatture.
                  </p>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {onDownloadPdf ? (
                      <button onClick={onDownloadPdf} style={{ padding: '12px 24px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
                        <FileText size={18} /> Scarica Consuntivo PDF
                      </button>
                    ) : onNavigateToConsuntivo ? (
                      <button onClick={() => { onClose(); onNavigateToConsuntivo(); }} style={{ padding: '12px 24px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
                        <FileText size={18} /> Vai al Consuntivo
                      </button>
                    ) : null}
                    
                    {onDownloadDossier && (
                      <button onClick={onDownloadDossier} style={{ padding: '12px 24px', background: 'transparent', border: '1px solid #10b981', color: '#059669', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
                        <Archive size={18} /> Dossier Completo (.zip)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={styles.footer}>
              {step < 5 ? (
                <>
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
                    <button 
                      onClick={handleChiudi} 
                      style={{ ...styles.btnSuccess, opacity: canConfirm && !isProcessing && !isCaricamento ? 1 : 0.5 }} 
                      disabled={!canConfirm || isProcessing || isCaricamento}
                    >
                      {isProcessing ? 'Chiusura in corso...' : 'Conferma Chiusura'} <Save size={16} />
                    </button>
                  )}
                </>
              ) : (
                <button onClick={onClose} style={styles.btnSecondary}>
                  Chiudi Wizard
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
  },
  btnActionWarning: {
    padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.5)',
    background: 'rgba(255, 255, 255, 0.5)', color: '#b45309', cursor: 'pointer',
    fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
    transition: 'all 0.2s'
  }
};
