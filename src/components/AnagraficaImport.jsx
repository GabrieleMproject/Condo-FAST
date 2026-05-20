// src/components/AnagraficaImport.jsx
import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

// ── Colonne attese (flessibili — l'AI normalizza i nomi) ──────────────────
const CAMPI_ATTESI = ['nome','cognome','email','telefono','indirizzo','citta','cap','provincia','codice_fiscale','ruolo','unita']

// ── Parsing XLSX / CSV ────────────────────────────────────────────────────
function parseXlsx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      resolve(rows)
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: reject,
    })
  })
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// ── AI parsing via Claude API ──────────────────────────────────────────────
async function parseWithAI(file, fileType) {
  let messages = []

  if (fileType === 'pdf') {
    const base64 = await readFileAsBase64(file)
    messages = [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 }
        },
        {
          type: 'text',
          text: `Estrai tutti i dati anagrafici di persone presenti in questo documento.
Per ogni persona restituisci un oggetto JSON con questi campi (lascia vuoto "" se non presente):
nome, cognome, email, telefono, indirizzo, citta, cap, provincia, codice_fiscale, ruolo (proprietario/inquilino/""), unita (numero unità/appartamento se presente).
Rispondi SOLO con un array JSON valido, senza testo aggiuntivo, senza backtick markdown.
Esempio: [{"nome":"Mario","cognome":"Rossi","email":"mario@example.com","telefono":"3331234567","indirizzo":"Via Roma 1","citta":"Milano","cap":"20100","provincia":"MI","codice_fiscale":"RSSMRA80A01F205X","ruolo":"proprietario","unita":"3"}]`
        }
      ]
    }]
  } else {
    // docx → leggi come testo
    const text = await readFileAsText(file)
    messages = [{
      role: 'user',
      content: `Estrai tutti i dati anagrafici di persone presenti in questo testo.
Per ogni persona restituisci un oggetto JSON con questi campi (lascia vuoto "" se non presente):
nome, cognome, email, telefono, indirizzo, citta, cap, provincia, codice_fiscale, ruolo (proprietario/inquilino/""), unita.
Rispondi SOLO con un array JSON valido, senza testo aggiuntivo, senza backtick markdown.

TESTO:
${text.substring(0, 15000)}`
    }]
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages,
    })
  })

  const data = await response.json()
  const text_response = data.content?.map(b => b.text || '').join('').trim()

  // Pulizia robusta JSON
  const cleaned = text_response
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  return JSON.parse(cleaned)
}

// ── Normalizza un array di righe grezze → struttura standard ───────────────
function normalizeRows(rows) {
  return rows.map(row => {
    const normalized = {}
    // Mappa chiavi non standard → standard (case insensitive, trim)
    for (const [k, v] of Object.entries(row)) {
      const key = k.toLowerCase().trim()
        .replace(/\s+/g, '_')
        .replace('cognome', 'cognome')
        .replace('nome', 'nome')
        .replace('telefono', 'telefono')
        .replace('cell', 'telefono')
        .replace('cellulare', 'telefono')
        .replace('tel', 'telefono')
        .replace('mail', 'email')
        .replace('cf', 'codice_fiscale')
        .replace('codice_fiscale', 'codice_fiscale')
        .replace('indirizzo_residenza', 'indirizzo')
        .replace('via', 'indirizzo')
        .replace('comune', 'citta')
        .replace('città', 'citta')
        .replace('città', 'citta')
        .replace('prov', 'provincia')
        .replace('appartamento', 'unita')
        .replace('interno', 'unita')

      if (CAMPI_ATTESI.includes(key)) normalized[key] = String(v || '').trim()
      else if (!normalized[key]) normalized[key] = String(v || '').trim()
    }
    return normalized
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════
export default function AnagraficaImport({ onImport, onClose }) {
  const [step, setStep]         = useState('upload')   // upload | preview | importing | done
  const [rows, setRows]         = useState([])
  const [fileName, setFileName] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError]       = useState(null)
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef()

  // ── Gestione file drop/select ──────────────────────────────────────────
  const handleFile = async (file) => {
    if (!file) return
    setError(null)
    setFileName(file.name)
    const ext = file.name.split('.').pop().toLowerCase()

    try {
      let parsed = []

      if (ext === 'xlsx' || ext === 'xls') {
        const raw = await parseXlsx(file)
        parsed = normalizeRows(raw)
      } else if (ext === 'csv') {
        const raw = await parseCsv(file)
        parsed = normalizeRows(raw)
      } else if (ext === 'pdf' || ext === 'docx' || ext === 'doc') {
        setAiLoading(true)
        parsed = await parseWithAI(file, ext === 'pdf' ? 'pdf' : 'docx')
        setAiLoading(false)
      } else {
        throw new Error('Formato non supportato. Usa xlsx, csv, pdf o docx.')
      }

      if (!parsed || parsed.length === 0) throw new Error('Nessun dato trovato nel file.')
      setRows(parsed)
      setStep('preview')
    } catch (err) {
      setAiLoading(false)
      setError(err.message)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // ── Modifica riga in preview ───────────────────────────────────────────
  const updateCell = (rowIdx, field, value) => {
    setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: value } : r))
  }

  const removeRow = (rowIdx) => {
    setRows(prev => prev.filter((_, i) => i !== rowIdx))
  }

  // ── Conferma import ────────────────────────────────────────────────────
  const handleConfirm = async () => {
    setStep('importing')
    try {
      const result = await onImport(rows)
      setImportResult(result)
      setStep('done')
    } catch (err) {
      setError(err.message)
      setStep('preview')
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>

        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Importa Anagrafica</h2>
            <p style={styles.subtitle}>Carica un file con i dati di proprietari e inquilini</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* ── STEP: UPLOAD ─────────────────────────────── */}
        {step === 'upload' && (
          <div style={styles.body}>
            <div
              style={styles.dropzone}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
            >
              {aiLoading ? (
                <div style={styles.aiLoading}>
                  <div style={styles.spinner} />
                  <p style={{ color: '#60a5fa', margin: '12px 0 4px' }}>Claude sta analizzando il documento…</p>
                  <p style={{ color: '#64748b', fontSize: '13px' }}>Estrazione dati con AI in corso</p>
                </div>
              ) : (
                <>
                  <div style={styles.uploadIcon}>📂</div>
                  <p style={styles.dropText}>Trascina qui il file o <span style={styles.link}>clicca per sfogliare</span></p>
                  <p style={styles.dropSub}>Formati supportati: <strong>XLSX, CSV</strong> (parsing diretto) · <strong>PDF, DOCX</strong> (estrazione AI)</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.docx,.doc"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            {/* Template download hint */}
            <div style={styles.templateHint}>
              <span style={{ color: '#94a3b8' }}>💡 Formato consigliato colonne XLSX/CSV:</span>
              <code style={styles.code}>nome · cognome · email · telefono · indirizzo · citta · cap · provincia · codice_fiscale · ruolo · unita</code>
            </div>
          </div>
        )}

        {/* ── STEP: PREVIEW ────────────────────────────── */}
        {step === 'preview' && (
          <div style={styles.body}>
            <div style={styles.previewHeader}>
              <span style={{ color: '#94a3b8' }}>📄 {fileName}</span>
              <span style={styles.badge}>{rows.length} persone trovate</span>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['nome','cognome','email','telefono','indirizzo','citta','ruolo','unita',''].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} style={styles.tr}>
                      {['nome','cognome','email','telefono','indirizzo','citta','ruolo','unita'].map(field => (
                        <td key={field} style={styles.td}>
                          <input
                            style={styles.cellInput}
                            value={row[field] || ''}
                            onChange={(e) => updateCell(i, field, e.target.value)}
                          />
                        </td>
                      ))}
                      <td style={styles.td}>
                        <button style={styles.removeBtn} onClick={() => removeRow(i)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            <div style={styles.actions}>
              <button style={styles.btnSecondary} onClick={() => { setStep('upload'); setRows([]); setError(null) }}>
                ← Ricarica file
              </button>
              <button style={styles.btnPrimary} onClick={handleConfirm} disabled={rows.length === 0}>
                Importa {rows.length} persone →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: IMPORTING ──────────────────────────── */}
        {step === 'importing' && (
          <div style={{ ...styles.body, textAlign: 'center', padding: '48px' }}>
            <div style={styles.spinner} />
            <p style={{ color: '#60a5fa', marginTop: 16 }}>Importazione in corso…</p>
          </div>
        )}

        {/* ── STEP: DONE ───────────────────────────────── */}
        {step === 'done' && importResult && (
          <div style={{ ...styles.body, textAlign: 'center', padding: '40px' }}>
            <div style={styles.doneIcon}>✅</div>
            <h3 style={{ color: '#e2e8f0', marginBottom: 8 }}>Importazione completata</h3>
            <p style={{ color: '#60a5fa', fontSize: 20, marginBottom: 4 }}>
              <strong>{importResult.created}</strong> persone importate
            </p>
            {importResult.errors?.length > 0 && (
              <p style={{ color: '#f87171', fontSize: 13 }}>
                {importResult.errors.length} righe con errore
              </p>
            )}
            <button style={{ ...styles.btnPrimary, marginTop: 24 }} onClick={onClose}>
              Chiudi
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STILI
// ═══════════════════════════════════════════════════════════════════════════
const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, backdropFilter: 'blur(4px)',
  },
  modal: {
    background: '#1e293b', borderRadius: 16, width: '90vw', maxWidth: 900,
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    border: '1px solid #334155', boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '24px 28px 20px', borderBottom: '1px solid #334155',
  },
  title: { color: '#e2e8f0', fontSize: 20, fontWeight: 700, margin: 0, fontFamily: 'Sora, sans-serif' },
  subtitle: { color: '#64748b', fontSize: 13, margin: '4px 0 0' },
  closeBtn: {
    background: 'none', border: 'none', color: '#64748b', fontSize: 20,
    cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
  },
  body: { padding: '24px 28px', overflowY: 'auto', flex: 1 },
  dropzone: {
    border: '2px dashed #334155', borderRadius: 12, padding: '48px 32px',
    textAlign: 'center', cursor: 'pointer', transition: 'border-color .2s',
    background: '#0f172a',
  },
  uploadIcon: { fontSize: 48, marginBottom: 16 },
  dropText: { color: '#cbd5e1', fontSize: 16, margin: '0 0 8px' },
  dropSub: { color: '#64748b', fontSize: 13 },
  link: { color: '#3b82f6', textDecoration: 'underline' },
  aiLoading: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  spinner: {
    width: 36, height: 36, border: '3px solid #334155',
    borderTop: '3px solid #3b82f6', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
  errorBox: {
    background: '#450a0a', border: '1px solid #991b1b', color: '#fca5a5',
    borderRadius: 8, padding: '10px 14px', marginTop: 16, fontSize: 13,
  },
  templateHint: {
    marginTop: 24, padding: '14px 18px', background: '#0f172a',
    borderRadius: 8, border: '1px solid #1e3a5f', fontSize: 12,
  },
  code: {
    display: 'block', color: '#60a5fa', marginTop: 6,
    fontFamily: 'monospace', letterSpacing: '0.02em',
  },
  previewHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    background: '#1d4ed8', color: '#bfdbfe', fontSize: 12,
    padding: '4px 10px', borderRadius: 20, fontWeight: 600,
  },
  tableWrap: { overflowX: 'auto', maxHeight: 380, overflowY: 'auto', borderRadius: 8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    background: '#0f172a', color: '#64748b', padding: '8px 10px',
    textAlign: 'left', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.05em', position: 'sticky', top: 0,
  },
  tr: { borderBottom: '1px solid #1e293b' },
  td: { padding: '4px 6px' },
  cellInput: {
    background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0',
    borderRadius: 6, padding: '5px 8px', width: '100%', fontSize: 12,
    outline: 'none',
  },
  removeBtn: {
    background: 'none', border: 'none', color: '#ef4444',
    cursor: 'pointer', fontSize: 14, padding: '4px 8px',
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  btnPrimary: {
    background: '#2563eb', color: 'white', border: 'none', borderRadius: 8,
    padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  btnSecondary: {
    background: 'transparent', color: '#94a3b8', border: '1px solid #334155',
    borderRadius: 8, padding: '10px 22px', fontSize: 14, cursor: 'pointer',
  },
  doneIcon: { fontSize: 56, marginBottom: 16 },
}
