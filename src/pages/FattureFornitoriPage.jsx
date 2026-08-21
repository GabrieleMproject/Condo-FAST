import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { estraiFattura, getTipoFile, comprimiImmagine, estraiFileDaZip } from '../lib/fileExtractor';
import { parseFatturaXmlP7m } from '../lib/xmlFatturaParser';
import { calcolaFileHash } from '../lib/fileHash';
import { useFornitori } from '../hooks/useFornitori';
import { usePlan } from '../hooks/usePlan';
import ModalWarningPertinenza from '../components/ModalWarningPertinenza';
import ModalRichiestaPreventivo from '../components/ModalRichiestaPreventivo';
import { checkInvoiceMatch } from '../lib/partnerEngine';
import { Edit3, Trash2, AlertTriangle, Upload, Paperclip, Loader2, Receipt, Calendar, Clock, Link2, FileText, Store } from 'lucide-react';

const STATI = {
  attesa:     { label: 'In attesa',  color: '#f59e0b', bg: '#f59e0b20' },
  pagata:     { label: 'Pagata',     color: '#16a34a', bg: '#16a34a20' },
  contestata: { label: 'Contestata', color: '#ef4444', bg: '#ef444420' },
  annullata:  { label: 'Annullata',  color: 'var(--text-muted)', bg: '#64748b20' },
};

const CATEGORIE = ['manutenzione', 'pulizie', 'utenze', 'assicurazione', 'amministrazione', 'altro'];

// ─── Badge ritenuta/F24 DERIVATO (D1=1A) — non in DB ──────────────────────
// ritenuta IS NULL              → nessun badge
// stato != 'pagata'             → "Ritenuta · non pagata"
// stato='pagata' & f24 mancante → "In attesa F24"
// stato='pagata' & f24 presente → "Ritenuta completa"
function badgeRitenuta(f) {
  if (f.ritenuta_acconto == null) return null;
  if (f.stato !== 'pagata') return { label: 'Ritenuta · non pagata', color: '#f59e0b', bg: '#f59e0b20' };
  if (!f.f24_url)           return { label: 'In attesa F24',         color: '#ef4444', bg: '#ef444420' };
  return { label: 'Ritenuta completa', color: '#16a34a', bg: '#16a34a20' };
}

export default function FattureFornitoriPage() {
  const { condominioId } = useParams();
  const navigate = useNavigate();

  const [condominio, setCondominio]       = useState(null);
  const [warningModal, setWarningModal]   = useState(null);
  const [pendingFile, setPendingFile]     = useState(null);
  const [showPreventivoModal, setShowPreventivoModal] = useState(false);

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

  // F24 upload
  const f24InputRef            = useRef();
  const [f24TargetId, setF24TargetId] = useState(null);
  const [f24Busy, setF24Busy]  = useState(false);

  // Modulo Fiscale (Fornitori) e Piani
  const { canUse } = usePlan();
  const { fornitori, createFornitore } = useFornitori();
  const [pendingNewFornitore, setPendingNewFornitore] = useState(null);

  useEffect(() => {
    if (condominioId) {
      loadFatture();
      loadSpese();
      supabase.from('condomini').select('id, nome, codice_fiscale, indirizzo').eq('id', condominioId).single()
        .then(({ data }) => setCondominio(data));
    }
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
      .order('data_spesa', { ascending: false })
      .limit(50);
    setSpese(data || []);
  }

  // ─── Visualizzazione file sicura con Signed URL ──────────────
  async function visualizzaFile(urlOPath, bucket) {
    if (!urlOPath) return;
    if (urlOPath.startsWith('http://') || urlOPath.startsWith('https://')) {
      window.open(urlOPath, '_blank');
      return;
    }
    let newWindow = null;
    try {
      newWindow = window.open('about:blank', '_blank');
      if (!newWindow) {
        alert('Abilita i popup per visualizzare il file.');
        return;
      }
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(urlOPath, 900); // 15 minuti
      if (error) {
        newWindow.close();
        throw error;
      }
      if (data?.signedUrl) {
        newWindow.location.href = data.signedUrl;
      } else {
        newWindow.close();
        alert('Impossibile generare l\'URL per il file.');
      }
    } catch (err) {
      if (newWindow) newWindow.close();
      alert('Errore durante la generazione del link firmato: ' + err.message);
    }
  }

  function formattaData(dataStr) {
    if (!dataStr) return '';
    const d = new Date(dataStr);
    return isNaN(d.getTime()) ? dataStr : d.toLocaleDateString('it-IT');
  }

  // ─── Upload fattura (singolo o lotto / pacchetti ZIP) ──────────────────────
  async function handleFiles(rawFiles) {
    if (!rawFiles || (Array.isArray(rawFiles) ? rawFiles.length === 0 : !rawFiles.length && !(rawFiles instanceof File))) return;
    const fileList = rawFiles instanceof File ? [rawFiles] : Array.from(rawFiles);
    if (!fileList.length) return;

    setUploading(true);
    setErroreUpload('');
    setUploadProgress('Verifica e decompressione file in corso...');

    try {
      const filesEspansi = [];
      for (const f of fileList) {
        const tipo = getTipoFile(f);
        if (tipo === 'zip') {
          setUploadProgress(`Estrazione pacchetto ZIP: ${f.name}...`);
          const estratti = await estraiFileDaZip(f);
          if (estratti.length === 0) {
            setErroreUpload('Nessun file supportato (XML, p7m, PDF, immagini) trovato all\'interno dell\'archivio ZIP.');
          }
          filesEspansi.push(...estratti);
        } else {
          filesEspansi.push(f);
        }
      }

      if (filesEspansi.length === 0) {
        setUploading(false);
        setUploadProgress('');
        return;
      }

      let contatoreSalvati = 0;
      for (let i = 0; i < filesEspansi.length; i++) {
        const file = filesEspansi[i];
        const tipo = getTipoFile(file);
        if (tipo === 'unknown') continue;

        if (file.size > 15 * 1024 * 1024) {
          console.warn(`File ${file.name} supera 15MB, ignorato.`);
          continue;
        }

        // Controllo Feature Gate per Fatture Elettroniche XML/p7m
        if ((tipo === 'xml' || tipo === 'p7m') && !canUse('fatturazione_xml_sdi')) {
          setErroreUpload('L\'importazione nativa delle Fatture Elettroniche XML/p7m è una funzionalità esclusiva del piano Professional.');
          continue;
        }

        const prefix = filesEspansi.length > 1 ? `[${i + 1}/${filesEspansi.length}] ${file.name}: ` : '';
        setUploadProgress(`${prefix}Controllo duplicati e hash...`);

        // Controllo Anti-Duplicato SHA-256
        const hash = await calcolaFileHash(file);
        if (hash) {
          const { data: fatturaEsistente } = await supabase
            .from('fatture_fornitori')
            .select('id, fornitore, data_fattura, importo_totale')
            .eq('condominio_id', condominioId)
            .eq('file_hash', hash)
            .maybeSingle();

          if (fatturaEsistente) {
            if (filesEspansi.length === 1) {
              const confermata = window.confirm(
                `ATTENZIONE DUPLICATO:\nQuesto documento risulta già caricato nel sistema per la fattura "${fatturaEsistente.fornitore}" del ${fatturaEsistente.data_fattura} (€ ${fatturaEsistente.importo_totale}).\n\nVuoi procedere comunque col ricaricamento?`
              );
              if (!confermata) continue;
            } else {
              // In batch o ZIP, salta duplicato
              continue;
            }
          }
        }

        let datiAI = null;
        let fileCompresso = file;

        if (tipo === 'xml' || tipo === 'p7m') {
          setUploadProgress(`${prefix}Estrazione nativa XML SDI (0ms)...`);
          try {
            const resXml = await parseFatturaXmlP7m(file);
            datiAI = resXml?.dati || resXml;
          } catch (xmlErr) {
            console.warn(`File XML ${file.name} non conforme a fattura:`, xmlErr.message);
            continue;
          }
        } else {
          fileCompresso = await comprimiImmagine(file);
          setUploadProgress(`${prefix}Estrazione dati con AI...`);
          datiAI = await estraiFattura(fileCompresso, condominio);
        }

        if (!datiAI) continue;

        if (datiAI?._warningPertinenza && filesEspansi.length === 1) {
          setPendingFile({ fileCompresso, datiAI, tipo, hash });
          setWarningModal({
            slotErrato: datiAI._warningPertinenza.slotErrato ? {
              tipoRilevato: datiAI._warningPertinenza.slotErrato.tipoRilevato,
              slotAtteso: 'Fatture Fornitori'
            } : null,
            condominioErrato: datiAI._warningPertinenza.condominioErrato ? {
              intestatarioRilevato: datiAI._warningPertinenza.condominioErrato.intestatarioRilevato,
              condominioAttivoNome: condominio?.nome || 'Condominio Corrente',
              motivoDiscrepanza: datiAI._warningPertinenza.condominioErrato.motivoDiscrepanza
            } : null
          });
          setUploading(false);
          setUploadProgress('');
          return;
        }

        setUploadProgress(`${prefix}Salvataggio nel database...`);
        await salvaFatturaEstratta(fileCompresso, datiAI, tipo, hash);
        contatoreSalvati++;
      }

      await loadFatture();
      if (filesEspansi.length > 1) {
        setUploadProgress(`Completato! ${contatoreSalvati} fatture elaborate con successo.`);
        setTimeout(() => {
          setUploading(false);
          setUploadProgress('');
        }, 2000);
      } else {
        setUploading(false);
        setUploadProgress('');
      }
    } catch (e) {
      setErroreUpload('Errore: ' + e.message);
      setUploadProgress('');
      setUploading(false);
    }
  }

  async function handleFile(file) {
    return handleFiles([file]);
  }

  async function salvaFatturaEstratta(fileCompresso, datiAI, tipo, hash = '') {
    setUploading(true);
    setUploadProgress('Salvataggio...');
    try {
      let fileUrl = null;
      if (tipo !== 'unknown') {
        setUploadProgress('Caricamento file su storage...');
        const { data: { user } } = await supabase.auth.getUser();
        const path = `${user.id}/${condominioId}/${Date.now()}_${fileCompresso.name}`;
        const { data: storageData, error: storageErr } = await supabase.storage
          .from('fatture')
          .upload(path, fileCompresso, { contentType: fileCompresso.type });
        if (!storageErr && storageData) {
          fileUrl = path;
        }
      }

      setUploadProgress('Salvataggio...');
      const { data: { user } } = await supabase.auth.getUser();

      const { error, data: insertedRow } = await supabase.from('fatture_fornitori').insert({
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
        pdf_url:         fileUrl,
        file_hash:       hash || null,
        ai_dati_estratti: datiAI,
        imponibile_ritenuta: datiAI.imponibile_ritenuta || 0.00,
        aliquota_ritenuta_percentuale: datiAI.aliquota_ritenuta_percentuale || 0.00,
        importo_ritenuta: datiAI.importo_ritenuta || 0.00,
        ritenuta_acconto: datiAI.importo_ritenuta || 0.00,
        codice_tributo_f24: datiAI.codice_tributo_f24 || null,
      }).select().single();

      if (error) throw error;

      setUploadProgress('Fattura importata con successo');
      await loadFatture();
      
      // Controllo Fornitore per Modulo Fiscale
      if (datiAI.partita_iva_fornitore || datiAI.fornitore) {
        const pIvaClean = (datiAI.partita_iva_fornitore || '').replace(/\s+/g, '');
        let fornitoreTrovato = null;
        
        if (pIvaClean) {
          fornitoreTrovato = fornitori.find(f => f.partita_iva === pIvaClean || f.codice_fiscale === pIvaClean);
        } else {
          const nomeClean = (datiAI.fornitore || '').trim().toLowerCase();
          fornitoreTrovato = fornitori.find(f => f.ragione_sociale.toLowerCase() === nomeClean);
        }

        if (fornitoreTrovato) {
          await supabase.from('fatture_fornitori').update({ fornitore_id: fornitoreTrovato.id }).eq('id', insertedRow.id);
          await loadFatture();
        } else {
          setPendingNewFornitore({ 
            fatturaId: insertedRow.id, 
            ragioneSociale: datiAI.fornitore || '', 
            partitaIva: pIvaClean 
          });
        }
      }

      // Auto-match fornitore partner per provvigioni
      if (datiAI.partita_iva_fornitore && insertedRow?.id) {
        checkInvoiceMatch(
          insertedRow.id,
          datiAI.partita_iva_fornitore,
          datiAI.importo_totale,
          datiAI.data_fattura,
          datiAI.numero_fattura,
          condominioId,
          user.id
        ).catch(err => console.warn("Auto match partner warning:", err));
      }

      setTimeout(() => setUploadProgress(''), 3000);
    } catch (e) {
      setErroreUpload('Errore: ' + e.message);
      setUploadProgress('');
    } finally {
      setUploading(false);
      setPendingFile(null);
      setWarningModal(null);
    }
  }

  // ─── Upload quietanza F24 (path canonico §3) ─────────────────
  function pickF24(fatturaId) {
    setF24TargetId(fatturaId);
    f24InputRef.current?.click();
  }

  async function onF24Selected(e) {
    const file = e.target.files?.[0];
    const id   = f24TargetId;
    e.target.value = '';
    setF24TargetId(null);
    if (!file || !id) return;

    const MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!MIME.includes(file.type)) {
      setErroreUpload('F24: usa PDF, JPG, PNG o WEBP.');
      return;
    }

    setF24Busy(true);
    setErroreUpload('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // path CANONICO: ${uid}/${condominioId}/f24_${idFattura}_${file.name}
      const path = `${user.id}/${condominioId}/f24_${id}_${file.name}`;
      const { error: se } = await supabase.storage
        .from('fatture')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (se) throw se;

      const { error: ue } = await supabase
        .from('fatture_fornitori')
        .update({ f24_url: path, f24_caricato_at: new Date().toISOString() })
        .eq('id', id);
      if (ue) throw ue;

      await loadFatture();
    } catch (err) {
      setErroreUpload('Errore upload F24: ' + err.message);
    } finally {
      setF24Busy(false);
    }
  }

  // ─── Modifica inline ─────────────────────────────────────────
  function startEdit(f) {
    setEditingId(f.id);
    setEditData({
      fornitore_id:     f.fornitore_id || '',
      fornitore:        f.fornitore,
      numero_fattura:   f.numero_fattura || '',
      data_fattura:     f.data_fattura,
      data_scadenza:    f.data_scadenza || '',
      importo_totale:   f.importo_totale,
      categoria:        f.categoria,
      stato:            f.stato,
      descrizione:      f.descrizione || '',
      spesa_id:         f.spesa_id || '',
      ritenuta_acconto: f.ritenuta_acconto ?? '',
      imponibile_ritenuta: f.imponibile_ritenuta ?? 0,
      aliquota_ritenuta_percentuale: f.aliquota_ritenuta_percentuale ?? 0,
      importo_ritenuta: f.importo_ritenuta ?? 0,
      codice_tributo_f24: f.codice_tributo_f24 || '',
      data_pagamento: f.data_pagamento || '',
    });
  }

  async function saveEdit(id) {
    const update = { ...editData };
    if (!update.data_scadenza)  delete update.data_scadenza;
    if (!update.numero_fattura) delete update.numero_fattura;
    if (!update.spesa_id) update.spesa_id = null;
    if (!update.fornitore_id) update.fornitore_id = null;
    
    update.imponibile_ritenuta = parseFloat(update.imponibile_ritenuta) || 0;
    update.aliquota_ritenuta_percentuale = parseFloat(update.aliquota_ritenuta_percentuale) || 0;
    update.importo_ritenuta = parseFloat(update.importo_ritenuta) || 0;
    update.ritenuta_acconto = update.importo_ritenuta;
    update.codice_tributo_f24 = update.codice_tributo_f24 || null;
    
    if (update.stato === 'pagata') {
      update.data_pagamento = update.data_pagamento || new Date().toISOString().split('T')[0];
    } else {
      update.data_pagamento = null;
    }

    const { error } = await supabase.from('fatture_fornitori').update(update).eq('id', id);
    if (error) {
      alert('Errore durante il salvataggio: ' + error.message);
      return;
    }
    setEditingId(null);
    await loadFatture();
  }

  async function eliminaFattura(id) {
    if (!confirm('Eliminare questa fattura?')) return;
    
    // Trova la fattura localmente per recuperare i path dei file
    const f = fatture.find(x => x.id === id);
    if (f) {
      const pathsToRemove = [];
      if (f.pdf_url && !f.pdf_url.startsWith('http://') && !f.pdf_url.startsWith('https://')) {
        pathsToRemove.push(f.pdf_url);
      }
      if (f.f24_url && !f.f24_url.startsWith('http://') && !f.f24_url.startsWith('https://')) {
        pathsToRemove.push(f.f24_url);
      }
      if (pathsToRemove.length > 0) {
        try {
          await supabase.storage.from('fatture').remove(pathsToRemove);
        } catch (storageErr) {
          console.error('Errore rimozione file da storage:', storageErr);
        }
      }
    }

    const { error } = await supabase.from('fatture_fornitori').delete().eq('id', id);
    if (error) {
      alert('Errore durante l\'eliminazione: ' + error.message);
      return;
    }
    setFatture(prev => prev.filter(f => f.id !== id));
  }

  // ─── KPI ────────────────────────────────────────────────────
  const totaleAttesa   = fatture.filter(f => f.stato === 'attesa').reduce((a, f) => a + (f.importo_totale || 0), 0);
  const totalePagato   = fatture.filter(f => f.stato === 'pagata').reduce((a, f) => a + (f.importo_totale || 0), 0);
  const attesaF24      = fatture.filter(f => f.ritenuta_acconto != null && f.stato === 'pagata' && !f.f24_url);

  const fattureFiltrate =
    filtroStato === '__f24'
      ? attesaF24
      : filtroStato
      ? fatture.filter(f => f.stato === filtroStato)
      : fatture;

  return (
    <div style={styles.page}>
      {/* input nascosto per quietanza F24 */}
      <input
        ref={f24InputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
        style={{ display: 'none' }} onChange={onF24Selected}
      />

      <div style={{ ...styles.header, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={styles.title}>Fatture Fornitori</h1>
          <p style={styles.subtitle}>Carica fatture e collega alle spese condominiali</p>
        </div>
        <button
          onClick={() => setShowPreventivoModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            color: '#3b82f6',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Store size={16} /> Richiedi Preventivo Convenzionato
        </button>
      </div>

      {/* KPI */}
      <div style={styles.kpiRow}>
        {[
          { label: 'Fatture totali',   value: fatture.length,                                                                color: '#2563eb' },
          { label: 'Da pagare',        value: `€ ${totaleAttesa.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,    color: '#f59e0b' },
          { label: 'Pagate',           value: `€ ${totalePagato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,    color: '#16a34a' },
          { label: 'In attesa F24',    value: attesaF24.length,                                                              color: '#ef4444' },
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
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        <input
          type="file" multiple accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.txt,.xml,.p7m,.zip"
          style={{ display: 'none' }} id="fattura-upload"
          onChange={e => handleFiles(e.target.files)}
          disabled={uploading}
        />
        <label htmlFor="fattura-upload" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
          <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
            {uploading ? <Loader2 size={36} className="spin" color="var(--primary)" /> : <Receipt size={36} color="var(--text-muted)" />}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            {uploading ? uploadProgress : 'Trascina le fatture o archivi ZIP qui'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {uploading ? '' : 'ZIP (Cassetto Fiscale AdE), XML, p7m, PDF, DOCX, immagine, Excel — estrazione nativa SDI o con IA'}
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
        <div style={styles.toggleGroup}>
          <button style={{ ...styles.tBtn, ...(filtroStato === '' ? styles.tBtnActive : {}) }} onClick={() => setFiltroStato('')}>Tutte</button>
          {Object.entries(STATI).map(([k, v]) => (
            <button key={k}
              style={{ ...styles.tBtn, ...(filtroStato === k ? { background: v.bg, color: v.color } : {}) }}
              onClick={() => setFiltroStato(k)}>
              {v.label}
            </button>
          ))}
          <button
            style={{ ...styles.tBtn, ...(filtroStato === '__f24' ? { background: '#ef444420', color: '#ef4444' } : {}) }}
            onClick={() => setFiltroStato('__f24')}>
            In attesa F24{attesaF24.length ? ` (${attesaF24.length})` : ''}
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Caricamento...</div>
      ) : fattureFiltrate.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
            <Receipt size={40} color="var(--text-muted)" strokeWidth={1.5} />
          </div>
          <p>Nessuna fattura.</p>
        </div>
      ) : (
        <div style={styles.lista}>
          {fattureFiltrate.map(f => {
            const isEditing = editingId === f.id;
            const stato     = STATI[f.stato] || STATI.attesa;
            const bRit      = badgeRitenuta(f);

            return (
              <div key={f.id} style={styles.card}>
                {isEditing ? (
                  <EditFattura
                    data={editData}
                    onChange={setEditData}
                    onSave={() => saveEdit(f.id)}
                    onCancel={() => setEditingId(null)}
                    spese={spese}
                    fornitori={fornitori}
                  />
                ) : (
                  <div style={styles.cardContent}>
                    <div style={styles.cardLeft}>
                      <div style={styles.cardTop}>
                        <span style={styles.fornitore}>{f.fornitore}</span>
                        <span style={{ ...styles.statoBadge, background: stato.bg, color: stato.color }}>{stato.label}</span>
                        {bRit && <span style={{ ...styles.statoBadge, background: bRit.bg, color: bRit.color }}>{bRit.label}</span>}
                        {f.numero_fattura && <span style={styles.numFattura}>N. {f.numero_fattura}</span>}
                      </div>
                      <div style={styles.cardDesc}>{f.descrizione}</div>
                      <div style={styles.cardMeta}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={13} /> {formattaData(f.data_fattura)}</span>
                        {f.data_scadenza && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={13} /> Scad: {formattaData(f.data_scadenza)}</span>}
                        <span style={styles.catBadge}>{f.categoria}</span>
                        {f.spesa_id && <span style={{ ...styles.spesaColleg, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Link2 size={13} /> Collegata a spesa</span>}
                        {f.pdf_url && (
                          <button
                            onClick={() => visualizzaFile(f.pdf_url, 'fatture')}
                            style={{ ...styles.pdfLink, background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <FileText size={13} /> File
                          </button>
                        )}
                        {f.ritenuta_acconto != null && (
                          <span>R.A.: € {Number(f.ritenuta_acconto).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                        )}
                        {f.ritenuta_acconto != null && f.stato === 'pagata' && (
                          f.f24_url
                            ? <button
                                onClick={() => visualizzaFile(f.f24_url, 'fatture')}
                                style={{ ...styles.pdfLink, background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <Paperclip size={12} /> F24
                              </button>
                            : <button style={styles.f24Btn} disabled={f24Busy} onClick={() => pickF24(f.id)}>
                                {f24Busy ? '…' : (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <Upload size={12} /> Carica F24
                                  </span>
                                )}
                              </button>
                        )}
                      </div>
                    </div>
                    <div style={styles.cardRight}>
                      <span style={styles.importo}>€ {(f.importo_totale || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                      {f.importo_iva > 0 && <span style={styles.iva}>IVA: € {f.importo_iva.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>}
                      <div style={styles.cardActions}>
                        <button style={styles.btnEdit} onClick={() => startEdit(f)} type="button"><Edit3 size={12} /></button>
                        <button style={styles.btnDel}  onClick={() => eliminaFattura(f.id)} type="button"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nuovo Fornitore */}
      {pendingNewFornitore && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, width: 450 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: 'var(--text-primary)' }}>Nuovo Fornitore Rilevato</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
              L'AI ha rilevato un nuovo fornitore nella fattura. Vuoi salvarlo in rubrica per utilizzarlo nelle <b>Certificazioni Fiscali (CU/770)</b>?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>Ragione Sociale</label>
                <input 
                  type="text" 
                  value={pendingNewFornitore.ragioneSociale} 
                  onChange={e => setPendingNewFornitore({ ...pendingNewFornitore, ragioneSociale: e.target.value })}
                  style={{ ...styles.input, width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>P.IVA / CF</label>
                <input 
                  type="text" 
                  value={pendingNewFornitore.partitaIva} 
                  onChange={e => setPendingNewFornitore({ ...pendingNewFornitore, partitaIva: e.target.value })}
                  style={{ ...styles.input, width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button 
                onClick={() => setPendingNewFornitore(null)}
                style={{ ...styles.filterBtn(false), padding: '8px 16px', background: 'transparent' }}
              >
                Ignora per ora
              </button>
              <button 
                onClick={async () => {
                  try {
                    const newFornitore = await createFornitore({ 
                      ragione_sociale: pendingNewFornitore.ragioneSociale || 'Fornitore sconosciuto', 
                      partita_iva: pendingNewFornitore.partitaIva || null
                    });
                    await supabase.from('fatture_fornitori').update({ fornitore_id: newFornitore.id }).eq('id', pendingNewFornitore.fatturaId);
                    await loadFatture();
                    setPendingNewFornitore(null);
                  } catch(e) {
                    alert('Errore: ' + e.message);
                  }
                }}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
              >
                Salva in Rubrica
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Avviso Pertinenza Documento */}
      <ModalWarningPertinenza
        isOpen={!!warningModal}
        onClose={() => { setWarningModal(null); setPendingFile(null); }}
        warning={warningModal}
        onProcediComunque={() => {
          if (pendingFile) {
            salvaFatturaEstratta(pendingFile.fileCompresso, pendingFile.datiAI, pendingFile.tipo);
          }
        }}
        onSposta={() => {
          const tipo = warningModal?.slotErrato?.tipoRilevato || '';
          setWarningModal(null);
          setPendingFile(null);
          if (tipo.includes('estratto')) {
            navigate(`/condomini/${condominioId}/estratto-conto`);
          } else {
            navigate(`/condomini/${condominioId}`);
          }
        }}
      />

      {/* Modale Richiesta Preventivo Convenzionato */}
      {showPreventivoModal && (
        <ModalRichiestaPreventivo
          condominio={condominio}
          onClose={() => setShowPreventivoModal(false)}
        />
      )}

    </div>
  );
}

function EditFattura({ data, onChange, onSave, onCancel, spese, fornitori }) {
  const upd = (field, val) => {
    onChange(prev => {
      let next = { ...prev, [field]: val };
      if (field === 'imponibile_ritenuta' || field === 'aliquota_ritenuta_percentuale') {
        const imp = parseFloat(field === 'imponibile_ritenuta' ? val : next.imponibile_ritenuta) || 0;
        const aliq = parseFloat(field === 'aliquota_ritenuta_percentuale' ? val : next.aliquota_ritenuta_percentuale) || 0;
        const calcolata = (imp * aliq / 100).toFixed(2);
        next.importo_ritenuta = calcolata;
        next.ritenuta_acconto = calcolata;
      }
      if (field === 'stato' && val !== 'pagata') {
        next.data_pagamento = '';
      } else if (field === 'stato' && val === 'pagata' && !next.data_pagamento) {
        next.data_pagamento = new Date().toISOString().split('T')[0];
      }
      return next;
    });
  };

  return (
    <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Fornitore (Rubrica)</label>
        <select value={data.fornitore_id || ''} onChange={e => upd('fornitore_id', e.target.value)}
          style={{ width: '100%', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontFamily: "'Sora', sans-serif", fontSize: 13, marginBottom: 4 }}>
          <option value="">-- Seleziona Fornitore --</option>
          {fornitori && fornitori.map(f => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
        </select>
        <input type="text" placeholder="Oppure testo libero..." value={data.fornitore ?? ''} onChange={e => upd('fornitore', e.target.value)}
            style={{ width: '100%', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontFamily: "'Sora', sans-serif", fontSize: 13, boxSizing: 'border-box' }} />
      </div>
      {[
        { label: 'N° Fattura',         field: 'numero_fattura',   type: 'text'   },
        { label: 'Data Fattura',       field: 'data_fattura',     type: 'date'   },
        { label: 'Data Scadenza',      field: 'data_scadenza',    type: 'date'   },
        { label: 'Importo Totale €',   field: 'importo_totale',   type: 'number' },
      ].map(({ label, field, type }) => (
        <div key={field}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
          <input type={type} step={type === 'number' ? '0.01' : undefined} value={data[field] ?? ''} onChange={e => upd(field, e.target.value)}
            style={{ width: '100%', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontFamily: "'Sora', sans-serif", fontSize: 13, boxSizing: 'border-box' }} />
        </div>
      ))}
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Imponibile Ritenuta €</label>
        <input type="number" step="0.01" value={data.imponibile_ritenuta ?? ''} onChange={e => upd('imponibile_ritenuta', e.target.value)}
          style={{ width: '100%', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontFamily: "'Sora', sans-serif", fontSize: 13, boxSizing: 'border-box' }} />
      </div>
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Aliquota Ritenuta %</label>
        <input type="number" step="0.01" value={data.aliquota_ritenuta_percentuale ?? ''} onChange={e => upd('aliquota_ritenuta_percentuale', e.target.value)}
          style={{ width: '100%', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontFamily: "'Sora', sans-serif", fontSize: 13, boxSizing: 'border-box' }} />
      </div>
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Importo Ritenuta €</label>
        <input type="number" step="0.01" value={data.importo_ritenuta ?? ''} onChange={e => upd('importo_ritenuta', e.target.value)}
          style={{ width: '100%', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontFamily: "'Sora', sans-serif", fontSize: 13, boxSizing: 'border-box' }} />
      </div>
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Codice Tributo F24</label>
        <select value={data.codice_tributo_f24 || ''} onChange={e => upd('codice_tributo_f24', e.target.value)}
          style={{ width: '100%', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontFamily: "'Sora', sans-serif", fontSize: 13 }}>
          <option value="">Nessuno (Esente / Forfettario / Beni)</option>
          <option value="1019">1019 (Contratti d'appalto - 4% IRPEF)</option>
          <option value="1020">1020 (Contratti d'opera - 4% IRES)</option>
          <option value="1040">1040 (Lavoro autonomo / Professionisti - 20%)</option>
          <option value="1038">1038 (Provvigioni agenti / mediatori)</option>
        </select>
      </div>
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Netto a Pagare al Fornitore (Bonifico)</label>
        <div style={{ padding: '7px 10px', background: 'var(--card-bg)', border: '1px dashed var(--border-color)', borderRadius: 7, color: '#10b981', fontWeight: 600, fontSize: 13 }}>
          € {Math.max(0, (parseFloat(data.importo_totale) || 0) - (parseFloat(data.importo_ritenuta) || 0)).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Stato</label>
        <select value={data.stato} onChange={e => upd('stato', e.target.value)}
          style={{ width: '100%', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontFamily: "'Sora', sans-serif", fontSize: 13 }}>
          {Object.entries({ attesa: 'In attesa', pagata: 'Pagata', contestata: 'Contestata', annullata: 'Annullata' }).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      {data.stato === 'pagata' && (
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Data Pagamento</label>
          <input type="date" value={data.data_pagamento ?? ''} onChange={e => upd('data_pagamento', e.target.value)}
            style={{ width: '100%', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontFamily: "'Sora', sans-serif", fontSize: 13, boxSizing: 'border-box' }} />
        </div>
      )}
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Collega a Spesa</label>
        <select value={data.spesa_id || ''} onChange={e => upd('spesa_id', e.target.value)}
          style={{ width: '100%', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontFamily: "'Sora', sans-serif", fontSize: 13 }}>
          <option value="">— Nessuna —</option>
          {spese.map(s => <option key={s.id} value={s.id}>{s.descrizione} (€ {s.importo})</option>)}
        </select>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={onCancel} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 7, padding: '7px 18px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}>Annulla</button>
        <button onClick={onSave}   style={{ background: '#2563eb', border: 'none', borderRadius: 7, padding: '7px 18px', color: '#fff', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 700 }}>Salva</button>
      </div>
    </div>
  );
}

const styles = {
  page:        { fontFamily: "'Sora', sans-serif", color: 'var(--text-primary)', padding: 24 },
  header:      { marginBottom: 20 },
  title:       { margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' },
  subtitle:    { margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' },
  kpiRow:      { display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  kpiCard:     { flex: '1 1 140px', background: 'var(--card-bg)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--border-color)' },
  kpiVal:      { fontSize: 20, fontWeight: 700 },
  kpiLabel:    { fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' },
  dropZone:    { border: '2px dashed var(--border-color)', borderRadius: 16, padding: '32px 20px', textAlign: 'center', marginBottom: 20, background: 'rgba(128,128,128,0.06)', transition: 'all 0.2s' },
  dropActive:  { borderColor: '#2563eb', background: '#2563eb10' },
  errMsg:      { background: '#ef444415', border: '1px solid #ef444440', borderRadius: 10, padding: '10px 16px', color: '#ef4444', fontSize: 13, marginBottom: 16 },
  toolbar:     { marginBottom: 16 },
  toggleGroup: { display: 'flex', background: 'var(--card-bg)', borderRadius: 8, padding: 2, gap: 2, flexWrap: 'wrap' },
  tBtn:        { background: 'none', border: 'none', color: 'var(--text-muted)', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontSize: 13, fontWeight: 600, transition: 'all 0.2s' },
  tBtnActive:  { background: '#2563eb', color: '#fff' },
  empty:       { textAlign: 'center', padding: 60, color: 'var(--text-muted)' },
  lista:       { display: 'flex', flexDirection: 'column', gap: 10 },
  card:        { background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' },
  cardContent: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 18px', gap: 16 },
  cardLeft:    { flex: 1, minWidth: 0 },
  cardTop:     { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  fornitore:   { fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 },
  statoBadge:  { borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 },
  numFattura:  { color: 'var(--text-muted)', fontSize: 12 },
  cardDesc:    { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 },
  cardMeta:    { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' },
  catBadge:    { background: 'var(--border-color)', color: 'var(--text-secondary)', borderRadius: 20, padding: '2px 8px', fontSize: 11 },
  spesaColleg: { color: '#60a5fa' },
  pdfLink:     { color: '#60a5fa', textDecoration: 'none', fontSize: 12 },
  f24Btn:      { background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', borderRadius: 6, padding: '2px 10px', fontSize: 11, cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 600 },
  cardRight:   { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  importo:     { fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' },
  iva:         { fontSize: 11, color: 'var(--text-muted)' },
  cardActions: { display: 'flex', gap: 6, marginTop: 6 },
  btnEdit:     { background: 'var(--border-color)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13 },
  btnDel:      { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '4px 6px' },
};