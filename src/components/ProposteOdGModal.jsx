import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { X, MessageSquarePlus, CheckCircle2, Clock, Archive, ArrowRight, AlertCircle, Plus, Filter, User, Building } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProposteOdGModal({ condominioId, onClose, onAggiungiAdAssemblea }) {
  const [proposte, setProposte] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStato, setFiltroStato] = useState('tutti');
  const [showNuovaProposta, setShowNuovaProposta] = useState(false);
  const [persone, setPersone] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    persona_id: '',
    titolo: '',
    descrizione: '',
    categoria: 'manutenzione',
    priorita: 'normale'
  });

  const loadProposte = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('assemblee_proposte_odg')
        .select('*, persona:persone(id, nome, cognome, codice_fiscale)')
        .eq('condominio_id', condominioId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProposte(data || []);

      // Carica persone per eventuale inserimento manuale
      const { data: personeData } = await supabase
        .from('persone')
        .select('id, nome, cognome')
        .eq('condominio_id', condominioId)
        .order('cognome');
      setPersone(personeData || []);
    } catch (err) {
      console.error('Errore caricamento proposte OdG:', err);
      toast.error('Errore caricamento proposte OdG');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (condominioId) {
      loadProposte();
    }
  }, [condominioId]);

  const handleAggiornaStato = async (id, nuovoStato, note = null) => {
    try {
      const updateData = { stato: nuovoStato };
      if (note !== null) updateData.note_amministratore = note;

      const { error } = await supabase
        .from('assemblee_proposte_odg')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      toast.success(nuovoStato === 'archiviata' ? 'Proposta archiviata' : 'Stato aggiornato');
      loadProposte();
    } catch (err) {
      console.error('Errore aggiornamento stato:', err);
      toast.error('Errore durante l\'aggiornamento');
    }
  };

  const handleCreaProposta = async (e) => {
    e.preventDefault();
    if (!form.titolo.trim() || !form.descrizione.trim()) {
      toast.error('Compila titolo e descrizione');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('assemblee_proposte_odg')
        .insert({
          condominio_id: condominioId,
          persona_id: form.persona_id || (persone[0]?.id || null),
          titolo: form.titolo,
          descrizione: form.descrizione,
          categoria: form.categoria,
          priorita: form.priorita,
          stato: 'in_attesa'
        });

      if (error) throw error;
      toast.success('Proposta inserita con successo');
      setShowNuovaProposta(false);
      setForm({ persona_id: '', titolo: '', descrizione: '', categoria: 'manutenzione', priorita: 'normale' });
      loadProposte();
    } catch (err) {
      console.error('Errore salvataggio proposta:', err);
      toast.error('Errore inserimento: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const proposteFiltrate = proposte.filter(p => {
    if (filtroStato === 'tutti') return true;
    return p.stato === filtroStato;
  });

  const conteggioInAttesa = proposte.filter(p => p.stato === 'in_attesa').length;

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={S.iconWrap}>
              <MessageSquarePlus size={22} color="#3b82f6" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                Cassetto Proposte OdG dei Condòmini
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                Raccogli, valuta e inserisci all'ordine del giorno le richieste pervenute durante l'anno.
              </p>
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {/* Action & Filter Bar */}
        <div style={S.toolbar}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setFiltroStato('tutti')}
              style={{ ...S.filterBtn, ...(filtroStato === 'tutti' ? S.filterBtnActive : {}) }}
            >
              Tutte ({proposte.length})
            </button>
            <button
              onClick={() => setFiltroStato('in_attesa')}
              style={{ ...S.filterBtn, ...(filtroStato === 'in_attesa' ? S.filterBtnActive : {}) }}
            >
              In Attesa ({conteggioInAttesa})
            </button>
            <button
              onClick={() => setFiltroStato('inserita_odg')}
              style={{ ...S.filterBtn, ...(filtroStato === 'inserita_odg' ? S.filterBtnActive : {}) }}
            >
              Inserite in Assemblea
            </button>
            <button
              onClick={() => setFiltroStato('archiviata')}
              style={{ ...S.filterBtn, ...(filtroStato === 'archiviata' ? S.filterBtnActive : {}) }}
            >
              Archiviate
            </button>
          </div>

          <button
            onClick={() => setShowNuovaProposta(!showNuovaProposta)}
            style={S.btnNuova}
          >
            <Plus size={16} /> Registra Proposta
          </button>
        </div>

        {/* Form Nuova Proposta Rapida */}
        {showNuovaProposta && (
          <form onSubmit={handleCreaProposta} style={S.formWrap}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Aggiungi Proposta per conto di un condòmino
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={S.label}>Condòmino Proponente</label>
                <select
                  value={form.persona_id}
                  onChange={e => setForm({ ...form, persona_id: e.target.value })}
                  style={S.input}
                  required
                >
                  <option value="">Seleziona condòmino...</option>
                  {persone.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.cognome} {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>Categoria & Priorità</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={form.categoria}
                    onChange={e => setForm({ ...form, categoria: e.target.value })}
                    style={S.input}
                  >
                    <option value="manutenzione">Manutenzione</option>
                    <option value="spese">Spese / Bilancio</option>
                    <option value="regolamento">Regolamento</option>
                    <option value="servizi">Servizi Comuni</option>
                    <option value="altro">Altro</option>
                  </select>
                  <select
                    value={form.priorita}
                    onChange={e => setForm({ ...form, priorita: e.target.value })}
                    style={S.input}
                  >
                    <option value="normale">Priorità Normale</option>
                    <option value="urgente">Priorità Urgente</option>
                    <option value="bassa">Bassa Priorità</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Titolo del punto proposto</label>
              <input
                type="text"
                placeholder="Es. Sostituzione lampade androne con LED a sensore"
                value={form.titolo}
                onChange={e => setForm({ ...form, titolo: e.target.value })}
                style={S.input}
                required
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Motivazione e descrizione dettagliata</label>
              <textarea
                placeholder="Descrivi la richiesta pervenuta dal condòmino..."
                value={form.descrizione}
                onChange={e => setForm({ ...form, descrizione: e.target.value })}
                style={{ ...S.input, minHeight: 70, resize: 'vertical' }}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowNuovaProposta(false)}
                style={S.btnSecondary}
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={saving}
                style={S.btnPrimary}
              >
                {saving ? 'Salvataggio...' : 'Salva nel Cassetto'}
              </button>
            </div>
          </form>
        )}

        {/* Content List */}
        <div style={S.listContent}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              Caricamento proposte...
            </div>
          ) : proposteFiltrate.length === 0 ? (
            <div style={S.emptyBox}>
              <Clock size={36} color="#94a3b8" style={{ marginBottom: 10 }} />
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Nessuna proposta trovata per questo filtro.
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                I condòmini possono inviare proposte in qualsiasi momento dalla loro App CondoFast.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {proposteFiltrate.map(p => {
                const isUrgente = p.priorita === 'urgente';
                return (
                  <div key={p.id} style={S.propostaCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{
                            ...S.badge,
                            background: isUrgente ? '#fee2e2' : '#e0e7ff',
                            color: isUrgente ? '#dc2626' : '#4338ca'
                          }}>
                            {p.categoria || 'Generale'}
                          </span>
                          {isUrgente && (
                            <span style={{ ...S.badge, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
                              ⚡ URGENTE
                            </span>
                          )}
                          <span style={{
                            ...S.badge,
                            background: p.stato === 'in_attesa' ? '#fef3c7' :
                                        p.stato === 'inserita_odg' ? '#d1fae5' :
                                        p.stato === 'approvata' ? '#dbeafe' : '#f1f5f9',
                            color: p.stato === 'in_attesa' ? '#b45309' :
                                   p.stato === 'inserita_odg' ? '#047857' :
                                   p.stato === 'approvata' ? '#1d4ed8' : '#64748b'
                          }}>
                            {p.stato === 'in_attesa' ? 'In Attesa' :
                             p.stato === 'inserita_odg' ? 'Inserita in OdG' :
                             p.stato === 'approvata' ? 'Accolta' : 'Archiviata'}
                          </span>
                        </div>
                        <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {p.titolo}
                        </h4>
                      </div>

                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {p.created_at ? new Date(p.created_at).toLocaleDateString('it-IT') : ''}
                      </span>
                    </div>

                    <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {p.descrizione}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={14} />
                        <span>Proposta da: <strong>{p.persona ? `${p.persona.cognome} ${p.persona.nome}` : 'Condòmino'}</strong></span>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        {p.stato !== 'inserita_odg' && onAggiungiAdAssemblea && (
                          <button
                            onClick={() => onAggiungiAdAssemblea(p)}
                            style={S.btnActionPromuovi}
                            title="Aggiungi come punto OdG nella prossima assemblea"
                          >
                            <ArrowRight size={14} /> Inserisci in Assemblea
                          </button>
                        )}
                        {p.stato === 'in_attesa' && (
                          <button
                            onClick={() => handleAggiornaStato(p.id, 'archiviata')}
                            style={S.btnActionArchivia}
                            title="Archivia proposta"
                          >
                            <Archive size={14} /> Archivia
                          </button>
                        )}
                        {p.stato === 'archiviata' && (
                          <button
                            onClick={() => handleAggiornaStato(p.id, 'in_attesa')}
                            style={S.btnActionRipristina}
                          >
                            Ripristina
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1050,
    padding: 16
  },
  modal: {
    background: 'var(--card-bg, #ffffff)',
    borderRadius: 16,
    width: '100%',
    maxWidth: 780,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
    border: '1px solid var(--border-color, #e2e8f0)',
    fontFamily: 'Sora, sans-serif'
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-color, #e2e8f0)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: 'rgba(59, 130, 246, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted, #64748b)',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 8
  },
  toolbar: {
    padding: '12px 20px',
    background: 'var(--app-bg, #f8fafc)',
    borderBottom: '1px solid var(--border-color, #e2e8f0)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  filterBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid var(--border-color, #e2e8f0)',
    background: 'var(--card-bg, #ffffff)',
    color: 'var(--text-secondary, #475569)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif'
  },
  filterBtnActive: {
    background: '#3b82f6',
    color: '#ffffff',
    borderColor: '#3b82f6'
  },
  btnNuova: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 8,
    border: 'none',
    background: '#10b981',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif'
  },
  formWrap: {
    padding: '16px 20px',
    background: 'rgba(59, 130, 246, 0.04)',
    borderBottom: '1px solid var(--border-color, #e2e8f0)'
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-secondary, #475569)',
    marginBottom: 4
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--border-color, #cbd5e1)',
    background: 'var(--card-bg, #ffffff)',
    fontSize: 13,
    color: 'var(--text-primary, #0f172a)',
    fontFamily: 'Sora, sans-serif',
    boxSizing: 'border-box'
  },
  btnPrimary: {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: '#3b82f6',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif'
  },
  btnSecondary: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid var(--border-color, #cbd5e1)',
    background: 'transparent',
    color: 'var(--text-secondary, #475569)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif'
  },
  listContent: {
    padding: '16px 20px',
    overflowY: 'auto',
    flex: 1
  },
  emptyBox: {
    textAlign: 'center',
    padding: '40px 20px',
    background: 'var(--app-bg, #f8fafc)',
    borderRadius: 12,
    border: '1px dashed var(--border-color, #e2e8f0)'
  },
  propostaCard: {
    background: 'var(--card-bg, #ffffff)',
    borderRadius: 12,
    padding: 16,
    border: '1px solid var(--border-color, #e2e8f0)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
  },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  btnActionPromuovi: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 6,
    border: 'none',
    background: '#3b82f6',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnActionArchivia: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid var(--border-color, #cbd5e1)',
    background: 'transparent',
    color: 'var(--text-muted, #64748b)',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnActionRipristina: {
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid var(--border-color, #cbd5e1)',
    background: 'transparent',
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer'
  }
};
