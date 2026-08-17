import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Gift, Copy, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import RisparmioStudioWidget from '../components/RisparmioStudioWidget';
import PanoramicaPacchettiModal from '../components/PanoramicaPacchettiModal';
import SelezioneCondominioModal from '../components/SelezioneCondominioModal';
import ModaleServiziTelematici from '../components/ModaleServiziTelematici';

const styles = {
  container: {
    padding: '24px 40px',
    maxWidth: 1000,
    margin: '0 auto',
    width: '100%',
    paddingBottom: 80
  },
  header: {
    marginBottom: 32
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: '0 0 8px 0',
    letterSpacing: '-0.02em'
  },
  subtitle: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: 1.5
  },
  section: {
    marginBottom: 48,
    paddingBottom: 40,
    borderBottom: '1px solid var(--border-color-2)'
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 24px 0',
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  brandingCard: {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
  },
  brandingLabel: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 6
  },
  brandingInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--border-color-2)',
    fontSize: 14,
    color: 'var(--text-primary)',
    background: 'var(--app-bg)',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  brandingBtn: {
    padding: '10px 20px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  }
};

export default function ScontiPromoPage() {
  const { user, profile } = useAuth();
  
  // Stati Referral Program
  const [userReferrals, setUserReferrals] = useState([]);
  const [activeCampagna, setActiveCampagna] = useState(null);
  const [loadingReferrals, setLoadingReferrals] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Stati Modali Pacchetti
  const [showPanoramica, setShowPanoramica] = useState(false);
  const [showSelezione, setShowSelezione] = useState(false);
  const [showAttivazione, setShowAttivazione] = useState(false);
  
  const [selectedPacchetto, setSelectedPacchetto] = useState(null);
  const [selectedCondominio, setSelectedCondominio] = useState(null);

  useEffect(() => {
    async function fetchReferralData() {
      try {
        const { data: refs, error: refsErr } = await supabase
          .from('referrals')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (refsErr) throw refsErr;
        setUserReferrals(refs || []);

        const { data: camp, error: campErr } = await supabase
          .from('referral_campaigns')
          .select('*')
          .eq('attiva', true)
          .maybeSingle();

        if (campErr) throw campErr;
        setActiveCampagna(camp || null);
      } catch (e) {
        console.error('Errore caricamento dati referral:', e);
      } finally {
        setLoadingReferrals(false);
      }
    }

    if (user?.id) {
      fetchReferralData();
    }
  }, [user]);

  function formattaEmailMascherata(email) {
    if (!email) return '';
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) return name + '***@' + domain;
    return name.substring(0, 2) + '***' + name.substring(name.length - 1) + '@' + domain;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Sconti & Promozioni</h1>
        <p style={styles.subtitle}>
          Scopri tutti i modi per abbattere i costi della tua licenza CondoFAST.
        </p>
      </header>

      {/* ── RISPARMIO STUDIO ────────────────────────── */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Risparmio Studio</h2>
        <p style={{ ...styles.subtitle, marginTop: -8, marginBottom: 16 }}>
          Il programma che riduce il tuo canone mensile offrendo servizi extra ai tuoi condomini.
        </p>
        <RisparmioStudioWidget onScopriClick={() => setShowPanoramica(true)} />
      </section>

      {/* ── REFERRAL PROGRAM / PORTA UN AMICO ────────────────────────── */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Porta un amico</h2>
        <p style={{ ...styles.subtitle, marginTop: -8, marginBottom: 16 }}>
          Invita un collega ad iscriversi a CondoFAST. Ricevi uno sconto sulla tua prossima fatturazione per ogni amico abbonato.
        </p>

        <div style={styles.brandingCard}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Box Campagna Attiva */}
            {activeCampagna ? (
              <div style={{ background: 'var(--card-bg)', border: '1px dashed #3b82f6', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: '#1e3a8a', padding: 10, borderRadius: 8, color: '#3b82f6' }}>
                  <Gift size={24} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Campagna Promozionale Attiva: {activeCampagna.nome}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Ottieni <strong style={{ color: '#10b981' }}>{activeCampagna.sconto_importo}€</strong> di sconto sul tuo abbonamento per ogni amministratore invitato che attiva un piano.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: 'var(--border-color)', padding: 10, borderRadius: 8, color: 'var(--text-secondary)' }}>
                  <Gift size={24} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Nessuna campagna attiva al momento
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Puoi comunque condividere il tuo link di invito. Gli sconti verranno applicati in base alle future campagne promozionali.
                  </div>
                </div>
              </div>
            )}

            {/* Link di invito */}
            <div>
              <label style={styles.brandingLabel}>Il tuo link di invito unico</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/register?ref=${profile?.referral_code || ''}`}
                  style={{ ...styles.brandingInput, flex: 1, fontFamily: 'monospace', color: '#3b82f6', background: 'var(--input-bg)' }}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/register?ref=${profile?.referral_code || ''}`);
                    setCopiedLink(true);
                    toast.success('Link copiato negli appunti!');
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  style={{
                    ...styles.brandingBtn,
                    background: copiedLink ? '#10b981' : '#2563eb',
                    width: 120,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  {copiedLink ? 'Copiato' : 'Copia'}
                </button>
              </div>
            </div>

            {/* Tabella Storico Inviti */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Storico dei tuoi inviti</h3>
              
              {loadingReferrals ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '10px 0' }}>Caricamento inviti...</div>
              ) : userReferrals.length > 0 ? (
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--app-bg)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Amico Invitato</th>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Stato</th>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Sconto Valore</th>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Invitato il</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userReferrals.map(ref => (
                        <tr key={ref.id} style={{ borderBottom: '1px solid var(--border-color-2)' }}>
                          <td style={{ padding: '12px', fontSize: 13, color: 'var(--text-primary)' }}>
                            {formattaEmailMascherata(ref.referred_email)}
                          </td>
                          <td style={{ padding: '12px', fontSize: 13 }}>
                            {ref.stato === 'registrato' && (
                              <span style={{ color: 'var(--text-muted)', background: 'var(--border-color-2)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>Registrato</span>
                            )}
                            {ref.stato === 'convalidato' && (
                              <span style={{ color: 'var(--accent)', background: 'var(--accent-glow)', border: '1px solid var(--accent)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>Abbonato (In attesa)</span>
                            )}
                            {ref.stato === 'applicato' && (
                              <span style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.15)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>Sconto Applicato</span>
                            )}
                          </td>
                          <td style={{ padding: '12px', fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                            {ref.sconto_valore}€
                          </td>
                          <td style={{ padding: '12px', fontSize: 12, color: 'var(--text-muted)' }}>
                            {new Date(ref.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ background: 'var(--app-bg)', padding: 20, borderRadius: 8, textAlign: 'center', border: '1px solid var(--border-color-2)' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Non hai ancora invitato nessun amico. Condividi il tuo link per iniziare a risparmiare!</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </section>


      {/* ── MODALI ────────────────────────── */}
      {showPanoramica && (
        <PanoramicaPacchettiModal 
          onClose={() => setShowPanoramica(false)} 
          onSelectPacchetto={(pkg) => {
            setSelectedPacchetto(pkg);
            setShowPanoramica(false);
            setShowSelezione(true);
          }} 
        />
      )}

      {showSelezione && (
        <SelezioneCondominioModal 
          pacchetto={selectedPacchetto}
          onClose={() => setShowSelezione(false)}
          onConferma={(condominio, pkg) => {
            setSelectedCondominio(condominio);
            setShowSelezione(false);
            setShowAttivazione(true);
          }}
        />
      )}

      {showAttivazione && selectedCondominio && (
        <ModaleServiziTelematici 
          isOpen={showAttivazione}
          onClose={() => setShowAttivazione(false)}
          condominio={selectedCondominio}
        />
      )}
    </div>
  );
}
