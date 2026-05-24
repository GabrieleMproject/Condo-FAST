import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { callClaude } from '../lib/claudeClient';

export default function RiconciliazioniPage() {
  const { condominioId } = useParams();

  const [movimenti, setMovimenti] = useState([]);
  const [fatture, setFatture] = useState([]);
  const [riconciliazioni, setRiconciliazioni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analizzando, setAnalizzando] = useState(false);
  const [progressoAI, setProgressoAI] = useState('');
  const [filtroStato, setFiltroStato] = useState('suggerita');

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
      const risposta = await callClaude(systemPrompt, userPrompt, { max_tokens: 2048 });
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
      setTimeout(() => setProgressoAI(''), 4000);
    } catch (e) {
      setProgressoAI('Errore: ' + e.message);
    } finally {
      setAnalizzando(false);
    }
  }

  // ─── Conferma / rifiuta ──────────────────────────────────────
  async function aggiornaStato(ricId, nuovoStato, movimentoId, fatturaId) {
    await supabase.from('riconciliazioni').update({
      stato: nuovoStato,
      confermata_at: nuovoStato === 'confermata' ? new Date().toISOString() : null,
    }).eq('id', ricId);

    if (nuovoStato === 'confermata') {
      // Segna movimento e fattura come riconciliati
      await Promise.all([
        supabase.from('estratto_conto').update({ riconciliato: true }).eq('id', movimentoId),
        supabase.from('fatture_fornitori').update({ riconciliata: true }).eq('id', fatturaId),
      ]);
    }

    await loadAll();
  }

  // ─── Filtro ──────────────────────────────────────────────────
  const ricFiltrate = filtroStato ? riconciliazioni.filter(r => r.stato === filtroStato) : riconciliazioni;

  const kpiSuggerite = riconciliazioni.filter(r => r.stato === 'suggerita').length;
  const kpiConfermate = riconciliazioni.filter(r => r.stato === 'confermata').length;
  const kpiRifiutate = riconciliazioni.filter(r => r.stato === 'rifiutata').length;
  const movDaRic = movimenti.filter(m => !m.riconciliato).length;

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#475569', fontFamily: "'Sora', sans-serif" }}>Caricamento...</div>;

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
          {analizzando ? '⏳ Analisi...' : '🤖 Avvia Analisi AI'}
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
          { label: 'Rifiutati', value: kpiRifiutate, color: '#64748b' },
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
          { val: '', label: 'Tutti' },
          { val: 'suggerita', label: '🤖 Da confermare' },
          { val: 'confermata', label: '✓ Confermati' },
          { val: 'rifiutata', label: '✕ Rifiutati' },
        ].map(({ val, label }) => (
          <button
            key={val}
            style={{ ...styles.tBtn, ...(filtroStato === val ? styles.tBtnActive : {}) }}
            onClick={() => setFiltroStato(val)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {ricFiltrate.length === 0 ? (
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
        <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 2 }}>
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
          <div style={styles.motivazione}>💡 {ric.note}</div>
        )}

        {ric.stato === 'suggerita' && (
          <div style={styles.actions}>
            <button style={styles.btnConferma} onClick={onConferma}>✓ Conferma</button>
            <button style={styles.btnRifiuta} onClick={onRifiuta}>✕ Rifiuta</button>
          </div>
        )}

        {ric.stato === 'confermata' && (
          <span style={{ ...styles.statoBadge, background: '#16a34a20', color: '#16a34a' }}>
            ✓ Confermata {ric.confermata_at ? new Date(ric.confermata_at).toLocaleDateString('it-IT') : ''}
          </span>
        )}

        {ric.stato === 'rifiutata' && (
          <span style={{ ...styles.statoBadge, background: '#64748b20', color: '#64748b' }}>
            ✕ Rifiutata
          </span>
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
  kpiCard: { flex: '1 1 140px', background: '#1e293b', borderRadius: 12, padding: '16px 20px', border: '1px solid #334155' },
  kpiVal: { fontSize: 24, fontWeight: 700 },
  kpiLabel: { fontSize: 11, color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' },
  toolbar: { display: 'flex', gap: 4, marginBottom: 16, background: '#1e293b', borderRadius: 8, padding: 2, flexWrap: 'wrap' },
  tBtn: { background: 'none', border: 'none', color: '#64748b', padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontSize: 13, fontWeight: 600, transition: 'all 0.2s' },
  tBtnActive: { background: '#2563eb', color: '#fff' },
  empty: { textAlign: 'center', padding: 60, color: '#475569' },
  lista: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    background: '#1e293b', borderRadius: 14, border: '1px solid #334155',
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
};
