import { useState, useEffect } from 'react'
import { useAssemblee } from '../hooks/useAssemblee'
import AssembleaLiveConsole from './AssembleaLiveConsole'
import { CalendarRange, Plus, Video, MapPin, Loader2, ArrowRight, QrCode } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'

export default function GestioneAssembleeView({ condominioId }) {
  const { assemblee, loading, error, fetch, crea } = useAssemblee(condominioId)
  const [activeAssembleaId, setActiveAssembleaId] = useState(null)
  
  // Modale creazione
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ titolo: '', tipo: 'ordinaria', data_inizio: '', luogo: '', link_video: '', note: '' })
  const [odgList, setOdgList] = useState([{ titolo: '', descrizione: '' }])
  const [creating, setCreating] = useState(false)
  const [showQrGenerico, setShowQrGenerico] = useState(null)

  useEffect(() => {
    fetch()
  }, [fetch])

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      // Filter out empty odg
      const validOdg = odgList.filter(o => o.titolo.trim() !== '')
      await crea(form, validOdg)
      setShowCreate(false)
      setForm({ titolo: '', tipo: 'ordinaria', data_inizio: '', luogo: '', link_video: '', note: '' })
      setOdgList([{ titolo: '', descrizione: '' }])
    } catch (err) {
      alert('Errore creazione assemblea: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  if (activeAssembleaId) {
    return (
      <AssembleaLiveConsole 
        assembleaId={activeAssembleaId} 
        onClose={() => setActiveAssembleaId(null)} 
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>Programmazione Assemblee</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>Pianifica e gestisci lo svolgimento delle assemblee in tempo reale.</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={S.btnPrimary}>
          <Plus size={16} /> Nuova Assemblea
        </button>
      </div>

      {loading && !assemblee.length ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}><Loader2 size={24} className="spin" /></div>
      ) : assemblee.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: 'var(--card-bg)', borderRadius: 12, border: '1px dashed var(--border-color)' }}>
          <CalendarRange size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Nessuna assemblea programmata.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {assemblee.map(ass => (
            <div key={ass.id} style={S.assembleaCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ 
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, textTransform: 'uppercase',
                      background: ass.tipo === 'ordinaria' ? 'rgba(59,130,246,0.1)' : 'rgba(139,92,246,0.1)',
                      color: ass.tipo === 'ordinaria' ? '#3b82f6' : '#8b5cf6'
                    }}>
                      {ass.tipo}
                    </span>
                    <span style={{ 
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, textTransform: 'uppercase',
                      background: ass.stato === 'bozza' ? 'rgba(148,163,184,0.1)' : 
                                  ass.stato === 'in_corso' ? 'rgba(16,185,129,0.1)' : 
                                  'rgba(245,158,11,0.1)',
                      color: ass.stato === 'bozza' ? '#94a3b8' : 
                             ass.stato === 'in_corso' ? '#10b981' : 
                             '#f59e0b'
                    }}>
                      {ass.stato.replace('_', ' ')}
                    </span>
                  </div>
                  <h4 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--text-primary)' }}>{ass.titolo}</h4>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {ass.data_inizio && <span>{new Date(ass.data_inizio).toLocaleString('it-IT')}</span>}
                    {ass.luogo && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12}/> {ass.luogo}</span>}
                    {ass.link_video && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Video size={12}/> Teleassemblea</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <button 
                    onClick={() => setActiveAssembleaId(ass.id)}
                    style={S.btnAction}
                  >
                    Entra nella Regia <ArrowRight size={14} />
                  </button>
                  <button 
                    onClick={() => setShowQrGenerico(ass.id)}
                    style={{ ...S.btnAction, background: 'var(--app-bg)', color: 'var(--text-secondary)' }}
                  >
                    <QrCode size={14} /> QR Sala (App)
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Creazione */}
      {showCreate && (
        <div style={S.overlay}>
          <div style={S.modalCard}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>Nuova Assemblea</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.label}>Titolo *</label>
                  <input required value={form.titolo} onChange={e=>setForm({...form, titolo: e.target.value})} style={S.input} placeholder="Es. Assemblea Ordinaria 2026" />
                </div>
                <div>
                  <label style={S.label}>Tipo *</label>
                  <select required value={form.tipo} onChange={e=>setForm({...form, tipo: e.target.value})} style={S.input}>
                    <option value="ordinaria">Ordinaria</option>
                    <option value="straordinaria">Straordinaria</option>
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.label}>Data e Ora *</label>
                  <input type="datetime-local" required value={form.data_inizio} onChange={e=>setForm({...form, data_inizio: e.target.value})} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Luogo Fisico (opzionale)</label>
                  <input value={form.luogo} onChange={e=>setForm({...form, luogo: e.target.value})} style={S.input} placeholder="Es. Studio Amministratore" />
                </div>
              </div>

              <div>
                <label style={S.label}>Link Teleassemblea (opzionale)</label>
                <input value={form.link_video} onChange={e=>setForm({...form, link_video: e.target.value})} style={S.input} placeholder="Es. https://meet.google.com/..." />
              </div>

              <div>
                <h4 style={{ margin: '16px 0 8px', color: 'var(--text-primary)', fontSize: 14 }}>Ordine del Giorno (OdG)</h4>
                {odgList.map((odg, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <span style={{ background: 'var(--app-bg)', padding: '8px 12px', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, border: '1px solid var(--border-color)' }}>{idx + 1}.</span>
                    <input 
                      value={odg.titolo}
                      onChange={e => {
                      const newOdg = [...odgList]
                      newOdg[idx] = { ...newOdg[idx], titolo: e.target.value }
                      setOdgList(newOdg)
                      }}
                      style={{ ...S.input, flex: 1 }}
                      placeholder="Titolo punto OdG"
                    />
                    <button type="button" onClick={() => setOdgList(odgList.filter((_, i) => i !== idx))} style={{ ...S.btnSecondary, padding: '0 12px', color: '#ef4444' }}>&times;</button>
                  </div>
                ))}
                <button type="button" onClick={() => setOdgList([...odgList, { titolo: '', descrizione: '' }])} style={{ ...S.btnSecondary, width: '100%', marginTop: 8 }}>
                  + Aggiungi Punto all'OdG
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={() => setShowCreate(false)} style={S.btnSecondary}>Annulla</button>
                <button type="submit" disabled={creating} style={S.btnPrimary}>{creating ? 'Salvataggio...' : 'Crea Assemblea'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal QR Code Generico */}
      {showQrGenerico && (
        <div style={S.overlay} onClick={() => setShowQrGenerico(null)}>
          <div style={{ ...S.modalCard, width: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>Accesso App (Sala)</h3>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-secondary)' }}>
              Proietta o stampa questo QR. I condòmini potranno inquadrarlo per registrarsi e votare in sala.
            </p>
            <div style={{ background: '#fff', padding: 24, borderRadius: 16, display: 'inline-block', border: '1px solid #e2e8f0', marginBottom: 24 }}>
              <QRCodeCanvas 
                value={`${window.location.origin}/voto/join/${showQrGenerico}`}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>
              Link manuale:<br/>
              <strong style={{ userSelect: 'all' }}>{window.location.origin}/voto/join/{showQrGenerico}</strong>
            </p>
            <button onClick={() => setShowQrGenerico(null)} style={{ ...S.btnSecondary, width: '100%' }}>Chiudi</button>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  btnPrimary: { background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Sora, sans-serif' },
  btnSecondary: { background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
  btnAction: { background: 'rgba(37,99,235,0.1)', color: '#3b82f6', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
  assembleaCard: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalCard: { background: 'var(--card-bg)', padding: 24, borderRadius: 16, width: 600, maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)' },
  label: { display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' },
  input: { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--app-bg)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'Sora, sans-serif' },
}
