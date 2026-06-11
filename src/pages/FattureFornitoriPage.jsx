import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { estraiFattura, getTipoFile } from '../lib/fileExtractor';

const STATI = {
  attesa:     { label: 'In attesa',  color: '#f59e0b', bg: '#f59e0b20' },
  pagata:     { label: 'Pagata',     color: '#16a34a', bg: '#16a34a20' },
  contestata: { label: 'Contestata', color: '#ef4444', bg: '#ef444420' },
  annullata:  { label: 'Annullata',  color: '#64748b', bg: '#64748b20' },
};

const CATEGORIE = ['manutenzione', 'pulizie', 'utenze', 'assicurazione', 'amministrazione', 'altro'];

export default function FattureFornitoriPage() {
  const { condominioId } = useParams();

  const [fatture, setFatture]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [uploading, setUploading]         = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [erroreUpload, setErroreUpload]   = useState('');
  const [editingId, setEditingId]         = useState(null);
  const [editData, setEditData]           = useState({});
  const [filtroStato, setFiltroStato]     = useState('');
  const [dragOver, setDragOver]           = useState(false);
  const [spese, setSpese]                 = useState([]);

  useEffect(() => {
    if (condominioId) { loadFatture(); loadSpese(); }
  }, [condominioId]);

  async function loadFatture() {
    setLoading(true);
    const { data } = await supabase
      .from('fatture_fornitori')
      .select('*')
      .eq('condominio_id', condominioId)
      .order('data_fattura', { ascending: false });
    setFatture(data || []);
    setLoading(false);
  }

  async function loadSpese() {
    const { data } = await supabase
      .from('spese')
      .select('id, descrizione, importo')
      .eq('condominio_id', condominioId)
      .order('data_competenza', { ascending: false })
      .limit(50);
    setSpese(data || []);
  }

  // ─── Upload fattura ──────────────────────────────────────────
  async function handleFile(file) {
    if (!file) return;
    const tipo = getTipoFile(file);
    if (tipo === 'unknown') {
      setErroreUpload('Formato non supportato. Usa PDF, DOCX, immagine, Excel o TXT.');
      return;
    }

    setUploading(true);
    setErroreUpload('');
    setUploadProgress('Lettura file...');

    try {
      setUploadProgress('Estrazione dati fattura con AI...');
      const datiAI = await estraiFattura(file);

      // ✅ Upload su Storage per PDF e DOCX (entrambi vanno archiviati)
      let fileUrl = null;
      if (tipo === 'pdf' || tipo === 'docx') {
        setUploadProgress('Caricamento file su storage...');
        const { data: { user } } = await supabase.auth.getUser();
        const path = `${user.id}/${condominioId}/${Date.now()}_${file.name}`;
        const { data: storageData, error: storageErr } = await supabase.storage
          .from('fatture')
          .upload(path, file, { contentType: file.type });
        if (!storageErr && storageData) {
          const { data: urlData } = supabase.storage.from('fatture').getPublicUrl(path);
          fileUrl = urlData?.publicUrl || null;
        }
      }

      setUploadProgress('Salvataggio...');
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('fatture_fornitori').insert({
        condominio_id:   condominioId,
        user_id:         user.id,
        fornitore:       datiAI.fornitore || 'Fornitore sconosciuto',
        numero_fattura:  datiAI.numero_fattura || null,
        data_fattura:    datiAI.data_fattura,
        data_scadenza:   datiAI.data_scadenza || null,
        importo_totale:  datiAI.importo_totale,
        importo_iva:     datiAI.importo_iva || 0,
        importo_netto:   datiAI.importo_netto || (datiAI.importo_totale - (datiAI.importo_iva || 0)),
        descrizione:     datiAI.descrizione || '',
        categoria:       datiAI.categoria || 'altro',
        stato:           'attesa',
        pdf_url:         fileUrl,          // rinominato concettualmente: ora può essere anche .docx
        ai_dati_estratti: datiAI,
      });

      if (error) throw error;

      setUploadProgress('✅ Fattura importata con successo');
      await loadFatture();
      setTimeout(() => setUploadProgress(''), 3000);
    } catch (e) {
      setErroreUpload('Errore: ' + e.message);
      setUploadProgress('');
    } finally {
      setUploading(false);
    }
  }

  // ─── Modifica inline ─────────────────────────────────────────
  function startEdit(f) {
    setEditingId(f.id);
    setEditData({
      fornitore:      f.fornitore,
      numero_fattura: f.numero_fattura || '',
      data_fattura:   f.data_fattura,
      data_scadenza:  f.data_scadenza || '',
      importo_totale: f.importo_totale,
      categoria:      f.categoria,
      stato:          f.stato,
      descrizione:    f.descrizione || '',
      spesa_id:       f.spesa_id || '',
    });
  }

  async function saveEdit(id) {
    const update = { ...editData };
    if (!update.data_scadenza)  delete update.data_scadenza;
    if (!update.numero_fattura) delete update.numero_fattura;
    if (!update.spesa_id) update.spesa_id = null;

    await supabase.from('fatture_fornitori').update(update).eq('id', id);
    setEditingId(null);
    await loadFatture();
  }

  async function eliminaFattura(id) {
    if (!confirm('Eliminare questa fattura?')) return;
    await supabase.from('fatture_fornitori').delete().eq('id', id);
    setFatture(prev => prev.filter(f => f.id !== id));
  }

  // ─── KPI ────────────────────────────────────────────────────
  const totaleAttesa   = fatture.filter(f => f.stato === 'attesa').reduce((a, f) => a + (f.importo_totale || 0), 0);
  const totalePagato   = fatture.filter(f => f.stato === 'pagata').reduce((a, f) => a + (f.importo_totale || 0), 0);
  const fattureFiltrate = filtroStato ? fatture.filter(f => f.stato === filtroStato) : fatture;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Fatture Fornitori</h1>
          <p style={styles.subtitle}>Carica fatture e collega alle spese condominiali</p>
        </div>
      </div>

      {/* KPI */}
      <div style={styles.kpiRow}>
        {[
          { label: 'Fatture totali',   value: fatture.length,                                                                              color: '#2563eb' },
          { label: 'Da pagare',        value: `€ ${totaleAttesa.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,                  color: '#f59e0b' },
          { label: 'Pagate',           value: `€ ${totalePagato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,                  color: '#16a34a' },
          { label: 'Non riconciliate', value: fatture.filter(f => !f.riconciliata).length,                                                color: '#8b5cf6' },
        ].map(k => (
          <div key={k.label} style={styles.kpiCard}>
            <div style={{ ...styles.kpiVal, color: k.color }}>{k.value}</div>
            <div style={styles.kpiLabel}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        style={{ ...styles.dropZone, ...(dragOver ? styles.dropActive : {}) }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
      >
        {/* ✅ accept aggiornato: .docx abilitato, .doc legacy rimosso */}
        <input
          type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.txt"
          style={{ display: 'none' }} id="fattura-upload"
          onChange={e => handleFile(e.target.files[0])}
          disabled={uploading}
        />
        <label htmlFor="fattura-upload" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{uploading ? '⏳' : '🧾'}</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
            {uploading ? uploadProgress : 'Trascina una fattura qui'}
          </div>
          {/* ✅ Descrizione formati aggiornata */}
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {uploading ? '' : 'PDF, DOCX, immagine, Excel, TXT — l\'AI estrarrà i dati automaticamente'}
          </div>
        </label>
      </div>

      {erroreUpload && <div style={styles.errMsg}>⚠️ {erroreUpload}</div>}

      {/* Filtri */}
      <div style={styles.toolbar}>
        <div style={styles.toggleGroup}>
          <button style={{ ...styles.tBtn, ...(filtroStato === '' ? styles.tBtnActive : {}) }} onClick={() => setFiltroStato('')}>Tutte</button>
          {Object.entries(STATI).map(([k, v]) => (
            <button key={k}
              style={{ ...styles.tBtn, ...(filtroStato === k ? { background: v.bg, color: v.color } : {}) }}
              onClick={() => setFiltroStato(k)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>Caricamento...</div>
      ) : fattureFiltrate.length === 0 ? (
        <div style={styles.empty}><div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div><p>Nessuna fattura. Carica la prima.</p></div>
      ) : (
        <div style={styles.lista}>
          {fattureFiltrate.map(f => {
            const isEditing = editingId === f.id;
            const stato     = STATI[f.stato] || STATI.attesa;

            return (
              <div key={f.id} style={styles.card}>
                {isEditing ? (
                  <EditFattura
                    data={editData}
                    onChange={setEditData}
                    onSave={() => saveEdit(f.id)}
                    onCancel={() => setEditingId(null)}
                    spese={spese}
                  />
                ) : (
                  <div style={styles.cardContent}>
                    <div style={styles.cardLeft}>
                      <div style={styles.cardTop}>
                        <span style={styles.fornitore}>{f.fornitore}</span>
                        <span style={{ ...styles.statoBadge, background: stato.bg, color: stato.color }}>{stato.label}</span>
                        {f.numero_fattura && <span style={styles.numFattura}>N. {f.numero_fattura}</span>}
                      </div>
                      <div style={styles.cardDesc}>{f.descrizione}</div>
                      <div style={styles.cardMeta}>
                        <span>📅 {new Date(f.data_fattura).toLocaleDateString('it-IT')}</span>
                        {f.data_scadenza && <span>⏰ Scad: {new Date(f.data_scadenza).toLocaleDateString('it-IT')}</span>}
                        <span style={styles.catBadge}>{f.categoria}</span>
                        {f.spesa_id && <span style={styles.spesaColleg}>🔗 Collegata a spesa</span>}
                        {f.pdf_url && <a href={f.pdf_url} target="_blank" rel="noreferrer" style={styles.pdfLink}>📄 File</a>}
                      </div>
                    </div>
                    <div style={styles.cardRight}>
                      <span style={styles.importo}>€ {(f.importo_totale || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                      {f.importo_iva > 0 && <span style={styles.iva}>IVA: € {f.importo_iva.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>}
                      <div style={styles.cardActions}>
                        <button style={styles.btnEdit} onClick={() => startEdit(f)}>✏️</button>
                        <button style={styles.btnDel}  onClick={() => eliminaFattura(f.id)}>✕</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditFattura({ data, onChange, onSave, onCancel, spese }) {
  const upd = (field, val) => onChange(prev => ({ ...prev, [field]: val }));
  return (
    <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {[
        { label: 'Fornitore',       field: 'fornitore',      type: 'text'   },
        { label: 'N° Fattura',      field: 'numero_fattura', type: 'text'   },
        { label: 'Data Fattura',    field: 'data_fattura',   type: 'date'   },
        { label: 'Data Scadenza',   field: 'data_scadenza',  type: 'date'   },
        { label: 'Importo Totale €',field: 'importo_totale', type: 'number' },
      ].map(({ label, field, type }) => (
        <div key={field}>
          <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>{label}</label>
          <input type={type} value={data[field] || ''} onChange={e => upd(field, e.target.value)}
            style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 7, padding: '7px 10px', color: '#e2e8f0', fontFamily: "'Sora', sans-serif", fontSize: 13, boxSizing: 'border-box' }} />
        </div>
      ))}
      <div>
        <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Stato</label>
        <select value={data.stato} onChange={e => upd('stato', e.target.value)}
          style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 7, padding: '7px 10px', color: '#e2e8f0', fontFamily: "'Sora', sans-serif", fontSize: 13 }}>
          {Object.entries({ attesa: 'In attesa', pagata: 'Pagata', contestata: 'Contestata', annullata: 'Annullata' }).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Collega a Spesa</label>
        <select value={data.spesa_id || ''} onChange={e => upd('spesa_id', e.target.value)}
          style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 7, padding: '7px 10px', color: '#e2e8f0', fontFamily: "'Sora', sans-serif", fontSize: 13 }}>
          <option value="">— Nessuna —</option>
          {spese.map(s => <option key={s.id} value={s.id}>{s.descrizione} (€ {s.importo})</option>)}
        </select>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={onCancel} style={{ background: 'none', border: '1px solid #334155', borderRadius: 7, padding: '7px 18px', color: '#94a3b8', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}>Annulla</button>
        <button onClick={onSave}   style={{ background: '#2563eb', border: 'none', borderRadius: 7, padding: '7px 18px', color: '#fff', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 700 }}>Salva</button>
      </div>
    </div>
  );
}

const styles = {
  page:        { fontFamily: "'Sora', sans-serif", color: '#e2e8f0', padding: 24 },
  header:      { marginBottom: 20 },
  title:       { margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' },
  subtitle:    { margin: '4px 0 0', fontSize: 13, color: '#64748b' },
  kpiRow:      { display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  kpiCard:     { flex: '1 1 140px', background: '#1e293b', borderRadius: 12, padding: '16px 20px', border: '1px solid #334155' },
  kpiVal:      { fontSize: 20, fontWeight: 700 },
  kpiLabel:    { fontSize: 11, color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' },
  dropZone:    { border: '2px dashed #334155', borderRadius: 16, padding: '32px 20px', textAlign: 'center', marginBottom: 20, background: '#1e293b10', transition: 'all 0.2s' },
  dropActive:  { borderColor: '#2563eb', background: '#2563eb10' },
  errMsg:      { background: '#ef444415', border: '1px solid #ef444440', borderRadius: 10, padding: '10px 16px', color: '#ef4444', fontSize: 13, marginBottom: 16 },
  toolbar:     { marginBottom: 16 },
  toggleGroup: { display: 'flex', background: '#1e293b', borderRadius: 8, padding: 2, gap: 2, flexWrap: 'wrap' },
  tBtn:        { background: 'none', border: 'none', color: '#64748b', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontSize: 13, fontWeight: 600, transition: 'all 0.2s' },
  tBtnActive:  { background: '#2563eb', color: '#fff' },
  empty:       { textAlign: 'center', padding: 60, color: '#475569' },
  lista:       { display: 'flex', flexDirection: 'column', gap: 10 },
  card:        { background: '#1e293b', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden' },
  cardContent: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 18px', gap: 16 },
  cardLeft:    { flex: 1, minWidth: 0 },
  cardTop:     { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  fornitore:   { fontWeight: 700, color: '#f1f5f9', fontSize: 15 },
  statoBadge:  { borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 },
  numFattura:  { color: '#64748b', fontSize: 12 },
  cardDesc:    { fontSize: 13, color: '#94a3b8', marginBottom: 6 },
  cardMeta:    { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#64748b' },
  catBadge:    { background: '#334155', color: '#94a3b8', borderRadius: 20, padding: '2px 8px', fontSize: 11 },
  spesaColleg: { color: '#60a5fa' },
  pdfLink:     { color: '#60a5fa', textDecoration: 'none', fontSize: 12 },
  cardRight:   { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  importo:     { fontSize: 18, fontWeight: 700, color: '#f1f5f9' },
  iva:         { fontSize: 11, color: '#64748b' },
  cardActions: { display: 'flex', gap: 6, marginTop: 6 },
  btnEdit:     { background: '#334155', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13 },
  btnDel:      { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14, padding: '4px 6px' },
};
