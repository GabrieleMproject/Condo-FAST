import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAssemblee } from '../hooks/useAssemblee';
import AssembleaLiveConsole from './AssembleaLiveConsole';
import ProposteOdGModal from './ProposteOdGModal';
import {
  CalendarRange, Plus, Video, MapPin, Loader2, ArrowRight, QrCode,
  MessageSquarePlus, Smartphone, Copy, Check, ExternalLink, ShieldCheck
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import toast from 'react-hot-toast';

export default function GestioneAssembleeView({ condominioId }) {
  const { assemblee, loading, error, fetch, crea } = useAssemblee(condominioId);
  const [activeAssembleaId, setActiveAssembleaId] = useState(null);
  
  // Modale creazione
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ titolo: '', tipo: 'ordinaria', tipo_convocazione: 'seconda', data_inizio: '', luogo: '', link_video: '', note: '' });
  const [odgList, setOdgList] = useState([{ titolo: '', descrizione: '', tipo_quorum: 'ordinaria_maggioranza', quorum_millesimi_richiesto: 333.33 }]);
  const [creating, setCreating] = useState(false);
  const [showQrGenerico, setShowQrGenerico] = useState(null);

  // Proposte OdG & Codice App Condominio
  const [showProposteModal, setShowProposteModal] = useState(false);
  const [conteggioProposte, setConteggioProposte] = useState(0);
  const [showInvitoModal, setShowInvitoModal] = useState(false);
  const [condominioData, setCondominioData] = useState(null);
  const [copiedInvito, setCopiedInvito] = useState(false);

  useEffect(() => {
    fetch();
    loadCondominioInfo();
  }, [fetch, condominioId]);

  const loadCondominioInfo = async () => {
    if (!condominioId) return;
    try {
      // 1. Carica info condominio (incluso codice_app)
      const { data: condo } = await supabase
        .from('condomini')
        .select('*')
        .eq('id', condominioId)
        .single();
      setCondominioData(condo);

      // 2. Carica conteggio proposte in attesa
      const { count } = await supabase
        .from('assemblee_proposte_odg')
        .select('*', { count: 'exact', head: true })
        .eq('condominio_id', condominioId)
        .eq('stato', 'in_attesa');
      setConteggioProposte(count || 0);
    } catch (err) {
      console.error('Errore caricamento dati condominio:', err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const validOdg = odgList.filter(o => o.titolo.trim() !== '');
      await crea(form, validOdg);
      setShowCreate(false);
      setForm({ titolo: '', tipo: 'ordinaria', tipo_convocazione: 'seconda', data_inizio: '', luogo: '', link_video: '', note: '' });
      setOdgList([{ titolo: '', descrizione: '', tipo_quorum: 'ordinaria_maggioranza', quorum_millesimi_richiesto: 333.33 }]);
      toast.success('Assemblea creata con successo!');
    } catch (err) {
      toast.error('Errore creazione assemblea: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleAggiungiDaProposta = (proposta) => {
    setShowProposteModal(false);
    setShowCreate(true);
    setOdgList(prev => [
      ...prev.filter(o => o.titolo.trim() !== ''),
      {
        titolo: proposta.titolo,
        descrizione: `${proposta.descrizione} (Proposto da: ${proposta.persona?.cognome || ''} ${proposta.persona?.nome || ''})`,
        tipo_quorum: 'ordinaria_maggioranza',
        quorum_millesimi_richiesto: 333.33,
        proposta_id: proposta.id
      }
    ]);
    toast.success('Proposta aggiunta all\'Ordine del Giorno in bozza');
  };

  const copyTestoInvito = () => {
    const codice = condominioData?.codice_app || 'CONDO-APP';
    const appUrl = import.meta.env.VITE_CONDOMINO_APP_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? `http://${window.location.hostname}:5174` : 'https://condomino.condofast.it');
    const testo = `Gentile Condòmino,\nè ora disponibile la nuova App Condòmini di ${condominioData?.nome || 'Condominio'}.\n\nDa oggi puoi consultare tutti i documenti, visualizzare e copiare i dati per pagare le rate con 1 click, proporre punti all'Ordine del Giorno e votare in diretta durante le assemblee!\n\n📲 Accedi qui: ${appUrl}\n🔑 Codice Condominio: *${codice}*\nBasta inserire il tuo Codice Fiscale e il Codice Condominio per accedere istantaneamente.\n\nCordiali saluti,\nLo Studio di Amministrazione`;
    navigator.clipboard.writeText(testo);
    setCopiedInvito(true);
    toast.success('Messaggio di invito copiato negli appunti!');
    setTimeout(() => setCopiedInvito(false), 2500);
  };

  if (activeAssembleaId) {
    return (
      <AssembleaLiveConsole 
        assembleaId={activeAssembleaId} 
        onClose={() => {
          setActiveAssembleaId(null);
          fetch();
        }} 
      />
    );
  }

  return (
    <div>
      {/* Top Banner Action & Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>
            Programmazione Assemblee & Votazioni Live
          </h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
            Pianifica le assemblee, raccogli le proposte dei condòmini e gestisci la votazione real-time.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Pulsante Cassetto Proposte OdG */}
          <button
            onClick={() => setShowProposteModal(true)}
            style={S.btnProposte}
          >
            <MessageSquarePlus size={16} />
            <span>Proposte OdG Condòmini</span>
            {conteggioProposte > 0 && (
              <span style={S.badgeCount}>{conteggioProposte}</span>
            )}
          </button>

          {/* Pulsante Invito App Condòmini */}
          <button
            onClick={() => setShowInvitoModal(true)}
            style={S.btnInvito}
          >
            <Smartphone size={16} /> Invita Condòmini
          </button>

          <button onClick={() => setShowCreate(true)} style={S.btnPrimary}>
            <Plus size={16} /> Nuova Assemblea
          </button>
        </div>
      </div>

      {loading && !assemblee.length ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}><Loader2 size={24} className="spin" /></div>
      ) : assemblee.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: 'var(--card-bg)', borderRadius: 12, border: '1px dashed var(--border-color)' }}>
          <CalendarRange size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 600 }}>Nessuna assemblea programmata.</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Crea una nuova assemblea ordinaria o straordinaria per avviare la convocazione.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {assemblee.map(ass => (
            <div key={ass.id} style={S.assembleaCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ 
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, textTransform: 'uppercase',
                      background: ass.tipo === 'ordinaria' ? 'rgba(59,130,246,0.1)' : 'rgba(139,92,246,0.1)',
                      color: ass.tipo === 'ordinaria' ? '#3b82f6' : '#8b5cf6'
                    }}>
                      {ass.tipo}
                    </span>
                    <span style={{ 
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, textTransform: 'uppercase',
                      background: ass.stato === 'bozza' ? 'rgba(148,163,184,0.1)' : 
                                  ass.stato === 'in_corso' ? 'rgba(16,185,129,0.1)' : 
                                  'rgba(245,158,11,0.1)',
                      color: ass.stato === 'bozza' ? '#94a3b8' : 
                             ass.stato === 'in_corso' ? '#10b981' : 
                             '#f59e0b'
                    }}>
                      {ass.stato.replace('_', ' ')}
                    </span>
                  </div>
                  <h4 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--text-primary)', fontWeight: 700 }}>{ass.titolo}</h4>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {ass.data_inizio && <span>{new Date(ass.data_inizio).toLocaleString('it-IT')}</span>}
                    {ass.luogo && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12}/> {ass.luogo}</span>}
                    {ass.link_video && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Video size={12}/> Teleassemblea</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <button 
                    onClick={() => setActiveAssembleaId(ass.id)}
                    style={S.btnActionRegia}
                  >
                    Entra nella Live Regia <ArrowRight size={14} />
                  </button>
                  <button 
                    onClick={() => setShowQrGenerico(ass.id)}
                    style={{ ...S.btnAction, background: 'var(--app-bg)', color: 'var(--text-secondary)' }}
                  >
                    <QrCode size={14} /> QR Sala App
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Cassetto Proposte OdG */}
      {showProposteModal && (
        <ProposteOdGModal
          condominioId={condominioId}
          onClose={() => {
            setShowProposteModal(false);
            loadCondominioInfo();
          }}
          onAggiungiAdAssemblea={handleAggiungiDaProposta}
        />
      )}

      {/* Modal Invito App Condòmini */}
      {showInvitoModal && (
        <div style={S.overlay} onClick={() => setShowInvitoModal(false)}>
          <div style={{ ...S.modalCard, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Smartphone size={22} color="#4338ca" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Invita i Condòmini sull'App
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                  I condòmini accedono in sicurezza con il Codice Condominio e il loro Codice Fiscale.
                </p>
              </div>
            </div>

            <div style={{ background: 'var(--app-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
                Codice Condominio Univoco (PIN)
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6', letterSpacing: '0.1em' }}>
                {condominioData?.codice_app || 'COND-APP'}
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, fontSize: 12, color: '#334155', lineHeight: 1.4, marginBottom: 16 }}>
              <strong>Testo d'invito pre-compilato:</strong>
              <div style={{ marginTop: 6, color: '#64748b', fontStyle: 'italic' }}>
                "Gentile Condòmino, è disponibile l'App di {condominioData?.nome || 'Condominio'}. Accedi inserendo il tuo Codice Fiscale e il Codice Condominio: {condominioData?.codice_app}..."
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={copyTestoInvito}
                style={{ ...S.btnPrimary, flex: 1, justifyContent: 'center' }}
              >
                {copiedInvito ? <Check size={16} /> : <Copy size={16} />}
                {copiedInvito ? 'Copiato!' : 'Copia Messaggio per WhatsApp/Email'}
              </button>
              <button
                onClick={() => setShowInvitoModal(false)}
                style={S.btnSecondary}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Creazione Assemblea con Quorum */}
      {showCreate && (
        <div style={S.overlay}>
          <div style={S.modalCard}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)', fontWeight: 700 }}>Nuova Assemblea</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.label}>Titolo Assemblea *</label>
                  <input required value={form.titolo} onChange={e=>setForm({...form, titolo: e.target.value})} style={S.input} placeholder="Es. Assemblea Ordinaria Esercizio 2026" />
                </div>
                <div>
                  <label style={S.label}>Tipo Assemblea *</label>
                  <select required value={form.tipo} onChange={e=>setForm({...form, tipo: e.target.value})} style={S.input}>
                    <option value="ordinaria">Ordinaria</option>
                    <option value="straordinaria">Straordinaria</option>
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.label}>Data e Ora Inizio *</label>
                  <input type="datetime-local" required value={form.data_inizio} onChange={e=>setForm({...form, data_inizio: e.target.value})} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Luogo Fisico (opzionale)</label>
                  <input value={form.luogo} onChange={e=>setForm({...form, luogo: e.target.value})} style={S.input} placeholder="Es. Sala Condominiale / Studio" />
                </div>
              </div>

              <div>
                <label style={S.label}>Link Teleassemblea (Google Meet / Zoom - opzionale)</label>
                <input value={form.link_video} onChange={e=>setForm({...form, link_video: e.target.value})} style={S.input} placeholder="Es. https://meet.google.com/..." />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px' }}>
                  <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}>
                    Punti all'Ordine del Giorno (OdG)
                  </h4>
                  <button
                    type="button"
                    onClick={() => setOdgList([...odgList, { titolo: '', descrizione: '', tipo_quorum: 'ordinaria_maggioranza', quorum_millesimi_richiesto: 333.33 }])}
                    style={{ ...S.btnSecondary, padding: '4px 10px', fontSize: 12 }}
                  >
                    + Aggiungi Punto
                  </button>
                </div>

                {odgList.map((odg, idx) => (
                  <div key={idx} style={{ background: 'var(--app-bg)', padding: 12, borderRadius: 10, border: '1px solid var(--border-color)', marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, padding: '6px 10px', background: 'var(--card-bg)', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12 }}>
                        #{idx + 1}
                      </span>
                      <input 
                        value={odg.titolo}
                        onChange={e => {
                          const newOdg = [...odgList];
                          newOdg[idx] = { ...newOdg[idx], titolo: e.target.value };
                          setOdgList(newOdg);
                        }}
                        style={{ ...S.input, flex: 1 }}
                        placeholder="Titolo del punto OdG (es. Approvazione Rendiconto Consuntivo)"
                        required
                      />
                      {odgList.length > 1 && (
                        <button type="button" onClick={() => setOdgList(odgList.filter((_, i) => i !== idx))} style={{ ...S.btnSecondary, padding: '0 10px', color: '#ef4444' }}>&times;</button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                      <input
                        value={odg.descrizione || ''}
                        onChange={e => {
                          const newOdg = [...odgList];
                          newOdg[idx] = { ...newOdg[idx], descrizione: e.target.value };
                          setOdgList(newOdg);
                        }}
                        style={{ ...S.input, fontSize: 12 }}
                        placeholder="Note o descrizione del punto per i condòmini..."
                      />
                      <select
                        value={odg.tipo_quorum || 'ordinaria_maggioranza'}
                        onChange={e => {
                          const newOdg = [...odgList];
                          newOdg[idx] = { ...newOdg[idx], tipo_quorum: e.target.value };
                          setOdgList(newOdg);
                        }}
                        style={{ ...S.input, fontSize: 12 }}
                      >
                        <option value="ordinaria_maggioranza">Ordinaria (333,33 ‰)</option>
                        <option value="straordinaria_500">Straordinaria (500,00 ‰)</option>
                        <option value="innovazioni_667">Innovazioni (667,00 ‰)</option>
                        <option value="unanimita_1000">Unanimità (1000 ‰)</option>
                        <option value="personalizzato">Personalizzato</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={() => setShowCreate(false)} style={S.btnSecondary}>Annulla</button>
                <button type="submit" disabled={creating} style={S.btnPrimary}>{creating ? 'Salvataggio...' : 'Crea Assemblea'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal QR Code Generico */}
      {showQrGenerico && (
        <div style={S.overlay} onClick={() => setShowQrGenerico(null)}>
          <div style={{ ...S.modalCard, width: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 700 }}>Accesso App Assemblea (Sala)</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)' }}>
              Proietta o mostra questo QR Code ai condòmini presenti in sala per farli accedere al voto in tempo reale.
            </p>
            <div style={{ background: '#fff', padding: 20, borderRadius: 16, display: 'inline-block', border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <QRCodeCanvas 
                value={`${window.location.origin}/voto/join/${showQrGenerico}`}
                size={220}
                level="H"
                includeMargin={true}
              />
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>
              Link manuale per i condòmini:<br/>
              <strong style={{ userSelect: 'all', color: '#3b82f6' }}>{window.location.origin}/voto/join/{showQrGenerico}</strong>
            </p>
            <button onClick={() => setShowQrGenerico(null)} style={{ ...S.btnSecondary, width: '100%' }}>Chiudi</button>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  btnPrimary: { background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Sora, sans-serif' },
  btnSecondary: { background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
  btnProposte: { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Sora, sans-serif' },
  btnInvito: { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Sora, sans-serif' },
  badgeCount: { background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 10 },
  btnAction: { background: 'rgba(37,99,235,0.1)', color: '#3b82f6', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
  btnActionRegia: { background: '#10b981', color: '#ffffff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 6px rgba(16,185,129,0.3)' },
  assembleaCard: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modalCard: { background: 'var(--card-bg, #ffffff)', padding: 24, borderRadius: 16, width: 620, maxWidth: '92%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color, #e2e8f0)', fontFamily: 'Sora, sans-serif' },
  label: { display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' },
  input: { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--app-bg)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'Sora, sans-serif', boxSizing: 'border-box' },
};
