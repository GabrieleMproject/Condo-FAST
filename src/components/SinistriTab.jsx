import { useEffect, useState, useRef } from 'react'
import { useSinistri } from '../hooks/useSinistri'
import { useUnita } from '../hooks/useUnita'
import { useDocumenti } from '../hooks/useDocumenti'
import {
  ShieldAlert, Calendar, Plus, ChevronLeft, Trash2, Link2, Link2Off,
  Paperclip, FileText, CheckCircle2, AlertTriangle, AlertCircle, X, Download, Loader2
} from 'lucide-react'

const STATI_SINISTRO = [
  { value: 'aperto', label: 'Aperto', color: '#f59e0b', bg: '#f59e0b1c' },
  { value: 'perizia', label: 'In perizia', color: '#3b82f6', bg: '#3b82f61c' },
  { value: 'liquidato', label: 'Liquidato', color: '#10b981', bg: '#10b9811c' },
  { value: 'respinto', label: 'Respinto', color: '#ef4444', bg: '#ef44441c' },
  { value: 'chiuso', label: 'Chiuso', color: '#6b7280', bg: '#6b72801c' },
]

const getProprietarioLabel = (unita) => {
  if (!unita?.occupanti_unita) return ''
  const prop = unita.occupanti_unita.find(o => o.ruolo === 'proprietario' && o.attivo)
  return prop?.persone ? `${prop.persone.nome} ${prop.persone.cognome}` : ''
}

export default function SinistriTab({ condominioId }) {
  const {
    sinistri, loading: loadingSinistri, error: errorSinistri, fetchSinistri,
    creaSinistro, aggiornaSinistro, eliminaSinistro,
    fetchSpeseCollegate, fetchSpeseNonCollegate, collegaSpesa, scollegaSpesa
  } = useSinistri(condominioId)

  const { unita, getProprietario } = useUnita(condominioId)
  const { documenti, fetch: fetchDocumenti, upload: uploadDocumento, remove: eliminaDocumento, getSignedUrl } = useDocumenti(condominioId)

  const [activeSinistro, setActiveSinistro] = useState(null)
  const [speseCollegate, setSpeseCollegate] = useState([])
  const [speseNonCollegate, setSpeseNonCollegate] = useState([])
  
  // Modali e Form
  const [showNuovoModal, setShowNuovoModal] = useState(false)
  const [showCollegaSpesaModal, setShowCollegaSpesaModal] = useState(false)
  const [confirmDeleteSinistro, setConfirmDeleteSinistro] = useState(null)
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState(null)

  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const fileRef = useRef()
  const [docForm, setDocForm] = useState({ nome: '', note: '' })

  const [formSinistro, setFormSinistro] = useState({
    titolo: '',
    codice_sinistro: '',
    data_evento: new Date().toISOString().split('T')[0],
    data_denuncia: '',
    descrizione: '',
    stato: 'aperto',
    importo_stimato: 0,
    importo_liquidato: 0,
    franchigia: 0,
    unita_origine_id: '',
    note_interne: ''
  })

  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState(null)

  useEffect(() => {
    fetchSinistri()
    fetchDocumenti()
  }, [fetchSinistri, fetchDocumenti])

  useEffect(() => {
    if (activeSinistro) {
      const updatedActive = sinistri.find(s => s.id === activeSinistro.id)
      if (updatedActive) {
        setActiveSinistro(updatedActive)
      }
    }
  }, [sinistri, activeSinistro?.id])

  // Seleziona un sinistro e carica le relative spese collegate
  const handleSelectSinistro = async (sinistro) => {
    setActiveSinistro(sinistro)
    setEditMode(false)
    try {
      const spese = await fetchSpeseCollegate(sinistro.id)
      setSpeseCollegate(spese)
    } catch (e) {
      console.error(e)
    }
  }

  const handleOpenNuovoModal = () => {
    setFormSinistro({
      titolo: '',
      codice_sinistro: '',
      data_evento: new Date().toISOString().split('T')[0],
      data_denuncia: '',
      descrizione: '',
      stato: 'aperto',
      importo_stimato: 0,
      importo_liquidato: 0,
      franchigia: 0,
      unita_origine_id: '',
      note_interne: ''
    })
    setShowNuovoModal(true)
  }

  const handleCreaSinistro = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...formSinistro,
        importo_stimato: Number(formSinistro.importo_stimato) || 0,
        importo_liquidato: Number(formSinistro.importo_liquidato) || 0,
        franchigia: Number(formSinistro.franchigia) || 0,
        unita_origine_id: formSinistro.unita_origine_id || null,
        data_denuncia: formSinistro.data_denuncia || null,
      }
      await creaSinistro(payload)
      setShowNuovoModal(false)
    } catch (err) {
      alert('Errore creazione: ' + err.message)
    }
  }

  const handleEliminaSinistro = async (id) => {
    try {
      await eliminaSinistro(id)
      setConfirmDeleteSinistro(null)
      if (activeSinistro?.id === id) {
        setActiveSinistro(null)
      }
    } catch (err) {
      alert('Errore eliminazione: ' + err.message)
    }
  }

  const handleStartEdit = () => {
    setEditForm({
      ...activeSinistro,
      unita_origine_id: activeSinistro.unita_origine_id || '',
      data_denuncia: activeSinistro.data_denuncia || '',
    })
    setEditMode(true)
  }

  const handleSalvaModifiche = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        titolo: editForm.titolo,
        codice_sinistro: editForm.codice_sinistro,
        data_evento: editForm.data_evento,
        data_denuncia: editForm.data_denuncia || null,
        descrizione: editForm.descrizione,
        stato: editForm.stato,
        importo_stimato: Number(editForm.importo_stimato) || 0,
        importo_liquidato: Number(editForm.importo_liquidato) || 0,
        franchigia: Number(editForm.franchigia) || 0,
        unita_origine_id: editForm.unita_origine_id || null,
        note_interne: editForm.note_interne,
      }
      await aggiornaSinistro(activeSinistro.id, payload)
      setEditMode(false)
    } catch (err) {
      alert('Errore salvataggio: ' + err.message)
    }
  }

  // Spese
  const handleOpenCollegaSpesa = async () => {
    try {
      const nonCollegate = await fetchSpeseNonCollegate()
      setSpeseNonCollegate(nonCollegate)
      setShowCollegaSpesaModal(true)
    } catch (e) {
      alert('Errore nel recupero delle spese non collegate: ' + e.message)
    }
  }

  const handleCollegaSpesa = async (spesaId) => {
    try {
      await collegaSpesa(spesaId, activeSinistro.id)
      setShowCollegaSpesaModal(false)
      // Ricarica spese collegate
      const spese = await fetchSpeseCollegate(activeSinistro.id)
      setSpeseCollegate(spese)
    } catch (e) {
      alert('Errore collegamento spesa: ' + e.message)
    }
  }

  const handleScollegaSpesa = async (spesaId) => {
    try {
      await scollegaSpesa(spesaId)
      setSpeseCollegate(prev => prev.filter(s => s.id !== spesaId))
    } catch (e) {
      alert('Errore scollegamento spesa: ' + e.message)
    }
  }

  // Upload Documenti
  const handleUploadDoc = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !activeSinistro) return
    setUploading(true)
    const ext = file.name.split('.').pop().toLowerCase()
    setUploadProgress(
      ext === 'pdf' || ext === 'docx'
        ? 'Estrazione testo in corso (AI)...'
        : 'Caricamento...'
    )
    try {
      const nomeDoc = docForm.nome || file.name.replace(/\.[^.]+$/, '')
      await uploadDocumento(file, 'sinistro', nomeDoc, docForm.note || '', null, activeSinistro.id)
      setDocForm({ nome: '', note: '' })
      setUploadProgress('')
    } catch (err) {
      alert('Errore upload: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleOpenDoc = async (doc) => {
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
      console.error(err)
      newWindow.close()
      alert('Impossibile aprire il documento')
    }
  }

  const handleDeleteDoc = async (doc) => {
    try {
      await eliminaDocumento(doc)
      setConfirmDeleteDoc(null)
    } catch (err) {
      alert('Errore eliminazione: ' + err.message)
    }
  }

  // Calcoli finanziari
  const totaleSpeseRiparazione = speseCollegate.reduce((acc, s) => acc + (Number(s.importo) || 0), 0)
  const importoLiquidato = activeSinistro ? Number(activeSinistro.importo_liquidato) || 0 : 0
  const differenzaCaricoCondominio = Math.max(0, totaleSpeseRiparazione - importoLiquidato)

  const documentiSinistro = documenti.filter(d => d.sinistro_id === activeSinistro?.id)

  const formattaEuro = (val) => {
    return `€ ${Number(val).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formattaData = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('it-IT')
  }

  return (
    <div style={{ padding: '20px 0', fontFamily: 'Sora, sans-serif' }}>
      {/* ERROR MESSAGE */}
      {errorSinistri && (
        <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} />
          <span>{errorSinistri}</span>
        </div>
      )}

      {!activeSinistro ? (
        <>
          {/* ELENCO SINISTRI */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 18, fontWeight: 600 }}>Gestione Sinistri</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Registro dei sinistri del condominio, gestione delle perizie, dei rimborsi assicurativi e delle spese di ripristino.
              </p>
            </div>
            <button onClick={handleOpenNuovoModal} style={S.btnPrimary}>
              <Plus size={16} style={{ marginRight: 6 }} /> Nuovo Sinistro
            </button>
          </div>

          {/* TABELLA SINISTRI */}
          {loadingSinistri && !sinistri.length ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Caricamento...</div>
          ) : sinistri.length === 0 ? (
            <div style={{
              background: 'var(--card-bg)', border: '2px dashed var(--border-color)', borderRadius: 12,
              padding: 48, textAlign: 'center'
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <ShieldAlert size={40} style={{ color: 'var(--text-muted)' }} />
              </div>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14, fontWeight: 500 }}>
                Nessun sinistro registrato in questo condominio
              </p>
              <p style={{ color: 'var(--text-muted)', margin: '6px 0 0', fontSize: 12 }}>
                Clicca su "Nuovo Sinistro" in alto a destra per registrare la prima denuncia.
              </p>
            </div>
          ) : (
            <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--app-bg)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Titolo</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Data Evento</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Codice Assicurazione</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Origine</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Stato</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Danno Stimato</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Liquidato</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sinistri.map(s => {
                    const st = STATI_SINISTRO.find(x => x.value === s.stato) || STATI_SINISTRO[0]
                    return (
                      <tr
                        key={s.id}
                        onClick={() => handleSelectSinistro(s)}
                        style={{
                          borderBottom: '1px solid var(--border-color)', cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.titolo}</td>
                        <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>{formattaData(s.data_evento)}</td>
                        <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>{s.codice_sinistro || '—'}</td>
                        <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                          {s.unita ? `Scala ${s.unita.scala} - N. ${s.unita.numero || ''} (${getProprietarioLabel(s.unita)})` : 'Parti Comuni'}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            color: st.color, background: st.bg, borderRadius: 6,
                            padding: '2px 8px', fontSize: 11, fontWeight: 700
                          }}>{st.label}</span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', color: 'var(--text-secondary)' }}>{formattaEuro(s.importo_stimato)}</td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 600, color: s.importo_liquidato > 0 ? '#10b981' : 'var(--text-secondary)' }}>
                          {formattaEuro(s.importo_liquidato)}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setConfirmDeleteSinistro(s)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* DETTAGLIO SINISTRO */
        <div>
          <button onClick={() => setActiveSinistro(null)} style={{ ...S.btnSecondary, marginBottom: 20 }}>
            <ChevronLeft size={16} style={{ marginRight: 4 }} /> Torna all'elenco
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 20, fontWeight: 700 }}>
                  {activeSinistro.titolo}
                </h3>
                {(() => {
                  const st = STATI_SINISTRO.find(x => x.value === activeSinistro.stato) || STATI_SINISTRO[0]
                  return (
                    <span style={{
                      color: st.color, background: st.bg, borderRadius: 6,
                      padding: '2px 8px', fontSize: 11, fontWeight: 700
                    }}>{st.label}</span>
                  )
                })()}
              </div>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Codice Assicurazione: <strong style={{ color: 'var(--text-secondary)' }}>{activeSinistro.codice_sinistro || '—'}</strong> |
                Data Evento: <strong style={{ color: 'var(--text-secondary)' }}>{formattaData(activeSinistro.data_evento)}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!editMode ? (
                <>
                  <button onClick={handleStartEdit} style={S.btnPrimary}>Modifica Dettagli</button>
                  <button onClick={() => setConfirmDeleteSinistro(activeSinistro)} style={{ ...S.btnDanger, padding: '9px 12px' }}>
                    <Trash2 size={16} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditMode(false)} style={S.btnSecondary}>Annulla</button>
                  <button onClick={handleSalvaModifiche} style={S.btnSuccess}>Salva</button>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            {/* SCHEDA DATI GENERALE */}
            <div style={S.card}>
              <h4 style={S.cardTitle}>Informazioni Generali</h4>
              {!editMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <span style={S.infoLabel}>Unità immobiliare d'origine</span>
                    <span style={S.infoValue}>
                      {activeSinistro.unita
                        ? `Scala ${activeSinistro.unita.scala} - N. ${activeSinistro.unita.numero || ''} (${getProprietarioLabel(activeSinistro.unita)})`
                        : 'Parti Comuni / Nessuna'}
                    </span>
                  </div>
                  <div>
                    <span style={S.infoLabel}>Data Denuncia</span>
                    <span style={S.infoValue}>{formattaData(activeSinistro.data_denuncia)}</span>
                  </div>
                  <div>
                    <span style={S.infoLabel}>Descrizione dell'evento</span>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {activeSinistro.descrizione || 'Nessuna descrizione specificata.'}
                    </p>
                  </div>
                  <div>
                    <span style={S.infoLabel}>Note Interne Amministratore</span>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {activeSinistro.note_interne || 'Nessuna nota interna inserita.'}
                    </p>
                  </div>
                </div>
              ) : (
                /* FORM DI MODIFICA */
                <form onSubmit={handleSalvaModifiche} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={S.formLabel}>Titolo *</label>
                      <input
                        type="text"
                        value={editForm.titolo}
                        onChange={e => setEditForm(f => ({ ...f, titolo: e.target.value }))}
                        required
                        style={S.input}
                      />
                    </div>
                    <div>
                      <label style={S.formLabel}>Codice Sinistro</label>
                      <input
                        type="text"
                        value={editForm.codice_sinistro}
                        onChange={e => setEditForm(f => ({ ...f, codice_sinistro: e.target.value }))}
                        style={S.input}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={S.formLabel}>Data Evento *</label>
                      <input
                        type="date"
                        value={editForm.data_evento}
                        onChange={e => setEditForm(f => ({ ...f, data_evento: e.target.value }))}
                        required
                        style={S.input}
                      />
                    </div>
                    <div>
                      <label style={S.formLabel}>Data Denuncia</label>
                      <input
                        type="date"
                        value={editForm.data_denuncia}
                        onChange={e => setEditForm(f => ({ ...f, data_denuncia: e.target.value }))}
                        style={S.input}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={S.formLabel}>Stato</label>
                      <select
                        value={editForm.stato}
                        onChange={e => setEditForm(f => ({ ...f, stato: e.target.value }))}
                        style={S.input}
                      >
                        {STATI_SINISTRO.map(x => (
                          <option key={x.value} value={x.value}>{x.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={S.formLabel}>Unità Origine</label>
                      <select
                        value={editForm.unita_origine_id}
                        onChange={e => setEditForm(f => ({ ...f, unita_origine_id: e.target.value }))}
                        style={S.input}
                      >
                        <option value="">Parti Comuni (Nessuna)</option>
                        {unita.map(u => {
                          const prop = getProprietario(u)
                          return (
                            <option key={u.id} value={u.id}>
                              Scala {u.scala} - N. {u.numero || ''} {prop ? `(${prop.cognome})` : ''}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={S.formLabel}>Danno Stimato (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.importo_stimato}
                        onChange={e => setEditForm(f => ({ ...f, importo_stimato: e.target.value }))}
                        style={S.input}
                      />
                    </div>
                    <div>
                      <label style={S.formLabel}>Liquidato (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.importo_liquidato}
                        onChange={e => setEditForm(f => ({ ...f, importo_liquidato: e.target.value }))}
                        style={S.input}
                      />
                    </div>
                    <div>
                      <label style={S.formLabel}>Franchigia (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.franchigia}
                        onChange={e => setEditForm(f => ({ ...f, franchigia: e.target.value }))}
                        style={S.input}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={S.formLabel}>Descrizione</label>
                    <textarea
                      value={editForm.descrizione}
                      onChange={e => setEditForm(f => ({ ...f, descrizione: e.target.value }))}
                      rows={3}
                      style={{ ...S.input, resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <label style={S.formLabel}>Note Interne</label>
                    <textarea
                      value={editForm.note_interne}
                      onChange={e => setEditForm(f => ({ ...f, note_interne: e.target.value }))}
                      rows={2}
                      style={{ ...S.input, resize: 'vertical' }}
                    />
                  </div>
                </form>
              )}
            </div>

            {/* QUADRO ECONOMICO / FINANZIARIO */}
            <div style={{ ...S.card, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h4 style={S.cardTitle}>Quadro Economico</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Totale Spese di Riparazione:</span>
                    <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>{formattaEuro(totaleSpeseRiparazione)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Importo Rimborsato/Liquidato:</span>
                    <strong style={{ color: '#10b981', fontSize: 14 }}>{formattaEuro(importoLiquidato)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Franchigia / Scoperto applicato:</span>
                    <strong style={{ color: '#ef4444', fontSize: 14 }}>{formattaEuro(activeSinistro.franchigia)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Danno Stimato iniziale:</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{formattaEuro(activeSinistro.importo_stimato)}</span>
                  </div>
                </div>
              </div>

              <div style={{
                background: 'var(--app-bg)', borderRadius: 8, padding: 16,
                border: '1px solid var(--border-color)', marginTop: 20
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Costo a Carico Condominio
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      (Spese associate - liquidazione)
                    </div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: differenzaCaricoCondominio > 0 ? '#ef4444' : '#10b981' }}>
                    {formattaEuro(differenzaCaricoCondominio)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* SPESE COLLEGATE */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h4 style={{ ...S.cardTitle, margin: 0 }}>Spese di Riparazione</h4>
                <button onClick={handleOpenCollegaSpesa} style={{ ...S.btnSecondary, padding: '4px 10px', fontSize: 11 }}>
                  <Link2 size={12} style={{ marginRight: 4 }} /> Collega Spesa
                </button>
              </div>

              {!speseCollegate.length ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32, fontSize: 13 }}>
                  Nessuna spesa di riparazione collegata a questo sinistro.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {speseCollegate.map(spesa => (
                    <div key={spesa.id} style={S.itemRow}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{spesa.descrizione}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {formattaData(spesa.data_spesa)} · Fornitore: {spesa.fornitore || 'Non specificato'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{formattaEuro(spesa.importo)}</span>
                        <button
                          onClick={() => handleScollegaSpesa(spesa.id)}
                          title="Scollega dal sinistro"
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          <Link2Off size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DOCUMENTI ALLEGATI */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h4 style={{ ...S.cardTitle, margin: 0 }}>Documentazione Allegata</h4>
                <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...S.btnSecondary, padding: '4px 10px', fontSize: 11 }}>
                  <Plus size={12} style={{ marginRight: 4 }} /> Aggiungi File
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  onChange={handleUploadDoc}
                  style={{ display: 'none' }}
                  accept=".pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.txt"
                />
              </div>

              {uploadProgress && (
                <div style={{ background: 'var(--app-bg)', color: '#60a5fa', border: '1px solid #2563eb', padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 size={13} className="spin" /> {uploadProgress}
                </div>
              )}

              {!documentiSinistro.length ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32, fontSize: 13 }}>
                  Nessun documento allegato.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {documentiSinistro.map(doc => {
                    const ext = doc.nome.split('.').pop().toLowerCase()
                    const hasTesto = !!doc.testo_estratto
                    return (
                      <div key={doc.id} style={S.itemRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                          <FileText size={18} color="#60a5fa" />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {doc.nome}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{formattaData(doc.created_at)}</span>
                              {hasTesto && (
                                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <CheckCircle2 size={10} /> Testo AI
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleOpenDoc(doc)}
                            style={{ background: 'var(--app-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}
                          >
                            Apri
                          </button>
                          <button
                            onClick={() => setConfirmDeleteDoc(doc)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUOVO SINISTRO */}
      {showNuovoModal && (
        <div style={S.modalOverlay}>
          <div style={S.modalContent}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 16, fontWeight: 700 }}>Registra Nuovo Sinistro</h3>
              <button onClick={() => setShowNuovoModal(false)} style={S.btnClose}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreaSinistro} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.formLabel}>Titolo Sinistro *</label>
                  <input
                    type="text"
                    value={formSinistro.titolo}
                    onChange={e => setFormSinistro(f => ({ ...f, titolo: e.target.value }))}
                    placeholder="Es. Infiltrazione soffitto scala A"
                    required
                    style={S.input}
                  />
                </div>
                <div>
                  <label style={S.formLabel}>Codice Assicurazione</label>
                  <input
                    type="text"
                    value={formSinistro.codice_sinistro}
                    onChange={e => setFormSinistro(f => ({ ...f, codice_sinistro: e.target.value }))}
                    placeholder="Es. SIN-2026-987"
                    style={S.input}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.formLabel}>Data Evento *</label>
                  <input
                    type="date"
                    value={formSinistro.data_evento}
                    onChange={e => setFormSinistro(f => ({ ...f, data_evento: e.target.value }))}
                    required
                    style={S.input}
                  />
                </div>
                <div>
                  <label style={S.formLabel}>Data Denuncia</label>
                  <input
                    type="date"
                    value={formSinistro.data_denuncia}
                    onChange={e => setFormSinistro(f => ({ ...f, data_denuncia: e.target.value }))}
                    style={S.input}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.formLabel}>Stato Iniziale</label>
                  <select
                    value={formSinistro.stato}
                    onChange={e => setFormSinistro(f => ({ ...f, stato: e.target.value }))}
                    style={S.input}
                  >
                    {STATI_SINISTRO.map(x => (
                      <option key={x.value} value={x.value}>{x.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={S.formLabel}>Unità d'Origine (se privata)</label>
                  <select
                    value={formSinistro.unita_origine_id}
                    onChange={e => setFormSinistro(f => ({ ...f, unita_origine_id: e.target.value }))}
                    style={S.input}
                  >
                    <option value="">Parti Comuni / Nessuna</option>
                    {unita.map(u => {
                      const prop = getProprietario(u)
                      return (
                        <option key={u.id} value={u.id}>
                          Scala {u.scala} - N. {u.numero || ''} {prop ? `(${prop.cognome})` : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label style={S.formLabel}>Stima Danno (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formSinistro.importo_stimato}
                    onChange={e => setFormSinistro(f => ({ ...f, importo_stimato: e.target.value }))}
                    style={S.input}
                  />
                </div>
                <div>
                  <label style={S.formLabel}>Liquidato (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formSinistro.importo_liquidato}
                    onChange={e => setFormSinistro(f => ({ ...f, importo_liquidato: e.target.value }))}
                    style={S.input}
                  />
                </div>
                <div>
                  <label style={S.formLabel}>Franchigia (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formSinistro.franchigia}
                    onChange={e => setFormSinistro(f => ({ ...f, franchigia: e.target.value }))}
                    style={S.input}
                  />
                </div>
              </div>

              <div>
                <label style={S.formLabel}>Descrizione dell'evento</label>
                <textarea
                  value={formSinistro.descrizione}
                  onChange={e => setFormSinistro(f => ({ ...f, descrizione: e.target.value }))}
                  placeholder="Descrivi come si è verificato il sinistro e quali parti del fabbricato sono danneggiate..."
                  rows={3}
                  style={{ ...S.input, resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={S.formLabel}>Note Interne (opzionali)</label>
                <textarea
                  value={formSinistro.note_interne}
                  onChange={e => setFormSinistro(f => ({ ...f, note_interne: e.target.value }))}
                  placeholder="Annotazioni riservate, scambi telefonici con il broker..."
                  rows={2}
                  style={{ ...S.input, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" onClick={() => setShowNuovoModal(false)} style={S.btnSecondary}>
                  Annulla
                </button>
                <button type="submit" style={S.btnPrimary}>
                  Crea Sinistro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL COLLEGA SPESA */}
      {showCollegaSpesaModal && (
        <div style={S.modalOverlay}>
          <div style={{ ...S.modalContent, maxWidth: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 16, fontWeight: 700 }}>Collega Spesa a Sinistro</h3>
              <button onClick={() => setShowCollegaSpesaModal(false)} style={S.btnClose}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Di seguito sono elencate le spese del condominio che non risultano ancora collegate a nessun sinistro. Selezionane una per associarla.
            </p>

            {!speseNonCollegate.length ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 13 }}>
                Tutte le spese del condominio sono già collegate o non ci sono spese registrate.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 350, overflowY: 'auto', paddingRight: 4 }}>
                {speseNonCollegate.map(spesa => (
                  <div key={spesa.id} style={{ ...S.itemRow, background: 'var(--app-bg)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{spesa.descrizione}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Data: {formattaData(spesa.data_spesa)} · Categoria: {spesa.criterio || 'altro'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>{formattaEuro(spesa.importo)}</strong>
                      <button onClick={() => handleCollegaSpesa(spesa.id)} style={{ ...S.btnPrimary, padding: '5px 12px', fontSize: 11 }}>
                        Associa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowCollegaSpesaModal(false)} style={S.btnSecondary}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE SINISTRO */}
      {confirmDeleteSinistro && (
        <div style={S.modalOverlay}>
          <div style={{ ...S.modalContent, maxWidth: 400 }}>
            <h4 style={{ margin: '0 0 12px', color: 'var(--text-primary)' }}>Elimina Sinistro</h4>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 20px', fontSize: 13, lineHeight: 1.5 }}>
              Sei sicuro di voler eliminare definitivamente il sinistro "<strong style={{ color: 'var(--text-primary)' }}>{confirmDeleteSinistro.titolo}</strong>"?
              Questa azione scollegherà tutte le spese associate e non potrà essere annullata.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDeleteSinistro(null)} style={S.btnSecondary}>Annulla</button>
              <button onClick={() => handleEliminaSinistro(confirmDeleteSinistro.id)} style={S.btnDanger}>Elimina</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE DOCUMENTO */}
      {confirmDeleteDoc && (
        <div style={S.modalOverlay}>
          <div style={{ ...S.modalContent, maxWidth: 400 }}>
            <h4 style={{ margin: '0 0 12px', color: 'var(--text-primary)' }}>Elimina Documento</h4>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 20px', fontSize: 13, lineHeight: 1.5 }}>
              Sei sicuro di voler eliminare "<strong style={{ color: 'var(--text-primary)' }}>{confirmDeleteDoc.nome}</strong>"?
              Il file verrà rimosso definitivamente dallo storage di CondoSmart.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDeleteDoc(null)} style={S.btnSecondary}>Annulla</button>
              <button onClick={() => handleDeleteDoc(confirmDeleteDoc)} style={S.btnDanger}>Elimina</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  btnPrimary: {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
    padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'Sora, sans-serif', display: 'flex', alignItems: 'center', transition: 'background 0.15s'
  },
  btnSecondary: {
    background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 8,
    padding: '9px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'Sora, sans-serif', display: 'flex', alignItems: 'center'
  },
  btnSuccess: {
    background: '#059669', color: '#fff', border: 'none', borderRadius: 8,
    padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif'
  },
  btnDanger: {
    background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8,
    padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif'
  },
  btnClose: {
    background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
  },
  card: {
    background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '20px 24px'
  },
  cardTitle: {
    color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em'
  },
  infoLabel: {
    display: 'block', color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4
  },
  infoValue: {
    display: 'block', color: 'var(--text-primary)', fontSize: 14, fontWeight: 500, marginBottom: 8
  },
  formLabel: {
    display: 'block', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 6
  },
  input: {
    width: '100%', background: 'var(--app-bg)', color: 'var(--text-primary)',
    border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px',
    fontSize: 13, fontFamily: 'Sora, sans-serif', boxSizing: 'border-box'
  },
  itemRow: {
    background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8,
    padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: '#00000088', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
  },
  modalContent: {
    background: 'var(--card-bg)', borderRadius: 16, padding: 32, width: '100%',
    maxWidth: 550, border: '1px solid var(--border-color)', boxSizing: 'border-box'
  }
}
