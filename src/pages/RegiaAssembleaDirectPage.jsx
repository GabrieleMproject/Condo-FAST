import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { downloadVerbaleAssembleaPdf } from '../lib/exportVerbaleAssemblea';
import {
  Play, Square, ShieldCheck, Scale, Check, X, Minus,
  Download, Plus, Edit3, Trash2, ArrowLeft, Users, Loader2, Sparkles, Building, Radio, Zap, UserCheck, KeyRound
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegiaAssembleaDirectPage() {
  const [loading, setLoading] = useState(false);
  const channelRef = useRef(null);
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  const [assemblea, setAssemblea] = useState({
    id: 'demo-assemblea-live',
    titolo: 'Assemblea Ordinaria Esercizio 2026',
    tipo: 'ordinaria',
    tipo_convocazione: 'seconda',
    data_inizio: new Date().toISOString(),
    luogo: 'Studio Amministratore / Teleassemblea Meet'
  });

  const [condominio, setCondominio] = useState({
    id: 'demo-condo-1',
    nome: 'Condominio Parco delle Rose',
    indirizzo: 'Via Dante Alighieri 14, Milano',
    codice_fiscale: '97854120154',
    iban: 'IT60X0542811101000000123456'
  });

  const [odgList, setOdgList] = useState([
    {
      id: 'odg-1',
      numero_ordine: 1,
      titolo: 'Approvazione Rendiconto Consuntivo 2025 e Riparto Spese',
      descrizione: 'Esame della gestione ordinaria e approvazione saldi.',
      stato_votazione: 'in_corso',
      tipo_quorum: 'ordinaria_maggioranza',
      quorum_millesimi_richiesto: 333.33,
      esito: 'non_votato'
    },
    {
      id: 'odg-2',
      numero_ordine: 2,
      titolo: 'Conferma o Nomina Amministratore e compenso professionale',
      descrizione: 'Rinnovo incarico di gestione per l\'esercizio corrente.',
      stato_votazione: 'chiusa',
      tipo_quorum: 'straordinaria_500',
      quorum_millesimi_richiesto: 500.00,
      esito: 'non_votato'
    },
    {
      id: 'odg-3',
      numero_ordine: 3,
      titolo: 'Sostituzione corpi illuminanti androne con tecnologia LED',
      descrizione: 'Proposta avanzata dai condòmini per efficientamento energetico.',
      stato_votazione: 'chiusa',
      tipo_quorum: 'ordinaria_maggioranza',
      quorum_millesimi_richiesto: 333.33,
      esito: 'non_votato'
    }
  ]);

  const [activeOdgId, setActiveOdgId] = useState('odg-1');
  const [editingOdg, setEditingOdg] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newOdgForm, setNewOdgForm] = useState({ titolo: '', descrizione: '', tipo_quorum: 'ordinaria_maggioranza', quorum_millesimi_richiesto: 333.33 });

  // Lista presenze e unità mock con supporto Deleghe
  const [unitaList, setUnitaList] = useState([
    { id: 'u-1', nome: 'Appartamento Int. 1', millesimi_proprieta: 95.00, persona: { id: 'p-1', nome: 'Mario', cognome: 'Bianchi' }, delegaA: null },
    { id: 'u-2', nome: 'Appartamento Int. 2', millesimi_proprieta: 80.50, persona: { id: 'p-2', nome: 'Laura', cognome: 'Verdi' }, delegaA: null },
    { id: 'u-3', nome: 'Appartamento Int. 3', millesimi_proprieta: 120.00, persona: { id: 'p-3', nome: 'Giuseppe', cognome: 'Ferrari' }, delegaA: null },
    { id: 'u-4', nome: 'Appartamento Int. 4 (Condòmino App)', millesimi_proprieta: 54.50, persona: { id: 'p-4', nome: 'Marco', cognome: 'Rossi' }, delegaA: null, delegheRicevute: [] },
    { id: 'u-5', nome: 'Appartamento Int. 5', millesimi_proprieta: 150.00, persona: { id: 'p-5', nome: 'Anna', cognome: 'Neri' }, delegaA: null },
    { id: 'u-6', nome: 'Appartamento Int. 6', millesimi_proprieta: 110.00, persona: { id: 'p-6', nome: 'Roberto', cognome: 'Galli' }, delegaA: null },
  ]);

  const [presenze, setPresenze] = useState([
    { id: 'pres-1', unita_id: 'u-1', persona_id: 'p-1', presente: true, perDelega: false },
    { id: 'pres-2', unita_id: 'u-2', persona_id: 'p-2', presente: true, perDelega: false },
    { id: 'pres-3', unita_id: 'u-3', persona_id: 'p-3', presente: true, perDelega: false },
    { id: 'pres-4', unita_id: 'u-4', persona_id: 'p-4', presente: true, perDelega: false },
    { id: 'pres-5', unita_id: 'u-5', persona_id: 'p-5', presente: true, perDelega: false },
    { id: 'pres-6', unita_id: 'u-6', persona_id: 'p-6', presente: false, perDelega: false },
  ]);

  const [delegheAttive, setDelegheAttive] = useState([]);

  const [voti, setVoti] = useState({
    'odg-1': {
      'u-1': 'favorevole',
      'u-2': 'favorevole',
      'u-3': 'contrario',
      'u-4': 'favorevole'
    }
  });

  const [presidente] = useState('Dott.ssa Anna Neri');
  const [segretario] = useState('Geom. Mario Bianchi');

  // Push Sync Helper Ultra-Rapido (Local SSE Relay + Supabase Realtime)
  const pushSync = useCallback((list, actId, currentVoti) => {
    const payload = {
      odgList: list || odgList,
      activeOdgId: actId || activeOdgId,
      voti: currentVoti || voti,
      timestamp: Date.now()
    };

    try {
      const hostname = window.location.hostname || 'localhost';
      fetch(`http://${hostname}:5174/api/live-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (e) {}

    if (channelRef.current) {
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'odg_state_change',
          payload
        });
      } catch (e) {}
    }
  }, [odgList, activeOdgId, voti]);

  // Listener SSE e Realtime
  useEffect(() => {
    const hostname = window.location.hostname || 'localhost';
    let es;
    try {
      es = new EventSource(`http://${hostname}:5174/api/live-sync/sse`);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.voti) {
            setVoti(prev => ({ ...prev, ...data.voti }));
          }
        } catch (e) {}
      };
    } catch (e) {}

    const channel = supabase.channel('condofast_live_assembly_channel', {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'condomino_vote' }, (msg) => {
        const { odgId, unitaId, voto } = msg.payload || {};
        if (odgId && voto) {
          const targetUnit = unitaId || 'u-4';
          setVoti(prev => ({
            ...prev,
            [odgId]: {
              ...(prev[odgId] || {}),
              [targetUnit]: voto
            }
          }));
          toast.success(`Nuovo voto dal telefono ricevuto: ${voto.toUpperCase()}`);
        }
      })
      .on('broadcast', { event: 'delega_riscattata' }, (msg) => {
        const { delega } = msg.payload || {};
        if (delega) {
          setDelegheAttive(prev => [...prev, delega]);
          toast.success(`Delega riscattata via app: ${delega.codice} (${delega.delegante_nome} +${delega.millesimi}‰)`, {
            icon: '📜',
            duration: 4000
          });
        }
      })
      .on('broadcast', { event: 'request_initial_state' }, () => {
        pushSync(odgList, activeOdgId, voti);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
          pushSync(odgList, activeOdgId, voti);
        }
      });

    channelRef.current = channel;

    return () => {
      if (es) es.close();
      supabase.removeChannel(channel);
    };
  }, []);

  const currentOdg = odgList.find(o => o.id === activeOdgId) || odgList[0];
  const inCorso = currentOdg?.stato_votazione === 'in_corso';

  // Calcolo presenze e teste
  const presenzeAttive = presenze.filter(p => p.presente);
  const testePresenti = presenzeAttive.length;
  const millesimiPresenti = presenzeAttive.reduce((acc, p) => {
    const u = unitaList.find(un => un.id === p.unita_id);
    return acc + (u?.millesimi_proprieta || 0);
  }, 0);

  // Calcolo voti punto attivo (inclusi millesimi delegati su u-4)
  const votiPunto = voti[currentOdg?.id] || {};
  let favMil = 0, conMil = 0, astMil = 0;
  let favTes = 0, conTes = 0, astTes = 0;

  const millesimiExtraDelegati = delegheAttive.reduce((acc, d) => acc + (d.millesimi || 0), 0);

  Object.entries(votiPunto).forEach(([uId, vStr]) => {
    const u = unitaList.find(un => un.id === uId);
    let m = u?.millesimi_proprieta || 0;
    // Se è u-4 e ha deleghe collegate, aggiungi i millesimi delegati
    if (uId === 'u-4') {
      m += millesimiExtraDelegati;
    }

    if (vStr === 'favorevole') { favMil += m; favTes += 1; }
    else if (vStr === 'contrario') { conMil += m; conTes += 1; }
    else if (vStr === 'astenuto') { astMil += m; astTes += 1; }
  });

  const millesimiRichiesti = currentOdg?.tipo_quorum === 'straordinaria_500' ? 500.0 :
                             currentOdg?.tipo_quorum === 'innovazioni_667' ? 667.0 :
                             currentOdg?.tipo_quorum === 'unanimita_1000' ? 1000.0 :
                             currentOdg?.tipo_quorum === 'personalizzato' ? (parseFloat(currentOdg.quorum_millesimi_richiesto) || 333.33) :
                             333.33;

  const maggioranzaTesteRichiesta = Math.ceil(testePresenti / 2);
  const isApprovato = favMil >= (millesimiRichiesti - 0.01) && favTes >= maggioranzaTesteRichiesta && favTes > conTes;

  const toggleStatoVotazione = () => {
    const newStato = inCorso ? 'chiusa' : 'in_corso';
    const esitoFinale = isApprovato ? 'approvato' : 'respinto';
    const updatedList = odgList.map(o => o.id === currentOdg.id ? {
      ...o,
      stato_votazione: newStato,
      esito: newStato === 'chiusa' ? esitoFinale : o.esito,
      totale_favorevoli_millesimi: favMil,
      totale_contrari_millesimi: conMil,
      totale_astenuti_millesimi: astMil,
      totale_favorevoli_teste: favTes,
      totale_contrari_teste: conTes,
      totale_astenuti_teste: astTes
    } : o);

    setOdgList(updatedList);
    pushSync(updatedList, activeOdgId, voti);

    if (newStato === 'chiusa') {
      toast.success(`Votazione conclusa: Delibera ${esitoFinale.toUpperCase()}`);
    } else {
      toast.success(`Votazione aperta in tempo reale per: "${currentOdg.titolo}"`);
    }
  };

  const handleVotaSala = (uId, vStr) => {
    const nextVoti = {
      ...voti,
      [currentOdg.id]: {
        ...(voti[currentOdg.id] || {}),
        [uId]: vStr
      }
    };
    setVoti(nextVoti);
    pushSync(odgList, activeOdgId, nextVoti);
  };

  const handleSaveEditOdg = (e) => {
    e.preventDefault();
    const updatedList = odgList.map(o => o.id === editingOdg.id ? editingOdg : o);
    setOdgList(updatedList);
    setEditingOdg(null);
    pushSync(updatedList, activeOdgId, voti);
    toast.success('Argomento OdG aggiornato e sincronizzato sullo smartphone!');
  };

  const handleAddOdg = (e) => {
    e.preventDefault();
    const newOdg = {
      id: 'odg-' + Date.now(),
      numero_ordine: odgList.length + 1,
      titolo: newOdgForm.titolo,
      descrizione: newOdgForm.descrizione,
      tipo_quorum: newOdgForm.tipo_quorum,
      quorum_millesimi_richiesto: newOdgForm.quorum_millesimi_richiesto,
      stato_votazione: 'chiusa',
      esito: 'non_votato'
    };
    const updatedList = [...odgList, newOdg];
    setOdgList(updatedList);
    setActiveOdgId(newOdg.id);
    setShowAddModal(false);
    setNewOdgForm({ titolo: '', descrizione: '', tipo_quorum: 'ordinaria_maggioranza', quorum_millesimi_richiesto: 333.33 });
    pushSync(updatedList, newOdg.id, voti);
    toast.success('Nuovo punto OdG inserito e sincronizzato!');
  };

  const handleScaricaVerbale = () => {
    const formattedOdg = odgList.map(o => ({
      ...o,
      totale_favorevoli_millesimi: favMil,
      totale_contrari_millesimi: conMil,
      totale_astenuti_millesimi: astMil,
      totale_favorevoli_teste: favTes,
      totale_contrari_teste: conTes,
      totale_astenuti_teste: astTes
    }));

    downloadVerbaleAssembleaPdf({
      condominio,
      assemblea,
      odgList: formattedOdg,
      presenze,
      persone: unitaList.map(u => u.persona),
      unita: unitaList,
      presidente,
      segretario,
      oraFine: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    });
    toast.success('Verbale PDF scaricato con successo!');
  };

  return (
    <div style={S.pageWrapper}>
      {/* Top Header Bar */}
      <div style={S.topHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={S.liveDot}></div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={S.badgeLive}>REGIA ASSEMBLEA LIVE</span>
              <span style={S.badgeCondo}>{condominio.nome}</span>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 12,
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                <Zap size={12} color="#34d399" />
                Ultra-Live + Deleghe Digitali (Art. 67 c.c.)
              </span>
            </div>
            <h1 style={{ margin: '2px 0 0', fontSize: 17, color: '#fff', fontWeight: 700 }}>
              {assemblea.titolo}
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Quorum Costitutivo Box */}
          <div style={S.quorumBox}>
            <Scale size={16} color="#10b981" />
            <div>
              <div style={{ fontSize: 10, color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>
                Quorum Costitutivo (Art. 1136 c.c.)
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
                {testePresenti} Teste ({millesimiPresenti.toFixed(2)} ‰) • <span style={{ color: '#10b981' }}>VALIDO</span>
              </div>
            </div>
          </div>

          <button onClick={handleScaricaVerbale} style={S.btnVerbale}>
            <Download size={15} /> Scarica Verbale PDF
          </button>
        </div>
      </div>

      {/* Main Regia Panel */}
      <div style={S.mainLayout}>
        {/* Sidebar OdG */}
        <div style={S.sidebar}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Punti all'OdG ({odgList.length})
            </span>
            <button onClick={() => setShowAddModal(true)} style={S.btnAddSmall}>
              <Plus size={13} /> Aggiungi
            </button>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {odgList.map((item) => {
              const isActive = activeOdgId === item.id;
              const isVotoAperto = item.stato_votazione === 'in_corso';
              const isApprov = item.esito === 'approvato';
              const isResp = item.esito === 'respinto';

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setActiveOdgId(item.id);
                    pushSync(odgList, item.id, voti);
                  }}
                  style={{
                    ...S.odgCard,
                    borderColor: isActive ? '#3b82f6' : 'var(--border-color)',
                    background: isActive ? 'rgba(59, 130, 246, 0.08)' : 'var(--card-bg)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: 12, color: isActive ? '#3b82f6' : 'var(--text-muted)' }}>
                      #{item.numero_ordine}
                    </span>
                    {isVotoAperto && <span style={S.badgeLivePulse}>VOTO LIVE</span>}
                    {!isVotoAperto && isApprov && <span style={S.badgeApprovato}>APPROVATO</span>}
                    {!isVotoAperto && isResp && <span style={S.badgeRespinto}>RESPINTO</span>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {item.titolo}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Box Deleghe Collegate */}
          {delegheAttive.length > 0 && (
            <div style={{ marginTop: 20, padding: 12, background: 'rgba(59, 130, 246, 0.1)', borderRadius: 10, border: '1px solid #3b82f6' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <KeyRound size={13} /> Deleghe Riconosciute ({delegheAttive.length})
              </div>
              {delegheAttive.map((d, i) => (
                <div key={i} style={{ fontSize: 11, color: '#e2e8f0', marginBottom: 4 }}>
                  • <strong>{d.delegante_nome}</strong> (+{d.millesimi}‰) tramite codice <span style={{ fontFamily: 'monospace', color: '#93c5fd' }}>{d.codice}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Center Live Stage */}
        <div style={S.contentStage}>
          {/* Header OdG Attivo con Modifica Rapida */}
          <div style={S.odgHeaderCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Punto #{currentOdg.numero_ordine} in trattazione
                </span>
                <h2 style={{ margin: '4px 0 6px', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {currentOdg.titolo}
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {currentOdg.descrizione}
                </p>
              </div>

              <button
                onClick={() => setEditingOdg({ ...currentOdg })}
                style={S.btnEditOdg}
                title="Modifica argomento o quorum"
              >
                <Edit3 size={15} /> Modifica Titolo / Argomento
              </button>
            </div>

            {/* Banner Controllo Votazione */}
            <div style={{
              ...S.liveStatusBar,
              background: inCorso ? 'rgba(16, 185, 129, 0.1)' : 'var(--app-bg)',
              borderColor: inCorso ? '#10b981' : 'var(--border-color)'
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: inCorso ? '#059669' : 'var(--text-muted)' }}>
                  Stato Votazione
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: inCorso ? '#10b981' : 'var(--text-primary)' }}>
                  {inCorso ? '🟢 VOTAZIONE APERTA SULL\'APP CONDÒMINI' : '⚪ VOTAZIONE CHIUSA'}
                </div>
              </div>

              <button
                onClick={toggleStatoVotazione}
                style={{
                  ...S.btnControlVoto,
                  background: inCorso ? '#ef4444' : '#10b981',
                  boxShadow: inCorso ? '0 4px 14px rgba(239, 68, 68, 0.4)' : '0 4px 14px rgba(16, 185, 129, 0.4)'
                }}
              >
                {inCorso ? <><Square size={16} /> Chiudi Votazione e Convalida</> : <><Play size={16} /> Apri Votazione Live</>}
              </button>
            </div>
          </div>

          {/* Valutazione Quorum Deliberativo Live */}
          <div style={{
            ...S.quorumResultBar,
            background: isApprovato ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
            border: `1px solid ${isApprovato ? '#10b981' : '#f59e0b'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldCheck size={22} color={isApprovato ? '#10b981' : '#f59e0b'} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: isApprovato ? '#047857' : '#b45309', textTransform: 'uppercase' }}>
                  Quorum Deliberativo ({currentOdg.tipo_quorum?.replace('_', ' ')})
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Richiesti: <strong>{millesimiRichiesti.toFixed(2)} ‰</strong> e maggioranza teste ({maggioranzaTesteRichiesta} favorevoli).
                  Attualmente: {favTes} teste ({favMil.toFixed(2)} ‰).
                </div>
              </div>
            </div>

            <span style={{
              fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 12,
              background: isApprovato ? '#10b981' : '#f59e0b', color: '#fff'
            }}>
              {isApprovato ? 'DELIBERA APPROVABILE' : 'INSUFFICIENTE'}
            </span>
          </div>

          {/* 3 Result Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ ...S.kpiCard, borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{favTes} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>teste</span></div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{favMil.toFixed(2)} ‰</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Favorevoli</div>
            </div>

            <div style={{ ...S.kpiCard, borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444' }}>{conTes} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>teste</span></div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{conMil.toFixed(2)} ‰</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contrari</div>
            </div>

            <div style={{ ...S.kpiCard, borderLeft: '4px solid #94a3b8' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#64748b' }}>{astTes} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>teste</span></div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{astMil.toFixed(2)} ‰</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Astenuti</div>
            </div>
          </div>

          {/* Tabella Voti Nominativi Sala & App */}
          <div style={S.tableContainer}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--app-bg)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 14px' }}>Condòmino / Intestatario</th>
                  <th style={{ padding: '10px 14px' }}>Unità</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Millesimi ‰</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Voto Espresso</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Registrazione Sala</th>
                </tr>
              </thead>
              <tbody>
                {unitaList.map(u => {
                  const pres = presenze.find(p => p.unita_id === u.id)?.presente;
                  const vStr = votiPunto[u.id];
                  const hasDeleghe = u.id === 'u-4' && delegheAttive.length > 0;
                  const totM = u.millesimi_proprieta + (hasDeleghe ? millesimiExtraDelegati : 0);

                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: pres ? 1 : 0.45 }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {u.persona?.cognome} {u.persona?.nome}
                        {hasDeleghe && (
                          <span style={{ fontSize: 10, color: '#3b82f6', background: 'rgba(59,130,246,0.15)', padding: '2px 6px', borderRadius: 6, marginLeft: 6, fontWeight: 600 }}>
                            +{delegheAttive.length} Delega
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                        {u.nome}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>
                        {totM.toFixed(2)} ‰
                        {hasDeleghe && (
                          <span style={{ fontSize: 10, color: '#60a5fa', display: 'block' }}>
                            ({u.millesimi_proprieta.toFixed(2)} + {millesimiExtraDelegati.toFixed(2)} ‰)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {vStr ? (
                          <span style={{
                            fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase',
                            background: vStr === 'favorevole' ? '#d1fae5' : vStr === 'contrario' ? '#fee2e2' : '#f1f5f9',
                            color: vStr === 'favorevole' ? '#047857' : vStr === 'contrario' ? '#b91c1c' : '#64748b'
                          }}>
                            {vStr}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>In attesa</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button onClick={() => handleVotaSala(u.id, 'favorevole')} style={S.btnVotoSmall(vStr === 'favorevole', '#10b981')}>Sì</button>
                          <button onClick={() => handleVotaSala(u.id, 'contrario')} style={S.btnVotoSmall(vStr === 'contrario', '#ef4444')}>No</button>
                          <button onClick={() => handleVotaSala(u.id, 'astenuto')} style={S.btnVotoSmall(vStr === 'astenuto', '#94a3b8')}>Ast</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Modifica Argomento OdG */}
      {editingOdg && (
        <div style={S.overlay}>
          <div style={S.modalCard}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700 }}>Modifica Argomento OdG</h3>
            <form onSubmit={handleSaveEditOdg} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={S.label}>Titolo del punto OdG</label>
                <input
                  type="text"
                  required
                  value={editingOdg.titolo}
                  onChange={e => setEditingOdg({ ...editingOdg, titolo: e.target.value })}
                  style={S.input}
                />
              </div>

              <div>
                <label style={S.label}>Descrizione / Note per i condòmini</label>
                <textarea
                  rows={3}
                  value={editingOdg.descrizione || ''}
                  onChange={e => setEditingOdg({ ...editingOdg, descrizione: e.target.value })}
                  style={{ ...S.input, resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={S.label}>Tipologia Quorum Deliberativo</label>
                <select
                  value={editingOdg.tipo_quorum}
                  onChange={e => setEditingOdg({ ...editingOdg, tipo_quorum: e.target.value })}
                  style={S.input}
                >
                  <option value="ordinaria_maggioranza">Ordinaria (333,33 ‰ + Maggioranza Intervenuti)</option>
                  <option value="straordinaria_500">Straordinaria / Nomina Amm. (500,00 ‰)</option>
                  <option value="innovazioni_667">Innovazioni (667,00 ‰ + 2/3 Intervenuti)</option>
                  <option value="unanimita_1000">Unanimità (1000 ‰)</option>
                  <option value="personalizzato">Personalizzato</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setEditingOdg(null)} style={S.btnSecondary}>Annulla</button>
                <button type="submit" style={S.btnPrimary}>Salva Modifiche e Sincronizza</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Aggiungi Nuovo OdG */}
      {showAddModal && (
        <div style={S.overlay}>
          <div style={S.modalCard}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700 }}>Aggiungi Nuovo Punto all'OdG</h3>
            <form onSubmit={handleAddOdg} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={S.label}>Titolo del punto OdG *</label>
                <input
                  type="text"
                  required
                  placeholder="Es. Approvazione preventivo tinteggiatura scale"
                  value={newOdgForm.titolo}
                  onChange={e => setNewOdgForm({ ...newOdgForm, titolo: e.target.value })}
                  style={S.input}
                />
              </div>

              <div>
                <label style={S.label}>Descrizione / Note per i condòmini</label>
                <textarea
                  rows={3}
                  placeholder="Dettagli sul punto all'ordine del giorno..."
                  value={newOdgForm.descrizione}
                  onChange={e => setNewOdgForm({ ...newOdgForm, descrizione: e.target.value })}
                  style={{ ...S.input, resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={S.label}>Tipologia Quorum</label>
                <select
                  value={newOdgForm.tipo_quorum}
                  onChange={e => setNewOdgForm({ ...newOdgForm, tipo_quorum: e.target.value })}
                  style={S.input}
                >
                  <option value="ordinaria_maggioranza">Ordinaria (333,33 ‰)</option>
                  <option value="straordinaria_500">Straordinaria (500,00 ‰)</option>
                  <option value="innovazioni_667">Innovazioni (667,00 ‰)</option>
                  <option value="unanimita_1000">Unanimità (1000 ‰)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={S.btnSecondary}>Annulla</button>
                <button type="submit" style={S.btnPrimary}>Crea e Sincronizza</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  pageWrapper: {
    minHeight: '100vh',
    background: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Sora, sans-serif'
  },
  topHeader: {
    background: '#1e293b',
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #334155'
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    background: '#10b981',
    boxShadow: '0 0 10px #10b981'
  },
  badgeLive: {
    fontSize: 10,
    fontWeight: 800,
    color: '#10b981',
    letterSpacing: '0.05em'
  },
  badgeCondo: {
    fontSize: 10,
    fontWeight: 600,
    background: 'rgba(255,255,255,0.1)',
    color: '#e2e8f0',
    padding: '2px 8px',
    borderRadius: 8
  },
  quorumBox: {
    background: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid #10b981',
    padding: '6px 14px',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 10
  },
  btnVerbale: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: '#3b82f6',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer'
  },
  mainLayout: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden'
  },
  sidebar: {
    width: 320,
    background: '#1e293b',
    borderRight: '1px solid #334155',
    padding: 16,
    overflowY: 'auto'
  },
  btnAddSmall: {
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    borderRadius: 6,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4
  },
  odgCard: {
    background: '#0f172a',
    borderRadius: 10,
    padding: 12,
    border: '1px solid #334155',
    cursor: 'pointer',
    transition: 'all 0.15s'
  },
  badgeLivePulse: {
    fontSize: 9,
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: 6,
    background: '#10b981',
    color: '#fff'
  },
  badgeApprovato: {
    fontSize: 9,
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: 6,
    background: '#065f46',
    color: '#34d399'
  },
  badgeRespinto: {
    fontSize: 9,
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: 6,
    background: '#7f1d1d',
    color: '#f87171'
  },
  contentStage: {
    flex: 1,
    background: '#0f172a',
    padding: 24,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column'
  },
  odgHeaderCard: {
    background: '#1e293b',
    borderRadius: 14,
    padding: 20,
    border: '1px solid #334155',
    marginBottom: 16
  },
  btnEditOdg: {
    background: 'rgba(255,255,255,0.06)',
    color: '#e2e8f0',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },
  liveStatusBar: {
    marginTop: 16,
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  btnControlVoto: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    borderRadius: 8,
    border: 'none',
    color: '#fff',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer'
  },
  quorumResultBar: {
    padding: '12px 18px',
    borderRadius: 12,
    marginBottom: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  kpiCard: {
    background: '#1e293b',
    borderRadius: 10,
    padding: 14,
    border: '1px solid #334155'
  },
  tableContainer: {
    flex: 1,
    background: '#1e293b',
    borderRadius: 12,
    border: '1px solid #334155',
    overflow: 'hidden'
  },
  btnVotoSmall: (active, color) => ({
    background: active ? color : 'transparent',
    color: active ? '#fff' : '#94a3b8',
    border: `1px solid ${active ? color : '#475569'}`,
    borderRadius: 6,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer'
  }),
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16
  },
  modalCard: {
    background: '#1e293b',
    color: '#fff',
    padding: 24,
    borderRadius: 16,
    width: 500,
    maxWidth: '92%',
    border: '1px solid #334155'
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#94a3b8',
    marginBottom: 6
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid #475569',
    background: '#0f172a',
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Sora, sans-serif',
    boxSizing: 'border-box'
  },
  btnPrimary: {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: '#3b82f6',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnSecondary: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid #475569',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer'
  }
};
