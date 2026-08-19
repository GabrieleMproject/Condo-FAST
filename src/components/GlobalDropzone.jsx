import React, { useState, useEffect, useCallback, useRef } from 'react'
import { UploadCloud, FileText, X, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react'
import { estraiFattura, getTipoFile, comprimiImmagine, estraiFileDaZip } from '../lib/fileExtractor'
import { parseFatturaXmlP7m } from '../lib/xmlFatturaParser'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'

export default function GlobalDropzone() {
  const [isDragging, setIsDragging] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [extractedData, setExtractedData] = useState(null)
  
  const navigate = useNavigate()
  const dragCounter = useRef(0)
  const fileInputRef = useRef(null)

  // Ascolta l'evento custom per aprire la modale manualmente
  useEffect(() => {
    const handleOpenModal = () => setIsModalOpen(true)
    window.addEventListener('open-ai-dropzone', handleOpenModal)
    return () => window.removeEventListener('open-ai-dropzone', handleOpenModal)
  }, [])

  // Gestione Drag & Drop Globale
  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer?.types?.includes('Files')) {
        dragCounter.current += 1
        setIsDragging(true)
      }
    }
    const handleDragLeave = (e) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current -= 1
      if (dragCounter.current === 0) {
        setIsDragging(false)
      }
    }
    const handleDragOver = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }
    const handleDrop = (e) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      dragCounter.current = 0
      
      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        processFile(files[0])
      }
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [])

  const handleManualFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const processFile = async (file) => {
    setIsModalOpen(true)
    setIsProcessing(true)
    setExtractedData(null)
    
    try {
      let fileToSend = file
      let info = getTipoFile(file)

      if (info === 'zip') {
        const estratti = await estraiFileDaZip(file)
        if (estratti.length === 0) {
          throw new Error('Nessun file valido trovato all\'interno dello ZIP.')
        }
        fileToSend = estratti[0]
        info = getTipoFile(fileToSend)
        toast.success(`Estratto file ${fileToSend.name} da archivio ZIP`)
      }

      let estratto = null
      if (info === 'xml' || info === 'p7m') {
        const resXml = await parseFatturaXmlP7m(fileToSend)
        estratto = resXml.dati
      } else {
        if (info === 'image') {
          fileToSend = await comprimiImmagine(fileToSend)
        }
        estratto = await estraiFattura(fileToSend)
      }
      
      if (estratto && estratto.is_valido !== false) {
        setExtractedData(estratto)
        toast.success('Dati estratti con successo!')
      } else {
        toast.error('Documento non riconosciuto come fattura.')
        setIsModalOpen(false)
      }
    } catch (err) {
      console.error(err)
      toast.error('Errore durante l\'estrazione: ' + err.message)
      setIsModalOpen(false)
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleProcedi = () => {
    // Naviga alla registrazione spesa passando i dati
    // Si aspetta che la pagina accetti lo state, oppure salva in context
    setIsModalOpen(false)
    navigate('/spese', { state: { extractedFattura: extractedData } })
    toast.success('Pronto per la registrazione')
  }

  if (!isDragging && !isModalOpen) return null

  return (
    <div style={styles.overlay(isDragging)}>
      {isDragging && !isModalOpen && (
        <div style={styles.dragPrompt}>
          <UploadCloud size={80} style={{ color: '#7c3aed', marginBottom: 20 }} />
          <h2 style={{ fontSize: 32, margin: '0 0 10px', color: '#fff' }}>Rilascia il file qui</h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
            L'Intelligenza Artificiale lo analizzerà per te
          </p>
        </div>
      )}

      {isModalOpen && (
        <div style={styles.modal}>
          <button style={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
            <X size={20} />
          </button>
          
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={styles.iconCircle}>
              <Sparkles size={28} style={{ color: '#7c3aed' }} />
            </div>
            <h2 style={{ fontSize: 22, margin: '0 0 8px' }}>Caricamento AI Globale</h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>
              Analisi e inserimento rapido documenti
            </p>
          </div>

          {!isProcessing && !extractedData && (
            <div 
              style={styles.uploadBox}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={40} style={{ color: '#a78bfa', marginBottom: 12 }} />
              <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Sfoglia o Trascina File</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                Supportati: PDF, JPG, PNG
              </p>
            </div>
          )}

          {isProcessing && (
            <div style={styles.processingBox}>
              <Loader2 size={40} className="animate-spin" style={{ color: '#7c3aed', marginBottom: 16 }} />
              <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Analisi in corso...</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                Gemini sta leggendo il documento
              </p>
            </div>
          )}

          {extractedData && !isProcessing && (
            <div style={styles.resultBox}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: '#10b981', fontWeight: 600 }}>
                <CheckCircle2 size={20} /> Dati Estratti
              </div>
              
              <div style={styles.dataGrid}>
                <div>
                  <div style={styles.label}>Fornitore</div>
                  <div style={styles.value}>{extractedData.fornitore || 'N/D'}</div>
                </div>
                <div>
                  <div style={styles.label}>Importo</div>
                  <div style={styles.value}>
                    {extractedData.importo_totale 
                      ? `€ ${Number(extractedData.importo_totale).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
                      : 'N/D'}
                  </div>
                </div>
                <div>
                  <div style={styles.label}>Data Fattura</div>
                  <div style={styles.value}>{extractedData.data_fattura || 'N/D'}</div>
                </div>
              </div>

              <button style={styles.btnPrimary} onClick={handleProcedi}>
                Registra Spesa
              </button>
            </div>
          )}

          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleManualFileChange}
            style={{ display: 'none' }}
            accept=".pdf,.xml,.p7m,.zip,image/*,.docx,.xlsx"
          />
        </div>
      )}
    </div>
  )
}

const styles = {
  overlay: (isDragging) => ({
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: isDragging ? 'rgba(15, 23, 42, 0.85)' : 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(8px)',
    zIndex: 999999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  }),
  dragPrompt: {
    textAlign: 'center',
    pointerEvents: 'none',
    animation: 'pulse 2s infinite'
  },
  modal: {
    background: 'var(--card-bg)',
    borderRadius: 20,
    width: '100%',
    maxWidth: 480,
    padding: 32,
    position: 'relative',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    border: '1px solid var(--border-color)',
    animation: 'scaleIn 0.2s ease-out'
  },
  closeBtn: {
    position: 'absolute',
    top: 16, right: 16,
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 8,
    borderRadius: 8
  },
  iconCircle: {
    width: 64, height: 64,
    borderRadius: '50%',
    background: 'rgba(124,58,237,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    border: '1px solid rgba(124,58,237,0.2)'
  },
  uploadBox: {
    border: '2px dashed var(--border-color)',
    borderRadius: 16,
    padding: '40px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.02)',
    transition: 'all 0.2s'
  },
  processingBox: {
    padding: '40px 20px',
    textAlign: 'center',
    background: 'var(--app-bg)',
    borderRadius: 16,
    border: '1px solid var(--border-color)'
  },
  resultBox: {
    background: 'var(--app-bg)',
    padding: 20,
    borderRadius: 16,
    border: '1px solid rgba(16, 185, 129, 0.3)'
  },
  dataGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
    marginBottom: 24
  },
  label: { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  value: { fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' },
  btnPrimary: {
    width: '100%',
    padding: '12px 20px',
    background: '#7c3aed',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s'
  }
}
