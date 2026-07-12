import { useEffect, useRef, useState, useMemo } from 'react'
import { useDocumenti } from '../hooks/useDocumenti'
import { callClaude } from '../lib/claudeClient'
import { 
  FileSignature, Search, Sparkles, Paperclip, CheckCircle2, 
  AlertTriangle, Trash2, Calendar, FileText, Loader2, X, Plus 
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

export default function VerbaliAssembleaTab({ condominioId }) {
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
  const [noMatchWarning, setNoMatchWarning] = useState(false);

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

  useEffect(() => {
    if (verbali.length > 0 && selectedVerbaliIds.size === 0) {
      setSelectedVerbaliIds(new Set(verbali.map(v => v.id)));
    }
  }, [verbali, selectedVerbaliIds]);

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
      await upload(selectedFile, 'verbale', form.nome, form.note, form.data_documento);
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
    const url = await getSignedUrl(doc.url_storage);
    if (url) {
      newWindow.location.href = url;
    } else {
      newWindow.close();
      alert('Impossibile aprire il verbale');
    }
  };

  // Esegue la ricerca AI
  const handleAiSearch = async (forceAll = false) => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setOptimizationLog(null);
    setNoMatchWarning(false);

    try {
      // 1. Filtra i verbali selezionati dall'utente
      const verbaliDaCercare = verbali.filter(v => selectedVerbaliIds.has(v.id));
      
      if (verbaliDaCercare.length === 0) {
        throw new Error('Seleziona almeno un verbale su cui effettuare la ricerca.');
      }

      // 2. Applica l'ottimizzatore di contesto basato su parole chiave
      const { verbaliFiltrati, metodo, keywords, risparmioPercentuale } = filtraContestoOttimizzato(
        verbaliDaCercare, 
        query, 
        forceAll
      );

      // Se non ci sono verbali corrispondenti e non abbiamo forzato la ricerca globale
      if (verbaliFiltrati.length === 0 && !forceAll && keywords.length > 0) {
        setNoMatchWarning(true);
        setSearching(false);
        return;
      }

      // 3. Prepara il prompt per Claude
      const systemPrompt = `Sei un assistente virtuale esperto di gestione condominiale CondoSmart. Rispondi alle domande dell'amministratore basandoti ESCLUSIVAMENTE sui verbali delle assemblee forniti.

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

      // 4. Chiamata a Claude
      const rispostaRaw = await callClaude(userPrompt, {
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
        console.error('Errore parsing JSON risposta Claude:', err, rispostaRaw);
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

      <div style={S.mainGrid}>
        
        {/* Colonna di sinistra: Lista verbali */}
        <div style={S.leftColumn}>
          <div style={S.cardHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileSignature size={18} color="#60a5fa" />
              <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Archivio Verbali ({verbali.length})</span>
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
              <FileSignature size={32} style={{ color: '#475569', marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Nessun verbale presente in questo condominio.</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#475569' }}>
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
                    border: isSelected ? '1px solid rgba(37, 99, 235, 0.5)' : '1px solid #334155',
                    background: isSelected ? 'rgba(37, 99, 235, 0.03)' : '#1e293b'
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
          <div style={S.aiSearchCard}>
            <div style={S.aiCardHeader}>
              <Sparkles size={18} color="#10b981" />
              <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Ricerca AI nei Verbali</span>
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

            {/* Avviso Ottimizzazione Costi */}
            {optimizationLog && (
              <div style={S.optimizationBadge}>
                ⚡ <strong>Ottimizzazione AI attiva:</strong> analizzati solo i paragrafi pertinenti ({optimizationLog.numVerbaliInviati}/{optimizationLog.numVerbaliTotali} verbali).
                {optimizationLog.risparmioPercentuale > 0 && (
                  <span style={{ color: '#10b981', fontWeight: 600 }}> Risparmio token: ~{optimizationLog.risparmioPercentuale}%</span>
                )}
              </div>
            )}

            {/* Warning di Nessuna Corrispondenza */}
            {noMatchWarning && (
              <div style={S.warningBox}>
                <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600, color: '#f59e0b', fontSize: 13 }}>
                    Nessuna parola chiave rilevante trovata
                  </p>
                  <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 12 }}>
                    Le parole cercate non compaiono in nessun paragrafo dei verbali selezionati. Vuoi forzare la ricerca sull'intero testo di tutti i verbali?
                  </p>
                  <button onClick={() => handleAiSearch(true)} style={S.btnForceSearch}>
                    Sì, effettua ricerca completa (consuma più crediti)
                  </button>
                </div>
              </div>
            )}

            {/* Risultato della Ricerca */}
            {searchResult && (
              <div style={S.resultArea}>
                <div style={S.resultTitle}>Risposta dell'AI:</div>
                <div style={{
                  ...S.resultText,
                  color: searchResult.trovato ? '#f1f5f9' : '#94a3b8'
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
                            {ref.documento_data && ` (Assemblea del ${new Date(ref.documento_data).toLocaleDateString('it-IT')})`}
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
        </div>

      </div>

      {/* Modal Upload */}
      {showUploadModal && (
        <div style={S.overlay}>
          <div style={S.modalCard}>
            <div style={S.modalHeader}>
              <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: 16 }}>Carica verbale di assemblea</h3>
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
                    borderColor: selectedFile ? '#2563eb' : '#334155'
                  }}
                >
                  {selectedFile ? (
                    <span style={{ color: '#60a5fa', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Paperclip size={14} /> {selectedFile.name}
                    </span>
                  ) : (
                    <span style={{ color: '#64748b', fontSize: 13 }}>Clicca qui per scegliere il file</span>
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
                <div style={S.uploadProgressBox}>
                  ⏳ {uploadProgress}
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
            <h4 style={{ margin: '0 0 10px', color: '#f1f5f9' }}>Elimina verbale</h4>
            <p style={{ color: '#94a3b8', margin: '0 0 20px', fontSize: 13, lineHeight: 1.5 }}>
              Sei sicuro di voler eliminare definitivamente il verbale "<strong style={{ color: '#f1f5f9' }}>{confirmDelete.nome}</strong>"?
              Questa azione cancellerà anche il testo indicizzato e non potrà essere annullata.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={S.btnModalSecondary}>Annulla</button>
              <button onClick={() => handleDelete(confirmDelete)} style={S.btnDeleteConfirm}>Elimina</button>
            </div>
          </div>
        </div>
      )}

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
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: 600
  },
  sectionSubTitle: {
    margin: '4px 0 0',
    color: '#94a3b8',
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
    gridTemplateColumns: '1fr',
    gap: 20,
    alignItems: 'start',
    // Per schermi grandi diventa due colonne
    '@media (min-width: 1024px)': {
      gridTemplateColumns: '4.5fr 5.5fr'
    }
  },
  leftColumn: {
    background: '#1e293b',
    borderRadius: 12,
    border: '1px solid #334155',
    padding: 16,
    minHeight: 300
  },
  rightColumn: {
    background: '#1e293b',
    borderRadius: 12,
    border: '1px solid #334155',
    padding: 16
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #334155',
    paddingBottom: 12,
    marginBottom: 12
  },
  selectAllLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  loadingState: {
    textAlign: 'center',
    color: '#64748b',
    padding: 40,
    fontSize: 13
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 16px',
    border: '1px dashed #334155',
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
    color: '#f1f5f9',
    fontWeight: 600,
    fontSize: 13,
    display: 'block'
  },
  verbMeta: {
    color: '#64748b',
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
    background: '#0f172a',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: 5,
    padding: '4px 10px',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif'
  },
  btnRowDelete: {
    background: 'transparent',
    color: '#64748b',
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
    borderBottom: '1px solid #334155',
    paddingBottom: 12,
    fontSize: 14,
    fontWeight: 600,
    color: '#f1f5f9'
  },
  aiHelpText: {
    margin: 0,
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 1.5
  },
  searchBoxContainer: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  searchTextArea: {
    width: '100%',
    background: 'transparent',
    color: '#f1f5f9',
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
    borderTop: '1px solid #1e293b',
    paddingTop: 8
  },
  selectedCount: {
    color: '#64748b',
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
    color: '#94a3b8',
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
    background: '#0f172a',
    border: '1px solid #334155',
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
    background: '#1e293b',
    borderRadius: 6,
    border: '1px solid #334155',
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
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: 600
  },
  blockquote: {
    margin: 0,
    paddingLeft: 8,
    borderLeft: '2px solid #60a5fa',
    color: '#94a3b8',
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
    background: '#1e293b',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 480,
    border: '1px solid #334155'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  closeModalBtn: {
    background: 'transparent',
    color: '#64748b',
    border: 'none',
    cursor: 'pointer',
    padding: 4
  },
  fieldLabel: {
    display: 'block',
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 6
  },
  inputField: {
    width: '100%',
    background: '#0f172a',
    color: '#f1f5f9',
    border: '1px solid #334155',
    borderRadius: 6,
    padding: '9px 12px',
    fontSize: 13,
    fontFamily: 'Sora, sans-serif',
    boxSizing: 'border-box'
  },
  fileDropArea: {
    background: '#0f172a',
    border: '2px dashed #334155',
    borderRadius: 8,
    padding: 20,
    textAlign: 'center',
    cursor: 'pointer'
  },
  uploadProgressBox: {
    background: '#0f172a',
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
    color: '#94a3b8',
    border: '1px solid #334155',
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
    background: '#1e293b',
    borderRadius: 12,
    padding: 24,
    maxWidth: 400,
    width: '100%',
    border: '1px solid #334155'
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
