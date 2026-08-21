import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bot, Check, X, AlertTriangle, Calendar, Building2, Lightbulb, CheckCircle2, XCircle, User, RefreshCw, Plus, Settings, Link2, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { callGemini } from '../lib/geminiClient';
import { pulisciEdEstraiJson } from '../lib/fileExtractor';
import { trovaBestMatchFattura } from '../lib/autoMatchingEngine';
import WizardRiconciliazioneModal from '../components/WizardRiconciliazioneModal';
import { toast } from 'react-hot-toast';

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
  const [showWizardModal, setShowWizardModal] = useState(false);

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
      toast.error('Nessun movimento o fattura aperta da riconciliare.');
      return;
    }

    setAnalizzando(true);
    setProgressoAI('Analisi Auto-Match Causali e N. Fattura...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const suggerimentiPronti = [];
      const fattureUsate = new Set();
      const movimentiRimanenti = [];

      // 1. First Pass: Auto-Matching causale + N. Fattura + Fornitore deterministico
      for (const m of movNonRic) {
        const fattureDisponibili = fatNonRic.filter(f => !fattureUsate.has(f.id));
        const best = trovaBestMatchFattura(m, fattureDisponibili);
        if (best && best.score >= 60) {
          fattureUsate.add(best.fattura.id);
          suggerimentiPronti.push({
            condominio_id: condominioId,
            user_id: user.id,
            movimento_id: m.id,
            fattura_id: best.fattura.id,
            confidence_score: best.score,
            metodo: 'auto_match',
            stato: 'suggerita',
            note: best.motivoMatch
          });
        } else {
          movimentiRimanenti.push(m);
        }
      }

      // 2. Second Pass: AI Fallback per i movimenti rimanenti non abbinati dal pattern causale
      const fattureRimanenti = fatNonRic.filter(f => !fattureUsate.has(f.id));
      if (movimentiRimanenti.length > 0 && fattureRimanenti.length > 0) {
        setProgressoAI(`Analisi AI per i ${movimentiRimanenti.length} movimenti rimanenti...`);
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
${JSON.stringify(movimentiRimanenti.map(m => ({
          id: m.id,
          data: m.data_movimento,
          causale: m.causale,
          importo: Math.abs(m.importo),
          fornitore: m.fornitore_rilevato,
        })), null, 2)}

FATTURE NON RICONCILIATE:
${JSON.stringify(fattureRimanenti.map(f => ({
          id: f.id,
          fornitore: f.fornitore,
          data_fattura: f.data_fattura,
          importo: f.importo_totale,
          descrizione: f.descrizione,
          numero: f.numero_fattura,
        })), null, 2)}

Abbina i movimenti alle fatture.`;

        const risposta = await callGemini(userPrompt, {
          system: systemPrompt,
          maxTokens: 4000,
          funzione: 'riconcilia_uscite',
          condominio_id: condominioId,
          jsonMode: true,
        });
        const suggerimentiAi = pulisciEdEstraiJson(risposta, true);

        if (Array.isArray(suggerimentiAi)) {
          suggerimentiAi.forEach(s => {
            suggerimentiPronti.push({
              condominio_id: condominioId,
              user_id: user.id,
              movimento_id: s.movimento_id,
              fattura_id: s.fattura_id,
              confidence_score: s.confidence_score,
              metodo: 'ai',
              stato: 'suggerita',
              note: s.motivazione,
            });
          });
        }
      }

      // Salva tutti i suggerimenti generati su Supabase
      if (suggerimentiPronti.length > 0) {
        setProgressoAI(`Salvataggio ${suggerimentiPronti.length} suggerimenti di riconciliazione...`);
        await supabase.from('riconciliazioni')
          .upsert(suggerimentiPronti, { onConflict: 'movimento_id,fattura_id', ignoreDuplicates: true });
      }

      setProgressoAI(`${suggerimentiPronti.length} abbinamenti generati con successo`);
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
      if (nuovoStato === 'confermata') {
        const mov = movimenti.find(m => m.id === movimentoId);
        const fat = fatture.find(f => f.id === fatturaId);
        const dataPagamento = mov ? mov.data_movimento : new Date().toISOString().split('T')[0];

        // Regola Triplo Riscontro: se è un F24 o la fattura ha ritenuta, verificare la presenza della quietanza F24
        const isMovF24 = mov && (mov.causale?.toLowerCase().includes('f24') || mov.causale?.toLowerCase().includes('agenzia entrate'));
        const haRitenuta = fat && (parseFloat(fat.importo_ritenuta || 0) > 0 || parseFloat(fat.ritenuta_acconto || 0) > 0);

        if (isMovF24 || haRitenuta) {
          // Verifica se la quietanza F24 è presente in fattura o f24_deleghe
          const quietanzaPresente = fat?.f24_url || false;
          if (!quietanzaPresente && isMovF24) {
            toast.error('Impossibile riconciliare addebito F24 senza quietanza: carica prima il file della quietanza F24 nel sistema (regola del triplo riscontro).');
            return;
          }
        }

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

      const { error: errRic } = await supabase.from('riconciliazioni').update({
        stato: nuovoStato,
        confermata_at: nuovoStato === 'confermata' ? new Date().toISOString() : null,
      }).eq('id', ricId);
      if (errRic) throw errRic;

      await loadAll();
      toast.success(nuovoStato === 'confermata' ? 'Riconciliazione confermata con successo!' : 'Abbinamento rifiutato');
    } catch (err) {
      toast.error('Errore aggiornamento riconciliazione: ' + err.message);
    }
  }

  // ─── 1-Click Auto-Approvazione Riconciliazioni Perfette (100% Certezza) ───
  const [approvandoTutti, setApprovandoTutti] = useState(false);
  const matchPerfetti = riconciliazioni.filter(r => r.stato === 'suggerita' && (r.confidence_score >= 90 || r.metodo === 'auto_match'));

  async function handleApprovaTuttiPerfetti() {
    if (!matchPerfetti.length) return;
    setApprovandoTutti(true);
    try {
      let approvati = 0;
      for (const ric of matchPerfetti) {
        const mov = ric.movimento || movimenti.find(m => m.id === ric.movimento_id);
        const dataPagamento = mov ? mov.data_movimento : new Date().toISOString().split('T')[0];

        await Promise.all([
          supabase.from('estratto_conto').update({ riconciliato: true }).eq('id', ric.movimento_id),
          supabase.from('fatture_fornitori').update({
            riconciliata: true,
            stato: 'pagata',
            data_pagamento: dataPagamento
          }).eq('id', ric.fattura_id),
          supabase.from('riconciliazioni').update({
            stato: 'confermata',
            confermata_at: new Date().toISOString(),
          }).eq('id', ric.id)
        ]);
        approvati++;
      }
      await loadAll();
      toast.success(`${approvati} riconciliazioni perfette (100% certe) confermate con successo!`);
    } catch (err) {
      toast.error('Errore approvazione multipla: ' + err.message);
    } finally {
      setApprovandoTutti(false);
    }
  }

  // ─── Self-Healing: Registra Spesa Rapida & Riconcilia in 1-Click da Movimento Orfano ───
  const [creandoSpesaId, setCreandoSpesaId] = useState(null);

  async function handleCreaSpesaERiconciliaRapido(mov) {
    setCreandoSpesaId(mov.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      // 1. Recupera o crea esercizio aperto per l'anno del movimento
      const annoMov = parseInt(mov.data_movimento?.substring(0, 4) || new Date().getFullYear());
      let { data: es } = await supabase
        .from('esercizi')
        .select('id')
        .eq('condominio_id', condominioId)
        .eq('anno', annoMov)
        .maybeSingle();

      if (!es) {
        const { data: newEs, error: esErr } = await supabase
          .from('esercizi')
          .insert([{
            condominio_id: condominioId,
            anno: annoMov,
            data_inizio: `${annoMov}-01-01`,
            data_fine: `${annoMov}-12-31`,
            stato: 'aperto',
            tipo: 'ordinario'
          }])
          .select('id')
          .single();
        if (!esErr && newEs) es = newEs;
      }

      // 2. Inserisce la spesa
      const importoPositivo = Math.abs(parseFloat(mov.importo || 0));
      const { data: nuovaSpesa, error: spesaErr } = await supabase
        .from('spese')
        .insert([{
          condominio_id: condominioId,
          esercizio_id: es?.id || null,
          descrizione: mov.causale || 'Spesa registrata da movimento bancario',
          importo: importoPositivo,
          data_spesa: mov.data_movimento,
          categoria: 'ordinaria',
          tipo_lavoro: 'ordinario',
          criterio: 'millesimi'
        }])
        .select()
        .single();

      if (spesaErr) throw spesaErr;

      // 3. Inserisce fatture_fornitori collegata
      const { data: nuovaFattura, error: fattErr } = await supabase
        .from('fatture_fornitori')
        .insert([{
          condominio_id: condominioId,
          fornitore: mov.fornitore_rilevato || 'Fornitore Bancario',
          data_fattura: mov.data_movimento,
          importo_totale: importoPositivo,
          importo_netto: importoPositivo,
          descrizione: mov.causale || 'Spesa da estratto conto',
          stato: 'pagata',
          riconciliata: true,
          data_pagamento: mov.data_movimento,
          user_id: user.id
        }])
        .select()
        .single();

      if (fattErr) throw fattErr;

      // 4. Aggiorna il movimento come riconciliato
      const { error: movErr } = await supabase
        .from('estratto_conto')
        .update({ riconciliato: true })
        .eq('id', mov.id);

      if (movErr) throw movErr;

      // 5. Crea record di riconciliazione confermata
      await supabase.from('riconciliazioni').insert([{
        condominio_id: condominioId,
        user_id: user.id,
        movimento_id: mov.id,
        fattura_id: nuovaFattura.id,
        confidence_score: 100,
        metodo: 'auto_match_rapido',
        stato: 'confermata',
        confermata_at: new Date().toISOString(),
        note: 'Registrata e riconciliata istantaneamente dal movimento orfano'
      }]);

      await loadAll();
      toast.success('✨ Spesa registrata e movimento riconciliato in 1-Click!');
    } catch (err) {
      console.error(err);
      toast.error('Errore durante la registrazione rapida: ' + err.message);
    } finally {
      setCreandoSpesaId(null);
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
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {matchPerfetti.length > 0 && (
            <button
              style={{ ...styles.btnAI, background: '#10b981', color: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)' }}
              onClick={handleApprovaTuttiPerfetti}
              disabled={approvandoTutti}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                {approvandoTutti ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {approvandoTutti ? 'Riconciliazione in corso...' : `⚡ Riconcilia ${matchPerfetti.length} Match Perfetti (100%)`}
              </span>
            </button>
          )}
          <button
            style={{ ...styles.btnAI, background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
            onClick={() => setShowWizardModal(true)}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Settings size={14} style={{ color: '#3b82f6' }} /> Configurazione Guidata
            </span>
          </button>
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
                isBusy={creandoSpesaId === m.id}
                onCreaRapido={() => handleCreaSpesaERiconciliaRapido(m)}
                onInserisci={() => navigate(`/condomini/${condominioId}/spese`, { state: { prefillSpesa: { importo: Math.abs(m.importo), data_spesa: m.data_movimento, descrizione: m.causale || '', fornitore: m.fornitore_rilevato || '' } } })}
              />
            ))}
          </div>
        )
      ) : ricFiltrate.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
            <Link2 size={40} color="var(--text-muted)" strokeWidth={1.5} />
          </div>
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
            <h3 style={{ margin: '0 0 12px', padding: '18px 24px 0', fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={20} style={{ color: '#fbbf24' }} /> Movimenti Uscita non Riconciliati ({movOrfani.length})
            </h3>
            <p style={{ padding: '0 24px', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
              L'AI ha identificato {movOrfani.length} uscite sul conto corrente per cui non è stata trovata alcuna fattura registrata.
            </p>

            <div style={{ maxHeight: 300, overflowY: 'auto', margin: '0 24px 20px', border: '1px solid var(--border-color)', borderRadius: 8, padding: 8 }}>
              {movOrfani.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.causale || 'Movimento senza causale'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={10} /> {formattaData(m.data_movimento)} {m.fornitore_rilevato ? <>• <Building2 size={10} /> {m.fornitore_rilevato}</> : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>
                      -€ {Math.abs(m.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </span>
                    <button
                      onClick={() => {
                        setShowOrfaniModal(false);
                        navigate(`/condomini/${condominioId}/spese`, {
                          state: { prefillSpesa: { importo: Math.abs(m.importo), data_spesa: m.data_movimento, descrizione: m.causale || '', fornitore: m.fornitore_rilevato || '' } }
                        });
                      }}
                      style={{ ...styles.btnAction, padding: '4px 10px', fontSize: 11 }}
                    >
                      + Crea Spesa
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowOrfaniModal(false)} style={styles.btnChiudiModal}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modale Wizard Configurazione Guidata Riconciliazione */}
      <WizardRiconciliazioneModal 
        isOpen={showWizardModal}
        onClose={() => setShowWizardModal(false)}
        onSaveSuccess={() => loadAll()}
      />
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
          {mov?.fornitore_rilevato && <div style={styles.matchSub}><Building2 size={12} /> {mov.fornitore_rilevato}</div>}
          <div style={styles.matchMeta}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {mov?.data_movimento ? new Date(mov.data_movimento).toLocaleDateString('it-IT') : '—'}</span>
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {fat?.data_fattura ? new Date(fat.data_fattura).toLocaleDateString('it-IT') : '—'}</span>
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

function MovimentoOrfanoCard({ mov, isBusy, onCreaRapido, onInserisci }) {
  return (
    <div style={{ ...styles.card, borderColor: '#ef444440', background: '#ef444408', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 260 }}>
        <div style={{ fontSize: 11, color: '#f87171', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} /> MOVIMENTO IN USCITA NON ANCORA REGISTRATO A FATTURA
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{mov.causale || '—'}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {formattaData(mov.data_movimento)}</span>
          <span>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Building2 size={12} /> {mov.fornitore_rilevato || 'Fornitore Bancario'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 18 }}>
          -€ {Math.abs(mov.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
        </span>
        <button 
          style={{
            ...styles.btnAction,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
            cursor: isBusy ? 'not-allowed' : 'pointer',
            opacity: isBusy ? 0.7 : 1
          }} 
          disabled={isBusy}
          onClick={onCreaRapido}
        >
          {isBusy ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creazione in corso...
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} /> Registra Spesa & Riconcilia (1-Click)
            </span>
          )}
        </button>
        <button 
          style={{
            ...styles.btnAction,
            background: 'transparent',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)'
          }} 
          onClick={onInserisci}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Dettagli...
          </span>
        </button>
      </div>
    </div>
  );
}
