import { useEffect, useRef, useState } from 'react'
import { useDocumenti } from '../hooks/useDocumenti'

const TIPI = [
  { value: 'regolamento', label: 'Regolamento condominiale', icon: '📋' },
  { value: 'tabella_millesimale_doc', label: 'Tabella millesimale', icon: '📊' },
  { value: 'verbale', label: 'Verbale assemblea', icon: '📝' },
  { value: 'contratto', label: 'Contratto/Appalto', icon: '📄' },
  { value: 'certificazione', label: 'Certificazione', icon: '🏆' },
  { value: 'estratto_conto_archivio', label: 'Estratto Conto (Archivio)', icon: '🏛️' },
  { value: 'altro', label: 'Altro', icon: '📁' },
]

const CATEGORIE_LABEL = {
  regolamento: { label: 'Regolamento', color: '#3b82f6' },
  tabella_millesimale_doc: { label: 'Millesimi', color: '#8b5cf6' },
  verbale: { label: 'Verbale', color: '#10b981' },
  contratto: { label: 'Contratto', color: '#f59e0b' },
  certificazione: { label: 'Certificazione', color: '#06b6d4' },
  estratto_conto_archivio: { label: 'Archivio E/C', color: '#0ea5e9' },
  altro: { label: 'Altro', color: '#6b7280' },
}

export default function DocumentiCondominio({ condominioId }) {
  const { documenti, loading, error, fetch, upload, remove, getSignedUrl } = useDocumenti(condominioId)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [form, setForm] = useState({ tipo: 'regolamento', nome: '', note: '' })
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
    // ✅ Messaggio generico per PDF e DOCX
    const ext = selectedFile.name.split('.').pop().toLowerCase()
    setUploadProgress(
      ext === 'pdf' || ext === 'docx'
        ? 'Estrazione testo in corso (AI)...'
        : 'Caricamento...'
    )
    try {
      await upload(selectedFile, form.tipo, form.nome, form.note)
      setShowForm(false)
      setForm({ tipo: 'regolamento', nome: '', note: '' })
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
    const url = await getSignedUrl(doc.url_storage)
    if (url) {
      newWindow.location.href = url
    } else {
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

  const documentiVisibili = documenti.filter(d => d.tipo !== 'estratto_conto')
  const filtrati = filtroTipo === 'tutti' ? documentiVisibili : documentiVisibili.filter(d => d.tipo === filtroTipo)

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: 18, fontWeight: 600 }}>Documenti</h3>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>
            Regolamento, tabelle millesimali, verbali e altri documenti del condominio
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
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
              background: filtroTipo === tipo ? '#2563eb' : '#1e293b',
              color: filtroTipo === tipo ? '#fff' : '#94a3b8',
              border: `1px solid ${filtroTipo === tipo ? '#2563eb' : '#334155'}`,
              borderRadius: 20, padding: '5px 14px', fontSize: 12,
              cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: 500
            }}
          >
            {tipo === 'tutti' ? 'Tutti' : TIPI.find(t => t.value === tipo)?.label}
            {tipo !== 'tutti' && (
              <span style={{ marginLeft: 6, color: '#64748b' }}>
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
        <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>Caricamento...</div>
      ) : filtrati.length === 0 ? (
        <div style={{
          background: '#1e293b', border: '2px dashed #334155', borderRadius: 12,
          padding: 48, textAlign: 'center'
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
            {filtroTipo === 'tutti' ? 'Nessun documento caricato' : `Nessun documento di tipo "${TIPI.find(t => t.value === filtroTipo)?.label}"`}
          </p>
          <p style={{ color: '#475569', margin: '8px 0 0', fontSize: 12 }}>
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
                  background: '#1e293b', borderRadius: 10, padding: '14px 18px',
                  border: `1px solid ${isNormativo ? '#2563eb44' : '#334155'}`,
                  display: 'flex', alignItems: 'center', gap: 16
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: '#0f172a', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 20, flexShrink: 0
                }}>
                  {TIPI.find(t => t.value === doc.tipo)?.icon || '📁'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14 }}>{doc.nome}</span>
                    <span style={{
                      background: cat.color + '22', color: cat.color,
                      borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600
                    }}>
                      {cat.label}
                    </span>
                    {hasTesto && (
                      <span style={{ background: '#10b98122', color: '#10b981', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>
                        ✓ Testo estratto
                      </span>
                    )}
                    {isNormativo && !hasTesto && (
                      <span style={{ background: '#f59e0b22', color: '#f59e0b', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>
                        ⚠ Testo non estratto
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    {new Date(doc.created_at).toLocaleDateString('it-IT')}
                    {doc.note && <span> · {doc.note}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => handleOpen(doc)}
                    style={{
                      background: '#0f172a', color: '#94a3b8', border: '1px solid #334155',
                      borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                      fontFamily: 'Sora, sans-serif'
                    }}
                  >
                    Apri
                  </button>
                  <button
                    onClick={() => setConfirmDelete(doc)}
                    style={{
                      background: 'transparent', color: '#64748b', border: 'none',
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
            background: '#1e293b', borderRadius: 16, padding: 32, width: '100%',
            maxWidth: 520, border: '1px solid #334155'
          }}>
            <h3 style={{ margin: '0 0 24px', color: '#f1f5f9', fontSize: 18 }}>Carica documento</h3>
            <form onSubmit={handleUpload}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>
                  Tipo documento *
                </label>
                <select
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  style={{
                    width: '100%', background: '#0f172a', color: '#f1f5f9',
                    border: '1px solid #334155', borderRadius: 8, padding: '10px 12px',
                    fontSize: 14, fontFamily: 'Sora, sans-serif'
                  }}
                >
                  {TIPI.map(t => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>
                  Nome documento
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Es. Regolamento 2020"
                  style={{
                    width: '100%', background: '#0f172a', color: '#f1f5f9',
                    border: '1px solid #334155', borderRadius: 8, padding: '10px 12px',
                    fontSize: 14, fontFamily: 'Sora, sans-serif', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>
                  File * {(form.tipo === 'regolamento' || form.tipo === 'tabella_millesimale_doc') && (
                    <span style={{ color: '#10b981' }}>(PDF o DOCX consigliato — il testo verrà estratto per l'AI)</span>
                  )}
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    background: '#0f172a', border: `2px dashed ${selectedFile ? '#2563eb' : '#334155'}`,
                    borderRadius: 8, padding: '20px', textAlign: 'center', cursor: 'pointer'
                  }}
                >
                  {selectedFile ? (
                    <span style={{ color: '#60a5fa', fontSize: 14 }}>📎 {selectedFile.name}</span>
                  ) : (
                    <span style={{ color: '#64748b', fontSize: 14 }}>Clicca per selezionare un file</span>
                  )}
                </div>
                {/* ✅ accept: .docx abilitato, .doc legacy rimosso */}
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFile}
                  accept=".pdf,.docx,.xls,.xlsx,.jpg,.png,.webp,.txt" />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>
                  Note (opzionale)
                </label>
                <input
                  type="text"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Es. Approvato in assemblea del 12/03/2023"
                  style={{
                    width: '100%', background: '#0f172a', color: '#f1f5f9',
                    border: '1px solid #334155', borderRadius: 8, padding: '10px 12px',
                    fontSize: 14, fontFamily: 'Sora, sans-serif', boxSizing: 'border-box'
                  }}
                />
              </div>

              {uploadProgress && (
                <div style={{
                  background: '#0f172a', border: '1px solid #2563eb', borderRadius: 8,
                  padding: '10px 14px', marginBottom: 16, color: '#60a5fa', fontSize: 13
                }}>
                  ⏳ {uploadProgress}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setSelectedFile(null) }}
                  disabled={uploading}
                  style={{
                    background: 'transparent', color: '#94a3b8', border: '1px solid #334155',
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
                    background: selectedFile && !uploading ? '#2563eb' : '#1e3a6e',
                    color: '#fff', border: 'none', borderRadius: 8,
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
            background: '#1e293b', borderRadius: 12, padding: 28, maxWidth: 400,
            width: '100%', border: '1px solid #334155'
          }}>
            <h4 style={{ margin: '0 0 12px', color: '#f1f5f9' }}>Elimina documento</h4>
            <p style={{ color: '#94a3b8', margin: '0 0 20px', fontSize: 14 }}>
              Sei sicuro di voler eliminare "<strong style={{ color: '#f1f5f9' }}>{confirmDelete.nome}</strong>"?
              Il file verrà rimosso definitivamente.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{
                background: 'transparent', color: '#94a3b8', border: '1px solid #334155',
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
