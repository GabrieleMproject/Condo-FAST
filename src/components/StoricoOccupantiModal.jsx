import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  User, Clock, Plus, Trash2, Calendar, UserPlus, X, Search, Check, AlertCircle 
} from 'lucide-react';

const formattaData = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('it-IT');
  } catch {
    return dateStr;
  }
};

export default function StoricoOccupantiModal({ unita, ruolo, onClose, onSaved }) {
  const [storico, setStorico] = useState([]);
  const [personeList, setPersoneList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Subentry Form States
  const [selectedPersonaId, setSelectedPersonaId] = useState('');
  const [dataSubentro, setDataSubentro] = useState(new Date().toISOString().split('T')[0]);
  const [searchPersonText, setSearchPersonText] = useState('');

  // New Person Form States
  const [showNewPersonForm, setShowNewPersonForm] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newCognome, setNewCognome] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTelefono, setNewTelefono] = useState('');
  const [newCf, setNewCf] = useState('');

  useEffect(() => {
    if (unita?.id) {
      loadData();
    }
  }, [unita?.id, ruolo]);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Fetch occupant history for this unit and role
      const { data: hist, error: histErr } = await supabase
        .from('occupanti_unita')
        .select(`
          id, ruolo, attivo, data_inizio, data_fine, created_at,
          persone (id, nome, cognome, email, telefono, codice_fiscale)
        `)
        .eq('unita_id', unita.id)
        .eq('ruolo', ruolo)
        .order('data_inizio', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (histErr) throw histErr;
      setStorico(hist || []);

      // 2. Fetch all people managed by this admin for the subentry dropdown list
      const { data: pers, error: persErr } = await supabase
        .from('persone')
        .select('id, nome, cognome, email, telefono, codice_fiscale')
        .order('cognome', { ascending: true })
        .order('nome', { ascending: true });

      if (persErr) throw persErr;
      setPersoneList(pers || []);
    } catch (e) {
      console.error('[StoricoOccupantiModal] loadData error:', e);
      setErrorMsg('Errore nel caricamento: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter people list based on search text
  const filteredPersone = useMemo(() => {
    if (!searchPersonText.trim()) return personeList;
    const query = searchPersonText.toLowerCase();
    return personeList.filter(p => 
      `${p.cognome || ''} ${p.nome || ''}`.toLowerCase().includes(query) ||
      (p.codice_fiscale || '').toLowerCase().includes(query) ||
      (p.email || '').toLowerCase().includes(query)
    );
  }, [personeList, searchPersonText]);

  // Current active occupant helper
  const currentActive = useMemo(() => {
    return storico.find(s => s.attivo) || null;
  }, [storico]);

  // Create a new person inline
  const handleCreaPersona = async () => {
    if (!newNome.trim() || !newCognome.trim()) {
      alert('Nome e Cognome sono obbligatori.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato.');

      const { data, error } = await supabase
        .from('persone')
        .insert([{
          nome: newNome.trim(),
          cognome: newCognome.trim(),
          email: newEmail.trim() || null,
          telefono: newTelefono.trim() || null,
          codice_fiscale: newCf.trim().toUpperCase() || null,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      // Add to list and select automatically
      setPersoneList(prev => [...prev, data].sort((a, b) => (a.cognome || '').localeCompare(b.cognome || '')));
      setSelectedPersonaId(data.id);
      
      // Reset form
      setNewNome('');
      setNewCognome('');
      setNewEmail('');
      setNewTelefono('');
      setNewCf('');
      setShowNewPersonForm(false);
      setSearchPersonText('');
    } catch (e) {
      alert('Errore creazione persona: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Save subentry transition
  const handleSalvaSubentro = async () => {
    if (!selectedPersonaId) {
      alert('Seleziona una persona per il subentro.');
      return;
    }
    if (!dataSubentro) {
      alert('Inserisci la data del subentro.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      // 1. If there is a current active occupant, deactivate it and set data_fine
      if (currentActive) {
        // Calculate data_fine as dataSubentro minus 1 day
        const subDate = new Date(dataSubentro);
        subDate.setDate(subDate.getDate() - 1);
        const dataFineStr = subDate.toISOString().split('T')[0];

        const { error: errOld } = await supabase
          .from('occupanti_unita')
          .update({
            attivo: false,
            data_fine: dataFineStr
          })
          .eq('id', currentActive.id);
        
        if (errOld) throw errOld;
      }

      // 2. Insert new occupant record as active
      const { error: errNew } = await supabase
        .from('occupanti_unita')
        .insert([{
          unita_id: unita.id,
          persona_id: selectedPersonaId,
          ruolo: ruolo,
          attivo: true,
          data_inizio: dataSubentro,
          data_fine: null
        }]);

      if (errNew) throw errNew;

      // Reset subentry fields
      setSelectedPersonaId('');
      setSearchPersonText('');
      
      // Reload and notify parent
      await loadData();
      if (onSaved) onSaved();
    } catch (e) {
      setErrorMsg('Errore durante il subentro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete a historical record from timeline
  const handleEliminaStorico = async (recordId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa riga di storico? L\'eliminazione è permanente.')) {
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('occupanti_unita')
        .delete()
        .eq('id', recordId);
      if (error) throw error;

      await loadData();
      if (onSaved) onSaved();
    } catch (e) {
      setErrorMsg('Errore eliminazione riga storico: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={st.modal} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={st.modalHeader}>
          <div>
            <h3 style={st.modalTitle}>
              🕒 Storico {ruolo === 'proprietario' ? 'Proprietari' : 'Inquilini'}
            </h3>
            <p style={st.modalSub}>
              Unità {unita.numero} {unita.scala ? `· Scala ${unita.scala}` : ''} {unita.piano != null ? `· Piano ${unita.piano}` : ''}
            </p>
          </div>
          <button className="storico-close-btn" style={st.closeBtn} onClick={onClose} disabled={saving}>
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div style={st.errorBox}>
            <AlertCircle size={15} style={{ marginRight: 6 }} /> {errorMsg}
          </div>
        )}

        <div style={st.modalBody}>
          {/* Left panel: Timeline of history */}
          <div style={st.leftPanel}>
            <h4 style={st.sectionTitle}>Cronologia</h4>
            
            {loading ? (
              <div style={st.loadingBox}>Caricamento storico...</div>
            ) : storico.length === 0 ? (
              <div style={st.emptyTimeline}>
                Nessun {ruolo === 'proprietario' ? 'proprietario' : 'inquilino'} storico registrato.
              </div>
            ) : (
              <div style={st.timelineList}>
                {storico.map((s, index) => {
                  const p = s.persone || {};
                  return (
                    <div key={s.id} style={st.timelineItem}>
                      <div style={st.timelineLineWrap}>
                        <div style={{
                          ...st.timelineDot,
                          background: s.attivo ? '#10b981' : '#64748b'
                        }} />
                        {index < storico.length - 1 && <div style={st.timelineLine} />}
                      </div>

                      <div style={st.timelineContent}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div>
                            <span style={{ fontWeight: 600, color: s.attivo ? '#f1f5f9' : '#94a3b8' }}>
                              {p.cognome} {p.nome}
                            </span>
                            {s.attivo ? (
                              <span style={st.badgeActive}>Attivo</span>
                            ) : (
                              <span style={st.badgePast}>Ex</span>
                            )}
                          </div>
                          
                          <button 
                            className="storico-delete-btn"
                            style={st.deleteBtn}
                            onClick={() => handleEliminaStorico(s.id)}
                            title="Elimina record storico"
                            disabled={saving}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {/* Dates info */}
                        <div style={st.timelineDates}>
                          <Calendar size={11} style={{ marginRight: 4 }} />
                          {s.attivo ? (
                            <span>Corrente (dal {s.data_inizio ? formattaData(s.data_inizio) : formattaData(s.created_at)})</span>
                          ) : (
                            <span>Dal {formattaData(s.data_inizio) || 'Inizio'} al {formattaData(s.data_fine) || 'Fine'}</span>
                          )}
                        </div>

                        {/* Contact details */}
                        {(p.email || p.telefono) && (
                          <div style={st.timelineContacts}>
                            {p.email && <span style={{ marginRight: 8 }}>✉️ {p.email}</span>}
                            {p.telefono && <span>📞 {p.telefono}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel: Subentry registration Form */}
          <div style={st.rightPanel}>
            <h4 style={st.sectionTitle}>🔄 Registra Subentro</h4>
            
            {showNewPersonForm ? (
              // Structured form to create a new person inline
              <div style={st.formCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>Crea Anagrafica Condòmino</span>
                  <button style={st.textLinkBtn} onClick={() => setShowNewPersonForm(false)}>Annulla</button>
                </div>

                <div style={st.formGroup}>
                  <label style={st.formLabel}>Nome *</label>
                  <input style={st.formInput} placeholder="es. Mario" value={newNome} onChange={e => setNewNome(e.target.value)} />
                </div>
                <div style={st.formGroup}>
                  <label style={st.formLabel}>Cognome *</label>
                  <input style={st.formInput} placeholder="es. Rossi" value={newCognome} onChange={e => setNewCognome(e.target.value)} />
                </div>
                <div style={st.formGroup}>
                  <label style={st.formLabel}>Email</label>
                  <input style={st.formInput} placeholder="es. mario@email.it" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                </div>
                <div style={st.formGroup}>
                  <label style={st.formLabel}>Telefono</label>
                  <input style={st.formInput} placeholder="es. 3331112233" value={newTelefono} onChange={e => setNewTelefono(e.target.value)} />
                </div>
                <div style={st.formGroup}>
                  <label style={st.formLabel}>Codice Fiscale</label>
                  <input style={st.formInput} placeholder="es. RSSMRA..." value={newCf} onChange={e => setNewCf(e.target.value)} />
                </div>

                <button style={{ ...st.btnPrimary, width: '100%', marginTop: 8 }} onClick={handleCreaPersona} disabled={saving}>
                  <Plus size={13} style={{ marginRight: 6 }} /> Crea e Seleziona
                </button>
              </div>
            ) : (
              // Standard subentry transition selector
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                
                {/* Search field */}
                <div style={st.formGroup}>
                  <label style={st.formLabel}>Cerca Condòmino</label>
                  <div style={st.searchWrap}>
                    <Search size={13} color="#64748b" style={{ marginLeft: 6 }} />
                    <input 
                      style={st.searchInput} 
                      placeholder="Filtra la lista per nome..."
                      value={searchPersonText}
                      onChange={e => setSearchPersonText(e.target.value)}
                    />
                  </div>
                </div>

                {/* Dropdown with search result */}
                <div style={st.formGroup}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={st.formLabel}>Scegli Persona *</label>
                    <button 
                      style={st.textLinkBtn}
                      onClick={() => setShowNewPersonForm(true)}
                    >
                      <UserPlus size={12} style={{ marginRight: 4 }} /> + Nuovo
                    </button>
                  </div>
                  <select 
                    style={st.select}
                    value={selectedPersonaId}
                    onChange={e => setSelectedPersonaId(e.target.value)}
                  >
                    <option value="">— Seleziona proprietario —</option>
                    {filteredPersone.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.cognome} {p.nome} {p.codice_fiscale ? `(${p.codice_fiscale})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date picker */}
                <div style={st.formGroup}>
                  <label style={st.formLabel}>Data Subentro *</label>
                  <input
                    type="date"
                    style={st.formInput}
                    value={dataSubentro}
                    onChange={e => setDataSubentro(e.target.value)}
                  />
                </div>

                <button 
                  style={{ ...st.btnPrimary, width: '100%', marginTop: 10 }}
                  onClick={handleSalvaSubentro}
                  disabled={saving || !selectedPersonaId}
                >
                  <Check size={13} style={{ marginRight: 6 }} /> Applica Subentro
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── STILI ──────────────────────────────────────────────────────────────────
const st = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1100, padding: 20,
  },
  modal: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 16,
    padding: 20, width: '100%', maxWidth: 750, boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
    maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: 14,
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: '1px solid #334155', paddingBottom: 10,
  },
  modalTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' },
  modalSub: { margin: '4px 0 0', fontSize: 12, color: '#94a3b8' },
  closeBtn: {
    background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer',
    padding: 6, display: 'flex', alignItems: 'center', borderRadius: '50%',
    '&:hover': { background: '#334155', color: '#f1f5f9' }
  },
  errorBox: {
    background: '#ef444415', border: '1px solid #ef444430', borderRadius: 8,
    padding: '8px 12px', color: '#f87171', fontSize: 12, display: 'flex', alignItems: 'center'
  },
  modalBody: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: 20,
    minHeight: 320,
    overflowY: 'auto',
  },
  
  // Left Panel
  leftPanel: {
    display: 'flex', flexDirection: 'column',
    borderRight: '1px solid #334155', paddingRight: 20,
  },
  sectionTitle: {
    margin: '0 0 12px', fontSize: 13, textTransform: 'uppercase',
    letterSpacing: '0.05em', color: '#94a3b8', borderBottom: '1px solid #33415550',
    paddingBottom: 6
  },
  loadingBox: {
    fontSize: 13, color: '#64748b', textAlign: 'center', padding: 30
  },
  emptyTimeline: {
    fontSize: 12, color: '#64748b', textAlign: 'center', padding: '40px 10px',
    border: '1px dashed #334155', borderRadius: 8, background: '#0f172a20'
  },
  timelineList: {
    display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1, maxHeight: 300,
  },
  timelineItem: {
    display: 'flex', gap: 10, position: 'relative'
  },
  timelineLineWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14,
  },
  timelineDot: {
    width: 8, height: 8, borderRadius: '50%', marginTop: 6, zIndex: 1
  },
  timelineLine: {
    width: 2, flex: 1, background: '#334155', margin: '4px 0'
  },
  timelineContent: {
    flex: 1, paddingBottom: 14,
  },
  badgeActive: {
    fontSize: 9, color: '#10b981', background: '#10b98115',
    padding: '1px 5px', borderRadius: 4, fontWeight: 700, marginLeft: 6,
    textTransform: 'uppercase'
  },
  badgePast: {
    fontSize: 9, color: '#94a3b8', background: '#33415530',
    padding: '1px 5px', borderRadius: 4, fontWeight: 700, marginLeft: 6,
    textTransform: 'uppercase'
  },
  timelineDates: {
    fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', marginTop: 4
  },
  timelineContacts: {
    fontSize: 11, color: '#64748b', marginTop: 3, wordBreak: 'break-all'
  },
  deleteBtn: {
    background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
    padding: 2, display: 'flex', alignItems: 'center', hover: { color: '#ef4444' }
  },

  // Right Panel
  rightPanel: {
    display: 'flex', flexDirection: 'column', gap: 12
  },
  formCard: {
    background: '#0f172a30', border: '1px solid #334155', borderRadius: 8,
    padding: 12, display: 'flex', flexDirection: 'column', gap: 8
  },
  formGroup: {
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  formLabel: {
    fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em'
  },
  formInput: {
    background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
    padding: '6px 10px', color: '#e2e8f0', fontFamily: "'Sora', sans-serif",
    fontSize: 12, outline: 'none'
  },
  searchWrap: {
    display: 'flex', alignItems: 'center', background: '#0f172a',
    border: '1px solid #334155', borderRadius: 6
  },
  searchInput: {
    background: 'none', border: 'none', color: '#e2e8f0', padding: '5px 8px',
    fontFamily: "'Sora', sans-serif", fontSize: 12, outline: 'none', flex: 1
  },
  select: {
    background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
    padding: '6px 8px', color: '#e2e8f0', fontFamily: "'Sora', sans-serif",
    fontSize: 12, outline: 'none', cursor: 'pointer'
  },
  textLinkBtn: {
    background: 'none', border: 'none', color: '#38bdf8', fontSize: 11,
    cursor: 'pointer', padding: 0, fontWeight: 600, display: 'flex', alignItems: 'center'
  },
  btnPrimary: {
    background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: 6, padding: '8px 12px', fontFamily: "'Sora', sans-serif",
    fontWeight: 600, fontSize: 12, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.2s'
  }
};
