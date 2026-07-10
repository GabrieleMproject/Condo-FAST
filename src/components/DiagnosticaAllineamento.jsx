// src/components/DiagnosticaAllineamento.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Search, Trash2, Check, AlertCircle, RefreshCw, UserPlus, Link2, Info, ArrowRight, UserCheck, X
} from 'lucide-react';

export default function DiagnosticaAllineamento({ condominioId, unita, tabelle, onReload, showToast }) {
  const [personeList, setPersoneList] = useState([]);
  const [loadingPersone, setLoadingPersone] = useState(false);
  const [loadingMerge, setLoadingMerge] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  // Merge states
  const [sourceUnitaId, setSourceUnitaId] = useState('');
  const [targetUnitaId, setTargetUnitaId] = useState('');

  // Dropdown states for quick assignment
  const [selectedOrphanPersonaId, setSelectedOrphanPersonaId] = useState('');
  const [orphanTargetUnitaId, setOrphanTargetUnitaId] = useState('');

  const [selectedEmptyUnitaId, setSelectedEmptyUnitaId] = useState('');
  const [emptyTargetPersonaId, setEmptyTargetPersonaId] = useState('');

  // Search text for people dropdown
  const [searchPersonText, setSearchPersonText] = useState('');

  // New Person quick modal/form states
  const [showNewPersonForm, setShowNewPersonForm] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newCognome, setNewCognome] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTelefono, setNewTelefono] = useState('');
  const [newCf, setNewCf] = useState('');

  useEffect(() => {
    caricaPersone();
  }, [condominioId]);

  async function caricaPersone() {
    setLoadingPersone(true);
    try {
      const { data, error } = await supabase
        .from('persone')
        .select(`
          id, nome, cognome, email, telefono, codice_fiscale,
          occupanti_unita(id, ruolo, attivo, unita_id, unita(condominio_id))
        `)
        .order('cognome')
        .order('nome');

      if (error) throw error;
      setPersoneList(data || []);
    } catch (e) {
      console.error('[Diagnostica] Errore caricamento persone:', e);
      if (showToast) showToast('Errore caricamento anagrafica: ' + e.message, 'error');
    } finally {
      setLoadingPersone(false);
    }
  }

  // 1. Detect anomalous units with millesimi but no owner
  const unitaSenzaProprietario = useMemo(() => {
    return unita.filter(u => {
      const hasActiveProp = u.occupanti_unita?.some(o => o.ruolo === 'proprietario' && o.attivo);
      return !hasActiveProp;
    });
  }, [unita]);

  // 2. Detect people with no units in this condominium
  const condominiOrfani = useMemo(() => {
    return personeList.filter(p => {
      const isAssociatedToThisCondo = p.occupanti_unita?.some(
        o => o.unita?.condominio_id === condominioId && o.attivo
      );
      return !isAssociatedToThisCondo;
    });
  }, [personeList, condominioId]);

  // List of potential target units for merge (excludes the source unit)
  const targetUnitaOptions = useMemo(() => {
    if (!sourceUnitaId) return unita;
    return unita.filter(u => u.id !== sourceUnitaId);
  }, [unita, sourceUnitaId]);

  // Handle merging source unit into target unit
  async function handleMerge() {
    if (!sourceUnitaId || !targetUnitaId) {
      alert('Seleziona sia l\'unità sorgente che l\'unità di destinazione.');
      return;
    }
    const sourceU = unita.find(u => u.id === sourceUnitaId);
    const targetU = unita.find(u => u.id === targetUnitaId);

    const confirmText = `ATTENZIONE: FONDERE LE UNITÀ È UN'OPERAZIONE IRREVERSIBILE.

Sei sicuro di voler unire l'unità "${sourceU?.numero || 'Senza Numero'}" (sorgente) nell'unità "${targetU?.numero || 'Senza Numero'}" (destinazione)?

Cosa succederà:
1. Le quote millesimali di "${sourceU?.numero}" verranno trasferite a "${targetU?.numero}" (se quest'ultima non le ha già).
2. I residenti/proprietari/inquilini di "${sourceU?.numero}" verranno spostati su "${targetU?.numero}".
3. Eventuali rate, saldi iniziali e spese ripartite verranno convogliati.
4. L'unità duplicata "${sourceU?.numero}" verrà ELIMINATA definitivamente dal database.`;

    if (!window.confirm(confirmText)) return;

    setLoadingMerge(true);
    try {
      // Step A: Merge millesimi_unita
      // Fetch all millesimi for source unit
      const { data: sourceMil } = await supabase
        .from('millesimi_unita')
        .select('*')
        .eq('unita_id', sourceUnitaId);

      // Fetch all millesimi for target unit
      const { data: targetMil } = await supabase
        .from('millesimi_unita')
        .select('*')
        .eq('unita_id', targetUnitaId);

      if (sourceMil && sourceMil.length > 0) {
        for (const sM of sourceMil) {
          const alreadyExistsOnTarget = targetMil?.find(tM => tM.tabella_id === sM.tabella_id);
          if (alreadyExistsOnTarget) {
            // Se il target ha valore 0 e la sorgente ha un valore positivo, aggiorniamo il target
            const targetVal = parseFloat(alreadyExistsOnTarget.valore || 0);
            const sourceVal = parseFloat(sM.valore || 0);
            if (targetVal === 0 && sourceVal > 0) {
              await supabase
                .from('millesimi_unita')
                .update({ valore: sourceVal })
                .eq('unita_id', targetUnitaId)
                .eq('tabella_id', sM.tabella_id);
            }
            // Eliminiamo il record sorgente duplicato per evitare conflitti
            await supabase
              .from('millesimi_unita')
              .delete()
              .eq('unita_id', sourceUnitaId)
              .eq('tabella_id', sM.tabella_id);
          } else {
            // Se il target non ha il record per questa tabella, associamo quello sorgente
            await supabase
              .from('millesimi_unita')
              .update({ unita_id: targetUnitaId })
              .eq('unita_id', sourceUnitaId)
              .eq('tabella_id', sM.tabella_id);
          }
        }
      }

      // Step B: Merge occupanti_unita
      // Fetch target occupants to avoid duplicate active roles
      const { data: targetOcc } = await supabase
        .from('occupanti_unita')
        .select('*')
        .eq('unita_id', targetUnitaId);

      const { data: sourceOcc } = await supabase
        .from('occupanti_unita')
        .select('*')
        .eq('unita_id', sourceUnitaId);

      if (sourceOcc && sourceOcc.length > 0) {
        for (const sO of sourceOcc) {
          // If target already has an active occupant for the same role, deactivate the incoming source occupant
          const hasActiveConflict = sO.attivo && targetOcc?.some(tO => tO.ruolo === sO.ruolo && tO.attivo);
          const updates = { unita_id: targetUnitaId };
          if (hasActiveConflict) {
            updates.attivo = false;
            // set data_fine to yesterday if it's null
            if (!sO.data_fine) {
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              updates.data_fine = yesterday.toISOString().split('T')[0];
            }
          }
          await supabase
            .from('occupanti_unita')
            .update(updates)
            .eq('id', sO.id);
        }
      }

      // Step C: Merge saldi_iniziali_unita
      const { data: sourceSaldi } = await supabase
        .from('saldi_iniziali_unita')
        .select('*')
        .eq('unita_id', sourceUnitaId);

      const { data: targetSaldi } = await supabase
        .from('saldi_iniziali_unita')
        .select('*')
        .eq('unita_id', targetUnitaId);

      if (sourceSaldi && sourceSaldi.length > 0) {
        for (const sS of sourceSaldi) {
          const alreadyExistsOnTarget = targetSaldi?.find(tS => tS.esercizio_id === sS.esercizio_id);
          if (alreadyExistsOnTarget) {
            // Sommiamo il saldo al target
            const newSaldo = parseFloat(alreadyExistsOnTarget.saldo || 0) + parseFloat(sS.saldo || 0);
            await supabase
              .from('saldi_iniziali_unita')
              .update({ saldo: newSaldo })
              .eq('unita_id', targetUnitaId)
              .eq('esercizio_id', sS.esercizio_id);
            // Eliminiamo la sorgente
            await supabase.from('saldi_iniziali_unita').delete().eq('id', sS.id);
          } else {
            await supabase.from('saldi_iniziali_unita').update({ unita_id: targetUnitaId }).eq('id', sS.id);
          }
        }
      }

      // Step D: Merge rate_unita
      const { data: sourceRate } = await supabase
        .from('rate_unita')
        .select('*')
        .eq('unita_id', sourceUnitaId);

      const { data: targetRate } = await supabase
        .from('rate_unita')
        .select('*')
        .eq('unita_id', targetUnitaId);

      if (sourceRate && sourceRate.length > 0) {
        for (const sR of sourceRate) {
          const alreadyExistsOnTarget = targetRate?.find(tR => tR.rata_id === sR.rata_id);
          if (alreadyExistsOnTarget) {
            // Riorizzontiamo le riconciliazioni incassi collegate alla cella sorgente verso quella target
            await supabase
              .from('riconciliazioni_incassi')
              .update({ rata_unita_id: alreadyExistsOnTarget.id })
              .eq('rata_unita_id', sR.id);

            // Sommiamo gli importi e ricalcoliamo lo stato della rata target
            const newImporto = parseFloat(alreadyExistsOnTarget.importo || 0) + parseFloat(sR.importo || 0);
            const newPagato  = parseFloat(alreadyExistsOnTarget.importo_pagato || 0) + parseFloat(sR.importo_pagato || 0);
            let newStato = 'non_pagata';
            if (newPagato >= newImporto) {
              newStato = 'pagata';
            } else if (newPagato > 0) {
              newStato = 'parziale';
            }

            await supabase
              .from('rate_unita')
              .update({
                importo: newImporto,
                importo_pagato: newPagato,
                stato: newStato,
                data_pagamento: alreadyExistsOnTarget.data_pagamento || sR.data_pagamento || null
              })
              .eq('id', alreadyExistsOnTarget.id);

            // Eliminiamo la cella sorgente duplicata
            await supabase.from('rate_unita').delete().eq('id', sR.id);
          } else {
            await supabase.from('rate_unita').update({ unita_id: targetUnitaId }).eq('id', sR.id);
          }
        }
      }

      // Step E: Merge ripartizioni
      const { data: sourceRip } = await supabase
        .from('ripartizioni')
        .select('*')
        .eq('unita_id', sourceUnitaId);

      const { data: targetRip } = await supabase
        .from('ripartizioni')
        .select('*')
        .eq('unita_id', targetUnitaId);

      if (sourceRip && sourceRip.length > 0) {
        for (const sRp of sourceRip) {
          const alreadyExistsOnTarget = targetRip?.find(tRp => tRp.spesa_id === sRp.spesa_id);
          if (alreadyExistsOnTarget) {
            // Sommiamo importo e millesimi
            const newImporto = parseFloat(alreadyExistsOnTarget.importo || 0) + parseFloat(sRp.importo || 0);
            const newMillesimi = parseFloat(alreadyExistsOnTarget.millesimi_usati || 0) + parseFloat(sRp.millesimi_usati || 0);

            await supabase
              .from('ripartizioni')
              .update({
                importo: newImporto,
                millesimi_usati: newMillesimi
              })
              .eq('unita_id', targetUnitaId)
              .eq('spesa_id', sRp.spesa_id);

            // Eliminiamo il record sorgente duplicato
            await supabase.from('ripartizioni').delete().eq('id', sRp.id);
          } else {
            await supabase.from('ripartizioni').update({ unita_id: targetUnitaId }).eq('id', sRp.id);
          }
        }
      }

      // Step F: Delete source unit from database
      const { error: errDel } = await supabase
        .from('unita')
        .delete()
        .eq('id', sourceUnitaId);

      if (errDel) throw errDel;

      if (showToast) showToast('Fusione completata con successo!', 'success');
      
      // Reset dropdown choices
      setSourceUnitaId('');
      setTargetUnitaId('');

      // Reload both parent unit/millesimi list and local people list
      if (onReload) await onReload();
      await caricaPersone();
    } catch (e) {
      console.error('[Diagnostica] Errore fusione:', e);
      if (showToast) showToast('Errore durante la fusione: ' + e.message, 'error');
    } finally {
      setLoadingMerge(false);
    }
  }

  // Quick link a person to a unit
  async function handleLinkPersona(unitaId, personaId, ruolo = 'proprietario') {
    if (!unitaId || !personaId) return;
    setLoadingAction(true);
    try {
      const oggi = new Date().toISOString().split('T')[0];
      const subDate = new Date();
      subDate.setDate(subDate.getDate() - 1);
      const ieri = subDate.toISOString().split('T')[0];

      // Deactivate previous active occupant of this unit and role
      await supabase
        .from('occupanti_unita')
        .update({ attivo: false, data_fine: ieri })
        .eq('unita_id', unitaId)
        .eq('ruolo', ruolo)
        .eq('attivo', true);

      // Insert new occupant relationship
      const { error } = await supabase
        .from('occupanti_unita')
        .insert([{
          unita_id: unitaId,
          persona_id: personaId,
          ruolo,
          attivo: true,
          data_inizio: oggi
        }]);

      if (error) throw error;

      if (showToast) showToast('Persona associata con successo!', 'success');
      
      // Reset dropdown states
      setSelectedEmptyUnitaId('');
      setEmptyTargetPersonaId('');
      setSelectedOrphanPersonaId('');
      setOrphanTargetUnitaId('');

      if (onReload) await onReload();
      await caricaPersone();
    } catch (e) {
      console.error('[Diagnostica] Errore associazione:', e);
      if (showToast) showToast('Errore durante l\'associazione: ' + e.message, 'error');
    } finally {
      setLoadingAction(false);
    }
  }

  // Create a new person and link them to a unit
  async function handleCreaEAssocia(unitaId) {
    if (!newNome.trim() || !newCognome.trim()) {
      alert('Nome e Cognome sono campi obbligatori.');
      return;
    }
    setLoadingAction(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      // Create new person record
      const { data: newP, error: pErr } = await supabase
        .from('persone')
        .insert([{
          user_id: user.id,
          nome: newNome.trim(),
          cognome: newCognome.trim(),
          email: newEmail.trim() || null,
          telefono: newTelefono.trim() || null,
          codice_fiscale: newCf.trim() || null
        }])
        .select()
        .single();

      if (pErr) throw pErr;

      // Link newly created person to unit
      const oggi = new Date().toISOString().split('T')[0];
      const { error: oErr } = await supabase
        .from('occupanti_unita')
        .insert([{
          unita_id: unitaId,
          persona_id: newP.id,
          ruolo: 'proprietario',
          attivo: true,
          data_inizio: oggi
        }]);

      if (oErr) throw oErr;

      if (showToast) showToast('Nuovo condomino creato e associato!', 'success');
      
      // Reset fields
      setNewNome('');
      setNewCognome('');
      setNewEmail('');
      setNewTelefono('');
      setNewCf('');
      setShowNewPersonForm(false);
      setSelectedEmptyUnitaId('');

      if (onReload) await onReload();
      await caricaPersone();
    } catch (e) {
      console.error('[Diagnostica] Errore creazione condomino:', e);
      if (showToast) showToast('Errore creazione condomino: ' + e.message, 'error');
    } finally {
      setLoadingAction(false);
    }
  }

  // Filter people list for searchable selects
  const filteredPersoneOptions = useMemo(() => {
    if (!searchPersonText.trim()) return personeList;
    const query = searchPersonText.toLowerCase();
    return personeList.filter(p => 
      `${p.cognome || ''} ${p.nome || ''}`.toLowerCase().includes(query) ||
      (p.codice_fiscale || '').toLowerCase().includes(query) ||
      (p.email || '').toLowerCase().includes(query)
    );
  }, [personeList, searchPersonText]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', fontFamily: "'Sora', sans-serif" }}>
      
      <div style={S.titleSection}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={22} color="#38bdf8" />
          <h2 style={S.title}>Diagnostica & Allineamento</h2>
        </div>
        <p style={S.subtitle}>Risolvi le incongruenze di associazione tra le tabelle millesimali e l'anagrafica dei condòmini.</p>
      </div>

      <div style={S.containerLayout}>
        
        {/* ROW 1: MERGE DUPLICATES */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <Link2 size={16} color="#38bdf8" />
            <h3 style={S.cardTitle}>Unione Unità Immobiliare (Risoluzione Duplicati)</h3>
          </div>
          <p style={S.cardDesc}>
            Se l'import dei millesimi e dell'anagrafica ha creato unità doppie (es. "Sub 4" e "Int. 4"), seleziona la sorgente da rimuovere e la destinazione da mantenere.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginTop: 12 }}>
            <div style={S.formGroup}>
              <label style={S.label}>Unità Sorgente (Verrà eliminata)</label>
              <select
                style={S.select}
                value={sourceUnitaId}
                onChange={e => {
                  setSourceUnitaId(e.target.value);
                  setTargetUnitaId('');
                }}
              >
                <option value="">Seleziona unità...</option>
                {unita.map(u => {
                  const hasProp = u.occupanti_unita?.some(o => o.ruolo === 'proprietario' && o.attivo);
                  return (
                    <option key={u.id} value={u.id}>
                      Int. {u.numero || '—'} {u.scala ? `(Scala ${u.scala})` : ''} - {hasProp ? 'Con Proprietario' : 'Senza Proprietario'}
                    </option>
                  );
                })}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 38, color: '#94a3b8' }}>
              <ArrowRight size={18} />
            </div>

            <div style={S.formGroup}>
              <label style={S.label}>Unità Destinazione (Verrà mantenuta)</label>
              <select
                style={S.select}
                value={targetUnitaId}
                onChange={e => setTargetUnitaId(e.target.value)}
                disabled={!sourceUnitaId}
              >
                <option value="">Seleziona unità...</option>
                {targetUnitaOptions.map(u => {
                  const hasProp = u.occupanti_unita?.some(o => o.ruolo === 'proprietario' && o.attivo);
                  return (
                    <option key={u.id} value={u.id}>
                      Int. {u.numero || '—'} {u.scala ? `(Scala ${u.scala})` : ''} - {hasProp ? 'Con Proprietario' : 'Senza Proprietario'}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              style={{ 
                ...S.btnPrimary, 
                backgroundColor: '#ef4444', 
                opacity: (!sourceUnitaId || !targetUnitaId || loadingMerge) ? 0.6 : 1 
              }}
              disabled={!sourceUnitaId || !targetUnitaId || loadingMerge}
              onClick={handleMerge}
            >
              {loadingMerge ? 'Fusione in corso...' : 'Fondi ed Elimina Sorgente'}
            </button>
          </div>
        </div>

        {/* ROW 2: EMPTY UNITS (WITH MILLESIMI, NO OWNER) */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <AlertCircle size={16} color="#facc15" />
            <h3 style={S.cardTitle}>Unità senza Proprietario Attivo ({unitaSenzaProprietario.length})</h3>
          </div>
          <p style={S.cardDesc}>
            Queste unità hanno millesimi compilati ma nessun condomino impostato come proprietario attivo. Associale a un condomino registrato o creane uno.
          </p>

          <div style={S.anomalyContainer}>
            {unitaSenzaProprietario.length === 0 ? (
              <div style={S.emptyState}>
                <Check size={20} color="#4ade80" />
                <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>Tutte le unità hanno un proprietario associato.</span>
              </div>
            ) : (
              <div style={S.list}>
                {unitaSenzaProprietario.map(u => {
                  const isSelectingThis = selectedEmptyUnitaId === u.id;
                  return (
                    <div key={u.id} style={S.listItem}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 700, color: '#f1f5f9' }}>Int. {u.numero || '—'}</span>
                        {u.scala && <span style={S.badge}>Scala {u.scala}</span>}
                        {u.piano !== null && <span style={S.badge}>Piano {u.piano}</span>}
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                          Millesimi registrati in archivio
                        </div>
                      </div>

                      {isSelectingThis ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#1e293b', padding: 12, borderRadius: 8, border: '1px solid #334155', width: '100%', maxWidth: 420 }}>
                          
                          {showNewPersonForm ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <strong style={{ fontSize: 12, color: '#38bdf8' }}>Crea Nuovo Proprietario:</strong>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <input style={S.inputSmall} placeholder="Nome *" value={newNome} onChange={e => setNewNome(e.target.value)} />
                                <input style={S.inputSmall} placeholder="Cognome *" value={newCognome} onChange={e => setNewCognome(e.target.value)} />
                              </div>
                              <input style={S.inputSmall} placeholder="Codice Fiscale" value={newCf} onChange={e => setNewCf(e.target.value)} />
                              <input style={S.inputSmall} placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                              <input style={S.inputSmall} placeholder="Telefono" value={newTelefono} onChange={e => setNewTelefono(e.target.value)} />
                              
                              <div style={{ display: 'flex', gap: 6, marginTop: 4, justifyContent: 'flex-end' }}>
                                <button style={S.btnText} onClick={() => setShowNewPersonForm(false)}>Seleziona esistente</button>
                                <button style={S.btnActionSecondary} onClick={() => setSelectedEmptyUnitaId('')}>Annulla</button>
                                <button style={S.btnActionPrimary} onClick={() => handleCreaEAssocia(u.id)} disabled={loadingAction}>Crea e Associa</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <strong style={{ fontSize: 12, color: '#cbd5e1' }}>Associa Condomino Esistente:</strong>
                              <input
                                style={S.inputSmall}
                                placeholder="Filtra persone per nome/CF..."
                                value={searchPersonText}
                                onChange={e => setSearchPersonText(e.target.value)}
                              />
                              <select
                                style={S.selectSmall}
                                value={emptyTargetPersonaId}
                                onChange={e => setEmptyTargetPersonaId(e.target.value)}
                              >
                                <option value="">Seleziona...</option>
                                {filteredPersoneOptions.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.cognome} {p.nome} {p.codice_fiscale ? `(${p.codice_fiscale})` : ''}
                                  </option>
                                ))}
                              </select>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                                <button style={S.btnText} onClick={() => { setShowNewPersonForm(true); setSearchPersonText(''); }}>+ Crea Nuovo</button>
                                <button style={S.btnActionSecondary} onClick={() => setSelectedEmptyUnitaId('')}>Annulla</button>
                                <button
                                  style={S.btnActionPrimary}
                                  onClick={() => handleLinkPersona(u.id, emptyTargetPersonaId, 'proprietario')}
                                  disabled={!emptyTargetPersonaId || loadingAction}
                                >
                                  Associa
                                </button>
                              </div>
                            </div>
                          )}
                          
                        </div>
                      ) : (
                        <button
                          style={S.btnActionPrimary}
                          onClick={() => {
                            setSelectedEmptyUnitaId(u.id);
                            setShowNewPersonForm(false);
                            setSearchPersonText('');
                            setEmptyTargetPersonaId('');
                          }}
                        >
                          <UserPlus size={13} style={{ marginRight: 6 }} /> Associa Proprietario
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ROW 3: ORPHAN PEOPLE (IN REGISTRY, NOT ASSOCIATED TO ANY UNIT) */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <Info size={16} color="#60a5fa" />
            <h3 style={S.cardTitle}>Condòmini non associati ad unità ({condominiOrfani.length})</h3>
          </div>
          <p style={S.cardDesc}>
            Queste persone sono registrate nell'anagrafica generale ma non risultano collegate a nessuna unità in questo condominio.
          </p>

          <div style={S.anomalyContainer}>
            {condominiOrfani.length === 0 ? (
              <div style={S.emptyState}>
                <Check size={20} color="#4ade80" />
                <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>Tutti i condòmini in anagrafica possiedono o occupano un'unità.</span>
              </div>
            ) : (
              <div style={S.list}>
                {condominiOrfani.map(p => {
                  const isSelectingThis = selectedOrphanPersonaId === p.id;
                  return (
                    <div key={p.id} style={S.listItem}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{p.cognome} {p.nome}</span>
                        {p.email && <span style={{ ...S.badge, backgroundColor: '#0284c715', color: '#38bdf8' }}>{p.email}</span>}
                        {p.codice_fiscale && <span style={{ ...S.badge, backgroundColor: '#0f172a' }}>{p.codice_fiscale}</span>}
                      </div>

                      {isSelectingThis ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#1e293b', padding: 8, borderRadius: 8, border: '1px solid #334155' }}>
                          <select
                            style={S.selectSmall}
                            value={orphanTargetUnitaId}
                            onChange={e => setOrphanTargetUnitaId(e.target.value)}
                          >
                            <option value="">Associa a unità...</option>
                            {unita.map(u => (
                              <option key={u.id} value={u.id}>
                                Int. {u.numero || '—'} {u.scala ? `(Sc. ${u.scala})` : ''}
                              </option>
                            ))}
                          </select>
                          <button
                             style={S.btnActionPrimary}
                             onClick={() => handleLinkPersona(orphanTargetUnitaId, p.id, 'proprietario')}
                             disabled={!orphanTargetUnitaId || loadingAction}
                           >
                             <Check size={14} />
                           </button>
                           <button style={S.btnActionSecondary} onClick={() => setSelectedOrphanPersonaId('')}><X size={14} /></button>
                        </div>
                      ) : (
                        <button
                          style={S.btnActionPrimary}
                          onClick={() => {
                            setSelectedOrphanPersonaId(p.id);
                            setOrphanTargetUnitaId('');
                          }}
                        >
                          <UserCheck size={13} style={{ marginRight: 6 }} /> Collega a Unità
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

// ─── STILI LOCALI PER IL PANNELLO DIAGNOSTICA ───────────────────────────────
const S = {
  titleSection: {
    display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 12, borderBottom: '1px solid #1e293b'
  },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: '#f1f5f9' },
  subtitle: { margin: 0, fontSize: 12, color: '#94a3b8' },
  
  containerLayout: {
    display: 'flex', flexDirection: 'column', gap: 16
  },
  
  card: {
    background: '#11182760', border: '1px solid #334155', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 8
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', gap: 8
  },
  cardTitle: {
    margin: 0, fontSize: 14, fontWeight: 700, color: '#f1f5f9'
  },
  cardDesc: {
    margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.4
  },
  
  formGroup: {
    display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200
  },
  label: {
    fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase'
  },
  select: {
    background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '7px 10px', color: '#e2e8f0', fontFamily: "'Sora', sans-serif", fontSize: 12, outline: 'none'
  },
  selectSmall: {
    background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '5px 8px', color: '#e2e8f0', fontFamily: "'Sora', sans-serif", fontSize: 12, outline: 'none', width: '220px'
  },
  inputSmall: {
    background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '5px 8px', color: '#e2e8f0', fontFamily: "'Sora', sans-serif", fontSize: 12, outline: 'none', boxSizing: 'border-box', width: '100%'
  },
  
  btnPrimary: {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', height: 36
  },
  btnActionPrimary: {
    background: '#1e293b', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 6, padding: '6px 12px', fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', height: 28, transition: 'background 0.2s'
  },
  btnActionSecondary: {
    background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, padding: '6px 12px', fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', height: 28
  },
  btnText: {
    background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 11, textDecoration: 'underline', fontFamily: "'Sora', sans-serif", padding: 0
  },
  
  anomalyContainer: {
    background: '#0f172a30', border: '1px solid #1e293b', borderRadius: 8, padding: 4, marginTop: 8
  },
  list: {
    display: 'flex', flexDirection: 'column', gap: 1
  },
  listItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #1e293b20', gap: 12
  },
  badge: {
    fontSize: 9, color: '#94a3b8', background: '#1e293b', padding: '2px 5px', borderRadius: 4, marginLeft: 6, fontWeight: 600
  },
  emptyState: {
    display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: '#10b98108', borderRadius: 6
  }
};
