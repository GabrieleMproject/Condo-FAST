import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Bot, Check, X, AlertTriangle, Lightbulb, CheckCircle2, XCircle, Calendar, User, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { callClaude } from '../lib/claudeClient';

// ─── Helper deterministici (nessuna AI) ────────────────────────────────────
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const euro = (n) => `€ ${(Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`;
const dataIt = (d) => (d ? new Date(d).toLocaleDateString('it-IT') : '—');

// Stesso identico sistema per parziale/pagata/sovra-versata: solo confronto aritmetico.
function calcolaStato(pagato, dovuto) {
  const p = r2(pagato), d = r2(dovuto);
  if (p <= 0) return 'non_pagata';
  if (p <  d) return 'parziale';
  if (p === d) return 'pagata';
  return 'sovra_pagata';
}

// Gli occupanti sono annidati sotto unita (rate_unita → unita → occupanti_unita).
// PostgREST non ha FK diretta rate_unita↔occupanti_unita: l'embed va passato per unita.
function estraiOccupanti(cella) {
  return cella?.unita?.occupanti || [];
}

const STATI_APERTI = ['non_pagata', 'parziale'];

export default function RiconciliazioniIncassiPage() {
  const { condominioId } = useParams();

  const [entrate, setEntrate]         = useState([]);   // estratto_conto tipo='entrata'
  const [celleAperte, setCelleAperte] = useState([]);   // rate_unita non saldate (candidate per AI)
  const [abbinamenti, setAbbinamenti] = useState([]);   // riconciliazioni_incassi (+ embed)
  const [loading, setLoading]         = useState(true);
  const [analizzando, setAnalizzando] = useState(false);
  const [progressoAI, setProgressoAI] = useState('');
  const [filtroStato, setFiltroStato] = useState('suggerita');
  const [showOrfaniModal, setShowOrfaniModal] = useState(false);

  useEffect(() => {
    if (condominioId) loadAll();
  }, [condominioId]);

  async function loadAll() {
    setLoading(true);
    const [
      entRes,
      celleRes,
      abbRes,
    ] = await Promise.all([
      supabase
        .from('estratto_conto')
        .select('*')
        .eq('condominio_id', condominioId)
        .eq('tipo', 'entrata')
        .order('data_movimento', { ascending: false }),

      supabase
        .from('rate_unita')
        .select(`
          id, importo, importo_pagato, stato,
          rata:rate(numero_rata, data_scadenza, descrizione, esercizio_id),
          unita:unita(
            numero, tipo, scala, piano,
            occupanti:occupanti_unita(ruolo, attivo, persona:persone(nome, cognome))
          )
        `)
        .eq('condominio_id', condominioId)
        .in('stato', STATI_APERTI),

      supabase
        .from('riconciliazioni_incassi')
        .select(`
          *,
          movimento:estratto_conto(*),
          cella:rate_unita(
            id, importo, importo_pagato, stato,
            rata:rate(numero_rata, data_scadenza),
            unita:unita(
              numero, tipo, scala, piano,
              occupanti:occupanti_unita(ruolo, attivo, persona:persone(nome, cognome))
            )
          )
        `)
        .eq('condominio_id', condominioId)
        .order('created_at', { ascending: false }),
    ]);

    if (entRes.error)  console.error('entrate:', entRes.error);
    if (celleRes.error) console.error('celle:', celleRes.error);
    if (abbRes.error)  console.error('abbinamenti:', abbRes.error);

    setEntrate(entRes.data || []);
    setCelleAperte(celleRes.data || []);
    setAbbinamenti(abbRes.data || []);
    setLoading(false);
  }

  // ─── AI: SOLO abbinamento (il calcolo stato è deterministico, fatto alla conferma) ───
  async function avviaAnalisiAI() {
    const entrateNonRic = entrate.filter(m => !m.riconciliato);

    if (entrateNonRic.length === 0 || celleAperte.length === 0) {
      alert('Nessuna entrata da riconciliare o nessuna cella rata aperta.');
      return;
    }

    setAnalizzando(true);
    setProgressoAI('Analisi AI in corso...');

    try {
      const systemPrompt = `Sei un esperto contabile italiano specializzato in condomini.
Abbina i BONIFICI IN ENTRATA alle CELLE RATA aperte (singola unità × rata) basandoti su:
1. Pagante: confronta il nome nella causale / "pagante_rilevato" con i nominativi dei paganti della cella.
2. Importo: un bonifico può coprire una o più celle; può essere parziale o eccedente.
3. Scadenza: di norma si salda prima la rata con scadenza più vicina ancora aperta.

Regole sull'importo:
- "importo_assegnato" è la quota del bonifico attribuita a quella cella.
- La somma degli "importo_assegnato" di uno stesso movimento NON deve superare l'importo del bonifico.
- Se un bonifico copre più rate della stessa unità, genera più abbinamenti (stesso movimento_id, rata_unita_id diversi).
- Non è obbligatorio assegnare l'intero bonifico.

Restituisci SOLO un array JSON, senza testo aggiuntivo:
[
  {
    "movimento_id": "uuid del bonifico",
    "rata_unita_id": "uuid della cella",
    "importo_assegnato": number,
    "confidence_score": 0-100,
    "motivazione": "breve spiegazione"
  }
]
Includi solo abbinamenti con confidence_score >= 30. Non abbinare due volte la stessa coppia movimento/cella.`;

      const entrateCtx = entrateNonRic.map(m => ({
        movimento_id:     m.id,
        data:             m.data_movimento,
        causale:          m.causale,
        importo:          Math.abs(m.importo),
        pagante_rilevato: m.pagante_rilevato ?? null,
      }));

      const celleCtx = celleAperte.map(c => ({
        rata_unita_id: c.id,
        unita: c.unita
          ? `${c.unita.numero}${c.unita.scala ? ' sc.' + c.unita.scala : ''}${c.unita.piano != null ? ' p.' + c.unita.piano : ''} (${c.unita.tipo})`
          : '—',
        rata: c.rata ? `Rata ${c.rata.numero_rata} scad. ${c.rata.data_scadenza}` : '—',
        importo_dovuto: c.importo,
        gia_pagato:     c.importo_pagato,
        residuo:        r2(c.importo - c.importo_pagato),
        paganti: estraiOccupanti(c)
          .filter(o => o.attivo && o.persona)
          .map(o => `${o.persona.nome} ${o.persona.cognome} (${o.ruolo})`),
      }));

      const userPrompt = `BONIFICI IN ENTRATA (non ancora riconciliati):
${JSON.stringify(entrateCtx, null, 2)}

CELLE RATA APERTE (da pagare o parziali):
${JSON.stringify(celleCtx, null, 2)}

Abbina i bonifici alle celle.`;

      setProgressoAI('Elaborazione suggerimenti...');
      const risposta = await callClaude(userPrompt, {
        system: systemPrompt,
        maxTokens: 4000,
        funzione: 'riconcilia_incassi',
        condominio_id: condominioId,
      });

      const clean = risposta.replace(/```json\n?|\n?```/g, '').trim();
      let suggerimenti = JSON.parse(clean);
      if (!Array.isArray(suggerimenti)) suggerimenti = [];
      suggerimenti = suggerimenti.filter(s => (s.confidence_score ?? 0) >= 30 && s.movimento_id && s.rata_unita_id);

      if (suggerimenti.length > 0) {
        setProgressoAI(`Salvataggio ${suggerimenti.length} suggerimenti...`);
        const inserts = suggerimenti.map(s => ({
          condominio_id:     condominioId,
          movimento_id:      s.movimento_id,
          rata_unita_id:     s.rata_unita_id,
          importo_assegnato: r2(s.importo_assegnato),
          confidence_score:  s.confidence_score,
          metodo:            'ai',
          stato:             'suggerita',
          note:              s.motivazione ?? null,
        }));

        await supabase
          .from('riconciliazioni_incassi')
          .upsert(inserts, { onConflict: 'movimento_id,rata_unita_id', ignoreDuplicates: true });
      }

      setProgressoAI(`✅ ${suggerimenti.length} abbinamenti suggeriti`);
      await loadAll();
      setShowOrfaniModal(true);
      setTimeout(() => setProgressoAI(''), 4000);
    } catch (e) {
      setProgressoAI('Errore: ' + e.message);
    } finally {
      setAnalizzando(false);
    }
  }

  // ─── Conferma (deterministica): aggiorna cella + ricalcola riconciliato movimento ───
  async function confermaAbbinamento(ab) {
    const cella = ab.cella;
    const mov   = ab.movimento;
    if (!cella || !mov) {
      alert('Dati incompleti per questo abbinamento.');
      return;
    }

    try {
      const nuovoPagato = r2((cella.importo_pagato || 0) + (ab.importo_assegnato || 0));
      const nuovoStato  = calcolaStato(nuovoPagato, cella.importo);

      const { error: errRic } = await supabase.from('riconciliazioni_incassi')
        .update({ stato: 'confermata', confermata_at: new Date().toISOString() })
        .eq('id', ab.id);
      if (errRic) throw errRic;

      const { error: errCella } = await supabase.from('rate_unita')
        .update({
          importo_pagato: nuovoPagato,
          stato:          nuovoStato,
          data_pagamento: mov.data_movimento,
        })
        .eq('id', cella.id);
      if (errCella) throw errCella;

      const { data: confermati, error: errConf } = await supabase
        .from('riconciliazioni_incassi')
        .select('importo_assegnato')
        .eq('movimento_id', mov.id)
        .eq('stato', 'confermata');
      if (errConf) throw errConf;

      const totAssegnato = r2((confermati || []).reduce((a, x) => a + (x.importo_assegnato || 0), 0));
      const riconciliato = totAssegnato >= r2(Math.abs(mov.importo));

      const { error: errMov } = await supabase.from('estratto_conto')
        .update({ riconciliato })
        .eq('id', mov.id);
      if (errMov) throw errMov;

      await loadAll();
    } catch (err) {
      alert('Errore conferma abbinamento incasso: ' + err.message);
    }
  }

  async function rifiutaAbbinamento(ab) {
    try {
      const { error } = await supabase.from('riconciliazioni_incassi')
        .update({ stato: 'rifiutata' })
        .eq('id', ab.id);
      if (error) throw error;
      await loadAll();
    } catch (err) {
      alert('Errore rifiuto abbinamento: ' + err.message);
    }
  }

  // ─── KPI / filtro ───────────────────────────────────────────────────────────
  const abbFiltrati = filtroStato ? abbinamenti.filter(a => a.stato === filtroStato) : abbinamenti;

  const kpiEntrateDaRic = entrate.filter(m => !m.riconciliato).length;
  const kpiSuggerite    = abbinamenti.filter(a => a.stato === 'suggerita').length;
  const kpiConfermate   = abbinamenti.filter(a => a.stato === 'confermata').length;
  const kpiCelleAperte  = celleAperte.length;
  const entrateOrfane   = entrate.filter(m => !m.riconciliato && !abbinamenti.some(a => a.movimento_id === m.id && (a.stato === 'suggerita' || a.stato === 'confermata')));

  async function abbinaManualeIncasso(mov, cella) {
    if (!cella || !mov) return;
    try {
      const importoAssegnato = r2(Math.min(Math.abs(mov.importo), cella.importo - (cella.importo_pagato || 0)));
      const nuovoPagato = r2((cella.importo_pagato || 0) + importoAssegnato);
      const nuovoStato = calcolaStato(nuovoPagato, cella.importo);

      const { error: errIns } = await supabase.from('riconciliazioni_incassi').insert({
        condominio_id: condominioId,
        movimento_id: mov.id,
        rata_unita_id: cella.id,
        importo_assegnato: importoAssegnato,
        confidence_score: 100,
        metodo: 'manuale',
        stato: 'confermata',
        confermata_at: new Date().toISOString(),
        note: 'Abbinamento manuale rapido'
      });
      if (errIns) throw errIns;

      const { error: errCella } = await supabase.from('rate_unita').update({
        importo_pagato: nuovoPagato,
        stato: nuovoStato,
        data_pagamento: mov.data_movimento,
      }).eq('id', cella.id);
      if (errCella) throw errCella;

      const { data: confermati, error: errConf } = await supabase.from('riconciliazioni_incassi').select('importo_assegnato').eq('movimento_id', mov.id).eq('stato', 'confermata');
      if (errConf) throw errConf;

      const totAssegnato = r2((confermati || []).reduce((a, x) => a + (x.importo_assegnato || 0), 0));
      const riconciliato = totAssegnato >= r2(Math.abs(mov.importo));
      const { error: errMov } = await supabase.from('estratto_conto').update({ riconciliato }).eq('id', mov.id);
      if (errMov) throw errMov;

      await loadAll();
    } catch (err) {
      alert('Errore abbinamento manuale: ' + err.message);
    }
  }

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#475569', fontFamily: "'Sora', sans-serif" }}>Caricamento...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Riconciliazione Incassi</h1>
          <p style={styles.subtitle}>Abbina i bonifici in entrata alle rate dei condòmini</p>
        </div>
        <button
          style={{ ...styles.btnAI, opacity: analizzando ? 0.6 : 1 }}
          onClick={avviaAnalisiAI}
          disabled={analizzando}
        >
          {analizzando ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analisi...
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Bot size={14} /> Avvia Analisi AI
            </span>
          )}
        </button>
      </div>

      {progressoAI && (
        <div style={styles.progressBar}>
          <div style={styles.progressDot} />
          {progressoAI}
        </div>
      )}

      <div style={styles.kpiRow}>
        {[
          { label: 'Entrate da riconciliare', value: kpiEntrateDaRic, color: '#f59e0b' },
          { label: 'Suggerimenti AI',         value: kpiSuggerite,    color: '#8b5cf6' },
          { label: 'Confermati',              value: kpiConfermate,   color: '#16a34a' },
          { label: 'Celle rata aperte',       value: kpiCelleAperte,  color: '#2563eb' },
        ].map(k => (
          <div key={k.label} style={styles.kpiCard}>
            <div style={{ ...styles.kpiVal, color: k.color }}>{k.value}</div>
            <div style={styles.kpiLabel}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={styles.toolbar}>
        {[
          { val: '',           label: 'Tutti', icon: null },
          { val: 'suggerita',  label: 'Da confermare', icon: Bot },
          { val: 'confermata', label: 'Confermati', icon: Check },
          { val: 'rifiutata',  label: 'Rifiutati', icon: X },
          { val: 'orfani',     label: `Senza Rata (${entrateOrfane.length})`, icon: AlertTriangle, isAlert: entrateOrfane.length > 0 },
        ].map(({ val, label, icon: Icon, isAlert }) => (
          <button
            key={val}
            style={{ 
              ...styles.tBtn, 
              ...(filtroStato === val ? styles.tBtnActive : {}),
              ...(isAlert && val === 'orfani' && filtroStato !== 'orfani' ? { background: '#f59e0b20', color: '#fbbf24', border: '1px solid #f59e0b40' } : {}),
              display: 'inline-flex', alignItems: 'center', gap: 6
            }}
            onClick={() => setFiltroStato(val)}
          >
            {Icon && <Icon size={14} />} {label}
          </button>
        ))}
      </div>

      {filtroStato === 'orfani' ? (
        entrateOrfane.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p>Nessun bonifico in entrata senza rata o incasso sconosciuto.</p>
          </div>
        ) : (
          <div style={styles.lista}>
            {entrateOrfane.map(m => (
              <EntrataOrfanaCard
                key={m.id}
                mov={m}
                celleAperte={celleAperte}
                onAbbina={cella => abbinaManualeIncasso(m, cella)}
              />
            ))}
          </div>
        )
      ) : abbFiltrati.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💶</div>
          <p>
            {filtroStato === 'suggerita'
              ? 'Nessun abbinamento da confermare. Clicca "Avvia Analisi AI" per generarne.'
              : 'Nessun abbinamento trovato.'}
          </p>
        </div>
      ) : (
        <div style={styles.lista}>
          {abbFiltrati.map(ab => (
            <AbbinamentoIncassoCard
              key={ab.id}
              ab={ab}
              onConferma={() => confermaAbbinamento(ab)}
              onRifiuta={() => rifiutaAbbinamento(ab)}
            />
          ))}
        </div>
      )}

      {/* Modal Avviso Entrate Orfane */}
      {showOrfaniModal && entrateOrfane.length > 0 && (
        <div style={styles.modalOverlay || { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={styles.modalBox || { background: '#1e293b', borderRadius: 16, border: '1px solid #334155', width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} /> Rilevati Bonifici senza Rata ({entrateOrfane.length})
              </h3>
              <button style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => setShowOrfaniModal(false)} type="button"><X size={20} /></button>
            </div>
            <p style={{ padding: '16px 24px', margin: 0, fontSize: 14, color: '#cbd5e1', lineHeight: 1.5 }}>
              L'AI ha terminato l'analisi ma ha rilevato <b>{entrateOrfane.length} bonifici in entrata</b> non associabili ad alcuna rata in modo automatico. Puoi abbinarli manualmente ora a una delle rate aperte oppure consultare la scheda <b>"Senza Rata"</b>.
            </p>
            <div style={{ padding: '0 24px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {entrateOrfane.map(m => (
                <div key={m.id} style={{ background: '#0f172a', padding: '14px 18px', borderRadius: 12, border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>{m.causale || '—'}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                      📅 {dataIt(m.data_movimento)} · {m.pagante_rilevato ? `👤 ${m.pagante_rilevato}` : 'Pagante non rilevato'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ color: '#10b981', fontWeight: 700, fontSize: 14 }}>
                      +€ {Math.abs(m.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </span>
                    <button
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 13 }}
                      onClick={() => {
                        setShowOrfaniModal(false);
                        setFiltroStato('orfani');
                      }}
                    >
                      🔗 Vai ad Abbinamento
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'flex-end', background: '#0f172a', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
              <button style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 13 }} onClick={() => setShowOrfaniModal(false)}>Ho capito, chiudi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Card singolo abbinamento ───────────────────────────────────────────────
function AbbinamentoIncassoCard({ ab, onConferma, onRifiuta }) {
  const mov   = ab.movimento;
  const cella = ab.cella;
  const score = ab.confidence_score || 0;
  const scoreColor = score >= 80 ? '#16a34a' : score >= 50 ? '#f59e0b' : '#ef4444';

  const unitaLabel = cella?.unita
    ? `${cella.unita.numero}${cella.unita.scala ? ' sc.' + cella.unita.scala : ''}${cella.unita.piano != null ? ' p.' + cella.unita.piano : ''}`
    : '—';
  const paganti = estraiOccupanti(cella)
    .filter(o => o.attivo && o.persona)
    .map(o => `${o.persona.nome} ${o.persona.cognome}`)
    .join(', ');
  const residuo = cella ? r2(cella.importo - cella.importo_pagato) : 0;

  return (
    <div style={{ ...styles.card, ...(ab.stato === 'confermata' ? styles.cardConfermata : ab.stato === 'rifiutata' ? styles.cardRifiutata : {}) }}>
      <div style={styles.scoreWrap}>
        <div style={{ ...styles.score, color: scoreColor, borderColor: scoreColor + '40' }}>{score}%</div>
        <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 2 }}>
          {ab.metodo === 'ai' ? 'AI' : 'Manuale'}
        </div>
      </div>

      <div style={styles.matchWrap}>
        {/* Bonifico */}
        <div style={styles.matchBox}>
          <div style={styles.matchLabel}>BONIFICO IN ENTRATA</div>
          <div style={styles.matchTitolo}>{mov?.causale || '—'}</div>
          {mov?.pagante_rilevato && <div style={styles.matchSub}>👤 {mov.pagante_rilevato}</div>}
          <div style={styles.matchMeta}>
            <span>📅 {dataIt(mov?.data_movimento)}</span>
            <span style={{ color: '#16a34a', fontWeight: 700 }}>+{euro(Math.abs(mov?.importo || 0))}</span>
          </div>
        </div>

        <div style={styles.arrow}>→</div>

        {/* Cella rata */}
        <div style={styles.matchBox}>
          <div style={styles.matchLabel}>RATA · UNITÀ {unitaLabel}</div>
          <div style={styles.matchTitolo}>
            {cella?.rata ? `Rata ${cella.rata.numero_rata} · scad. ${dataIt(cella.rata.data_scadenza)}` : '—'}
          </div>
          {paganti && <div style={styles.matchSub}>👤 {paganti}</div>}
          <div style={styles.matchMeta}>
            <span>Residuo {euro(residuo)}</span>
            <span style={{ color: '#2563eb', fontWeight: 700 }}>assegna {euro(ab.importo_assegnato)}</span>
          </div>
        </div>
      </div>

      <div style={styles.bottomRow}>
        {ab.note && (
          <div style={{ ...styles.motivazione, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Lightbulb size={14} style={{ color: '#fbbf24', flexShrink: 0 }} /> {ab.note}
          </div>
        )}

        {ab.stato === 'suggerita' && (
          <div style={styles.actions}>
            <button style={{ ...styles.btnConferma, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={onConferma}><Check size={14} /> Conferma</button>
            <button style={{ ...styles.btnRifiuta, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={onRifiuta}><X size={14} /> Rifiuta</button>
          </div>
        )}
        {ab.stato === 'confermata' && (
          <span style={{ ...styles.statoBadge, background: '#16a34a20', color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={12} /> Confermato {dataIt(ab.confermata_at)}
          </span>
        )}
        {ab.stato === 'rifiutata' && (
          <span style={{ ...styles.statoBadge, background: '#64748b20', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}><XCircle size={12} /> Rifiutato</span>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { fontFamily: "'Sora', sans-serif", color: '#e2e8f0', padding: 24 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#64748b' },
  btnAI: { background: 'linear-gradient(135deg, #16a34a, #2563eb)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  progressBar: { display: 'flex', alignItems: 'center', gap: 10, background: '#8b5cf620', border: '1px solid #8b5cf640', borderRadius: 10, padding: '10px 16px', marginBottom: 16, color: '#a78bfa', fontSize: 13 },
  progressDot: { width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' },
  kpiRow: { display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  kpiCard: { flex: '1 1 140px', background: '#1e293b', borderRadius: 12, padding: '16px 20px', border: '1px solid #334155' },
  kpiVal: { fontSize: 24, fontWeight: 700 },
  kpiLabel: { fontSize: 11, color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' },
  toolbar: { display: 'flex', gap: 4, marginBottom: 16, background: '#1e293b', borderRadius: 8, padding: 2, flexWrap: 'wrap' },
  tBtn: { background: 'none', border: 'none', color: '#64748b', padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontSize: 13, fontWeight: 600 },
  tBtnActive: { background: '#2563eb', color: '#fff' },
  empty: { textAlign: 'center', padding: 60, color: '#475569' },
  lista: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: '#1e293b', borderRadius: 14, border: '1px solid #334155', padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 },
  cardConfermata: { borderColor: '#16a34a40', background: '#16a34a08' },
  cardRifiutata: { borderColor: '#33415560', opacity: 0.7 },
  scoreWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 },
  score: { width: 52, height: 52, borderRadius: '50%', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 },
  matchWrap: { flex: 1, display: 'flex', alignItems: 'stretch', gap: 8, minWidth: 0 },
  matchBox: { flex: 1, background: '#0f172a', borderRadius: 10, padding: '10px 14px', minWidth: 0 },
  matchLabel: { fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 },
  matchTitolo: { fontSize: 13, fontWeight: 600, color: '#e2e8f0', wordBreak: 'break-word' },
  matchSub: { fontSize: 12, color: '#60a5fa', marginTop: 2 },
  matchMeta: { display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#64748b' },
  arrow: { fontSize: 20, color: '#334155', alignSelf: 'center', flexShrink: 0 },
  bottomRow: { display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0, minWidth: 120, alignItems: 'flex-end' },
  motivazione: { fontSize: 11, color: '#64748b', maxWidth: 160, textAlign: 'right', lineHeight: 1.4 },
  actions: { display: 'flex', flexDirection: 'column', gap: 6 },
  btnConferma: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 13 },
  btnRifiuta: { background: 'none', color: '#64748b', border: '1px solid #334155', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 13 },
  statoBadge: { borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 },
  btnAction: { background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' },
};

function EntrataOrfanaCard({ mov, celleAperte, onAbbina }) {
  const [selectedCellaId, setSelectedCellaId] = useState('');
  return (
    <div style={{ ...styles.card, borderColor: '#f59e0b40', background: '#f59e0b08', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
      <div style={{ flex: '1 1 250px' }}>
        <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} /> BONIFICO IN ENTRATA SENZA RATA ASSOCIATA
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>{mov.causale || '—'}</div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {dataIt(mov.data_movimento)}</span>
          <span>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <User size={12} /> {mov.pagante_rilevato || 'Pagante non rilevato'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: '#10b981', fontWeight: 700, fontSize: 18 }}>
          +€ {Math.abs(mov.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
        </span>
        <select
          value={selectedCellaId}
          onChange={e => setSelectedCellaId(e.target.value)}
          style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: "'Sora', sans-serif", maxWidth: 280 }}
        >
          <option value="">-- Seleziona una rata aperta --</option>
          {celleAperte.map(c => {
            const unitaLabel = c.unita ? `Unità ${c.unita.numero} (${c.unita.tipo})` : '';
            const rataLabel = c.rata ? `Rata ${c.rata.numero_rata}` : '';
            const residuo = r2(c.importo - (c.importo_pagato || 0));
            return (
              <option key={c.id} value={c.id}>
                {unitaLabel} - {rataLabel} (Residuo: € {residuo.toLocaleString('it-IT', { minimumFractionDigits: 2 })})
              </option>
            );
          })}
        </select>
        <button
          style={{ ...styles.btnAction, opacity: selectedCellaId ? 1 : 0.5, cursor: selectedCellaId ? 'pointer' : 'not-allowed' }}
          disabled={!selectedCellaId}
          onClick={() => {
            const cella = celleAperte.find(x => x.id === selectedCellaId);
            if (cella) {
              onAbbina(cella);
              setSelectedCellaId('');
            }
          }}
        >
          🔗 Abbina e Salda
        </button>
      </div>
    </div>
  );
}