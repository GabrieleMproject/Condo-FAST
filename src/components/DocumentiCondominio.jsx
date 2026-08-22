import { useEffect, useRef, useState } from 'react'
import { useDocumenti } from '../hooks/useDocumenti'
import { FileText, FileSpreadsheet, FileSignature, Award, Landmark, Folder, FolderOpen, Paperclip, CheckCircle2, AlertTriangle, Trash2, Download, Plus, X, File, ShieldAlert, Loader2 } from 'lucide-react'

function renderTipoIcon(tipo, size = 20) {
  switch (tipo) {
    case 'regolamento':
      return <FileText size={size} style={{ color: '#3b82f6' }} />
    case 'tabella_millesimale_doc':
      return <FileSpreadsheet size={size} style={{ color: '#8b5cf6' }} />
    case 'verbale':
      return <FileSignature size={size} style={{ color: '#10b981' }} />
    case 'contratto':
      return <File size={size} style={{ color: '#f59e0b' }} />
    case 'certificazione':
      return <Award size={size} style={{ color: '#06b6d4' }} />
    case 'estratto_conto_archivio':
      return <Landmark size={size} style={{ color: '#0ea5e9' }} />
    case 'sinistro':
      return <ShieldAlert size={size} style={{ color: '#ef4444' }} />
    default:
      return <Folder size={size} style={{ color: '#6b7280' }} />
  }
}

const TIPI = [
  { value: 'regolamento', label: 'Regolamento condominiale', icon: 'regolamento' },
  { value: 'tabella_millesimale_doc', label: 'Tabella millesimale', icon: 'tabella_millesimale_doc' },
  { value: 'contratto', label: 'Contratto/Appalto', icon: 'contratto' },
  { value: 'certificazione', label: 'Certificazione', icon: 'certificazione' },
  { value: 'estratto_conto_archivio', label: 'Estratto Conto (Archivio)', icon: 'estratto_conto_archivio' },
  { value: 'sinistro', label: 'Assicurazione & Sinistri', icon: 'sinistro' },
  { value: 'altro', label: 'Altro', icon: 'altro' },
]

const CATEGORIE_LABEL = {
  regolamento: { label: 'Regolamento', color: '#3b82f6' },
  tabella_millesimale_doc: { label: 'Millesimi', color: '#8b5cf6' },
  verbale: { label: 'Verbale', color: '#10b981' },
  contratto: { label: 'Contratto', color: '#f59e0b' },
  certificazione: { label: 'Certificazione', color: '#06b6d4' },
  estratto_conto_archivio: { label: 'Archivio E/C', color: '#0ea5e9' },
  sinistro: { label: 'Sinistri', color: '#ef4444' },
  altro: { label: 'Altro', color: '#6b7280' },
}

export default function DocumentiCondominio({ condominioId }) {
  const { documenti, loading, error, fetch, upload, remove, getSignedUrl, toggleVisibilitaCondomini } = useDocumenti(condominioId)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [form, setForm] = useState({ tipo: 'regolamento', nome: '', note: '', visibile_condomini: true })
  const [selectedFile, setSelectedFile] = useState(null)
  const [filtroTipo, setFiltroTipo] = useState('tutti')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const fileRef = useRef()

  useEffect(() => { fetch() }, [fetch])

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    if (!form.nome) setForm(f => ({ ...f, nome: file.name.replace(/\.[^.]+$/, '') }))
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!selectedFile || !form.tipo) return
    setUploading(true)
    // Messaggio generico per PDF e DOCX
    const ext = selectedFile.name.split('.').pop().toLowerCase()
    setUploadProgress(
      ext === 'pdf' || ext === 'docx'
        ? 'Estrazione testo in corso (AI)...'
        : 'Caricamento...'
    )
    try {
      await upload(selectedFile, form.tipo, form.nome, form.note, null, null, form.visibile_condomini)
      setShowForm(false)
      setForm({ tipo: 'regolamento', nome: '', note: '', visibile_condomini: true })
      setSelectedFile(null)
      setUploadProgress('')
    } catch (e) {
      alert('Errore upload: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleOpen = async (doc) => {
    const newWindow = window.open('about:blank', '_blank')
    if (!newWindow) {
      alert('Abilita i popup per visualizzare il file.')
      return
    }
    try {
      const url = await getSignedUrl(doc.url_storage)
      if (url) {
        newWindow.location.href = url
      } else {
        throw new Error("Impossibile generare l'URL firmato")
      }
    } catch (err) {
      console.error("Errore handleOpen:", err)
      newWindow.close()
      alert('Impossibile aprire il documento')
    }
  }

  const handleDelete = async (doc) => {
    try {
      await remove(doc)
      setConfirmDelete(null)
    } catch (e) {
      alert('Errore eliminazione: ' + e.message)
    }
  }

  const documentiVisibili = documenti.filter(d => d.tipo !== 'estratto_conto' && d.tipo !== 'verbale')
  const filtrati = filtroTipo === 'tutti' ? documentiVisibili : documentiVisibili.filter(d => d.tipo === filtroTipo)

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 18, fontWeight: 600 }}>Documenti</h3>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            Regolamento, tabelle millesimali, verbali e altri documenti del condominio
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Sora, sans-serif'
          }}
        >
          <span>+</span> Carica documento
        </button>
      </div>

      {/* Filtri tipo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['tutti', ...TIPI.map(t => t.value)].map(tipo => (
          <button
            key={tipo}
            onClick={() => setFiltroTipo(tipo)}
            style={{
              background: filtroTipo === tipo ? 'var(--accent)' : 'var(--app-bg)',
              color: filtroTipo === tipo ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${filtroTipo === tipo ? 'var(--accent)' : 'var(--border-color)'}`,
              borderRadius: 20, padding: '5px 14px', fontSize: 12,
              cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: 500
            }}
          >
            {tipo === 'tutti' ? 'Tutti' : TIPI.find(t => t.value === tipo)?.label}
            {tipo !== 'tutti' && (
              <span style={{ marginLeft: 6, color: 'var(--text-muted)' }}>
                {documentiVisibili.filter(d => d.tipo === tipo).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Lista documenti */}
      {loading && !documenti.length ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Caricamento...</div>
      ) : filtrati.length === 0 ? (
        <div style={{
          background: 'var(--card-bg)', border: '2px dashed var(--border-color)', borderRadius: 12,
          padding: 48, textAlign: 'center'
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><FolderOpen size={40} style={{ color: 'var(--text-muted)' }} /></div>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>
            {filtroTipo === 'tutti' ? 'Nessun documento caricato' : `Nessun documento di tipo "${TIPI.find(t => t.value === filtroTipo)?.label}"`}
          </p>
          <p style={{ color: 'var(--text-muted)', margin: '8px 0 0', fontSize: 12 }}>
            Carica il regolamento o le tabelle millesimali per abilitare i suggerimenti AI sulle spese
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrati.map(doc => {
            const cat = CATEGORIE_LABEL[doc.tipo] || CATEGORIE_LABEL.altro
            const isNormativo = doc.tipo === 'regolamento' || doc.tipo === 'tabella_millesimale_doc'
            const hasTesto = !!doc.testo_estratto
            return (
              <div
                key={doc.id}
                style={{
                  background: 'var(--card-bg)', borderRadius: 10, padding: '14px 18px',
                  border: `1px solid ${isNormativo ? 'var(--accent-glow)' : 'var(--border-color)'}`,
                  display: 'flex', alignItems: 'center', gap: 16
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: 'var(--app-bg)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 20, flexShrink: 0
                }}>
                  {renderTipoIcon(doc.tipo)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>{doc.nome}</span>
                    <span style={{
                      background: cat.color + '22', color: cat.color,
                      borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600
                    }}>
                      {cat.label}
                    </span>
                    {hasTesto && (
                      <span style={{ background: '#10b98122', color: '#10b981', borderRadius: 4, padding: '2px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={11} /> Testo estratto
                      </span>
                    )}
                    {isNormativo && !hasTesto && (
                      <span style={{ background: '#f59e0b22', color: '#f59e0b', borderRadius: 4, padding: '2px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={11} /> Testo non estratto
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {new Date(doc.created_at).toLocaleDateString('it-IT')}
                    {doc.note && <span> · {doc.note}</span>}
                  </div>
                  {doc.tags && doc.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {doc.tags.map(tag => (
                        <span key={tag} style={{ background: 'var(--accent-glow)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => toggleVisibilitaCondomini(doc.id, doc.visibile_condomini)}
                    style={{
                      background: doc.visibile_condomini !== false ? '#d1fae5' : '#f1f5f9',
                      color: doc.visibile_condomini !== false ? '#047857' : '#64748b',
                      border: `1px solid ${doc.visibile_condomini !== false ? '#a7f3d0' : '#e2e8f0'}`,
                      borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                    }}
                    title="Clicca per mostrare o nascondere questo documento nell'App dei Condòmini"
                  >
                    {doc.visibile_condomini !== false ? '📲 Visibile in App' : '🔒 Solo Studio'}
                  </button>
                  <button
                    onClick={() => handleOpen(doc)}
                    style={{
                      background: 'var(--app-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)',
                      borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                      fontFamily: 'Sora, sans-serif'
                    }}
                  >
                    Apri
                  </button>
                  <button
                    onClick={() => setConfirmDelete(doc)}
                    style={{
                      background: 'transparent', color: 'var(--text-muted)', border: 'none',
                      borderRadius: 6, padding: '6px 10px', fontSize: 16, cursor: 'pointer'
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Upload */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: '#00000088', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: 'var(--card-bg)', borderRadius: 16, padding: 32, width: '100%',
            maxWidth: 520, border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ margin: '0 0 24px', color: 'var(--text-primary)', fontSize: 18 }}>Carica documento</h3>
            <form onSubmit={handleUpload}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>
                  Tipo documento *
                </label>
                <select
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  style={{
                    width: '100%', background: 'var(--app-bg)', color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px',
                    fontSize: 14, fontFamily: 'Sora, sans-serif'
                  }}
                >
                  {TIPI.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>
                  Nome documento
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Es. Regolamento 2020"
                  style={{
                    width: '100%', background: 'var(--app-bg)', color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px',
                    fontSize: 14, fontFamily: 'Sora, sans-serif', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>
                  File * {(form.tipo === 'regolamento' || form.tipo === 'tabella_millesimale_doc') && (
                    <span style={{ color: '#10b981' }}>(PDF o DOCX consigliato — il testo verrà estratto per l'AI)</span>
                  )}
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    background: 'var(--app-bg)', border: `2px dashed ${selectedFile ? 'var(--accent)' : 'var(--border-color)'}`,
                    borderRadius: 8, padding: '20px', textAlign: 'center', cursor: 'pointer'
                  }}
                >
                  {selectedFile ? (
                    <span style={{ color: 'var(--accent)', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Paperclip size={14} /> {selectedFile.name}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Clicca per selezionare un file</span>
                  )}
                </div>
                {/* accept: .docx abilitato, .doc legacy rimosso */}
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFile}
                  accept=".pdf,.docx,.xls,.xlsx,.jpg,.png,.webp,.txt" />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>
                  Note (opzionale)
                </label>
                <input
                  type="text"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Es. Approvato in assemblea del 12/03/2023"
                  style={{
                    width: '100%', background: 'var(--app-bg)', color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px',
                    fontSize: 14, fontFamily: 'Sora, sans-serif', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="visibile_condomini"
                  checked={form.visibile_condomini}
                  onChange={e => setForm(f => ({ ...f, visibile_condomini: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="visibile_condomini" style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}>
                  Rendi visibile questo documento nell'App dei Condòmini
                </label>
              </div>

              {uploadProgress && (
                <div style={{
                  background: 'var(--app-bg)', border: '1px solid var(--accent)', borderRadius: 8,
                  padding: '10px 14px', marginBottom: 16, color: 'var(--accent)', fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6
                }}>
                  <Loader2 size={13} className="spin" /> {uploadProgress}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setSelectedFile(null) }}
                  disabled={uploading}
                  style={{
                    background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)',
                    borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer',
                    fontFamily: 'Sora, sans-serif'
                  }}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || uploading}
                  style={{
                    background: selectedFile && !uploading ? 'var(--accent)' : 'var(--border-color)',
                    color: selectedFile && !uploading ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 8,
                    padding: '10px 20px', fontSize: 14, fontWeight: 600,
                    cursor: selectedFile && !uploading ? 'pointer' : 'not-allowed',
                    fontFamily: 'Sora, sans-serif'
                  }}
                >
                  {uploading ? 'Caricamento...' : 'Carica'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: '#00000088', zIndex: 1001,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: 'var(--card-bg)', borderRadius: 12, padding: 28, maxWidth: 400,
            width: '100%', border: '1px solid var(--border-color)'
          }}>
            <h4 style={{ margin: '0 0 12px', color: 'var(--text-primary)' }}>Elimina documento</h4>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px', fontSize: 14 }}>
              Sei sicuro di voler eliminare "<strong style={{ color: 'var(--text-primary)' }}>{confirmDelete.nome}</strong>"?
              Il file verrà rimosso definitivamente.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{
                background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)',
                borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'Sora, sans-serif'
              }}>Annulla</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{
                background: '#dc2626', color: '#fff', border: 'none',
                borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
                fontWeight: 600, fontFamily: 'Sora, sans-serif'
              }}>Elimina</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
