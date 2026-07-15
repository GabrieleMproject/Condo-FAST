import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bot, Check, X, AlertTriangle, Calendar, Building2, Lightbulb, CheckCircle2, XCircle, User, RefreshCw, Plus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { callGemini } from '../lib/geminiClient';

const formattaData = (d) => (d ? new Date(d).toLocaleDateString('it-IT') : '—');

export default function RiconciliazioniPage() {
  const { condominioId } = useParams();
  const navigate = useNavigate();

  const [movimenti, setMovimenti] = useState([]);
  const [fatture, setFatture] = useState([]);
  const [riconciliazioni, setRiconciliazioni] = useState([]);
  const [loading, setLoading] = useState(true);
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
      { data: mov },
      { data: fat },
      { data: ric },
    ] = await Promise.all([
      supabase.from('estratto_conto').select('*').eq('condominio_id', condominioId).eq('tipo', 'uscita').order('data_movimento', { ascending: false }),
      supabase.from('fatture_fornitori').select('*').eq('condominio_id', condominioId).order('data_fattura', { ascending: false }),
      supabase.from('riconciliazioni').select(`
        *,
        movimento:estratto_conto(*),
        fattura:fatture_fornitori(*)
      `).eq('condominio_id', condominioId).order('created_at', { ascending: false }),
    ]);

    setMovimenti(mov || []);
    setFatture(fat || []);
    setRiconciliazioni(ric || []);
    setLoading(false);
  }

  // ─── AI: suggerisci abbinamenti ─────────────────────────────
  async function avviaAnalisiAI() {
    const movNonRic = movimenti.filter(m => !m.riconciliato);
    const fatNonRic = fatture.filter(f => !f.riconciliata);

    if (movNonRic.length === 0 || fatNonRic.length === 0) {
      alert('Nessun movimento o fattura da riconciliare.');
      return;
    }

    setAnalizzando(true);
    setProgressoAI('Analisi AI in corso...');

    try {
      const systemPrompt = `Sei un esperto contabile italiano. 
Abbina i movimenti bancari alle fatture dei fornitori basandoti su:
1. Corrispondenza importo (con tolleranza ±5€ per arrotondamenti/commissioni)
2. Corrispondenza temporale (il pagamento di solito avviene entro 30-60 gg dalla fattura)
3. Corrispondenza fornitore (dalla causale del movimento)

Restituisci SOLO un array JSON:
[
  {
    "movimento_id": "uuid del movimento",
    "fattura_id": "uuid della fattura",
    "confidence_score": 0-100,
    "motivazione": "breve spiegazione dell'abbinamento"
  }
]
Includi solo abbinamenti con confidence >= 30. Non abbinare lo stesso movimento a più fatture.`;

      const userPrompt = `MOVIMENTI BANCARI (uscite non riconciliate):
${JSON.stringify(movNonRic.map(m => ({
        id: m.id,
        data: m.data_movimento,
        causale: m.causale,
        importo: Math.abs(m.importo),
        fornitore: m.fornitore_rilevato,
      })), null, 2)}

FATTURE NON RICONCILIATE:
${JSON.stringify(fatNonRic.map(f => ({
        id: f.id,
        fornitore: f.fornitore,
        data_fattura: f.data_fattura,
        importo: f.importo_totale,
        descrizione: f.descrizione,
        numero: f.numero_fattura,
      })), null, 2)}

Abbina i movimenti alle fatture.`;

  setProgressoAI('Elaborazione suggerimenti...');
      const risposta = await callGemini(userPrompt, { system: systemPrompt, maxTokens: 2048, funzione: 'riconcilia_uscite', condominio_id: condominioId });
      const clean = risposta.replace(/```json\n?|\n?```/g, '').trim();
      const suggerimenti = JSON.parse(clean);

      // Salva suggerimenti su Supabase
      setProgressoAI(`Salvataggio ${suggerimenti.length} suggerimenti...`);
      const { data: { user } } = await supabase.auth.getUser();

      if (suggerimenti.length > 0) {
        const inserts = suggerimenti.map(s => ({
          condominio_id: condominioId,
          user_id: user.id,
          movimento_id: s.movimento_id,
          fattura_id: s.fattura_id,
          confidence_score: s.confidence_score,
          metodo: 'ai',
          stato: 'suggerita',
          note: s.motivazione,
        }));

        await supabase.from('riconciliazioni')
          .upsert(inserts, { onConflict: 'movimento_id,fattura_id', ignoreDuplicates: true });
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

  // ─── Conferma / rifiuta ──────────────────────────────────────
  async function aggiornaStato(ricId, nuovoStato, movimentoId, fatturaId) {
    try {
      const { error: errRic } = await supabase.from('riconciliazioni').update({
        stato: nuovoStato,
        confermata_at: nuovoStato === 'confermata' ? new Date().toISOString() : null,
      }).eq('id', ricId);
      if (errRic) throw errRic;

      if (nuovoStato === 'confermata') {
        const mov = movimenti.find(m => m.id === movimentoId);
        const dataPagamento = mov ? mov.data_movimento : new Date().toISOString().split('T')[0];

        const [resMov, resFatt] = await Promise.all([
          supabase.from('estratto_conto').update({ riconciliato: true }).eq('id', movimentoId),
          supabase.from('fatture_fornitori').update({ 
            riconciliata: true,
            stato: 'pagata',
            data_pagamento: dataPagamento
          }).eq('id', fatturaId),
        ]);
        if (resMov.error) throw resMov.error;
        if (resFatt.error) throw resFatt.error;
      }
      await loadAll();
    } catch (err) {
      alert('Errore aggiornamento riconciliazione: ' + err.message);
    }
  }

  // ─── Filtro ──────────────────────────────────────────────────
  const ricFiltrate = filtroStato ? riconciliazioni.filter(r => r.stato === filtroStato) : riconciliazioni;

  const kpiSuggerite = riconciliazioni.filter(r => r.stato === 'suggerita').length;
  const kpiConfermate = riconciliazioni.filter(r => r.stato === 'confermata').length;
  const kpiRifiutate = riconciliazioni.filter(r => r.stato === 'rifiutata').length;
  const movDaRic = movimenti.filter(m => !m.riconciliato).length;
  const movOrfani = movimenti.filter(m => !m.riconciliato && !riconciliazioni.some(r => r.movimento_id === m.id && (r.stato === 'suggerita' || r.stato === 'confermata')));

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontFamily: "'Sora', sans-serif" }}>Caricamento...</div>;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Riconciliazione Movimenti</h1>
          <p style={styles.subtitle}>Abbina i movimenti bancari alle fatture dei fornitori</p>
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

      {/* KPI */}
      <div style={styles.kpiRow}>
        {[
          { label: 'Movimenti da riconciliare', value: movDaRic, color: '#f59e0b' },
          { label: 'Suggerimenti AI', value: kpiSuggerite, color: '#8b5cf6' },
          { label: 'Confermati', value: kpiConfermate, color: '#16a34a' },
          { label: 'Rifiutati', value: kpiRifiutate, color: 'var(--text-muted)' },
        ].map(k => (
          <div key={k.label} style={styles.kpiCard}>
            <div style={{ ...styles.kpiVal, color: k.color }}>{k.value}</div>
            <div style={styles.kpiLabel}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtri */}
      <div style={styles.toolbar}>
        {[
          { val: '', label: 'Tutti', icon: null },
          { val: 'suggerita', label: 'Da confermare', icon: Bot },
          { val: 'confermata', label: 'Confermati', icon: Check },
          { val: 'rifiutata', label: 'Rifiutati', icon: X },
          { val: 'orfani', label: `Senza Fattura (${movOrfani.length})`, icon: AlertTriangle, isAlert: movOrfani.length > 0 },
        ].map(({ val, label, icon: Icon, isAlert }) => (
          <button
            key={val}
            style={{ 
              ...styles.tBtn, 
              ...(filtroStato === val ? styles.tBtnActive : {}),
              ...(isAlert && val === 'orfani' && filtroStato !== 'orfani' ? { background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' } : {}),
              display: 'inline-flex', alignItems: 'center', gap: 6
            }}
            onClick={() => setFiltroStato(val)}
          >
            {Icon && <Icon size={14} />} {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtroStato === 'orfani' ? (
        movOrfani.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><CheckCircle2 size={40} style={{ color: '#16a34a' }} /></div>
            <p>Nessun movimento in uscita senza fattura.</p>
          </div>
        ) : (
          <div style={styles.lista}>
            {movOrfani.map(m => (
              <MovimentoOrfanoCard
                key={m.id}
                mov={m}
                onInserisci={() => navigate(`/condomini/${condominioId}/spese`, { state: { prefillSpesa: { importo: Math.abs(m.importo), data_spesa: m.data_movimento, descrizione: m.causale || '', fornitore: m.fornitore_rilevato || '' } } })}
              />
            ))}
          </div>
        )
      ) : ricFiltrate.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
          <p>
            {filtroStato === 'suggerita'
              ? 'Nessun abbinamento da confermare. Clicca "Avvia Analisi AI" per generarne.'
              : 'Nessuna riconciliazione trovata.'}
          </p>
        </div>
      ) : (
        <div style={styles.lista}>
          {ricFiltrate.map(r => (
            <RiconciliazioneCard
              key={r.id}
              ric={r}
              onConferma={() => aggiornaStato(r.id, 'confermata', r.movimento_id, r.fattura_id)}
              onRifiuta={() => aggiornaStato(r.id, 'rifiutata', r.movimento_id, r.fattura_id)}
            />
          ))}
        </div>
      )}

      {/* Modal Avviso Movimenti Orfani */}
      {showOrfaniModal && movOrfani.length > 0 && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <h3 style={{ ...styles.modalTitle, display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={18} style={{ color: '#fbbf24' }} /> Rilevati Movimenti senza Fattura ({movOrfani.length})</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowOrfaniModal(false)} type="button"><X size={20} /></button>
            </div>
            <p style={styles.modalText}>
              L'AI ha terminato l'analisi ma ha rilevato <b>{movOrfani.length} movimenti bancari in uscita</b> che non hanno alcuna fattura associata in archivio. Puoi inserire le spese mancanti ora (con precompilazione automatica dai dati del bonifico) oppure consultare la scheda <b>"Senza Fattura"</b> in qualsiasi momento.
            </p>
            <div style={styles.modalList}>
              {movOrfani.map(m => (
                <div key={m.id} style={styles.modalItem}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{m.causale || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} /> {formattaData(m.data_movimento)} · {m.fornitore_rilevato ? <><Building2 size={12} /> {m.fornitore_rilevato}</> : 'Fornitore non rilevato'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 14 }}>
                      -€ {Math.abs(m.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </span>
                    <button
                      style={styles.btnAction}
                      onClick={() => {
                        setShowOrfaniModal(false);
                        navigate(`/condomini/${condominioId}/spese`, { state: { prefillSpesa: { importo: Math.abs(m.importo), data_spesa: m.data_movimento, descrizione: m.causale || '', fornitore: m.fornitore_rilevato || '' } } });
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Plus size={12} /> Inserisci Spesa
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.btnChiudiModal} onClick={() => setShowOrfaniModal(false)}>Ho capito, chiudi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Card singola riconciliazione ─────────────────────────────────────────────
function RiconciliazioneCard({ ric, onConferma, onRifiuta }) {
  const mov = ric.movimento;
  const fat = ric.fattura;
  const score = ric.confidence_score || 0;

  const scoreColor = score >= 80 ? '#16a34a' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ ...styles.card, ...(ric.stato === 'confermata' ? styles.cardConfermata : ric.stato === 'rifiutata' ? styles.cardRifiutata : {}) }}>
      {/* Score AI */}
      <div style={styles.scoreWrap}>
        <div style={{ ...styles.score, color: scoreColor, borderColor: scoreColor + '40' }}>
          {score}%
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 2 }}>
          {ric.metodo === 'ai' ? 'AI' : 'Manuale'}
        </div>
      </div>

      {/* Movimento ←→ Fattura */}
      <div style={styles.matchWrap}>
        {/* Movimento */}
        <div style={styles.matchBox}>
          <div style={styles.matchLabel}>MOVIMENTO BANCARIO</div>
          <div style={styles.matchTitolo}>{mov?.causale || '—'}</div>
          {mov?.fornitore_rilevato && <div style={styles.matchSub}>🏢 {mov.fornitore_rilevato}</div>}
          <div style={styles.matchMeta}>
            <span>📅 {mov?.data_movimento ? new Date(mov.data_movimento).toLocaleDateString('it-IT') : '—'}</span>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>
              -€ {Math.abs(mov?.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div style={styles.arrow}>↔</div>

        {/* Fattura */}
        <div style={styles.matchBox}>
          <div style={styles.matchLabel}>FATTURA FORNITORE</div>
          <div style={styles.matchTitolo}>{fat?.fornitore || '—'}</div>
          {fat?.numero_fattura && <div style={styles.matchSub}>N. {fat.numero_fattura}</div>}
          <div style={styles.matchMeta}>
            <span>📅 {fat?.data_fattura ? new Date(fat.data_fattura).toLocaleDateString('it-IT') : '—'}</span>
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>
              € {(fat?.importo_totale || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Motivazione AI + Azioni */}
      <div style={styles.bottomRow}>
        {ric.note && (
          <div style={{ ...styles.motivazione, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Lightbulb size={14} style={{ color: '#fbbf24', flexShrink: 0 }} /> {ric.note}</div>
        )}

        {ric.stato === 'suggerita' && (
          <div style={styles.actions}>
            <button style={{ ...styles.btnConferma, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={onConferma}><Check size={14} /> Conferma</button>
            <button style={{ ...styles.btnRifiuta, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={onRifiuta}><X size={14} /> Rifiuta</button>
          </div>
        )}

        {ric.stato === 'confermata' && (
          <span style={{ ...styles.statoBadge, background: '#16a34a20', color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={12} /> Confermata {ric.confermata_at ? new Date(ric.confermata_at).toLocaleDateString('it-IT') : ''}
          </span>
        )}

        {ric.stato === 'rifiutata' && (
          <span style={{ ...styles.statoBadge, background: '#64748b20', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <XCircle size={12} /> Rifiutata
          </span>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { fontFamily: "'Sora', sans-serif", color: 'var(--text-primary)', padding: 24 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' },
  btnAI: {
    background: 'linear-gradient(135deg, #2563eb, #8b5cf6)',
    color: '#fff', border: 'none', borderRadius: 10,
    padding: '10px 22px', fontFamily: "'Sora', sans-serif",
    fontWeight: 700, fontSize: 14, cursor: 'pointer',
  },
  progressBar: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#8b5cf620', border: '1px solid #8b5cf640',
    borderRadius: 10, padding: '10px 16px', marginBottom: 16,
    color: '#a78bfa', fontSize: 13,
  },
  progressDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6',
    animation: 'pulse 1s ease-in-out infinite',
  },
  kpiRow: { display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  kpiCard: { flex: '1 1 140px', background: 'var(--card-bg)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--border-color)' },
  kpiVal: { fontSize: 24, fontWeight: 700 },
  kpiLabel: { fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' },
  toolbar: { display: 'flex', gap: 4, marginBottom: 16, background: 'var(--card-bg)', borderRadius: 8, padding: 2, flexWrap: 'wrap' },
  tBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontSize: 13, fontWeight: 600, transition: 'all 0.2s' },
  tBtnActive: { background: '#2563eb', color: '#fff' },
  empty: { textAlign: 'center', padding: 60, color: 'var(--text-muted)' },
  lista: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--border-color)',
    padding: '16px 20px', display: 'flex', alignItems: 'flex-start',
    gap: 16, transition: 'border-color 0.2s',
  },
  cardConfermata: { borderColor: '#16a34a40', background: '#16a34a08' },
  cardRifiutata: { borderColor: '#33415560', opacity: 0.7 },
  scoreWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 },
  score: {
    width: 52, height: 52, borderRadius: '50%',
    border: '2px solid', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 13, fontWeight: 700,
  },
  matchWrap: { flex: 1, display: 'flex', alignItems: 'stretch', gap: 8, minWidth: 0 },
  matchBox: { flex: 1, background: 'var(--app-bg)', borderRadius: 10, padding: '10px 14px', minWidth: 0 },
  matchLabel: { fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 },
  matchTitolo: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' },
  matchSub: { fontSize: 12, color: '#60a5fa', marginTop: 2 },
  matchMeta: { display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--text-muted)' },
  arrow: { fontSize: 20, color: 'var(--border-color)', alignSelf: 'center', flexShrink: 0 },
  bottomRow: { display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0, minWidth: 120, alignItems: 'flex-end' },
  motivazione: { fontSize: 11, color: 'var(--text-muted)', maxWidth: 160, textAlign: 'right', lineHeight: 1.4 },
  actions: { display: 'flex', flexDirection: 'column', gap: 6 },
  btnConferma: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 13 },
  btnRifiuta: { background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 13 },
  statoBadge: { borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modalBox: { background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border-color)', width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' },
  modalHeader: { padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { margin: 0, fontSize: 18, fontWeight: 700, color: '#f87171' },
  modalCloseBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 20, cursor: 'pointer' },
  modalText: { padding: '16px 24px', margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 },
  modalList: { padding: '0 24px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 },
  modalItem: { background: 'var(--app-bg)', padding: '14px 18px', borderRadius: 12, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  modalFooter: { padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', background: 'var(--app-bg)', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  btnChiudiModal: { background: 'var(--border-color)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 13 },
  btnAction: { background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' },
};

function MovimentoOrfanoCard({ mov, onInserisci }) {
  return (
    <div style={{ ...styles.card, borderColor: '#ef444440', background: '#ef444408', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 11, color: '#f87171', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} /> MOVIMENTO IN USCITA SENZA FATTURA
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{mov.causale || '—'}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {formattaData(mov.data_movimento)}</span>
          <span>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Building2 size={12} /> {mov.fornitore_rilevato || 'Fornitore non rilevato'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 18 }}>
          -€ {Math.abs(mov.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
        </span>
        <button style={styles.btnAction} onClick={onInserisci}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Inserisci Spesa / Fattura
          </span>
        </button>
      </div>
    </div>
  );
}
