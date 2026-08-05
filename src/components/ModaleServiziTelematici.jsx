import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ShieldCheck, FileText, Check, X, ShieldAlert, Loader2, FileCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generaDeliberaPrivacy } from '../lib/deliberaPrivacyGenerator';
import { generaCertificatoGdpr } from '../lib/certificatoGdprGenerator';
import { usePlan } from '../hooks/usePlan';
import { useDocumenti } from '../hooks/useDocumenti';

export default function ModaleServiziTelematici({ isOpen, onClose, condominio }) {
  const { profile, refresh } = usePlan();
  const { documenti, fetch: fetchDocumenti, upload: uploadDocumento } = useDocumenti(condominio?.id);
  const [loading, setLoading] = useState(true);
  const [servizio, setServizio] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [pacchetto, setPacchetto] = useState('app_full_150');
  const [adminDisclaimerAccepted, setAdminDisclaimerAccepted] = useState(false);

  
  // Stati per la gestione del verbale
  const [selectedVerbaleId, setSelectedVerbaleId] = useState('');
  const [fileCaricato, setFileCaricato] = useState(null);
  const fileInputRef = useRef(null);

  const verbali = documenti?.filter(d => d.tipo === 'verbale') || [];

  useEffect(() => {
    if (isOpen && condominio) {
      loadServizio();
      fetchDocumenti();
    }
  }, [isOpen, condominio]);

  async function loadServizio() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('condominio_servizi_telematici')
        .select('*')
        .eq('condominio_id', condominio.id)
        .maybeSingle();
      
      if (error) throw error;
      setServizio(data || { attivo: false });
      setPacchetto(data?.pacchetto && data.pacchetto !== 'nessuno' ? data.pacchetto : 'app_full_150');
      setAdminDisclaimerAccepted(data?.admin_disclaimer_accepted || false);
    } catch (err) {
      toast.error('Errore caricamento stato servizio');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Il file è troppo grande (max 10MB).");
      return;
    }
    setFileCaricato(file);
    setSelectedVerbaleId(''); // Resetta la selezione se si carica un nuovo file
  };

  async function toggleServizio() {
    setSaving(true);
    try {
      const nuovoStato = !servizio.attivo;
      let finalVerbaleId = selectedVerbaleId;

      // Se stiamo attivando, e c'è un file nuovo caricato, facciamone l'upload prima
      if (nuovoStato && fileCaricato) {
        if (!uploadDocumento) {
           throw new Error("Funzione di upload mancante nel contesto.");
        }
        const doc = await uploadDocumento(fileCaricato, 'verbale', fileCaricato.name);
        if (!doc || !doc.id) {
          throw new Error("Errore durante il caricamento del verbale.");
        }
        finalVerbaleId = doc.id;
        await fetchDocumenti(); // ricarichiamo i documenti
      }

      const payload = {
        condominio_id: condominio.id,
        attivo: nuovoStato, // Attivazione fiduciaria immediata
        data_attivazione: nuovoStato ? new Date().toISOString() : null,
        pacchetto: nuovoStato ? pacchetto : 'nessuno',
        admin_disclaimer_accepted: nuovoStato ? adminDisclaimerAccepted : false
      };

      if (servizio?.id) {
        payload.id = servizio.id;
      }

      if (nuovoStato && finalVerbaleId) {
         payload.verbale_approvazione_id = finalVerbaleId;
      } else if (!nuovoStato) {
         payload.verbale_approvazione_id = null;
      }

      if (nuovoStato) {
        toast.loading('Generazione link di pagamento in corso...', { id: 'checkout-toast' });
        // Invoca la Edge Function per ottenere il link Stripe PRIMA di salvare nel DB
        const { data: fnData, error: fnError } = await supabase.functions.invoke('stripe-checkout-telematici', {
          body: { condominio_id: condominio.id, pacchetto }
        });

        if (fnError) throw fnError;
        if (!fnData?.url) throw new Error("URL di checkout non ricevuto. Verifica la configurazione di Stripe.");

        // Se Stripe ha generato il link con successo, salviamo l'Attivazione Fiduciaria
        const { data, error } = await supabase
          .from('condominio_servizi_telematici')
          .upsert(payload)
          .select()
          .single();
        if (error) throw error;
        setServizio(data);

        toast.success('Reindirizzamento a Stripe...', { id: 'checkout-toast' });
        window.location.href = fnData.url;
        return; // Fermiamo l'esecuzione
      } else {
        // Disattivazione
        const { data, error } = await supabase
          .from('condominio_servizi_telematici')
          .upsert(payload)
          .select()
          .single();
        if (error) throw error;
        setServizio(data);
        toast.success('Servizio disattivato.', { id: 'checkout-toast' });
      }
      
      await refresh(); // Aggiorna il piano per il calcolo sconti
      setFileCaricato(null);
    } catch (err) {
      toast.error(err.message || 'Errore durante il salvataggio', { id: 'checkout-toast' });
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const handleGeneraDelibera = async () => {
    setGenerandoPdf(true);
    try {
      // Autosave pacchetto if service is already active, otherwise it gets saved on toggle
      if (servizio?.id) {
        await supabase.from('condominio_servizi_telematici').update({ pacchetto }).eq('id', servizio.id);
      }
      await generaDeliberaPrivacy(condominio, profile, pacchetto);
      toast.success('Delibera generata!');
    } catch (err) {
      toast.error('Errore generazione delibera');
      console.error(err);
    } finally {
      setGenerandoPdf(false);
    }
  };

  const handleGeneraCertificato = async () => {
    setGenerandoPdf(true);
    try {
      await generaCertificatoGdpr(condominio, profile);
      toast.success('Certificato generato!');
    } catch (err) {
      toast.error('Errore generazione certificato');
      console.error(err);
    } finally {
      setGenerandoPdf(false);
    }
  };

  if (!isOpen) return null;

  // Calcola se l'attivazione è consentita
  const canActivate = !servizio?.attivo && (selectedVerbaleId !== '' || fileCaricato !== null) && adminDisclaimerAccepted;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={24} color="#10b981" />
            <h2 style={styles.title}>Conservazione Fiscale & Privacy GDPR</h2>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
        </div>

        <div style={styles.content}>
          <div style={styles.infoBox}>
            <p style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Il modulo <strong>Conservazione Fiscale Sostitutiva 10 Anni & Portale Telematico GDPR</strong> permette di adempiere agli obblighi di legge (Art. 1130 c.c.) per la conservazione documentale e la tutela della privacy dei condòmini.
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
              <li>Archiviazione sicura cloud per 10 anni (fatture, e-c, pezze giustificative).</li>
              <li>Portale telematico accessibile ai condòmini H24.</li>
              <li>Registro del trattamento e conformità GDPR.</li>
            </ul>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Scegli il Pacchetto da proporre in Assemblea:</h3>
              
              <div 
                onClick={() => !servizio?.attivo && setPacchetto('base_36')}
                style={{ ...styles.cardPacchetto, borderColor: pacchetto === 'base_36' ? '#10b981' : 'var(--border-color)', background: pacchetto === 'base_36' ? '#10b98111' : 'var(--app-bg)', cursor: servizio?.attivo ? 'default' : 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Standard (Solo Conservazione GDPR)</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>36 € / anno</div>
                </div>
                <div style={{ fontSize: 12, color: '#10b981', marginTop: 4, fontWeight: 600 }}>Sconto tuo gestionale: +12 € / anno</div>
              </div>

              <div 
                onClick={() => !servizio?.attivo && setPacchetto('app_limitata_100')}
                style={{ ...styles.cardPacchetto, borderColor: pacchetto === 'app_limitata_100' ? '#10b981' : 'var(--border-color)', background: pacchetto === 'app_limitata_100' ? '#10b98111' : 'var(--app-bg)', cursor: servizio?.attivo ? 'default' : 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>App Condòmini (Versione Limitata)</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>100 € / anno</div>
                </div>
                <div style={{ fontSize: 12, color: '#10b981', marginTop: 4, fontWeight: 600 }}>Sconto tuo gestionale: +30 € / anno</div>
              </div>

              <div 
                onClick={() => !servizio?.attivo && setPacchetto('app_full_150')}
                style={{ ...styles.cardPacchetto, borderColor: pacchetto === 'app_full_150' ? '#10b981' : 'var(--border-color)', background: pacchetto === 'app_full_150' ? '#10b98111' : 'var(--app-bg)', cursor: servizio?.attivo ? 'default' : 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>App Condòmini Full Option</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>150 € / anno</div>
                </div>
                <div style={{ fontSize: 12, color: '#10b981', marginTop: 4, fontWeight: 600 }}>Sconto tuo gestionale: +50 € / anno</div>
              </div>

              {!servizio?.attivo && (
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 12, cursor: 'pointer', background: 'var(--card-bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <input type="checkbox" checked={adminDisclaimerAccepted} onChange={(e) => setAdminDisclaimerAccepted(e.target.checked)} style={{ marginTop: 2 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Dichiaro di agire come Referral Partner di CondoFAST e mi impegno a comunicare all'Assemblea l'eventuale agevolazione sul mio canone, in conformità all'art. 1129 c.c.
                  </span>
                </label>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Loader2 size={24} className="spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : (
            <div style={{ marginTop: 24 }}>
              
              {!servizio?.attivo && (
                <div style={{ marginBottom: 24, padding: 16, borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--app-bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <ShieldAlert size={18} style={{ color: '#f59e0b' }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Autorizzazione Assembleare (Obbligatoria)
                    </span>
                  </div>
                  <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                    Per procedere con l'attivazione del servizio a pagamento, è necessario allegare o selezionare il <strong>Verbale di Assemblea</strong> in cui è stata deliberata l'approvazione della spesa.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        Scegli tra i Verbali già caricati:
                      </label>
                      <select 
                        value={selectedVerbaleId}
                        onChange={(e) => { setSelectedVerbaleId(e.target.value); setFileCaricato(null); }}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}
                      >
                        <option value="">-- Nessun verbale selezionato --</option>
                        {verbali.map(v => (
                          <option key={v.id} value={v.id}>{v.nome}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }}></div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>oppure</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }}></div>
                    </div>

                    <div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        accept=".pdf,.doc,.docx"
                        onChange={handleFileSelect}
                      />
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px dashed #7c3aed', background: fileCaricato ? '#7c3aed11' : 'transparent', color: '#7c3aed', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                      >
                        <FileText size={18} />
                        {fileCaricato ? `File Selezionato: ${fileCaricato.name}` : 'Carica Nuovo Verbale (PDF/DOC)'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div style={styles.statusSection}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {servizio?.attivo ? (
                    <div style={styles.statusBadgeActive}>
                      <Check size={16} /> Servizio Attivo
                    </div>
                  ) : (
                    <div style={styles.statusBadgeInactive}>
                      <ShieldAlert size={16} /> Servizio Non Attivo
                    </div>
                  )}
                  {servizio?.data_attivazione && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Dal {new Date(servizio.data_attivazione).toLocaleDateString('it-IT')}
                    </span>
                  )}
                </div>

                <button 
                  onClick={toggleServizio}
                  disabled={saving || (!servizio?.attivo && !canActivate)}
                  style={{
                    ...styles.toggleBtn,
                    background: (!servizio?.attivo && !canActivate) ? '#6b7280' : (servizio?.attivo ? 'var(--app-bg)' : '#10b981'),
                    color: servizio?.attivo ? '#ef4444' : '#fff',
                    border: servizio?.attivo ? '1px solid #ef4444' : 'none',
                    cursor: (!servizio?.attivo && !canActivate) ? 'not-allowed' : 'pointer',
                    flex: 1,
                    justifyContent: 'center'
                  }}
                >
                  {saving ? <Loader2 size={16} className="spin" /> : (servizio?.attivo ? 'Disattiva Servizio' : 'Richiedi Link Pagamento e Attiva')}
                </button>
              </div>

              <div style={styles.actionsGrid}>
                <button 
                  style={{...styles.actionBtn, opacity: generandoPdf ? 0.6 : 1}} 
                  onClick={handleGeneraDelibera}
                  disabled={generandoPdf}
                >
                  <FileText size={18} style={{ color: '#3b82f6' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Genera Delibera Assemblea</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Kit precompilato per approvazione</div>
                  </div>
                </button>

                <button 
                  style={{...styles.actionBtn, opacity: (!servizio?.attivo || generandoPdf) ? 0.6 : 1, cursor: (!servizio?.attivo || generandoPdf) ? 'not-allowed' : 'pointer'}}
                  onClick={handleGeneraCertificato}
                  disabled={!servizio?.attivo || generandoPdf}
                >
                  <FileCheck size={18} style={{ color: '#10b981' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Certificato GDPR Condominio</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Attestato di conformità privacy</div>
                  </div>
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 9999, padding: 20
  },
  modal: {
    background: 'var(--card-bg)',
    borderRadius: 16,
    width: '100%', maxWidth: 600,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    display: 'flex', flexDirection: 'column',
    maxHeight: '90vh',
    border: '1px solid var(--border-color)',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  title: {
    margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)'
  },
  closeBtn: {
    background: 'transparent', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', padding: 4, display: 'flex'
  },
  content: {
    padding: 24,
    overflowY: 'auto'
  },
  infoBox: {
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16
  },
  statusSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    marginBottom: 24
  },
  statusBadgeActive: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(16, 185, 129, 0.1)', color: '#059669',
    padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600
  },
  statusBadgeInactive: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
    padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600
  },
  toggleBtn: {
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
    transition: 'opacity 0.2s'
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    transition: 'all 0.2s',
    color: 'var(--text-primary)',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
  },
  cardPacchetto: {
    padding: 12,
    borderRadius: 8,
    border: '1px solid var(--border-color)',
    transition: 'all 0.2s'
  }
};
