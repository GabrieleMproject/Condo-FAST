import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { estraiMovimentiBancari, getTipoFile } from '../lib/fileExtractor';
import { useDocumenti } from '../hooks/useDocumenti';
import PlanGate from '../components/PlanGate';
import { Trash2, Building2, User, Check, AlertTriangle } from 'lucide-react';

const TIPI_ACCETTATI = '.pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png';
const formattaData = (d) => (d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleDateString('it-IT') : '—');

export default function EstrattoContoPage() {
  const { condominioId } = useParams();
  const { documenti, fetch: fetchDocumenti, upload: uploadDoc } = useDocumenti(condominioId);

  const [movimenti, setMovimenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [erroreUpload, setErroreUpload] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [bankingStatus, setBankingStatus] = useState(null);
  const [syncingBank, setSyncingBank] = useState(false);

  const docEstratto = documenti.find(d => d.tipo === 'estratto_conto');

  function parseDateEstratto(doc) {
    if (!doc || !doc.note) return { dal: null, al: null };
    try {
      const parsed = JSON.parse(doc.note);
      if (parsed && typeof parsed === 'object') {
        return { dal: parsed.dal || null, al: parsed.al || null };
      }
    } catch {
      // ignore
    }
    return { dal: null, al: null };
  }

  async function visualizzaDocumento(urlStorage) {
    if (!urlStorage) return;
    let newWindow = null;
    try {
      newWindow = window.open('about:blank', '_blank');
      if (!newWindow) {
        alert('Abilita i popup per visualizzare il file.');
        return;
      }
      const { data, error } = await supabase.storage
        .from('documenti-condominio')
        .createSignedUrl(urlStorage, 900); // 15 minuti
      if (error) {
        newWindow.close();
        throw error;
      }
      if (data?.signedUrl) {
        newWindow.location.href = data.signedUrl;
      } else {
        newWindow.close();
        alert('Impossibile generare il link per la visualizzazione del documento.');
      }
    } catch (e) {
      if (newWindow) newWindow.close();
      alert('Errore visualizzazione file: ' + e.message);
    }
  }

  useEffect(() => {
    if (condominioId) {
      loadMovimenti();
      fetchDocumenti();
      loadBankingStatus();
    }
  }, [condominioId, fetchDocumenti]);

  async function loadBankingStatus() {
    const { data } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('condominio_id', condominioId)
      .limit(1)
      .maybeSingle();
    setBankingStatus(data);
  }

  async function loadMovimenti() {
    setLoading(true);
    const { data } = await supabase
      .from('estratto_conto')
      .select('*')
      .eq('condominio_id', condominioId)
      .order('data_movimento', { ascending: false });
    setMovimenti(data || []);
    setLoading(false);
  }

  // ─── Upload e estrazione ────────────────────────────────────
  async function handleFile(file) {
    if (!file) return;
    const tipo = getTipoFile(file);
    if (tipo === 'unknown') {
      setErroreUpload('Formato non supportato. Usa PDF, XLSX, CSV o immagine.');
      return;
    }

    setUploading(true);
    setErroreUpload('');
    setUploadProgress('Lettura file...');

    try {
      setUploadProgress('Analisi AI in corso... (può richiedere 15-30 secondi)');
      const risultato = await estraiMovimentiBancari(file);

      setUploadProgress('Salvataggio movimenti...');
      const { data: { user } } = await supabase.auth.getUser();

      if (!risultato.movimenti?.length) {
        setErroreUpload('Nessun movimento trovato nel file. Verifica che sia un estratto conto valido.');
        return;
      }

      // Inserisci movimenti
      const records = risultato.movimenti.map(m => ({
        condominio_id: condominioId,
        user_id: user.id,
        data_movimento: m.data,
        causale: m.causale,
        importo: m.importo,
        saldo: m.saldo ?? null,
        tipo: m.tipo || (m.importo >= 0 ? 'entrata' : 'uscita'),
        fornitore_rilevato: m.fornitore_rilevato ?? null,
        pagante_rilevato: m.pagante_rilevato ?? null,   // ✅ S8b: ora si salva (entrate)
        riferimento_esterno: m.riferimento_esterno ?? null,
        fonte_import: tipo,
        ai_processed: true,
        riconciliato: false,
      }));

      const { error } = await supabase.from('estratto_conto').insert(records);
      if (error) throw error;

      // Calcolo date min e max dei nuovi movimenti estratti
      const dateValide = records
        .map(r => r.data_movimento)
        .filter(d => d && !isNaN(new Date(d).getTime()))
        .map(d => new Date(d).getTime());

      let nuovoDal = null;
      let nuovoAl = null;
      if (dateValide.length > 0) {
        nuovoDal = new Date(Math.min(...dateValide)).toISOString().split('T')[0];
        nuovoAl = new Date(Math.max(...dateValide)).toISOString().split('T')[0];
      }

      // Logica di gestione archiviazione / salvataggio del file estratto conto
      let msgSupplementare = '';
      if (docEstratto) {
        setUploadProgress('Archiviazione precedente estratto conto e salvataggio del nuovo...');
        try {
          const { dal: oldDal, al: oldAl } = parseDateEstratto(docEstratto);
          const periodoStr = (oldDal && oldAl) ? ` (${formattaData(oldDal)} - ${formattaData(oldAl)})` : '';
          const nuovoNome = `${docEstratto.nome || 'Estratto Conto'}${periodoStr} [Archiviato]`;
          const { error: errArchivioDb } = await supabase
            .from('documenti_condominio')
            .update({
              tipo: 'estratto_conto_archivio',
              nome: nuovoNome,
              note: JSON.stringify({ dal: oldDal, al: oldAl, archiviato_il: new Date().toISOString() })
            })
            .eq('id', docEstratto.id);
          if (errArchivioDb) throw errArchivioDb;
          msgSupplementare = ' (precedente estratto conto archiviato nei Documenti Condominio)';
        } catch (errArchivio) {
          console.error('Errore durante archiviazione vecchio estratto conto:', errArchivio);
        }
      } else {
        setUploadProgress('Salvataggio file estratto conto...');
        msgSupplementare = ' (File salvato come estratto conto principale)';
      }

      const noteJson = JSON.stringify({ dal: nuovoDal, al: nuovoAl });
      await uploadDoc(file, 'estratto_conto', file.name.replace(/\.[^.]+$/, ''), noteJson);

      setUploadProgress(`✅ ${records.length} movimenti importati${msgSupplementare}`);
      await loadMovimenti();
      await fetchDocumenti();
      setTimeout(() => setUploadProgress(''), 5000);
    } catch (e) {
      setErroreUpload('Errore estrazione: ' + e.message);
      setUploadProgress('');
    } finally {
      setUploading(false);
    }
  }

  async function eliminaMovimento(id) {
    if (!confirm('Eliminare questo movimento?')) return;
    await supabase.from('estratto_conto').delete().eq('id', id);
    setMovimenti(prev => prev.filter(m => m.id !== id));
  }

  // ─── KPI ────────────────────────────────────────────────────
  const movFiltrati = filtroTipo ? movimenti.filter(m => m.tipo === filtroTipo) : movimenti;
  const totaleEntrate = movimenti.filter(m => m.tipo === 'entrata').reduce((a, m) => a + m.importo, 0);
  const totaleUscite = movimenti.filter(m => m.tipo === 'uscita').reduce((a, m) => a + Math.abs(m.importo), 0);
  const nonRiconciliati = movimenti.filter(m => !m.riconciliato).length;

  const ultimoMovConSaldo = movimenti.find(m => m.saldo != null && m.saldo !== '');
  const saldoFinaleVal = ultimoMovConSaldo
    ? `€ ${Number(ultimoMovConSaldo.saldo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
    : (movimenti.length > 0 ? `€ ${(totaleEntrate - totaleUscite).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—');
  const saldoFinaleLabel = ultimoMovConSaldo
    ? `Saldo Finale (al ${formattaData(ultimoMovConSaldo.data_movimento)})`
    : 'Saldo Finale C/C';

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={styles.title}>Estratto Conto</h1>
            {docEstratto && (
              <div style={styles.docBadgeContainer}>
                <span style={styles.docDateBadge}>
                  📅 ESTRATTO CONTO {parseDateEstratto(docEstratto).dal && parseDateEstratto(docEstratto).al
                    ? `(${formattaData(parseDateEstratto(docEstratto).dal)} – ${formattaData(parseDateEstratto(docEstratto).al)})`
                    : ''}
                </span>
                <button
                  style={styles.docOpenBtn}
                  onClick={() => visualizzaDocumento(docEstratto.url_storage)}
                  title="Visualizza o scarica il file originale dell'estratto conto"
                >
                  📄 Scarica File
                </button>
              </div>
            )}
          </div>
          <p style={styles.subtitle}>Importa movimenti bancari da PDF, Excel o immagine</p>
        </div>
      </div>

      {/* KPI */}
      <div style={styles.kpiRow}>
        {[
          { label: saldoFinaleLabel, value: saldoFinaleVal, color: '#38bdf8' },
          { label: 'Entrate (Periodo)', value: `+€ ${totaleEntrate.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, color: '#16a34a' },
          { label: 'Uscite (Periodo)', value: `-€ ${totaleUscite.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, color: '#ef4444' },
          { label: 'Da Riconciliare', value: nonRiconciliati, color: nonRiconciliati > 0 ? '#f59e0b' : '#16a34a' },
        ].map(k => (
          <div key={k.label} style={styles.kpiCard}>
            <div style={{ ...styles.kpiVal, color: k.color }}>{k.value}</div>
            <div style={styles.kpiLabel}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Open Banking Section */}
      <PlanGate feature="open_banking" fallback={
        <div style={{...styles.dropZone, padding: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{ textAlign: 'left' }}>
            <div style={{fontWeight: 600, color: 'var(--text-primary)'}}>🏦 Open Banking (PSD2)</div>
            <div style={{fontSize: 13, color: 'var(--text-muted)'}}>Collega il conto corrente per scaricare i movimenti in automatico ogni notte. Esclusivo per il piano Professional.</div>
          </div>
          <button style={{...styles.docOpenBtn, background: 'var(--border-color)', color: 'var(--text-muted)', cursor: 'not-allowed'}} disabled>Passa a Pro</button>
        </div>
      }>
        <div style={{...styles.dropZone, padding: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: bankingStatus?.status === 'LINKED' ? '#16a34a' : 'var(--border-color)', background: bankingStatus?.status === 'LINKED' ? '#16a34a10' : '#1e293b10'}}>
          <div style={{ textAlign: 'left' }}>
            <div style={{fontWeight: 600, color: 'var(--text-primary)'}}>
              🏦 Sincronizzazione Bancaria (GoCardless)
              {bankingStatus?.status === 'LINKED' && <span style={{marginLeft: 10, fontSize: 12, color: '#16a34a', background: '#16a34a20', padding: '2px 8px', borderRadius: 12}}>🟢 Attiva ({bankingStatus.institution_name})</span>}
            </div>
            <div style={{fontSize: 13, color: 'var(--text-muted)'}}>
              {bankingStatus?.status === 'LINKED' ? `Sincronizzazione automatica attiva. Conto: ${bankingStatus.iban || bankingStatus.account_id || 'Autenticato'}` : 'Collega il conto bancario per scaricare i movimenti in tempo reale e azzerare i caricamenti PDF.'}
            </div>
          </div>
          <div style={{display: 'flex', gap: 10}}>
             {bankingStatus?.status === 'LINKED' && (
                <button 
                  style={{...styles.tBtn, background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)'}}
                  onClick={async () => {
                     setSyncingBank(true);
                     try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gocardless-proxy`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                          },
                          body: JSON.stringify({ action: 'sync_transactions', payload: { connectionId: bankingStatus.id } })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Errore di sincronizzazione');
                        alert(`Sincronizzazione completata. ${data.newTransactions} nuovi movimenti importati.`);
                        loadMovimenti();
                     } catch(err) {
                        alert(err.message);
                     } finally {
                        setSyncingBank(false);
                     }
                  }}
                  disabled={syncingBank}
                >
                  {syncingBank ? '⏳ Sincronizzo...' : '🔄 Sincronizza Ora'}
                </button>
             )}
             {!bankingStatus && (
                <button 
                  style={{...styles.docOpenBtn, background: '#2563eb'}} 
                  onClick={async () => {
                     try {
                        // Demo sandbox
                        const { data: { session } } = await supabase.auth.getSession();
                        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gocardless-proxy`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                          },
                          body: JSON.stringify({ action: 'create_requisition', payload: { 
                              condominioId: condominioId,
                              institutionId: 'SANDBOXFINANCE_SFIN0000',
                              institutionName: 'Sandbox Finance',
                              redirectUrl: window.location.href 
                          }})
                        });
                        const data = await res.json();
                        if (data.link) {
                            window.location.href = data.link; // Redirect to bank
                        } else {
                            // Fallback se non c'è la key
                            alert('Simulazione connessione bancaria avviata in dev.');
                            loadBankingStatus();
                        }
                     } catch(err) {
                        alert('Configura le API Key GoCardless nel backend prima di procedere.');
                     }
                  }}
                >
                  Collega Banca
                </button>
             )}
             {bankingStatus?.status === 'CREATED' && (
                <button 
                  style={{...styles.docOpenBtn, background: '#f59e0b'}} 
                  onClick={async () => {
                     setSyncingBank(true);
                     try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gocardless-proxy`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                          },
                          body: JSON.stringify({ action: 'sync_transactions', payload: { connectionId: bankingStatus.id } })
                        });
                        if (!res.ok) throw new Error('Errore completamento');
                        loadBankingStatus();
                        loadMovimenti();
                     } catch(err) {
                        alert(err.message);
                     } finally {
                        setSyncingBank(false);
                     }
                  }}
                  disabled={syncingBank}
                >
                  {syncingBank ? '⏳ Attendere...' : 'Completa Collegamento'}
                </button>
             )}
          </div>
        </div>
      </PlanGate>

      {/* Drop zone upload */}
      <div
        style={{ ...styles.dropZone, ...(dragOver ? styles.dropZoneActive : {}) }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
      >
        <input
          type="file"
          accept={TIPI_ACCETTATI}
          style={{ display: 'none' }}
          id="estratto-upload"
          onChange={e => handleFile(e.target.files[0])}
          disabled={uploading}
        />
        <label htmlFor="estratto-upload" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
          <div style={styles.dropIcon}>{uploading ? '⏳' : '📂'}</div>
          <div style={styles.dropTitle}>
            {uploading ? uploadProgress : 'Trascina qui l\'estratto conto'}
          </div>
          <div style={styles.dropSub}>
            {uploading ? '' : 'oppure clicca per selezionare — PDF, Excel, CSV, Immagine'}
          </div>
        </label>
      </div>

      {erroreUpload && (
        <div style={{ ...styles.errMsg, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} /> {erroreUpload}
        </div>
      )}

      {/* Filtri */}
      <div style={styles.toolbar}>
        <div style={styles.viewToggle}>
          {['', 'entrata', 'uscita'].map(t => (
            <button
              key={t}
              style={{ ...styles.tBtn, ...(filtroTipo === t ? styles.tBtnActive : {}) }}
              onClick={() => setFiltroTipo(t)}
            >
              {t === '' ? 'Tutti' : t === 'entrata' ? '↑ Entrate' : '↓ Uscite'}
            </button>
          ))}
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{movFiltrati.length} movimenti</span>
      </div>

      {/* Lista movimenti */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Caricamento...</div>
      ) : movFiltrati.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
          <p>Nessun movimento. Importa un estratto conto.</p>
        </div>
      ) : (
        <div style={styles.lista}>
          {movFiltrati.map(m => (
            <div key={m.id} style={styles.movRow}>
              <div style={styles.movLeft}>
                <span style={{
                  ...styles.movTipo,
                  background: m.tipo === 'entrata' ? '#16a34a20' : '#ef444420',
                  color: m.tipo === 'entrata' ? '#16a34a' : '#ef4444',
                }}>
                  {m.tipo === 'entrata' ? '↑' : '↓'}
                </span>
                <div>
                  <div style={styles.movCausale}>{m.causale}</div>
                  {m.fornitore_rilevato && (
                    <div style={{ ...styles.movFornitore, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Building2 size={12} /> {m.fornitore_rilevato}
                    </div>
                  )}
                  {m.pagante_rilevato && (
                    <div style={{ ...styles.movPagante, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <User size={12} /> {m.pagante_rilevato}
                    </div>
                  )}
                  <div style={styles.movMeta}>
                    {formattaData(m.data_movimento)}
                    {m.metodo_importazione === 'open_banking' && <span style={{marginLeft: 6, color: '#2563eb', fontWeight: 600}}>🏦 PSD2</span>}
                    {m.riferimento_esterno && ` · Rif: ${m.riferimento_esterno}`}
                    {m.riconciliato && (
                      <span style={{ ...styles.ricBadge, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Check size={12} /> Riconciliato
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div style={styles.movRight}>
                <span style={{
                  ...styles.movImporto,
                  color: m.importo >= 0 ? '#16a34a' : '#ef4444',
                }}>
                  {m.importo >= 0 ? '+' : ''}€ {Math.abs(m.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </span>
                {m.saldo != null && m.saldo !== '' && (
                  <div style={styles.movSaldo}>Saldo: € {Number(m.saldo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                )}
                <button style={styles.delBtn} onClick={() => eliminaMovimento(m.id)} title="Elimina" type="button"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { fontFamily: "'Sora', sans-serif", color: 'var(--text-primary)', padding: 24 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' },
  kpiRow: { display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  kpiCard: { flex: '1 1 140px', background: 'var(--card-bg)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--border-color)' },
  kpiVal: { fontSize: 20, fontWeight: 700 },
  kpiLabel: { fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' },
dropZone: {
    borderWidth: '2px', borderStyle: 'dashed', borderColor: 'var(--border-color)',
    borderRadius: 16, padding: '36px 20px',
    textAlign: 'center', marginBottom: 20, transition: 'all 0.2s',
    background: '#1e293b10',
  },
  dropZoneActive: { borderColor: '#2563eb', background: '#2563eb10' },
  dropIcon: { fontSize: 40, marginBottom: 10 },
  dropTitle: { fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 },
  dropSub: { fontSize: 13, color: 'var(--text-muted)' },
  errMsg: {
    background: '#ef444415', border: '1px solid #ef444440',
    borderRadius: 10, padding: '10px 16px', color: '#ef4444',
    fontSize: 13, marginBottom: 16,
  },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  viewToggle: { display: 'flex', background: 'var(--card-bg)', borderRadius: 8, padding: 2 },
  tBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)', padding: '6px 16px',
    borderRadius: 6, cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
  },
  tBtnActive: { background: '#2563eb', color: '#fff' },
  emptyState: { textAlign: 'center', padding: 60, color: 'var(--text-muted)' },
  lista: { display: 'flex', flexDirection: 'column', gap: 1 },
  movRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'var(--card-bg)', padding: '12px 16px', gap: 12,
    borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s',
  },
  movLeft: { display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 },
  movTipo: {
    width: 28, height: 28, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 16, flexShrink: 0,
  },
  movCausale: { fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, wordBreak: 'break-word' },
  movFornitore: { fontSize: 12, color: '#60a5fa', marginTop: 2 },
  movPagante: { fontSize: 12, color: '#34d399', marginTop: 2 },
  movMeta: { fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 },
  ricBadge: {
    background: '#16a34a20', color: '#16a34a',
    borderRadius: 20, padding: '1px 8px', fontSize: 10,
  },
  movRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  movImporto: { fontSize: 16, fontWeight: 700 },
  movSaldo: { fontSize: 11, color: 'var(--text-muted)' },
  delBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
    fontSize: 14, padding: '2px 4px', marginTop: 4, opacity: 0.6,
    transition: 'opacity 0.2s',
  },
  docBadgeContainer: {
    display: 'inline-flex', alignItems: 'center', gap: 10,
    background: 'var(--card-bg)', border: '1px solid #38bdf850',
    borderRadius: 8, padding: '4px 12px',
  },
  docDateBadge: {
    fontSize: 13, color: '#38bdf8', fontWeight: 600,
  },
  docOpenBtn: {
    background: '#0284c7', color: '#fff', border: 'none',
    borderRadius: 6, padding: '4px 10px', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    transition: 'background 0.2s',
  },
};