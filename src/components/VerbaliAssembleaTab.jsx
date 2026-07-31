import { useEffect, useRef, useState, useMemo } from 'react'
import { useDocumenti } from '../hooks/useDocumenti'
import { usePlan } from '../hooks/usePlan'
import UpgradeTeaserModal from './UpgradeTeaserModal'
import { callGemini } from '../lib/geminiClient'
import { 
  FileSignature, Search, Sparkles, Paperclip, CheckCircle2, 
  AlertTriangle, Trash2, Calendar, FileText, Loader2, X, Plus,
  Lock, Clock, ShieldCheck, ArrowRight
} from 'lucide-react'

// Elenco di stop words italiane comuni per l'estrazione delle parole chiave
const STOP_WORDS = new Set([
  'cosa', 'come', 'dove', 'quando', 'perche', 'chi', 'che', 'del', 'della', 'dello', 
  'dei', 'degli', 'delle', 'al', 'alla', 'allo', 'ai', 'agli', 'alle', 'dal', 'dalla', 
  'dallo', 'dai', 'dagli', 'dalle', 'nel', 'nella', 'nello', 'nei', 'negli', 'nelle', 
  'sul', 'sulla', 'sullo', 'sui', 'sugli', 'sulle', 'col', 'coi', 'per', 'con', 'su', 
  'tra', 'fra', 'un', 'una', 'uno', 'il', 'lo', 'la', 'i', 'gli', 'le', 'e', 'o', 'a', 
  'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'sono', 'stato', 'stata', 'stati', 
  'state', 'era', 'erano', 'aveva', 'avevano', 'deciso', 'delibera', 'deliberato', 
  'votazione', 'voto', 'assemblea', 'verbale', 'condominio', 'condomini', 'amministratore',
  'maggioranza', 'unanimita', 'favorevoli', 'contrari', 'astenuti'
]);

function estraiKeyword(testo) {
  return testo
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?\"]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

// Suddivide il testo in paragrafi e tiene solo quelli che contengono le keyword,
// includendo anche il paragrafo precedente e successivo come contesto per l'AI.
function filtraContestoOttimizzato(verbali, query, forceAll = false) {
  const keywords = estraiKeyword(query);
  
  if (keywords.length === 0 || forceAll) {
    return {
      verbaliFiltrati: verbali.map(v => ({
        id: v.id,
        nome: v.nome,
        data_documento: v.data_documento,
        testo_estratto: v.testo_estratto
      })),
      metodo: forceAll ? 'full_text_forzato' : 'full_text_default',
      keywords,
      risparmioPercentuale: 0
    };
  }

  const verbaliFiltrati = [];
  let totalCharsOriginal = 0;
  let totalCharsOptimized = 0;

  for (const verbale of verbali) {
    if (!verbale.testo_estratto) continue;
    
    const originalText = verbale.testo_estratto;
    totalCharsOriginal += originalText.length;
    
    // Suddividiamo il testo in paragrafi basandoci su doppi a capo
    const paragrafi = originalText.split(/\n\s*\n/);
    const paragrafiSelezionati = new Set();
    
    for (let i = 0; i < paragrafi.length; i++) {
      const p = paragrafi[i].toLowerCase();
      const match = keywords.some(kw => p.includes(kw));
      if (match) {
        // Aggiungiamo il paragrafo precedente, quello corrente e quello successivo per dare contesto
        if (i > 0) paragrafiSelezionati.add(i - 1);
        paragrafiSelezionati.add(i);
        if (i < paragrafi.length - 1) paragrafiSelezionati.add(i + 1);
      }
    }
    
    if (paragrafiSelezionati.size > 0) {
      // Ordiniamo gli indici dei paragrafi e uniamo il testo
      const indiciOrdinati = Array.from(paragrafiSelezionati).sort((a, b) => a - b);
      const blocchiTesto = [];
      let lastIndex = -2;
      
      for (const idx of indiciOrdinati) {
        if (lastIndex !== -2 && idx > lastIndex + 1) {
          blocchiTesto.push('[...]'); // Indica un salto nel testo per l'AI
        }
        blocchiTesto.push(paragrafi[idx]);
        lastIndex = idx;
      }
      
      const optimizedText = blocchiTesto.join('\n\n');
      totalCharsOptimized += optimizedText.length;
      
      verbaliFiltrati.push({
        id: verbale.id,
        nome: verbale.nome,
        data_documento: verbale.data_documento,
        testo_estratto: optimizedText
      });
    }
  }

  const risparmioPercentuale = totalCharsOriginal > 0 
    ? Math.round(((totalCharsOriginal - totalCharsOptimized) / totalCharsOriginal) * 100)
    : 0;

  return {
    verbaliFiltrati,
    metodo: 'keyword_chunks',
    keywords,
    risparmioPercentuale
  };
}

const formattaDataAi = (d) => {
  if (!d) return '';
  const parsed = new Date(d);
  return !isNaN(parsed.getTime()) ? parsed.toLocaleDateString('it-IT') : d;
};

export default function VerbaliAssembleaTab({ condominioId }) {
  const { canUse } = usePlan();
  const [showStudioPaywall, setShowStudioPaywall] = useState(false);
  const { documenti, loading, error, fetch, upload, remove, getSignedUrl } = useDocumenti(condominioId);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  
  // Campi form caricamento
  const [form, setForm] = useState({ nome: '', note: '', data_documento: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef();

  // Stati della ricerca AI
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [selectedVerbaliIds, setSelectedVerbaliIds] = useState(new Set());
  const [optimizationLog, setOptimizationLog] = useState(null);
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filtra solo i documenti di tipo "verbale"
  const verbali = useMemo(() => {
    return documenti
      .filter(d => d.tipo === 'verbale')
      .sort((a, b) => {
        // Ordina per data documento decrescente, altrimenti per data inserimento
        if (a.data_documento && b.data_documento) {
          return new Date(b.data_documento) - new Date(a.data_documento);
        }
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [documenti]);

  // Sincronizza i verbali selezionati per la ricerca all'avvio
  useEffect(() => {
    fetch();
  }, [fetch]);

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (verbali.length > 0 && !hasInitialized.current) {
      setSelectedVerbaliIds(new Set(verbali.map(v => v.id)));
      hasInitialized.current = true;
    }
  }, [verbali]);

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedVerbaliIds(new Set(verbali.map(v => v.id)));
    } else {
      setSelectedVerbaliIds(new Set());
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedVerbaliIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (!form.nome) {
      setForm(f => ({ ...f, nome: file.name.replace(/\.[^.]+$/, '') }));
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || !form.data_documento) return;
    
    setUploading(true);
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    setUploadProgress(
      ext === 'pdf' || ext === 'docx'
        ? 'Analisi ed estrazione testo in corso (AI)...'
        : 'Caricamento file...'
    );

    try {
      const res = await upload(selectedFile, 'verbale', form.nome, form.note, form.data_documento);
      if (res?.data?.id) {
        setSelectedVerbaliIds(prev => {
          const next = new Set(prev);
          next.add(res.data.id);
          return next;
        });
      }
      setShowUploadModal(false);
      setForm({ nome: '', note: '', data_documento: '' });
      setSelectedFile(null);
      setUploadProgress('');
    } catch (err) {
      alert('Errore caricamento verbale: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc) => {
    try {
      await remove(doc);
      setConfirmDelete(null);
      setSelectedVerbaliIds(prev => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    } catch (err) {
      alert('Errore eliminazione verbale: ' + err.message);
    }
  };

  const handleOpen = async (doc) => {
    const newWindow = window.open('about:blank', '_blank');
    if (!newWindow) {
      alert('Abilita i popup per visualizzare il file.');
      return;
    }
    try {
      const url = await getSignedUrl(doc.url_storage);
      if (url) {
        newWindow.location.href = url;
      } else {
        throw new Error("Impossibile generare l'URL firmato");
      }
    } catch (err) {
      console.error("Errore handleOpen:", err);
      newWindow.close();
      alert('Impossibile aprire il verbale');
    }
  };

  // Esegue la ricerca AI
  const handleAiSearch = async (forceAll = false) => {
    if (!canUse('ricerca_verbali_ai')) {
      setShowStudioPaywall(true);
      return;
    }
    if (!query.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setOptimizationLog(null);

    try {
      // 1. Filtra i verbali selezionati dall'utente
      const verbaliDaCercare = verbali.filter(v => selectedVerbaliIds.has(v.id));
      
      if (verbaliDaCercare.length === 0) {
        throw new Error('Seleziona almeno un verbale su cui effettuare la ricerca.');
      }

      // 2. Applica l'ottimizzatore di contesto basato su parole chiave
      let optimized = filtraContestoOttimizzato(
        verbaliDaCercare, 
        query, 
        forceAll
      );

      // Fallback automatico se non ci sono corrispondenze di keyword e non abbiamo forzato la ricerca globale
      if (optimized.verbaliFiltrati.length === 0 && !forceAll && optimized.keywords.length > 0) {
        optimized = filtraContestoOttimizzato(verbaliDaCercare, query, true);
        optimized.metodo = 'full_text_fallback_automatico';
      }

      const { verbaliFiltrati, metodo, risparmioPercentuale } = optimized;

      // 3. Prepara il prompt per Gemini
      const systemPrompt = `Sei un assistente virtuale esperto di gestione condominiale CondoFAST. Rispondi alle domande dell'amministratore basandoti ESCLUSIVAMENTE sui verbali delle assemblee forniti.

Domanda dell'amministratore:
"${query}"

Istruzioni per la risposta:
1. Fornisci una risposta precisa, chiara ed esclusivamente in italiano.
2. Cita esplicitamente il nome del verbale e la data in cui si fa riferimento all'informazione trovata.
3. Seleziona una citazione testuale breve (una frase o un paragrafo chiave) dal verbale che dimostri o provi la decisione presa, consentendo all'amministratore un riscontro visivo.
4. Se nel testo fornito non ci sono informazioni utili a rispondere alla domanda, rispondi impostando "trovato" a false nel JSON e spiegando nella "risposta" che l'argomento non è stato rinvenuto nei documenti analizzati.
5. Rispondi ESCLUSIVAMENTE in formato JSON valido, senza testi prima o dopo, senza blocchi di codice markdown (\`\`\`json).

Formato JSON atteso:
{
  "risposta": "Testo dettagliato della risposta contabile/legale...",
  "trovato": true,
  "riferimenti": [
    {
      "documento_nome": "Nome del verbale",
      "documento_data": "YYYY-MM-DD o data del verbale",
      "citazione": "La citazione esatta presente nel testo del verbale"
    }
  ]
}`;

      // Costruiamo il contesto testuale dei verbali
      const contestoVerbaliText = verbaliFiltrati
        .map(v => {
          const dataLabel = v.data_documento ? new Date(v.data_documento).toLocaleDateString('it-IT') : 'data non indicata';
          return `--- VERBALE: ${v.nome} (Assemblea del ${dataLabel}) ---\n${v.testo_estratto || 'Nessun testo estratto per questo verbale.'}`;
        })
        .join('\n\n========================================\n\n');

      const userPrompt = `Verbali ed estratti di testo disponibili per l'analisi:\n\n${contestoVerbaliText}\n\nRispondi alla domanda: "${query}" in formato JSON strutturato.`;

      // 4. Chiamata a Gemini
      const rispostaRaw = await callGemini(userPrompt, {
        system: systemPrompt,
        maxTokens: 1500,
        funzione: 'ricerca_verbali_ai',
        condominio_id: condominioId
      });

      // 5. Parsing del JSON
      let result;
      try {
        const cleanJson = rispostaRaw.replace(/```json|```/g, '').trim();
        result = JSON.parse(cleanJson);
      } catch (err) {
        console.error('Errore parsing JSON risposta Gemini:', err, rispostaRaw);
        result = {
          risposta: rispostaRaw,
          trovato: rispostaRaw.toLowerCase().includes('non ho trovato') ? false : true,
          riferimenti: []
        };
      }

      setSearchResult(result);
      setOptimizationLog({
        metodo,
        risparmioPercentuale,
        numVerbaliInviati: verbaliFiltrati.length,
        numVerbaliTotali: verbaliDaCercare.length
      });

    } catch (err) {
      alert('Errore durante la ricerca AI: ' + err.message);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ padding: '24px 0', fontFamily: 'Sora, sans-serif' }}>
      
      {/* Header */}
      <div style={S.header}>
        <div>
          <h3 style={S.sectionTitle}>Verbali delle Assemblee</h3>
          <p style={S.sectionSubTitle}>
            Gestisci lo storico dei verbali di assemblea e interroga l'AI per trovare delibere e accordi passati.
          </p>
        </div>
        <button onClick={() => setShowUploadModal(true)} style={S.btnPrimary}>
          <Plus size={16} /> Carica verbale
        </button>
      </div>

      <div style={{ ...S.mainGrid, gridTemplateColumns: isLargeScreen ? '4.5fr 5.5fr' : '1fr' }}>
        
        {/* Colonna di sinistra: Lista verbali */}
        <div style={S.leftColumn}>
          <div style={S.cardHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileSignature size={18} color="#60a5fa" />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Archivio Verbali ({verbali.length})</span>
            </div>
            {verbali.length > 0 && (
              <label style={S.selectAllLabel}>
                <input 
                  type="checkbox"
                  checked={selectedVerbaliIds.size === verbali.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                Seleziona tutti
              </label>
            )}
          </div>

          {loading && !verbali.length ? (
            <div style={S.loadingState}>Caricamento verbali...</div>
          ) : verbali.length === 0 ? (
            <div style={S.emptyState}>
              <FileSignature size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Nessun verbale presente in questo condominio.</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Carica i verbali in formato PDF o DOCX per abilitare la ricerca AI.
              </p>
            </div>
          ) : (
            <div style={S.verbaliList}>
              {verbali.map(verb => {
                const hasText = !!verb.testo_estratto;
                const isSelected = selectedVerbaliIds.has(verb.id);
                return (
                  <div key={verb.id} style={{
                    ...S.verbaleRow,
                    border: isSelected ? '1px solid rgba(37, 99, 235, 0.5)' : '1px solid var(--border-color)',
                    background: isSelected ? 'rgba(37, 99, 235, 0.03)' : 'var(--card-bg)'
                  }}>
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(verb.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    
                    <div style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={S.verbName}>{verb.nome}</span>
                        {hasText ? (
                          <span style={S.badgeSuccess} title="Il testo del verbale è stato estratto e indicizzato per la ricerca AI">
                            <CheckCircle2 size={11} /> Testo pronto
                          </span>
                        ) : (
                          <span style={S.badgeWarning} title="Il testo non è stato estratto. I PDF digitali o i file DOCX sono necessari per la ricerca AI.">
                            <AlertTriangle size={11} /> Solo file
                          </span>
                        )}
                      </div>
                      <div style={S.verbMeta}>
                        <Calendar size={12} style={{ marginRight: 4 }} />
                        <span>Assemblea del {verb.data_documento ? new Date(verb.data_documento).toLocaleDateString('it-IT') : '—'}</span>
                        {verb.note && <span style={{ marginLeft: 8 }}>· {verb.note}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
                      <button onClick={() => handleOpen(verb)} style={S.btnRowAction}>Apri</button>
                      <button onClick={() => setConfirmDelete(verb)} style={S.btnRowDelete}>×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Colonna di destra: Ricerca AI */}
        <div style={S.rightColumn}>
          {!canUse('ricerca_verbali_ai') ? (
            /* Banner Teaser In-page per Utenti Piano Base */
            <div style={{
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(37, 99, 235, 0.08) 100%)',
              border: '1px solid rgba(124, 58, 237, 0.3)', borderRadius: 16, padding: 24,
              display: 'flex', flexDirection: 'column', gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(124, 58, 237, 0.15)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a78bfa' }}>
                      Assistente AI Verbali
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 1 }}>
                      Ricerca & Analisi Delibere AI
                    </div>
                  </div>
                </div>
                <span style={{
                  fontSize: 10, background: 'rgba(124, 58, 237, 0.2)', color: '#a78bfa',
                  border: '1px solid rgba(124, 58, 237, 0.4)', padding: '3px 10px', borderRadius: 12,
                  fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4
                }}>
                  <Lock size={10} /> PIANO STUDIO
                </span>
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Risparmia fino al <strong>90% del tempo di consultazione</strong> per individuare delibere, quote di spesa e accordi passati nei verbali delle assemblee.
              </div>

              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Clock size={16} style={{ color: '#34d399', flexShrink: 0 }} />
                  <span><strong>Azzeramento ricerche manuali:</strong> l'AI legge centinaia di pagine PDF e DOCX in pochi secondi.</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle2 size={16} style={{ color: '#34d399', flexShrink: 0 }} />
                  <span><strong>Prova esatta delibera:</strong> citazione del paragrafo, verbale e data di riferimento.</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ShieldCheck size={16} style={{ color: '#34d399', flexShrink: 0 }} />
                  <span><strong>Risposte chiare per il contenzioso:</strong> riscontri immediati per condòmini ed avvocati.</span>
                </div>
              </div>

              <a
                href="/impostazioni#piani-abbonamento"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: '#fff',
                  textDecoration: 'none', borderRadius: 10, padding: '12px 20px',
                  fontSize: 13.5, fontWeight: 700, marginTop: 4,
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)'
                }}
              >
                <span>Passa al Piano Studio (169€/m)</span>
                <ArrowRight size={16} />
              </a>
            </div>
          ) : (
            <div style={S.aiSearchCard}>
              <div style={S.aiCardHeader}>
                <Sparkles size={18} color="#10b981" />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Ricerca AI nei Verbali</span>
              </div>

              <p style={S.aiHelpText}>
                Fai una domanda sulle decisioni prese nelle assemblee precedenti. L'AI cercherà nei testi dei verbali selezionati a sinistra.
              </p>

              <div style={S.searchBoxContainer}>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Es: Cosa è stato deliberato riguardo al cambio del cancello e alla ripartizione della spesa?"
                  rows={3}
                  style={S.searchTextArea}
                  disabled={searching}
                />
                <div style={S.searchActions}>
                  <span style={S.selectedCount}>
                    Cerca in: <strong>{selectedVerbaliIds.size}</strong> verbali
                  </span>
                  <button 
                    onClick={() => handleAiSearch(false)} 
                    disabled={searching || !query.trim() || selectedVerbaliIds.size === 0}
                    style={{
                      ...S.btnSearch,
                      opacity: (searching || !query.trim() || selectedVerbaliIds.size === 0) ? 0.6 : 1,
                      cursor: (searching || !query.trim() || selectedVerbaliIds.size === 0) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {searching ? (
                      <>
                        <Loader2 size={15} className="spinner" style={{ marginRight: 6 }} />
                        Ricerca...
                      </>
                    ) : (
                      <>
                        <Search size={15} style={{ marginRight: 6 }} />
                        Chiedi all'AI
                      </>
                    )}
                  </button>
                </div>
              </div>

            {/* Informazioni Ottimizzazione Costi */}
            {optimizationLog && (
              <div style={{
                ...S.optimizationBadge,
                background: optimizationLog.metodo === 'keyword_chunks' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(96, 165, 250, 0.08)',
                borderColor: optimizationLog.metodo === 'keyword_chunks' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(96, 165, 250, 0.2)',
              }}>
                {optimizationLog.metodo === 'keyword_chunks' ? (
                  <>
                    <Zap size={14} style={{ color: '#10b981', display: 'inline', marginRight: 4 }} /> <strong>Ottimizzazione attiva:</strong> analizzati solo i paragrafi pertinenti ({optimizationLog.numVerbaliInviati}/{optimizationLog.numVerbaliTotali} verbali).
                    {optimizationLog.risparmioPercentuale > 0 && (
                      <span style={{ color: '#10b981', fontWeight: 600 }}> Risparmio token: ~{optimizationLog.risparmioPercentuale}%</span>
                    )}
                  </>
                ) : optimizationLog.metodo === 'full_text_fallback_automatico' ? (
                  <>
                    <Search size={14} style={{ color: '#60a5fa', display: 'inline', marginRight: 4 }} /> <strong>Ricerca estesa automatica:</strong> nessuna corrispondenza esatta per le parole chiave, analizzato il testo completo dei verbali per sicurezza.
                  </>
                ) : (
                  <>
                    <Search size={14} style={{ color: '#60a5fa', display: 'inline', marginRight: 4 }} /> <strong>Ricerca completa:</strong> analizzato il testo completo di tutti i verbali selezionati.
                  </>
                )}
              </div>
            )}

            {/* Risultato della Ricerca */}
            {searchResult && (
              <div style={S.resultArea}>
                <div style={S.resultTitle}>Risposta dell'AI:</div>
                <div style={{
                  ...S.resultText,
                  color: searchResult.trovato ? 'var(--text-primary)' : '#94a3b8'
                }}>
                  {searchResult.risposta}
                </div>
                
                {searchResult.trovato && searchResult.riferimenti && searchResult.riferimenti.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={S.refTitle}>Estratto di riferimento nei documenti:</div>
                    {searchResult.riferimenti.map((ref, idx) => (
                      <div key={idx} style={S.refCard}>
                        <div style={S.refCardHeader}>
                          <FileText size={14} color="#60a5fa" />
                          <span style={S.refDocName}>
                            {ref.documento_nome} 
                            {ref.documento_data && ` (Assemblea del ${formattaDataAi(ref.documento_data)})`}
                          </span>
                        </div>
                        <blockquote style={S.blockquote}>
                          "{ref.citazione}"
                        </blockquote>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Modal Upload */}
      {showUploadModal && (
        <div style={S.overlay}>
          <div style={S.modalCard}>
            <div style={S.modalHeader}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 16 }}>Carica verbale di assemblea</h3>
              <button onClick={() => { setShowUploadModal(false); setSelectedFile(null); }} style={S.closeModalBtn}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleUploadSubmit}>
              
              <div style={{ marginBottom: 16 }}>
                <label style={S.fieldLabel}>Data dell'Assemblea *</label>
                <input
                  type="date"
                  required
                  value={form.data_documento}
                  onChange={e => setForm(f => ({ ...f, data_documento: e.target.value }))}
                  style={S.inputField}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.fieldLabel}>Nome del Verbale / Titolo</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Es. Verbale Assemblea Ordinaria 2026"
                  style={S.inputField}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.fieldLabel}>
                  Seleziona file (PDF o DOCX) *
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    ...S.fileDropArea,
                    borderColor: selectedFile ? '#2563eb' : 'var(--border-color)'
                  }}
                >
                  {selectedFile ? (
                    <span style={{ color: '#60a5fa', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Paperclip size={14} /> {selectedFile.name}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Clicca qui per scegliere il file</span>
                  )}
                </div>
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  style={{ display: 'none' }} 
                  onChange={handleFileChange}
                  accept=".pdf,.docx" 
                  required
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={S.fieldLabel}>Note / Descrizione (opzionale)</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Es. Approvato bilancio preventivo e lavori cancello"
                  style={S.inputField}
                />
              </div>

              {uploadProgress && (
                <div style={{ ...S.uploadProgressBox, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 size={13} className="spin" /> {uploadProgress}
                </div>
              )}

              <div style={S.modalActions}>
                <button
                  type="button"
                  onClick={() => { setShowUploadModal(false); setSelectedFile(null); }}
                  disabled={uploading}
                  style={S.btnModalSecondary}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || uploading}
                  style={{
                    ...S.btnModalPrimary,
                    background: selectedFile && !uploading ? '#2563eb' : '#1e3a6e',
                    cursor: selectedFile && !uploading ? 'pointer' : 'not-allowed'
                  }}
                >
                  {uploading ? 'Caricamento...' : 'Salva verbale'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Conferma Eliminazione */}
      {confirmDelete && (
        <div style={S.overlay}>
          <div style={S.confirmCard}>
            <h4 style={{ margin: '0 0 10px', color: 'var(--text-primary)' }}>Elimina verbale</h4>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px', fontSize: 13, lineHeight: 1.5 }}>
              Sei sicuro di voler eliminare definitivamente il verbale "<strong style={{ color: 'var(--text-primary)' }}>{confirmDelete.nome}</strong>"?
              Questa azione cancellerà anche il testo indicizzato e non potrà essere annullata.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={S.btnModalSecondary}>Annulla</button>
              <button onClick={() => handleDelete(confirmDelete)} style={S.btnDeleteConfirm}>Elimina</button>
            </div>
          </div>
        </div>
      )}

      {/* Teaser Modal Upgrade a Piano Studio per Ricerca AI Verbali */}
      <UpgradeTeaserModal 
        isOpen={showStudioPaywall}
        onClose={() => setShowStudioPaywall(false)}
        title="Ricerca & Analisi AI nei Verbali"
        description="Trova istantaneamente delibere, votazioni ed accordi passati interrogando l'AI sui verbali delle assemblee."
        pianoRichiesto="studio"
        badgeText="ESCLUSIVO PIANO STUDIO"
        features={[
          "Interrogazione in linguaggio naturale di tutti i verbali d'assemblea",
          "Estrazione automatica delle citazioni testuali e delle delibere",
          "Riduzione azzerata dei tempi di ricerca contabile e legale"
        ]}
        ctaText="Passa a Piano Studio (169€/m)"
      />
    </div>
  );
}

// ── Stili del componente (Coerenti con Sora & Dark Mode) ────────────────────
const S = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12
  },
  sectionTitle: {
    margin: 0,
    color: 'var(--text-primary)',
    fontSize: 18,
    fontWeight: 600
  },
  sectionSubTitle: {
    margin: '4px 0 0',
    color: 'var(--text-secondary)',
    fontSize: 13
  },
  btnPrimary: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'Sora, sans-serif',
    transition: 'background-color 0.15s'
  },
  mainGrid: {
    display: 'grid',
    gap: 20,
    alignItems: 'start',
  },
  leftColumn: {
    background: 'var(--card-bg)',
    borderRadius: 12,
    border: '1px solid var(--border-color)',
    padding: 16,
    minHeight: 300
  },
  rightColumn: {
    background: 'var(--card-bg)',
    borderRadius: 12,
    border: '1px solid var(--border-color)',
    padding: 16
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: 12,
    marginBottom: 12
  },
  selectAllLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  loadingState: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    padding: 40,
    fontSize: 13
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 16px',
    border: '1px dashed var(--border-color)',
    borderRadius: 8
  },
  verbaliList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 480,
    overflowY: 'auto'
  },
  verbaleRow: {
    borderRadius: 8,
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    transition: 'border-color 0.15s, background-color 0.15s'
  },
  verbName: {
    color: 'var(--text-primary)',
    fontWeight: 600,
    fontSize: 13,
    display: 'block'
  },
  verbMeta: {
    color: 'var(--text-muted)',
    fontSize: 11,
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  badgeSuccess: {
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
    borderRadius: 4,
    padding: '2px 6px',
    fontSize: 10,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3
  },
  badgeWarning: {
    background: 'rgba(245, 158, 11, 0.15)',
    color: '#f59e0b',
    borderRadius: 4,
    padding: '2px 6px',
    fontSize: 10,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3
  },
  btnRowAction: {
    background: 'var(--app-bg)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 5,
    padding: '4px 10px',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif'
  },
  btnRowDelete: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: 'none',
    fontSize: 16,
    cursor: 'pointer',
    padding: '0 4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  
  // Ricerca AI
  aiSearchCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  aiCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: 12,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)'
  },
  aiHelpText: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.5
  },
  searchBoxContainer: {
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  searchTextArea: {
    width: '100%',
    background: 'transparent',
    color: 'var(--text-primary)',
    border: 'none',
    resize: 'none',
    outline: 'none',
    fontFamily: 'Sora, sans-serif',
    fontSize: 13,
    lineHeight: 1.6,
    boxSizing: 'border-box'
  },
  searchActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid var(--border-color-2)',
    paddingTop: 8
  },
  selectedCount: {
    color: 'var(--text-muted)',
    fontSize: 11
  },
  btnSearch: {
    background: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: 'Sora, sans-serif'
  },
  optimizationBadge: {
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 11,
    color: 'var(--text-secondary)',
    lineHeight: 1.5
  },
  warningBox: {
    background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    borderRadius: 8,
    padding: '12px 14px',
    display: 'flex',
    gap: 10
  },
  btnForceSearch: {
    background: 'transparent',
    color: '#f59e0b',
    border: '1px solid #f59e0b',
    borderRadius: 5,
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 600,
    marginTop: 8,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif'
  },
  resultArea: {
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: 16,
    marginTop: 8
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#10b981',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 8
  },
  resultText: {
    fontSize: 13,
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap'
  },
  refTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#60a5fa',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginTop: 14,
    marginBottom: 8
  },
  refCard: {
    background: 'var(--card-bg)',
    borderRadius: 6,
    border: '1px solid var(--border-color)',
    padding: 10,
    marginBottom: 8
  },
  refCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6
  },
  refDocName: {
    color: 'var(--text-primary)',
    fontSize: 11,
    fontWeight: 600
  },
  blockquote: {
    margin: 0,
    paddingLeft: 8,
    borderLeft: '2px solid #60a5fa',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 1.5
  },

  // Modali e Overlay
  overlay: {
    position: 'fixed',
    inset: 0,
    background: '#000000aa',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  modalCard: {
    background: 'var(--card-bg)',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 480,
    border: '1px solid var(--border-color)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  closeModalBtn: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: 'none',
    cursor: 'pointer',
    padding: 4
  },
  fieldLabel: {
    display: 'block',
    color: 'var(--text-secondary)',
    fontSize: 12,
    marginBottom: 6
  },
  inputField: {
    width: '100%',
    background: 'var(--app-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    padding: '9px 12px',
    fontSize: 13,
    fontFamily: 'Sora, sans-serif',
    boxSizing: 'border-box'
  },
  fileDropArea: {
    background: 'var(--app-bg)',
    border: '2px dashed var(--border-color)',
    borderRadius: 8,
    padding: 20,
    textAlign: 'center',
    cursor: 'pointer'
  },
  uploadProgressBox: {
    background: 'var(--app-bg)',
    border: '1px solid #2563eb',
    borderRadius: 6,
    padding: '8px 12px',
    marginBottom: 16,
    color: '#60a5fa',
    fontSize: 12
  },
  modalActions: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 20
  },
  btnModalSecondary: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    padding: '9px 16px',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif'
  },
  btnModalPrimary: {
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'Sora, sans-serif'
  },
  confirmCard: {
    background: 'var(--card-bg)',
    borderRadius: 12,
    padding: 24,
    maxWidth: 400,
    width: '100%',
    border: '1px solid var(--border-color)'
  },
  btnDeleteConfirm: {
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '9px 16px',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'Sora, sans-serif'
  }
};
