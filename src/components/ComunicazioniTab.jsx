import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { supabase } from '../lib/supabaseClient';
import { useComunicazioni } from '../hooks/useComunicazioni';
import { Mail, Calendar, Eye, Send, Plus, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export default function ComunicazioniTab({ condominioId }) {
  const { comunicazioni, loading, fetchComunicazioni, inviaComunicazione } = useComunicazioni();
  const [persone, setPersone] = useState([]);
  const [loadingPersone, setLoadingPersone] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null);

  // Form State
  const [tipo, setTipo] = useState('generale');
  const [destinatariSelezionati, setDestinatariSelezionati] = useState([]);
  const [oggetto, setOggetto] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [inviando, setInviando] = useState(false);
  const [erroreForm, setErroreForm] = useState('');

  useEffect(() => {
    if (condominioId) {
      fetchComunicazioni(condominioId);
      loadPersone();
    }
  }, [condominioId, fetchComunicazioni]);

  // Carica le persone collegate a questo condominio
  async function loadPersone() {
    setLoadingPersone(true);
    try {
      const { data, error } = await supabase
        .from('persone')
        .select(`
          id, nome, cognome, email,
          occupanti_unita!inner(
            ruolo,
            attivo,
            unita!inner(condominio_id, numero)
          )
        `)
        .eq('occupanti_unita.unita.condominio_id', condominioId)
        .eq('occupanti_unita.attivo', true);

      if (error) throw error;

      // Filtra le persone che hanno un'email valida ed evita duplicati
      const unique = [];
      const seen = new Set();
      (data || []).forEach(p => {
        if (p.email && !seen.has(p.id)) {
          seen.add(p.id);
          // Raccogli i numeri di unità collegate
          const unitaList = p.occupanti_unita
            .filter(ou => ou.unita?.condominio_id === condominioId && ou.attivo)
            .map(ou => ou.unita.numero);
          unique.push({
            id: p.id,
            nome: `${p.nome} ${p.cognome}`,
            email: p.email,
            unita: unitaList.join(', '),
          });
        }
      });

      setPersone(unique);
    } catch (err) {
      console.error('Errore caricamento persone:', err.message);
    } finally {
      setLoadingPersone(false);
    }
  }

  // Gestione selezione destinatari
  const handleToggleDestinatario = (p) => {
    if (destinatariSelezionati.some(x => x.id === p.id)) {
      setDestinatariSelezionati(prev => prev.filter(x => x.id !== p.id));
    } else {
      setDestinatariSelezionati(prev => [...prev, p]);
    }
  };

  const handleSelectAll = () => {
    if (destinatariSelezionati.length === persone.length) {
      setDestinatariSelezionati([]);
    } else {
      setDestinatariSelezionati(persone);
    }
  };

  // Quando cambia il tipo, inizializza con i template base
  const handleTipoChange = (nuovoTipo) => {
    setTipo(nuovoTipo);
    if (nuovoTipo === 'avviso') {
      setOggetto('Avviso ai Condòmini');
      setMessaggio(`Gentile Condòmino,<br/><br/>Si comunica che in data [Inserire Data] alle ore [Inserire Ora] si terrà l'assemblea condominiale presso [Inserire Luogo].<br/><br/>Ordine del giorno:<br/>1. Approvazione rendiconto<br/>2. Varie ed eventuali<br/><br/>Cordiali saluti,<br/>L'Amministratore`);
    } else if (nuovoTipo === 'sollecito') {
      if (destinatariSelezionati.length === 1) {
        caricaECompilaSollecito(destinatariSelezionati[0]);
      } else {
        setOggetto('Sollecito pagamento rate condominiali');
        setMessaggio(`Gentile Condòmino,<br/><br/>Le ricordiamo che sono scaduti i termini per il pagamento delle rate condominiali dell'esercizio corrente.<br/><br/>La invitiamo a verificare la sua situazione finanziaria all'interno della griglia rate o a contattare l'amministrazione per regolarizzare il saldo il prima possibile.<br/><br/>Cordiali saluti,<br/>L'Amministratore`);
      }
    } else {
      // generale
      setOggetto('');
      setMessaggio('');
    }
  };

  // Rileva cambi nei destinatari solo per aggiornare il sollecito
  useEffect(() => {
    if (tipo === 'sollecito') {
      if (destinatariSelezionati.length === 1) {
        caricaECompilaSollecito(destinatariSelezionati[0]);
      } else {
        setOggetto('Sollecito pagamento rate condominiali');
        setMessaggio(`Gentile Condòmino,<br/><br/>Le ricordiamo che sono scaduti i termini per il pagamento delle rate condominiali dell'esercizio corrente.<br/><br/>La invitiamo a verificare la sua situazione finanziaria all'interno della griglia rate o a contattare l'amministrazione per regolarizzare il saldo il prima possibile.<br/><br/>Cordiali saluti,<br/>L'Amministratore`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinatariSelezionati]);

  // Carica i dati delle rate e compila il sollecito con il conguaglio finanziario
  async function caricaECompilaSollecito(dest) {
    try {
      // 1. Esercizio aperto (usa maybeSingle per evitare eccezioni)
      const { data: esData, error: esErr } = await supabase
        .from('esercizi')
        .select('id, anno')
        .eq('condominio_id', condominioId)
        .eq('stato', 'aperto')
        .maybeSingle();

      if (esErr || !esData) {
        setOggetto('Sollecito pagamento rate');
        setMessaggio(`Gentile ${dest.nome},<br/><br/>Le inviamo la presente per sollecitare il pagamento delle rate scadute. Non risultano esercizi attualmente aperti per il condominio.`);
        return;
      }

      // 2. Unità del condòmino
      const { data: unitaData } = await supabase
        .from('unita')
        .select(`
          id, numero,
          occupanti_unita!inner(persona_id, attivo)
        `)
        .eq('condominio_id', condominioId)
        .eq('occupanti_unita.persona_id', dest.id)
        .eq('occupanti_unita.attivo', true);

      if (!unitaData || unitaData.length === 0) return;
      const unitaIds = unitaData.map(u => u.id);

      // 3. Rate dell'esercizio
      const { data: rateData } = await supabase
        .from('rate')
        .select('id, data_scadenza, descrizione')
        .eq('esercizio_id', esData.id);

      if (!rateData || rateData.length === 0) return;
      const rateIds = rateData.map(r => r.id);

      // 4. Rate unità
      const { data: rateUnitaData } = await supabase
        .from('rate_unita')
        .select('*')
        .in('unita_id', unitaIds)
        .in('rata_id', rateIds);

      const rateUnitaList = rateUnitaData || [];
      const dovuto = rateUnitaList.reduce((s, r) => s + parseFloat(r.importo || 0), 0);
      const pagato = rateUnitaList.reduce((s, r) => s + parseFloat(r.importo_pagato || 0), 0);
      const insoluto = dovuto - pagato;

      const rateScadute = rateUnitaList.filter(ru => {
        const rata = rateData.find(r => r.id === ru.rata_id);
        const scaduta = rata?.data_scadenza && new Date(rata.data_scadenza) < new Date();
        return scaduta && ru.stato !== 'pagata' && ru.stato !== 'sovra_pagata';
      });

      const importoScaduto = rateScadute.reduce((s, r) => s + (parseFloat(r.importo || 0) - parseFloat(r.importo_pagato || 0)), 0);

      const testo = `Gentile <strong>${dest.nome}</strong>,<br/><br/>
Le inviamo la presente comunicazione in merito all'esercizio condominiale <strong>${esData.anno}</strong> (Unità: ${dest.unita}).<br/><br/>
Dalle nostre scritture contabili risulta la seguente <strong>quadratura finanziaria aggiornata</strong> per le sue quote:<br/>
<ul>
  <li>Totale dovuto per l'esercizio: <strong>€ ${dovuto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong></li>
  <li>Totale da lei versato ad oggi: <strong>€ ${pagato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong></li>
  <li>Saldo insoluto residuo: <strong>€ ${insoluto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong></li>
</ul>
Di questo saldo insoluto, l'importo attualmente <span style="color:#ef4444; font-weight:bold;">in ritardo / già scaduto</span> è pari a: <strong>€ ${importoScaduto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong>.<br/><br/>
La invitiamo a provvedere al saldo delle quote insolute a mezzo bonifico bancario.<br/><br/>
Cordiali saluti,<br/>
L'Amministratore`;

      setOggetto(`Sollecito pagamento rate Esercizio ${esData.anno} - Unità ${dest.unita}`);
      setMessaggio(testo);
    } catch (err) {
      console.error('Errore compilazione sollecito:', err.message);
    }
  }

  // Invio comunicazione
  async function handleInvia(e) {
    e.preventDefault();
    if (destinatariSelezionati.length === 0) {
      setErroreForm('Seleziona almeno un destinatario.');
      return;
    }
    if (!oggetto || !messaggio) {
      setErroreForm('Oggetto e corpo del messaggio sono obbligatori.');
      return;
    }

    setInviando(true);
    setErroreForm('');
    try {
      const destinatariBody = destinatariSelezionati.map(d => ({
        email: d.email,
        nome: d.nome,
      }));

      await inviaComunicazione({
        condominioId,
        destinatari: destinatariBody,
        oggetto,
        messaggio,
        tipo,
      });

      setShowModal(false);
      // Reset form
      setTipo('generale');
      setDestinatariSelezionati([]);
      setOggetto('');
      setMessaggio('');
    } catch (err) {
      setErroreForm('Errore durante l\'invio: ' + err.message);
    } finally {
      setInviando(false);
    }
  }

  const STATI = {
    inviata:    { label: 'Inviata',    color: '#10b981', bg: '#10b98115' },
    consegnata: { label: 'Consegnata', color: '#10b981', bg: '#10b98115' },
    fallita:    { label: 'Fallita',    color: '#ef4444', bg: '#ef444415' }
  };

  const TIPI = {
    generale:  'Generale',
    avviso:    'Avviso',
    sollecito: 'Sollecito'
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div style={styles.titleSec}>
          <Mail size={18} color="#64748b" />
          <span style={styles.titleText}>Registro Comunicazioni Condominio</span>
        </div>
        <button onClick={() => setShowModal(true)} style={styles.btnNew}>
          <Plus size={15} style={{ marginRight: 6 }} /> Nuova Comunicazione
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Caricamento comunicazioni...</div>
      ) : comunicazioni.length === 0 ? (
        <div style={styles.empty}>
          <Mail size={32} color="var(--text-muted)" style={{ marginBottom: 10 }} />
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nessuna email o sollecito inviato per questo condominio</p>
        </div>
      ) : (
        <div style={styles.list}>
          {comunicazioni.map(c => {
            const stato = STATI[c.stato] || STATI.inviata;
            return (
              <div key={c.id} style={styles.card}>
                <div style={styles.cardInfo}>
                  <div style={styles.cardTop}>
                    <span style={styles.destName}>{c.destinatario_nome || 'Condòmino'}</span>
                    <span style={styles.destEmail}>&lt;{c.destinatario_email}&gt;</span>
                    <span style={{ ...styles.badge, color: c.tipo === 'sollecito' ? '#ef4444' : '#60a5fa', background: c.tipo === 'sollecito' ? '#ef444415' : '#60a5fa15' }}>
                      {TIPI[c.tipo] || c.tipo}
                    </span>
                    <span style={{ ...styles.badge, color: stato.color, background: stato.bg }}>
                      {stato.label}
                    </span>
                  </div>
                  <div style={styles.cardOggetto}>{c.oggetto}</div>
                  <div style={{ ...styles.cardDate, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={12} /> <span>{new Date(c.created_at).toLocaleDateString('it-IT')} alle ore {new Date(c.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedMsg(c)} style={styles.btnView} title="Leggi Messaggio">
                  <Eye size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modale Nuova Comunicazione */}
      {showModal && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: 800 }}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Invia Comunicazione / Sollecito via Email</h3>
              <button onClick={() => setShowModal(false)} style={styles.btnClose} type="button"><X size={18} /></button>
            </div>
            <form onSubmit={handleInvia} style={{ display: 'contents' }}>
              <div style={styles.modalBody}>
                {erroreForm && (
                  <div style={{ ...styles.errBanner, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} /> <span>{erroreForm}</span>
                  </div>
                )}

                <div style={styles.formGrid}>
                  {/* Sezione Sinistra: Opzioni e Destinatari */}
                  <div style={styles.formCol}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Tipo Comunicazione</label>
                      <select value={tipo} onChange={e => handleTipoChange(e.target.value)} style={styles.select}>
                        <option value="generale">Generale (Testo Libero)</option>
                        <option value="avviso">Avviso / Convocazione Assemblea</option>
                        <option value="sollecito">Sollecito Rata (Conguagliato)</option>
                      </select>
                    </div>

                    <div style={styles.formGroup} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={styles.label}>Destinatari ({destinatariSelezionati.length})</label>
                        {persone.length > 0 && (
                          <button type="button" onClick={handleSelectAll} style={styles.btnLink}>
                            {destinatariSelezionati.length === persone.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                          </button>
                        )}
                      </div>
                      
                      <div style={styles.destList}>
                        {loadingPersone ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 10 }}>Caricamento condòmini...</div>
                        ) : persone.length === 0 ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 10 }}>
                            Nessun condòmino configurato con indirizzo email.
                          </div>
                        ) : (
                          persone.map(p => {
                            const isChecked = destinatariSelezionati.some(x => x.id === p.id);
                            return (
                              <label key={p.id} style={{ ...styles.destItem, background: isChecked ? 'rgba(37,99,235,0.08)' : 'transparent' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleDestinatario(p)}
                                  style={{ marginRight: 10 }}
                                />
                                <div style={{ fontSize: 13 }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.nome}</div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{p.email} • Unità: {p.unita}</div>
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sezione Destra: Oggetto e Testo */}
                  <div style={{ ...styles.formCol, flex: 1.4 }}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Oggetto Email</label>
                      <input
                        type="text"
                        value={oggetto}
                        onChange={e => setOggetto(e.target.value)}
                        placeholder="Oggetto della mail..."
                        style={styles.input}
                        required
                      />
                    </div>

                    <div style={styles.formGroup} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <label style={styles.label}>Messaggio (Supporta HTML)</label>
                      <textarea
                        value={messaggio}
                        onChange={e => setMessaggio(e.target.value)}
                        placeholder="Scrivi il corpo della mail qui..."
                        style={{ ...styles.textarea, flex: 1 }}
                        required
                      />
                    </div>
                  </div>
                </div>

                {tipo === 'sollecito' && destinatariSelezionati.length === 1 && (
                  <div style={styles.infoBanner}>
                    <Info size={14} style={{ marginRight: 6, flexShrink: 0 }} />
                    <span>
                      Conguaglio finanziario inserito automaticamente per <strong>{destinatariSelezionati[0].nome}</strong>.
                    </span>
                  </div>
                )}
                {tipo === 'sollecito' && destinatariSelezionati.length > 1 && (
                  <div style={styles.warnBanner}>
                    <AlertTriangle size={14} style={{ marginRight: 6, flexShrink: 0 }} />
                    <span>
                      Hai selezionato più destinatari. Verrà inviata un'email di sollecito standard a ciascuno (senza i calcoli specifici dell'unità).
                    </span>
                  </div>
                )}
              </div>
              <div style={styles.modalFooter}>
                <button type="button" onClick={() => setShowModal(false)} style={styles.btnCancel}>Annulla</button>
                <button type="submit" disabled={inviando || destinatariSelezionati.length === 0} style={styles.btnSubmit}>
                  {inviando ? 'Invio in corso...' : `Invia a ${destinatariSelezionati.length} destinatari`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Visualizzazione Dettaglio */}
      {selectedMsg && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Dettaglio Email Inviata</h3>
              <button onClick={() => setSelectedMsg(null)} style={styles.btnClose}><X size={18} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Destinatario:</span>
                <span style={styles.metaValue}>
                  {selectedMsg.destinatario_nome ? `${selectedMsg.destinatario_nome} <${selectedMsg.destinatario_email}>` : selectedMsg.destinatario_email}
                </span>
              </div>
              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Data di invio:</span>
                <span style={styles.metaValue}>
                  {new Date(selectedMsg.created_at).toLocaleString('it-IT')}
                </span>
              </div>
              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Oggetto:</span>
                <span style={{ ...styles.metaValue, fontWeight: 700 }}>{selectedMsg.oggetto}</span>
              </div>
              <div style={styles.msgContainer}>
                <div style={styles.msgLabel}>Contenuto Email (HTML):</div>
                <div 
                  style={styles.msgContent}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedMsg.messaggio) }} 
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setSelectedMsg(null)} style={styles.btnCancel}>Chiudi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { marginTop: 10 },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titleSec: { display: 'flex', alignItems: 'center', gap: 8 },
  titleText: { fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  btnNew: { background: '#2563eb', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700, fontFamily: "'Sora', sans-serif" },
  empty: { textAlign: 'center', padding: 40, color: 'var(--text-muted)', background: 'var(--app-bg)', borderRadius: 8, border: '1px solid var(--border-color)' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { background: 'var(--app-bg)', borderRadius: 8, padding: '14px 18px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  destName: { fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 },
  destEmail: { color: 'var(--text-muted)', fontSize: 12 },
  badge: { borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 600 },
  cardOggetto: { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 500 },
  cardDate: { fontSize: 11, color: 'var(--text-muted)' },
  btnView: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  // Modal & Form
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modal: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16, width: '100%', maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' },
  modalHeader: { padding: '16px 20px', background: 'var(--app-bg)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' },
  btnClose: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' },
  modalBody: { padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 400 },
  errBanner: { background: '#ef444415', border: '1px solid #ef444430', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13 },
  infoBanner: { background: '#3b82f615', border: '1px solid #3b82f630', borderRadius: 8, padding: '10px 14px', color: '#60a5fa', fontSize: 12, display: 'flex', alignItems: 'center' },
  warnBanner: { background: '#f59e0b15', border: '1px solid #f59e0b30', borderRadius: 8, padding: '10px 14px', color: '#f59e0b', fontSize: 12, display: 'flex', alignItems: 'center' },
  formGrid: { display: 'flex', gap: 20, flex: 1, minHeight: 350 },
  formCol: { display: 'flex', flexDirection: 'column', gap: 14, flex: 1 },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 },
  select: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontFamily: "'Sora', sans-serif", fontSize: 13 },
  input: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontFamily: "'Sora', sans-serif", fontSize: 13 },
  textarea: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px', color: 'var(--text-primary)', fontFamily: "'Sora', sans-serif", fontSize: 13, lineHeight: 1.6, resize: 'none' },
  btnLink: { background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: 0, fontFamily: "'Sora', sans-serif" },
  destList: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, overflowY: 'auto', flex: 1, maxHeight: 250 },
  destItem: { display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border-color-2)', cursor: 'pointer', transition: 'background-color 0.15s' },
  modalFooter: { padding: '14px 20px', background: 'var(--app-bg)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 10 },
  btnCancel: { background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 20px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontSize: 13 },
  btnSubmit: { background: '#2563eb', border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontSize: 13, fontWeight: 700 },
  // Detail Meta
  metaRow: { display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: 13 },
  metaLabel: { color: 'var(--text-muted)', fontWeight: 600 },
  metaValue: { color: 'var(--text-primary)' },
  msgContainer: { borderTop: '1px solid var(--border-color)', paddingTop: 14, marginTop: 6 },
  msgLabel: { color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginBottom: 8 },
  msgContent: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '16px', color: 'var(--text-primary)', overflowX: 'auto', fontFamily: "'Sora', sans-serif", fontSize: 13, lineHeight: 1.6 }
};
