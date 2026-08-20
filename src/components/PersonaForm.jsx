// src/components/PersonaForm.jsx
import { useState, useRef } from 'react'
import { UserCheck, Key, X, Sparkles } from 'lucide-react'
import { useAutoDraft } from '../hooks/useAutoDraft'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { useFormShortcuts } from '../hooks/useFormShortcuts'

const EMPTY_PERSONA = {
  nome: '', cognome: '', codice_fiscale: '', data_nascita: '',
  email: '', telefono: '', telefono_alt: '',
  indirizzo: '', cap: '', citta: '', provincia: '',
  note: '',
}

export default function PersonaForm({ ruolo, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY_PERSONA)
  const originalForm = useRef(EMPTY_PERSONA)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const draftKey = `draft_persona_${ruolo || 'generic'}`
  const { hasDraft, restoreDraft, clearDraft, lastSavedAt } = useAutoDraft(draftKey, form, setForm, true)

  const isDirty = Boolean(form.nome || form.cognome || form.codice_fiscale || form.email || form.telefono)
  useUnsavedChanges(isDirty && !saving)
  useFormShortcuts({ onSave: () => handleSave(), onCancel: () => handleClose(), isEnabled: true })

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const validate = () => {
    const e = {}
    if (!form.nome.trim())    e.nome    = 'Obbligatorio'
    if (!form.cognome.trim()) e.cognome = 'Obbligatorio'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) {
      setErrors(e)
      const firstErr = Object.keys(e)[0]
      if (firstErr) {
        setTimeout(() => {
          const el = document.querySelector(`input[name="${firstErr}"], input[value="${form[firstErr]}"]`)
          if (el) el.focus()
        }, 50)
      }
      return
    }
    setSaving(true)
    try {
      await onSave(form)
      if (clearDraft) clearDraft()
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (isDirty) {
      if (!window.confirm('Ci sono dati non salvati per questa persona. Sei sicuro di voler chiudere?')) return
    }
    onClose()
  }

  return (
    <div style={ov}>
      <div style={modal}>
        <div style={hdr}>
          <h2 style={{ ...ttl, display: 'flex', alignItems: 'center', gap: 8 }}>
            {ruolo === 'proprietario' ? <UserCheck size={18} /> : <Key size={18} />} Aggiungi {ruolo === 'proprietario' ? 'Proprietario' : 'Inquilino'}
          </h2>
          <button style={cls} onClick={handleClose}><X size={18} /></button>
        </div>

        <div style={body}>
          {hasDraft && !isDirty && (
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3b82f6', fontWeight: 600 }}>
                <Sparkles size={14} /> È disponibile una bozza per questo {ruolo || 'contatto'}.
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={restoreDraft} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  Ripristina
                </button>
                <button type="button" onClick={clearDraft} style={{ background: 'transparent', color: '#94a3b8', border: 'none', padding: '3px 6px', fontSize: 11, cursor: 'pointer' }}>
                  Elimina
                </button>
              </div>
            </div>
          )}

          {/* Dati anagrafici */}
          <Section title="Dati anagrafici">
            <div style={grid2}>
              <Field label="Cognome *" error={errors.cognome}>
                <input style={inp} value={form.cognome} onChange={e => set('cognome', e.target.value)} placeholder="Rossi" />
              </Field>
              <Field label="Nome *" error={errors.nome}>
                <input style={inp} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Mario" />
              </Field>
              <Field label="Codice Fiscale">
                <input style={inp} value={form.codice_fiscale} onChange={e => set('codice_fiscale', e.target.value.toUpperCase())} placeholder="RSSMRA80A01F205X" maxLength={16} />
              </Field>
              <Field label="Data di nascita">
                <input style={inp} type="date" value={form.data_nascita} onChange={e => set('data_nascita', e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* Contatti */}
          <Section title="Contatti">
            <div style={grid2}>
              <Field label="Email">
                <input style={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="mario.rossi@email.com" />
              </Field>
              <Field label="Telefono">
                <input style={inp} value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="333 1234567" />
              </Field>
              <Field label="Telefono alternativo">
                <input style={inp} value={form.telefono_alt} onChange={e => set('telefono_alt', e.target.value)} placeholder="02 1234567" />
              </Field>
            </div>
          </Section>

          {/* Residenza */}
          <Section title="Residenza">
            <Field label="Indirizzo">
              <input style={inp} value={form.indirizzo} onChange={e => set('indirizzo', e.target.value)} placeholder="Via Roma 1" />
            </Field>
            <div style={{ ...grid2, marginTop: 12 }}>
              <Field label="Città">
                <input style={inp} value={form.citta} onChange={e => set('citta', e.target.value)} placeholder="Milano" />
              </Field>
              <Field label="CAP">
                <input style={inp} value={form.cap} onChange={e => set('cap', e.target.value)} placeholder="20100" maxLength={5} />
              </Field>
              <Field label="Provincia">
                <input style={inp} value={form.provincia} onChange={e => set('provincia', e.target.value)} placeholder="MI" maxLength={2} />
              </Field>
            </div>
          </Section>

          <Field label="Note">
            <textarea style={{ ...inp, minHeight: 60, resize: 'vertical', marginTop: 4 }}
              value={form.note} onChange={e => set('note', e.target.value)} />
          </Field>
        </div>

        <div style={actions}>
          <button style={secBtn} onClick={onClose}>Annulla</button>
          <button style={priBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Salvataggio…' : `Salva ${ruolo}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border-color-2)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <div>
      <label style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
      {error && <span style={{ color: '#f87171', fontSize: 11 }}>{error}</span>}
    </div>
  )
}

const ov    = { position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,backdropFilter:'blur(4px)' }
const modal = { background: 'var(--card-bg)',borderRadius:14,width:'90vw',maxWidth:580,maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column',border: '1px solid var(--border-color)',boxShadow:'0 20px 50px rgba(0,0,0,0.5)' }
const hdr   = { display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 24px',borderBottom: '1px solid var(--border-color)',flexShrink:0 }
const ttl   = { color: 'var(--text-primary)',fontSize:18,fontWeight:700,margin:0,fontFamily:'Sora,sans-serif' }
const cls   = { background:'none',border:'none',color: 'var(--text-muted)',fontSize:18,cursor:'pointer' }
const body  = { padding:'20px 24px',overflowY:'auto',flex:1 }
const grid2 = { display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }
const inp   = { width:'100%',background: 'var(--app-bg)',border: '1px solid var(--border-color)',color: 'var(--text-primary)',borderRadius:8,padding:'8px 12px',fontSize:13,outline:'none',boxSizing:'border-box' }
const actions = { display:'flex',justifyContent:'flex-end',gap:10,padding:'14px 24px',borderTop: '1px solid var(--border-color)',flexShrink:0 }
const priBtn  = { background:'#2563eb',color:'white',border:'none',borderRadius:8,padding:'9px 20px',fontSize:13,fontWeight:600,cursor:'pointer' }
const secBtn  = { background:'transparent',color: 'var(--text-secondary)',border: '1px solid var(--border-color)',borderRadius:8,padding:'9px 20px',fontSize:13,cursor:'pointer' }
