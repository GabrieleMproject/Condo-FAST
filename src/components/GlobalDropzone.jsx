import React, { useState, useEffect, useRef } from 'react'
import { 
  UploadCloud, FileText, X, Loader2, Sparkles, CheckCircle2, AlertCircle, 
  Receipt, Landmark, Scale, ShieldCheck, Users, Archive, Building2, ArrowRight
} from 'lucide-react'
import { analizzaEClassificaDocumentoUniversale, getTipoFile, comprimiImmagine, estraiFileDaZip } from '../lib/fileExtractor'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'

// Mappa delle tipologie documentali supportate
const DOC_TYPE_META = {
  fattura_spesa: {
    label: 'Fattura / Spesa Fornitore',
    badgeBg: '#f5f3ff',
    badgeBorder: '#ddd6fe',
    badgeColor: '#7c3aed',
    icon: Receipt,
    primaryAction: '✨ Registra Spesa / Fattura',
    route: '/spese',
    actionDesc: 'Inserisci nei costi del condominio con calcolo automatico delle ripartizioni'
  },
  estratto_conto: {
    label: 'Estratto Conto Bancario',
    badgeBg: '#eff6ff',
    badgeBorder: '#bfdbfe',
    badgeColor: '#2563eb',
    icon: Landmark,
    primaryAction: '✨ Vai a Riconciliazioni Bancarie',
    route: '/condomini',
    actionDesc: 'Importa i movimenti bancari e riconcilia con fatture e quote condòmini'
  },
  verbale_assemblea: {
    label: 'Verbale di Assemblea',
    badgeBg: '#ecfdf5',
    badgeBorder: '#a7f3d0',
    badgeColor: '#059669',
    icon: FileText,
    primaryAction: '✨ Archivia Verbale di Assemblea',
    route: '/condomini',
    actionDesc: 'Salva con delibere estratte e indicizzazione per la ricerca AI'
  },
  tabella_millesimale: {
    label: 'Tabella Millesimale',
    badgeBg: '#fffbeb',
    badgeBorder: '#fde68a',
    badgeColor: '#d97706',
    icon: Scale,
    primaryAction: '✨ Importa nei Millesimi',
    route: '/condomini',
    actionDesc: 'Assegna le quote millesimali alle unità immobiliari'
  },
  f24_quietanza: {
    label: 'Quietanza F24 / Fiscale',
    badgeBg: '#f0fdf4',
    badgeBorder: '#bbf7d0',
    badgeColor: '#16a34a',
    icon: ShieldCheck,
    primaryAction: '✨ Registra nel Modulo Fiscale',
    route: '/modulo-fiscale',
    actionDesc: 'Registra il pagamento F24 e aggiorna le ritenute d\'acconto'
  },
  anagrafica: {
    label: 'Anagrafica Condòmini',
    badgeBg: '#ecfeff',
    badgeBorder: '#a5f3fc',
    badgeColor: '#0891b2',
    icon: Users,
    primaryAction: '✨ Importa Anagrafica',
    route: '/anagrafica',
    actionDesc: 'Popola l\'anagrafe condominiale con residenti, proprietari e unità'
  },
  documento_generale: {
    label: 'Documento Generale / Polizza',
    badgeBg: '#f8fafc',
    badgeBorder: '#e2e8f0',
    badgeColor: '#475569',
    icon: Archive,
    primaryAction: '✨ Archivia nei Documenti',
    route: '/condomini',
    actionDesc: 'Archivia con tag automatici nell\'archivio documentale del condominio'
  }
}

export default function GlobalDropzone() {
  const [isDragging, setIsDragging] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [currentFile, setCurrentFile] = useState(null)
  
  const navigate = useNavigate()
  const dragCounter = useRef(0)
  const fileInputRef = useRef(null)

  // Ascolta l'evento custom per aprire la modale manualmente da qualsiasi punto della UI
  useEffect(() => {
    const handleOpenModal = () => {
      setIsModalOpen(true)
      setResult(null)
      setCurrentFile(null)
    }
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
    setResult(null)
    setCurrentFile(file)
    
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
        toast.success(`Estratto ${fileToSend.name} dall'archivio ZIP`)
      }

      if (info === 'image') {
        fileToSend = await comprimiImmagine(fileToSend)
      }

      // Motore universale di analisi e classificazione AI
      const classificazione = await analizzaEClassificaDocumentoUniversale(fileToSend)
      
      setResult(classificazione)
      setCurrentFile(fileToSend)
      toast.success(`Documento analizzato: ${classificazione.titolo_rilevato || 'Classificato'}`)
    } catch (err) {
      console.error('[GlobalDropzone] Errore analisi:', err)
      toast.error('Errore durante l\'analisi del file: ' + (err.message || 'File non leggibile'))
      setIsModalOpen(false)
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleProcedi = () => {
    if (!result) return
    setIsModalOpen(false)

    const meta = DOC_TYPE_META[result.tipo_documento] || DOC_TYPE_META.fattura_spesa

    // Instradamento intelligente in base alla tipologia documentale
    if (result.tipo_documento === 'fattura_spesa') {
      navigate('/spese', { 
        state: { 
          extractedFattura: {
            ...result.dati_estratti,
            condominio_destinatario_nome: result.condominio_destinatario,
            condominio_destinatario_codice_fiscale: result.condominio_destinatario_codice_fiscale,
            condominio_destinatario_indirizzo: result.condominio_destinatario_indirizzo,
            condominio_destinatario_citta: result.condominio_destinatario_citta,
            condominio_destinatario_cap: result.condominio_destinatario_cap,
            condominio_destinatario_provincia: result.condominio_destinatario_provincia,
          },
          rawFile: currentFile
        } 
      })
      toast.success('Dati precaricati nel modulo Spese')
    } else if (result.tipo_documento === 'estratto_conto') {
      navigate('/condomini', { state: { estrattoContoFile: currentFile } })
      toast.success('Seleziona il condominio per avviare la riconciliazione bancaria')
    } else if (result.tipo_documento === 'f24_quietanza') {
      navigate('/modulo-fiscale', { state: { quietanzaF24: result.dati_estratti, file: currentFile } })
      toast.success('Pronto per l\'abbinamento quietanza nel Modulo Fiscale')
    } else if (result.tipo_documento === 'anagrafica') {
      navigate('/anagrafica', { state: { anagraficaImport: result.raw_extraction } })
      toast.success('Pronto per l\'importazione anagrafica')
    } else {
      navigate(meta.route, { state: { uploadedDoc: result, file: currentFile } })
      toast.success(`Apertura modulo: ${meta.label}`)
    }
  }

  if (!isDragging && !isModalOpen) return null

  const currentMeta = result ? (DOC_TYPE_META[result.tipo_documento] || DOC_TYPE_META.documento_generale) : null
  const TypeIcon = currentMeta?.icon || FileText

  return (
    <div style={styles.overlay(isDragging)}>
      {isDragging && !isModalOpen && (
        <div style={styles.dragPrompt}>
          <UploadCloud size={80} style={{ color: '#7c3aed', marginBottom: 20 }} />
          <h2 style={{ fontSize: 32, margin: '0 0 10px', color: '#fff' }}>Rilascia qualsiasi file qui</h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
            L'Intelligenza Artificiale riconoscerà automaticamente fatture, estratti conto, verbali, millesimi o F24
          </p>
        </div>
      )}

      {isModalOpen && (
        <div style={styles.modal}>
          <button style={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
            <X size={20} />
          </button>
          
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={styles.iconCircle}>
              <Sparkles size={28} style={{ color: '#7c3aed' }} />
            </div>
            <h2 style={{ fontSize: 22, margin: '0 0 6px', color: 'var(--text-primary)' }}>
              Caricamento Universale AI
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 13 }}>
              Trascina o seleziona qualunque documento: l'AI lo analizza e sceglie l'azione corretta
            </p>
          </div>

          {!isProcessing && !result && (
            <div 
              style={styles.uploadBox}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={44} style={{ color: '#7c3aed', margin: '0 auto 12px' }} />
              <h3 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--text-primary)' }}>
                Sfoglia o Trascina un File
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 12px' }}>
                Fatture, Estratti Conto, Verbali, Tabelle Millesimali, F24, Anagrafiche
              </p>
              <span style={{
                fontSize: 12, padding: '4px 10px', background: 'rgba(124,58,237,0.1)', color: '#7c3aed',
                borderRadius: 20, fontWeight: 600, border: '1px solid rgba(124,58,237,0.2)'
              }}>
                Supportati: PDF, XML SDI, P7M, JPG, PNG, XLSX, DOCX, ZIP
              </span>
            </div>
          )}

          {isProcessing && (
            <div style={styles.processingBox}>
              <Loader2 size={44} className="animate-spin" style={{ color: '#7c3aed', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
              <h3 style={{ margin: '0 0 8px', fontSize: 17, color: 'var(--text-primary)' }}>
                Analisi e Classificazione AI...
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                Gemini 2.0 Flash sta leggendo il documento ed estraendo i dati strutturati
              </p>
            </div>
          )}

          {result && !isProcessing && currentMeta && (
            <div style={styles.resultBox}>
              {/* Badge tipologia documento */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
                padding: '8px 12px', background: currentMeta.badgeBg, border: `1px solid ${currentMeta.badgeBorder}`,
                borderRadius: 10
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TypeIcon size={18} style={{ color: currentMeta.badgeColor }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: currentMeta.badgeColor }}>
                    {currentMeta.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981', fontSize: 12, fontWeight: 600 }}>
                  <CheckCircle2 size={14} /> Analizzato
                </div>
              </div>

              {/* Titolo e eventuale destinatario */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {result.titolo_rilevato}
                </div>
                {result.condominio_destinatario && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <Building2 size={13} style={{ color: '#7c3aed' }} />
                    Condominio rilevato: <strong style={{ color: 'var(--text-primary)' }}>{result.condominio_destinatario}</strong>
                  </div>
                )}
              </div>

              {/* Griglia Dati Chiave Estratti */}
              <div style={styles.dataGrid}>
                {result.dati_estratti?.fornitore && (
                  <div>
                    <div style={styles.label}>Fornitore / Emittente</div>
                    <div style={styles.value}>{result.dati_estratti.fornitore}</div>
                  </div>
                )}
                {result.dati_estratti?.importo_totale != null && (
                  <div>
                    <div style={styles.label}>Importo Totale</div>
                    <div style={{ ...styles.value, color: '#10b981', fontSize: 16 }}>
                      € {Number(result.dati_estratti.importo_totale).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
                {result.dati_estratti?.data_fattura && (
                  <div>
                    <div style={styles.label}>Data Documento</div>
                    <div style={styles.value}>{result.dati_estratti.data_fattura}</div>
                  </div>
                )}
                {result.dati_estratti?.numero_fattura && (
                  <div>
                    <div style={styles.label}>N. Documento</div>
                    <div style={styles.value}>{result.dati_estratti.numero_fattura}</div>
                  </div>
                )}
                {result.dati_estratti?.descrizione && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={styles.label}>Descrizione / Oggetto</div>
                    <div style={{ ...styles.value, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
                      {result.dati_estratti.descrizione}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottone Azione Primaria con Feedback */}
              <button style={styles.btnPrimary} onClick={handleProcedi}>
                <Sparkles size={16} /> {currentMeta.primaryAction} <ArrowRight size={16} />
              </button>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
                {currentMeta.actionDesc}
              </div>
            </div>
          )}

          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleManualFileChange}
            style={{ display: 'none' }}
            accept=".pdf,.xml,.p7m,.zip,image/*,.docx,.xlsx,.csv"
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
    background: isDragging ? 'rgba(15, 23, 42, 0.88)' : 'rgba(15, 23, 42, 0.65)',
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
    width: '90%',
    maxWidth: 520,
    padding: 28,
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
    width: 56, height: 56,
    borderRadius: '50%',
    background: 'rgba(124,58,237,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
    border: '1px solid rgba(124,58,237,0.2)'
  },
  uploadBox: {
    border: '2px dashed var(--border-color)',
    borderRadius: 16,
    padding: '36px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.02)',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
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
    border: '1px solid var(--border-color)'
  },
  dataGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 20,
    padding: '12px 14px',
    background: 'var(--card-bg)',
    borderRadius: 10,
    border: '1px solid var(--border-color)'
  },
  label: { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' },
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'background 0.2s',
    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
  }
}
