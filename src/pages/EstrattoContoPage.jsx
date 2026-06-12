import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { estraiMovimentiBancari, getTipoFile } from '../lib/fileExtractor';

const TIPI_ACCETTATI = '.pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png';

export default function EstrattoContoPage() {
  const { condominioId } = useParams();

  const [movimenti, setMovimenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [erroreUpload, setErroreUpload] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (condominioId) loadMovimenti();
  }, [condominioId]);

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

      setUploadProgress(`✅ ${records.length} movimenti importati con successo`);
      await loadMovimenti();
      setTimeout(() => setUploadProgress(''), 4000);
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
  const nonRiconciliati = movimenti.filter(m => !m.riconciliato && m.tipo === 'uscita').length;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Estratto Conto</h1>
          <p style={styles.subtitle}>Importa movimenti bancari da PDF, Excel o immagine</p>
        </div>
      </div>

      {/* KPI */}
      <div style={styles.kpiRow}>
        {[
          { label: 'Entrate', value: `+€ ${totaleEntrate.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, color: '#16a34a' },
          { label: 'Uscite', value: `-€ ${totaleUscite.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, color: '#ef4444' },
          { label: 'Saldo Netto', value: `€ ${(totaleEntrate - totaleUscite).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, color: '#2563eb' },
          { label: 'Da Riconciliare', value: nonRiconciliati, color: nonRiconciliati > 0 ? '#f59e0b' : '#16a34a' },
        ].map(k => (
          <div key={k.label} style={styles.kpiCard}>
            <div style={{ ...styles.kpiVal, color: k.color }}>{k.value}</div>
            <div style={styles.kpiLabel}>{k.label}</div>
          </div>
        ))}
      </div>

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

      {erroreUpload && <div style={styles.errMsg}>⚠️ {erroreUpload}</div>}

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
        <span style={{ color: '#475569', fontSize: 13 }}>{movFiltrati.length} movimenti</span>
      </div>

      {/* Lista movimenti */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>Caricamento...</div>
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
                    <div style={styles.movFornitore}>🏢 {m.fornitore_rilevato}</div>
                  )}
                  {m.pagante_rilevato && (
                    <div style={styles.movPagante}>👤 {m.pagante_rilevato}</div>
                  )}
                  <div style={styles.movMeta}>
                    {new Date(m.data_movimento).toLocaleDateString('it-IT')}
                    {m.riferimento_esterno && ` · Rif: ${m.riferimento_esterno}`}
                    {m.riconciliato && <span style={styles.ricBadge}>✓ Riconciliato</span>}
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
                {m.saldo !== null && (
                  <div style={styles.movSaldo}>Saldo: € {m.saldo?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                )}
                <button style={styles.delBtn} onClick={() => eliminaMovimento(m.id)} title="Elimina">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { fontFamily: "'Sora', sans-serif", color: '#e2e8f0', padding: 24 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#64748b' },
  kpiRow: { display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  kpiCard: { flex: '1 1 140px', background: '#1e293b', borderRadius: 12, padding: '16px 20px', border: '1px solid #334155' },
  kpiVal: { fontSize: 20, fontWeight: 700 },
  kpiLabel: { fontSize: 11, color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' },
  dropZone: {
    border: '2px dashed #334155', borderRadius: 16, padding: '36px 20px',
    textAlign: 'center', marginBottom: 20, transition: 'all 0.2s',
    background: '#1e293b10',
  },
  dropZoneActive: { borderColor: '#2563eb', background: '#2563eb10' },
  dropIcon: { fontSize: 40, marginBottom: 10 },
  dropTitle: { fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 },
  dropSub: { fontSize: 13, color: '#64748b' },
  errMsg: {
    background: '#ef444415', border: '1px solid #ef444440',
    borderRadius: 10, padding: '10px 16px', color: '#ef4444',
    fontSize: 13, marginBottom: 16,
  },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  viewToggle: { display: 'flex', background: '#1e293b', borderRadius: 8, padding: 2 },
  tBtn: {
    background: 'none', border: 'none', color: '#64748b', padding: '6px 16px',
    borderRadius: 6, cursor: 'pointer', fontFamily: "'Sora', sans-serif",
    fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
  },
  tBtnActive: { background: '#2563eb', color: '#fff' },
  emptyState: { textAlign: 'center', padding: 60, color: '#475569' },
  lista: { display: 'flex', flexDirection: 'column', gap: 1 },
  movRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#1e293b', padding: '12px 16px', gap: 12,
    borderBottom: '1px solid #334155', transition: 'background 0.15s',
  },
  movLeft: { display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 },
  movTipo: {
    width: 28, height: 28, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 16, flexShrink: 0,
  },
  movCausale: { fontSize: 14, color: '#e2e8f0', fontWeight: 500, wordBreak: 'break-word' },
  movFornitore: { fontSize: 12, color: '#60a5fa', marginTop: 2 },
  movPagante: { fontSize: 12, color: '#34d399', marginTop: 2 },
  movMeta: { fontSize: 11, color: '#64748b', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 },
  ricBadge: {
    background: '#16a34a20', color: '#16a34a',
    borderRadius: 20, padding: '1px 8px', fontSize: 10,
  },
  movRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  movImporto: { fontSize: 16, fontWeight: 700 },
  movSaldo: { fontSize: 11, color: '#475569' },
  delBtn: {
    background: 'none', border: 'none', color: '#475569', cursor: 'pointer',
    fontSize: 14, padding: '2px 4px', marginTop: 4, opacity: 0.6,
    transition: 'opacity 0.2s',
  },
};