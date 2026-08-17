// src/components/AnagraficaImport.jsx
import { useState, useRef } from 'react'
import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import { estraiAnagraficaDaFile, fileToText } from '../lib/fileExtractor'
import { FolderOpen, Lightbulb, FileText, CheckCircle2, X } from 'lucide-react'

// ── Colonne attese (flessibili — l'AI normalizza i nomi) ──────────────────
const CAMPI_ATTESI = ['nome','cognome','email','telefono','indirizzo','citta','cap','provincia','codice_fiscale','ruolo','unita']

// ── Parsing XLSX / CSV ────────────────────────────────────────────────────
function parseXlsx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(e.target.result)
        const worksheet = workbook.worksheets[0]
        if (!worksheet) { resolve([]); return; }
        const rows = []
        let headers = []
        worksheet.eachRow((row, rowNumber) => {
          const cells = []
          row.eachCell({ includeEmpty: true }, (cell) => {
            let val = cell.value;
            if (val && typeof val === 'object') {
              if (val.result !== undefined) val = val.result;
              else if (val.richText !== undefined) val = val.richText.map(t => t.text || '').join('');
              else if (val.text !== undefined) val = val.text;
            }
            cells.push(String(val ?? '').trim());
          });
          if (rowNumber === 1) {
            headers = cells
          } else {
            const obj = {}
            headers.forEach((h, i) => { if (h) obj[h] = cells[i] || '' })
            rows.push(obj)
          }
        })
        resolve(rows)
      } catch (err) {
        reject(err)
      }
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


// ── Normalizza un array di righe grezze → struttura standard ───────────────
function normalizeRows(rows) {
  return rows.map(row => {
    const normalized = {}
    
    // Inizializza tutti i campi attesi
    const campiAttesi = ['nome', 'cognome', 'codice_fiscale', 'email', 'telefono', 'indirizzo', 'citta', 'cap', 'provincia', 'ruolo', 'unita', 'scala']
    campiAttesi.forEach(c => normalized[c] = '')

    for (const [k, v] of Object.entries(row)) {
      const key = k.toLowerCase().trim().replace(/[-.\s/]+/g, '_')
      const valStr = String(v || '').trim()
      if (!valStr) continue

      let mappedKey = null

      // 1. Corrispondenza diretta
      if (key === 'nome') mappedKey = 'nome'
      else if (key === 'cognome') mappedKey = 'cognome'
      else if (key === 'codice_fiscale' || key === 'cf' || key === 'cod_fisc' || key === 'codicefiscale' || key === 'codfisc') mappedKey = 'codice_fiscale'
      else if (key === 'indirizzo' || key === 'via' || key === 'residenza' || key === 'indirizzo_residenza') mappedKey = 'indirizzo'
      else if (key === 'citta' || key === 'città' || key === 'comune') mappedKey = 'citta'
      else if (key === 'cap') mappedKey = 'cap'
      else if (key === 'provincia' || key === 'prov') mappedKey = 'provincia'
      else if (key === 'ruolo' || key === 'qualifica') mappedKey = 'ruolo'
      else if (key === 'unita' || key === 'unità' || key === 'interno' || key === 'int' || key === 'appartamento' || key === 'sub') mappedKey = 'unita'
      else if (key === 'scala' || key === 'sc') mappedKey = 'scala'
      
      // 2. Controllo Email/PEC
      else if (key.includes('email') || key.includes('mail') || key === 'pec' || key.includes('posta_e') || key.includes('contatto_e')) {
        mappedKey = 'email'
      }
      
      // 3. Controllo Telefono/Cellulare
      else if (key.includes('tel') || key.includes('cell') || key.includes('phone') || key.includes('recapito') || key.includes('mobil') || key.includes('contatto_t')) {
        mappedKey = 'telefono'
      }

      if (mappedKey) {
        if (normalized[mappedKey]) {
          // Unisce email e telefoni multipli con virgola
          if (mappedKey === 'telefono' || mappedKey === 'email') {
            const valoriEsistenti = normalized[mappedKey].split(',').map(s => s.trim())
            if (!valoriEsistenti.includes(valStr)) {
              normalized[mappedKey] = `${normalized[mappedKey]}, ${valStr}`
            }
          } else {
            normalized[mappedKey] = valStr
          }
        } else {
          normalized[mappedKey] = valStr
        }
      }
    }
    return normalized
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════
export default function AnagraficaImport({ onImport, onClose }) {
  const [step, setStep]           = useState('upload')
  const [rows, setRows]           = useState([])
  const [fileName, setFileName]   = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError]         = useState(null)
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef()

  const handleFile = async (file) => {
    if (!file) return
    setError(null)
    setFileName(file.name)
    const ext = file.name.split('.').pop().toLowerCase()

    try {
      let parsed = []

      if (ext === 'xlsx' || ext === 'xls') {
        try {
          const raw = await parseXlsx(file)
          parsed = normalizeRows(raw || [])
        } catch (xlsxErr) {
          if (ext === 'xls') {
            console.warn('[AnagraficaImport] Caricamento XLS fallito, provo fallback su CSV:', xlsxErr.message);
            try {
              const textContent = await fileToText(file)
              if (textContent && (textContent.includes(';') || textContent.includes(','))) {
                const parseRes = Papa.parse(textContent, { header: true, skipEmptyLines: true })
                if (parseRes.data && parseRes.data.length > 0) {
                  parsed = normalizeRows(parseRes.data)
                } else {
                  throw new Error("Dati CSV non validi");
                }
              } else {
                throw new Error("Nessun delimitatore rilevato");
              }
            } catch (csvErr) {
              throw new Error("Il file .xls (Excel legacy) non è supportato. Salva il file in formato .xlsx (Excel moderno) o .csv prima di caricarlo.");
            }
          } else {
            throw xlsxErr;
          }
        }
      } else if (ext === 'csv') {
        const raw = await parseCsv(file)
        parsed = normalizeRows(raw || [])
      } else if (['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'txt'].includes(ext)) {
        setAiLoading(true)
        const raw = await estraiAnagraficaDaFile(file)
        parsed = normalizeRows(raw || [])
        setAiLoading(false)
      } else {
        throw new Error('Formato non supportato. Usa xlsx, xls, csv, pdf, docx, doc o immagini.')
      }

      if (!parsed || parsed.length === 0) throw new Error('Nessun dato trovato nel file.')
      setRows(parsed)
      setStep('preview')
    } catch (err) {
      setAiLoading(false)
      setError(err?.message || 'Si è verificato un errore durante la lettura del file')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const updateCell = (rowIdx, field, value) => {
    setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: value } : r))
  }

  const removeRow = (rowIdx) => {
    setRows(prev => prev.filter((_, i) => i !== rowIdx))
  }

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

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>

        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Importa Anagrafica</h2>
            <p style={styles.subtitle}>Carica un file con i dati di proprietari e inquilini</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

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
                  <p style={{ color: '#60a5fa', margin: '12px 0 4px' }}>Gemini sta analizzando il documento…</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Estrazione dati con AI in corso</p>
                </div>
              ) : (
                <>
                  <div style={styles.uploadIcon}><FolderOpen size={48} style={{ color: '#3b82f6', margin: '0 auto' }} /></div>
                  <p style={styles.dropText}>Trascina qui il file o <span style={styles.link}>clicca per sfogliare</span></p>
                  <p style={styles.dropSub}>Formati supportati: <strong>XLSX, XLS, CSV</strong> (Excel/tabelle) · <strong>PDF, DOCX, DOC</strong> (estrazione AI)</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.docx,.jpg,.png,.webp"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            <div style={styles.templateHint}>
              <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Lightbulb size={14} style={{ color: '#fbbf24', flexShrink: 0 }} /> <span>Formato consigliato colonne XLSX/CSV:</span>
              </span>
              <code style={styles.code}>nome · cognome · email · telefono · indirizzo · citta · cap · provincia · codice_fiscale · ruolo · unita</code>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div style={styles.body}>
            <div style={styles.previewHeader}>
              <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FileText size={14} /> <span>{fileName}</span>
              </span>
              <span style={styles.badge}>{rows.length} persone trovate</span>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['nome','cognome','codice_fiscale','email','telefono','indirizzo','citta','ruolo','unita',''].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} style={styles.tr}>
                      {['nome','cognome','codice_fiscale','email','telefono','indirizzo','citta','ruolo','unita'].map(field => (
                        <td key={field} style={styles.td}>
                          <input
                            style={styles.cellInput}
                            value={row[field] || ''}
                            onChange={(e) => updateCell(i, field, e.target.value)}
                          />
                        </td>
                      ))}
                      <td style={styles.td}>
                        <button style={styles.removeBtn} onClick={() => removeRow(i)}><X size={14} /></button>
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

        {step === 'importing' && (
          <div style={{ ...styles.body, textAlign: 'center', padding: '48px' }}>
            <div style={styles.spinner} />
            <p style={{ color: '#60a5fa', marginTop: 16 }}>Importazione in corso…</p>
          </div>
        )}

        {step === 'done' && importResult && (
          <div style={{ ...styles.body, textAlign: 'center', padding: '40px' }}>
            <div style={styles.doneIcon}><CheckCircle2 size={48} style={{ color: '#10b981', margin: '0 auto' }} /></div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Importazione completata</h3>
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

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, backdropFilter: 'blur(4px)',
  },
  modal: {
    background: 'var(--card-bg)', borderRadius: 16, width: '90vw', maxWidth: 900,
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    border: '1px solid var(--border-color)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '24px 28px 20px', borderBottom: '1px solid var(--border-color)',
  },
  title: { color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, margin: 0, fontFamily: 'Sora, sans-serif' },
  subtitle: { color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20,
    cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
  },
  body: { padding: '24px 28px', overflowY: 'auto', flex: 1 },
  dropzone: {
    border: '2px dashed var(--border-color)', borderRadius: 12, padding: '48px 32px',
    textAlign: 'center', cursor: 'pointer', transition: 'border-color .2s',
    background: 'var(--app-bg)',
  },
  uploadIcon: { fontSize: 48, marginBottom: 16 },
  dropText: { color: 'var(--text-secondary)', fontSize: 16, margin: '0 0 8px' },
  dropSub: { color: 'var(--text-muted)', fontSize: 13 },
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
    marginTop: 24, padding: '14px 18px', background: 'var(--app-bg)',
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
    background: 'var(--app-bg)', color: 'var(--text-muted)', padding: '8px 10px',
    textAlign: 'left', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.05em', position: 'sticky', top: 0,
  },
  tr: { borderBottom: '1px solid var(--border-color-2)' },
  td: { padding: '4px 6px' },
  cellInput: {
    background: 'var(--app-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)',
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
    background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)',
    borderRadius: 8, padding: '10px 22px', fontSize: 14, cursor: 'pointer',
  },
  doneIcon: { fontSize: 56, marginBottom: 16 },
}
