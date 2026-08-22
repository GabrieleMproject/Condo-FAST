import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAssembleaLive } from '../hooks/useAssembleaLive';
import { downloadVerbaleAssembleaPdf } from '../lib/exportVerbaleAssemblea';
import {
  ArrowLeft, Users, Loader2, CheckCircle2, Circle, Check, X, Minus,
  Bell, UserPlus, FileText, Download, ShieldCheck, Settings, Play, Square,
  CheckCheck, AlertTriangle, ChevronRight, UserCheck, Scale
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AssembleaLiveConsole({ assembleaId, onClose }) {
  const {
    assemblea,
    condominio,
    odg,
    presenze,
    voti,
    unitaList,
    personeList,
    loading,
    error,
    togglePresenza,
    registraVoto,
    cambiaStatoOdg,
    aggiornaQuorumOdg
  } = useAssembleaLive(assembleaId);

  const [activeOdgTab, setActiveOdgTab] = useState(null);
  const [activeView, setActiveView] = useState('odg'); // 'odg' | 'presenze'
  const [salaAttesa, setSalaAttesa] = useState([]);
  const [presidente, setPresidente] = useState('Da nominare');
  const [segretario, setSegretario] = useState('Da nominare');
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Imposta il primo OdG attivo se non ancora impostato
  useEffect(() => {
    if (odg.length > 0 && !activeOdgTab) {
      setActiveOdgTab(odg[0].id);
    }
  }, [odg, activeOdgTab]);

  // Listener Sala d'Attesa
  useEffect(() => {
    if (!assembleaId) return;
    const loadAttesa = async () => {
      const { data } = await supabase
        .from('assemblee_sala_attesa')
        .select('*, persona:persona_id(nome, cognome, codice_fiscale)')
        .eq('assemblea_id', assembleaId)
        .eq('stato', 'in_attesa');
      setSalaAttesa(data || []);
    };
    loadAttesa();

    const channel = supabase.channel(`attesa_admin_${assembleaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assemblee_sala_attesa', filter: `assemblea_id=eq.${assembleaId}` }, async (payload) => {
        if (payload.eventType === 'INSERT' && payload.new.stato === 'in_attesa') {
          const { data } = await supabase.from('persone').select('nome, cognome, codice_fiscale').eq('id', payload.new.persona_id).single();
          setSalaAttesa(p => [...p, { ...payload.new, persona: data }]);
          toast.success(`Nuovo condomino in sala d'attesa: ${data?.cognome || ''} ${data?.nome || ''}`);
        } else if (payload.eventType === 'UPDATE') {
          if (payload.new.stato !== 'in_attesa') {
            setSalaAttesa(p => p.filter(r => r.id !== payload.new.id));
          }
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [assembleaId]);

  const gestisciAttesa = async (req, nuovoStato) => {
    if (nuovoStato === 'ammesso') {
      const { data: unitaPersona } = await supabase.from('occupanti_unita').select('unita_id').eq('persona_id', req.persona_id).limit(1).single();
      const uId = unitaPersona?.unita_id || (unitaList[0]?.id || null);
      if (uId) {
        await togglePresenza(uId, req.persona_id, true);
        toast.success('Condòmino ammesso e registrato presente!');
      }
    }
    await supabase.from('assemblee_sala_attesa').update({ stato: nuovoStato }).eq('id', req.id);
  };

  // Mappa Unità per calcolo millesimi
  const unitaMap = useMemo(() => new Map(unitaList.map(u => [u.id, u])), [unitaList]);

  // Calcolo Quorum Costitutivo
  const totalMillesimiCondominio = useMemo(() => {
    const sum = unitaList.reduce((acc, u) => acc + (parseFloat(u.millesimi_proprieta || u.millesimi || 0) || 0), 0);
    return sum > 0 ? sum : 1000.0;
  }, [unitaList]);

  const presenzeAttive = useMemo(() => presenze.filter(p => p.presente), [presenze]);
  const testePresenti = presenzeAttive.length;

  const millesimiPresenti = useMemo(() => {
    return presenzeAttive.reduce((acc, p) => {
      const u = unitaMap.get(p.unita_id);
      return acc + (parseFloat(u?.millesimi_proprieta || u?.millesimi || 0) || 0);
    }, 0);
  }, [presenzeAttive, unitaMap]);

  const isSecondaConvocazione = assemblea?.tipo_convocazione !== 'prima';
  const quorumCostitutivoMinimo = isSecondaConvocazione ? 333.33 : 666.67;
  const quorumCostitutivoTesteMinime = isSecondaConvocazione ? Math.ceil((unitaList.length || 1) / 3) : Math.ceil((unitaList.length || 1) / 2);
  const quorumCostitutivoRaggiunto = millesimiPresenti >= (quorumCostitutivoMinimo - 0.01) && testePresenti >= quorumCostitutivoTesteMinime;

  const handleDownloadPdf = () => {
    downloadVerbaleAssembleaPdf({
      condominio,
      assemblea,
      odgList: odg,
      presenze,
      persone: personeList,
      unita: unitaList,
      presidente,
      segretario,
      oraFine: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    });
    toast.success('Verbale PDF scaricato con successo!');
  };

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
      <Loader2 size={32} className="spin" style={{ margin: '0 auto 12px' }} />
      <p style={{ margin: 0, fontWeight: 600 }}>Avvio Live Console in corso...</p>
    </div>
  );

  if (error) return <div style={{ color: '#ef4444', padding: 24 }}>Errore: {error}</div>;

  return (
    <div style={S.container}>
      {/* Header Live Regia */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onClose} style={S.btnBack} title="Torna alla gestione assemblee">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={S.liveDot}></span>
              <span style={S.liveBadge}>LIVE CONSOLE REGIA</span>
              <span style={S.tipoBadge}>
                {assemblea?.tipo === 'straordinaria' ? 'Straordinaria' : 'Ordinaria'} ({isSecondaConvocazione ? '2ª Convocazione' : '1ª Convocazione'})
              </span>
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: 18, color: '#ffffff', fontWeight: 700 }}>
              {assemblea?.titolo || 'Assemblea Condominiale'}
            </h3>
          </div>
        </div>

        {/* KPI Quorum Costitutivo & Bottoni Azione */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Badge Quorum Costitutivo */}
          <div style={{
            ...S.quorumKpiBox,
            background: quorumCostitutivoRaggiunto ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${quorumCostitutivoRaggiunto ? '#10b981' : '#ef4444'}`
          }}>
            <Scale size={16} color={quorumCostitutivoRaggiunto ? '#10b981' : '#ef4444'} />
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: quorumCostitutivoRaggiunto ? '#34d399' : '#f87171' }}>
                Quorum Costitutivo (Art. 1136 c.c.)
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                {testePresenti} Teste ({millesimiPresenti.toFixed(2)} ‰)
                <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.85 }}>
                  {quorumCostitutivoRaggiunto ? '• VALIDO' : `• MIN. ${quorumCostitutivoMinimo.toFixed(1)}‰`}
                </span>
              </div>
            </div>
          </div>

          {/* Notifica Sala Attesa */}
          {salaAttesa.length > 0 && (
            <div style={S.salaAttesaBadge}>
              <Bell size={16} color="#ef4444" className="pulse-animation" />
              <span><strong>{salaAttesa.length}</strong> in attesa</span>
            </div>
          )}

          {/* Bottone Genera Verbale PDF */}
          <button onClick={handleDownloadPdf} style={S.btnVerbalePdf}>
            <Download size={16} /> Scarica Verbale PDF
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={S.subNavBar}>
        <button
          onClick={() => setActiveView('odg')}
          style={{ ...S.navTab, ...(activeView === 'odg' ? S.navTabActive : {}) }}
        >
          <Play size={15} /> Trattazione OdG & Votazioni Live ({odg.length})
        </button>
        <button
          onClick={() => setActiveView('presenze')}
          style={{ ...S.navTab, ...(activeView === 'presenze' ? S.navTabActive : {}) }}
        >
          <Users size={15} /> Appello, Presenze & Deleghe ({testePresenti}/{unitaList.length})
        </button>
      </div>

      {/* Main Body */}
      {activeView === 'presenze' ? (
        <PresenzeAppelloView
          unitaList={unitaList}
          personeList={personeList}
          presenze={presenze}
          togglePresenza={togglePresenza}
          presidente={presidente}
          setPresidente={setPresidente}
          segretario={segretario}
          setSegretario={setSegretario}
        />
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar OdG & Sala Attesa */}
          <div style={S.odgSidebar}>
            {/* Sala d'attesa rapida */}
            {salaAttesa.length > 0 && (
              <div style={S.salaAttesaBox}>
                <h4 style={S.salaAttesaTitle}>
                  <UserPlus size={14} /> Sala d'Attesa App ({salaAttesa.length})
                </h4>
                <div style={{ display: 'grid', gap: 6 }}>
                  {salaAttesa.map(req => (
                    <div key={req.id} style={S.attesaItem}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                        {req.persona?.cognome} {req.persona?.nome}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
                        CF: {req.codice_fiscale_richiedente}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => gestisciAttesa(req, 'ammesso')} style={S.btnAmmetti}>Ammetti</button>
                        <button onClick={() => gestisciAttesa(req, 'rifiutato')} style={S.btnRifiuta}>Rifiuta</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', fontWeight: 700 }}>
                Ordine del Giorno
              </h4>
            </div>

            <div style={{ display: 'grid', gap: 8, overflowY: 'auto' }}>
              {odg.map((item) => {
                const isActive = activeOdgTab === item.id;
                const inCorso = item.stato_votazione === 'in_corso';
                const isApprovato = item.esito === 'approvato';
                const isRespinto = item.esito === 'respinto';

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveOdgTab(item.id)}
                    style={{
                      ...S.odgItemBtn,
                      background: isActive ? 'rgba(37, 99, 235, 0.08)' : 'var(--card-bg)',
                      borderColor: isActive ? '#3b82f6' : 'var(--border-color)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: isActive ? '#3b82f6' : 'var(--text-muted)' }}>
                        #{item.numero_ordine}
                      </span>
                      {inCorso && (
                        <span style={S.badgeLivePulse}>VOTO LIVE</span>
                      )}
                      {!inCorso && isApprovato && (
                        <span style={{ ...S.badgeEsito, background: '#d1fae5', color: '#047857' }}>APPROVATO</span>
                      )}
                      {!inCorso && isRespinto && (
                        <span style={{ ...S.badgeEsito, background: '#fee2e2', color: '#b91c1c' }}>RESPINTO</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {item.titolo}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Area Dettaglio & Votazione OdG Attivo */}
          <div style={S.odgMainContent}>
            {activeOdgTab ? (
              <RenderOdgLive
                item={odg.find(o => o.id === activeOdgTab)}
                voti={voti.filter(v => v.odg_id === activeOdgTab)}
                presenze={presenzeAttive}
                unitaMap={unitaMap}
                cambiaStatoOdg={cambiaStatoOdg}
                registraVoto={registraVoto}
                aggiornaQuorumOdg={aggiornaQuorumOdg}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                <CheckCircle2 size={48} style={{ opacity: 0.4, marginBottom: 12 }} />
                <p style={{ fontSize: 16 }}>Seleziona un punto all'Ordine del Giorno per avviare la votazione.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RenderOdgLive({ item, voti, presenze, unitaMap, cambiaStatoOdg, registraVoto, aggiornaQuorumOdg }) {
  const inCorso = item.stato_votazione === 'in_corso';

  // Calcolo voti millesimali e teste
  const conteggio = useMemo(() => {
    let favMil = 0, conMil = 0, astMil = 0;
    let favTes = 0, conTes = 0, astTes = 0;

    voti.forEach(v => {
      const u = unitaMap.get(v.unita_id);
      const m = parseFloat(u?.millesimi_proprieta || u?.millesimi || 0) || 0;

      if (v.voto === 'favorevole') {
        favMil += m;
        favTes += 1;
      } else if (v.voto === 'contrario') {
        conMil += m;
        conTes += 1;
      } else if (v.voto === 'astenuto') {
        astMil += m;
        astTes += 1;
      }
    });

    return { favMil, conMil, astMil, favTes, conTes, astTes };
  }, [voti, unitaMap]);

  // Quorum Deliberativo richiesto
  const millesimiRichiesti = item.tipo_quorum === 'straordinaria_500' ? 500.0 :
                             item.tipo_quorum === 'innovazioni_667' ? 667.0 :
                             item.tipo_quorum === 'unanimita_1000' ? 1000.0 :
                             item.tipo_quorum === 'personalizzato' ? (parseFloat(item.quorum_millesimi_richiesto) || 333.33) :
                             333.33;

  const testePresenti = presenze.length || 1;
  const maggioranzaTesteRichiesta = item.tipo_quorum === 'innovazioni_667'
    ? Math.ceil(testePresenti * 2 / 3)
    : Math.ceil(testePresenti / 2);

  const quorumMillesimiSuperato = conteggio.favMil >= (millesimiRichiesti - 0.01);
  const quorumTesteSuperato = conteggio.favTes >= maggioranzaTesteRichiesta && conteggio.favTes > conteggio.conTes;
  const isDeliberaApprovata = quorumMillesimiSuperato && quorumTesteSuperato;

  const handleChiudiVotazione = async () => {
    const esitoFinale = isDeliberaApprovata ? 'approvato' : 'respinto';
    await cambiaStatoOdg(item.id, 'chiusa', {
      esito: esitoFinale,
      totale_favorevoli_millesimi: conteggio.favMil,
      totale_contrari_millesimi: conteggio.conMil,
      totale_astenuti_millesimi: conteggio.astMil,
      totale_favorevoli_teste: conteggio.favTes,
      totale_contrari_teste: conteggio.conTes,
      totale_astenuti_teste: conteggio.astTes
    });
    toast.success(`Votazione conclusa: Delibera ${esitoFinale.toUpperCase()}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header OdG */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>
            Punto {item.numero_ordine} dell'Ordine del Giorno
          </span>
          
          {/* Selettore Quorum Legale */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Tipologia Quorum:</label>
            <select
              value={item.tipo_quorum || 'ordinaria_maggioranza'}
              onChange={e => aggiornaQuorumOdg(item.id, e.target.value, millesimiRichiesti)}
              style={S.selectQuorum}
              disabled={inCorso}
            >
              <option value="ordinaria_maggioranza">Ordinaria (333,33 ‰ + Maggioranza Intervenuti)</option>
              <option value="straordinaria_500">Straordinaria / Nomina Amm. (500,00 ‰)</option>
              <option value="innovazioni_667">Innovazioni / Modifiche (667,00 ‰ + 2/3 Intervenuti)</option>
              <option value="unanimita_1000">Unanimità (1000,00 ‰)</option>
              <option value="personalizzato">Personalizzato...</option>
            </select>
          </div>
        </div>

        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
          {item.titolo}
        </h2>
        {item.descrizione && (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {item.descrizione}
          </p>
        )}
      </div>

      {/* Barra di Controllo Live */}
      <div style={{
        ...S.liveControlBar,
        background: inCorso ? 'rgba(16, 185, 129, 0.08)' : 'var(--app-bg)',
        borderColor: inCorso ? '#10b981' : 'var(--border-color)'
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: inCorso ? '#059669' : 'var(--text-muted)' }}>
            Stato Votazione
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: inCorso ? '#10b981' : 'var(--text-primary)' }}>
            {inCorso ? '🟢 VOTAZIONE APERTA IN TEMPO REALE' : (
              item.esito === 'approvato' ? '✅ DELIBERA APPROVATA' :
              item.esito === 'respinto' ? '❌ DELIBERA RESPINTA' :
              '⚪ IN ATTESA DI APERTURA'
            )}
          </div>
        </div>

        <div>
          {inCorso ? (
            <button onClick={handleChiudiVotazione} style={S.btnChiudiVoto}>
              <Square size={16} /> Chiudi Votazione e Convalida
            </button>
          ) : (
            <button onClick={() => cambiaStatoOdg(item.id, 'in_corso')} style={S.btnApriVoto}>
              <Play size={16} /> Apri Votazione Live
            </button>
          )}
        </div>
      </div>

      {/* Box Esito Quorum Deliberativo Live */}
      <div style={{
        ...S.quorumEsitoBox,
        background: isDeliberaApprovata ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
        border: `1px solid ${isDeliberaApprovata ? '#10b981' : '#f59e0b'}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={20} color={isDeliberaApprovata ? '#10b981' : '#f59e0b'} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: isDeliberaApprovata ? '#047857' : '#b45309' }}>
              Quorum Deliberativo ex art. 1136 c.c.
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Soglia richiesta: <strong>{millesimiRichiesti.toFixed(2)} ‰</strong> e <strong>{maggioranzaTesteRichiesta} teste favorevoli</strong>.
              Stato attuale: {conteggio.favTes} teste ({conteggio.favMil.toFixed(2)} ‰) a favore.
            </div>
          </div>
        </div>
        <div style={{
          fontSize: 12,
          fontWeight: 800,
          padding: '4px 12px',
          borderRadius: 16,
          background: isDeliberaApprovata ? '#10b981' : '#f59e0b',
          color: '#ffffff'
        }}>
          {isDeliberaApprovata ? 'QUORUM RAGGIUNTO' : 'QUORUM NON ANCORA RAGGIUNTO'}
        </div>
      </div>

      {/* Risultati Votazione (3 Card) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        <ResultCard label="Favorevoli" count={conteggio.favTes} millesimi={conteggio.favMil} color="#10b981" icon={Check} />
        <ResultCard label="Contrari" count={conteggio.conTes} millesimi={conteggio.conMil} color="#ef4444" icon={X} />
        <ResultCard label="Astenuti" count={conteggio.astTes} millesimi={conteggio.astMil} color="#94a3b8" icon={Minus} />
      </div>

      {/* Tabella Voti Nominativi Registrati */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <h4 style={{ margin: '0 0 10px', fontSize: 13, textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700 }}>
          Voti Nominativi & Inserimento Rapido Sala
        </h4>
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 10, background: 'var(--card-bg)' }}>
          {presenze.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              Nessun condòmino presente registrato. Fai l'appello nella scheda Presenze.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--app-bg)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>Condòmino</th>
                  <th style={{ padding: '8px 12px' }}>Unità</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Millesimi ‰</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Voto Espresso</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Azione Rapida Sala</th>
                </tr>
              </thead>
              <tbody>
                {presenze.map(p => {
                  const userVoto = voti.find(v => v.unita_id === p.unita_id && v.persona_id === p.persona_id)?.voto;
                  const u = unitaMap.get(p.unita_id);
                  const millesimi = parseFloat(u?.millesimi_proprieta || u?.millesimi || 0) || 0;

                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {p.persona?.cognome} {p.persona?.nome}
                        {p.delegato && <span style={{ fontSize: 11, color: '#3b82f6', display: 'block' }}>Delega a: {p.delegato.cognome} {p.delegato.nome}</span>}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                        {u?.nome || `Int. ${u?.interno || '-'}`}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                        {millesimi.toFixed(2)} ‰
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {userVoto ? (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            textTransform: 'uppercase',
                            background: userVoto === 'favorevole' ? '#d1fae5' : userVoto === 'contrario' ? '#fee2e2' : '#f1f5f9',
                            color: userVoto === 'favorevole' ? '#047857' : userVoto === 'contrario' ? '#b91c1c' : '#64748b'
                          }}>
                            {userVoto}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Non ancora votato</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button
                            onClick={() => registraVoto(item.id, p.unita_id, p.persona_id, 'favorevole')}
                            style={S.votoBtn(userVoto === 'favorevole', '#10b981')}
                            title="Favorevole"
                          >
                            Sì
                          </button>
                          <button
                            onClick={() => registraVoto(item.id, p.unita_id, p.persona_id, 'contrario')}
                            style={S.votoBtn(userVoto === 'contrario', '#ef4444')}
                            title="Contrario"
                          >
                            No
                          </button>
                          <button
                            onClick={() => registraVoto(item.id, p.unita_id, p.persona_id, 'astenuto')}
                            style={S.votoBtn(userVoto === 'astenuto', '#94a3b8')}
                            title="Astenuto"
                          >
                            Ast
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function PresenzeAppelloView({ unitaList, personeList, presenze, togglePresenza, presidente, setPresidente, segretario, setSegretario }) {
  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      {/* Box Cariche Assembleari */}
      <div style={S.caricheBox}>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Presidente dell'Assemblea</label>
          <input
            type="text"
            value={presidente}
            onChange={e => setPresidente(e.target.value)}
            style={S.input}
            placeholder="Nome e cognome Presidente..."
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Segretario Verbalizzante</label>
          <input
            type="text"
            value={segretario}
            onChange={e => setSegretario(e.target.value)}
            style={S.input}
            placeholder="Nome e cognome Segretario..."
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Appello Generale per Unità Immobiliare
          </h3>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
            Spunta i condòmini presenti o registra le deleghe per il calcolo dei Quorum.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {unitaList.map(u => {
          // Trova persona associata
          const pPres = presenze.find(p => p.unita_id === u.id);
          const isPresente = pPres?.presente || false;
          const persona = personeList.find(p => p.id === pPres?.persona_id) || personeList[0];

          return (
            <div key={u.id} style={{
              ...S.unitaCard,
              borderColor: isPresente ? '#10b981' : 'var(--border-color)',
              background: isPresente ? 'rgba(16, 185, 129, 0.04)' : 'var(--card-bg)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="checkbox"
                  checked={isPresente}
                  onChange={e => {
                    const persId = persona?.id;
                    if (persId) togglePresenza(u.id, persId, e.target.checked);
                  }}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {u.nome || `Unità ${u.interno || ''}`} (Sc. {u.scala || 'A'} - Piano {u.piano || 'T'})
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Intestatario: {persona ? `${persona.cognome} ${persona.nome}` : 'Non assegnato'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {(parseFloat(u.millesimi_proprieta || u.millesimi || 0) || 0).toFixed(2)} ‰
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Millesimi proprietà</div>
                </div>

                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: isPresente ? '#10b981' : '#f1f5f9',
                  color: isPresente ? '#ffffff' : '#64748b'
                }}>
                  {isPresente ? 'PRESENTE' : 'ASSENTE'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultCard({ label, count, millesimi, color, icon: Icon }) {
  return (
    <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color }}>
        <Icon size={22} />
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
          {count} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>teste</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: color, marginTop: 2 }}>
          {millesimi.toFixed(2)} ‰
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginTop: 2 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

const S = {
  container: {
    background: 'var(--card-bg, #ffffff)',
    borderRadius: 16,
    border: '1px solid var(--border-color, #e2e8f0)',
    overflow: 'hidden',
    height: '84vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Sora, sans-serif'
  },
  header: {
    background: '#0f172a',
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #1e293b'
  },
  btnBack: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: 8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    background: '#10b981',
    boxShadow: '0 0 8px #10b981'
  },
  liveBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: '#10b981',
    letterSpacing: '0.05em'
  },
  tipoBadge: {
    fontSize: 10,
    fontWeight: 600,
    background: 'rgba(255,255,255,0.12)',
    color: '#e2e8f0',
    padding: '2px 8px',
    borderRadius: 10
  },
  quorumKpiBox: {
    padding: '6px 14px',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 10
  },
  salaAttesaBadge: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '6px 12px',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12
  },
  btnVerbalePdf: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 8,
    border: 'none',
    background: '#3b82f6',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
  },
  subNavBar: {
    display: 'flex',
    background: 'var(--app-bg, #f8fafc)',
    borderBottom: '1px solid var(--border-color, #e2e8f0)',
    padding: '0 16px'
  },
  navTab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '12px 18px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary, #64748b)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    fontFamily: 'Sora, sans-serif'
  },
  navTabActive: {
    color: '#3b82f6',
    borderBottomColor: '#3b82f6',
    fontWeight: 700
  },
  odgSidebar: {
    width: 320,
    borderRight: '1px solid var(--border-color, #e2e8f0)',
    background: 'var(--app-bg, #f8fafc)',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto'
  },
  salaAttesaBox: {
    marginBottom: 16,
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 10,
    padding: 10
  },
  salaAttesaTitle: {
    margin: '0 0 8px',
    fontSize: 11,
    color: '#b91c1c',
    textTransform: 'uppercase',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },
  attesaItem: {
    background: '#ffffff',
    border: '1px solid #fca5a5',
    borderRadius: 6,
    padding: 8
  },
  btnAmmetti: {
    flex: 1,
    padding: '4px',
    background: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer'
  },
  btnRifiuta: {
    flex: 1,
    padding: '4px',
    background: '#f1f5f9',
    color: '#ef4444',
    border: '1px solid #cbd5e1',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer'
  },
  odgItemBtn: {
    padding: 12,
    borderRadius: 10,
    border: '1px solid',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif',
    transition: 'all 0.15s'
  },
  badgeLivePulse: {
    fontSize: 9,
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: 6,
    background: '#10b981',
    color: '#ffffff'
  },
  badgeEsito: {
    fontSize: 9,
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: 6
  },
  odgMainContent: {
    flex: 1,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto'
  },
  selectQuorum: {
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid var(--border-color, #cbd5e1)',
    fontSize: 12,
    fontFamily: 'Sora, sans-serif',
    background: 'var(--card-bg, #ffffff)',
    color: 'var(--text-primary, #0f172a)'
  },
  liveControlBar: {
    padding: '14px 18px',
    borderRadius: 12,
    border: '1px solid',
    marginBottom: 14,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  btnApriVoto: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 18px',
    borderRadius: 8,
    border: 'none',
    background: '#10b981',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(16, 185, 129, 0.3)'
  },
  btnChiudiVoto: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 18px',
    borderRadius: 8,
    border: 'none',
    background: '#ef4444',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(239, 68, 68, 0.3)'
  },
  quorumEsitoBox: {
    padding: '10px 16px',
    borderRadius: 10,
    marginBottom: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  votoBtn: (active, color) => ({
    background: active ? color : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary, #475569)',
    border: `1px solid ${active ? color : 'var(--border-color, #cbd5e1)'}`,
    borderRadius: 6,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer'
  }),
  caricheBox: {
    display: 'flex',
    gap: 16,
    background: 'var(--app-bg, #f8fafc)',
    padding: 16,
    borderRadius: 12,
    border: '1px solid var(--border-color, #e2e8f0)',
    marginBottom: 20
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
    boxSizing: 'border-box'
  },
  unitaCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
  }
};
