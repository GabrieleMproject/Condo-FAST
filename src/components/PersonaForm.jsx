// src/components/PersonaForm.jsx
import { useState } from 'react'
import { UserCheck, Key, X } from 'lucide-react'

export default function PersonaForm({ ruolo, onSave, onClose }) {
  const [form, setForm] = useState({
    nome: '', cognome: '', codice_fiscale: '', data_nascita: '',
    email: '', telefono: '', telefono_alt: '',
    indirizzo: '', cap: '', citta: '', provincia: '',
    note: '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const validate = () => {
    const e = {}
    if (!form.nome.trim())    e.nome    = 'Obbligatorio'
    if (!form.cognome.trim()) e.cognome = 'Obbligatorio'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={ov}>
      <div style={modal}>
        <div style={hdr}>
          <h2 style={{ ...ttl, display: 'flex', alignItems: 'center', gap: 8 }}>
            {ruolo === 'proprietario' ? <UserCheck size={18} /> : <Key size={18} />} Aggiungi {ruolo === 'proprietario' ? 'Proprietario' : 'Inquilino'}
          </h2>
          <button style={cls} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={body}>
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
      <div style={{ color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #1e293b' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <div>
      <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
      {error && <span style={{ color: '#f87171', fontSize: 11 }}>{error}</span>}
    </div>
  )
}

const ov    = { position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,backdropFilter:'blur(4px)' }
const modal = { background:'#1e293b',borderRadius:14,width:'90vw',maxWidth:580,maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column',border:'1px solid #334155',boxShadow:'0 20px 50px rgba(0,0,0,0.5)' }
const hdr   = { display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 24px',borderBottom:'1px solid #334155',flexShrink:0 }
const ttl   = { color:'#e2e8f0',fontSize:18,fontWeight:700,margin:0,fontFamily:'Sora,sans-serif' }
const cls   = { background:'none',border:'none',color:'#64748b',fontSize:18,cursor:'pointer' }
const body  = { padding:'20px 24px',overflowY:'auto',flex:1 }
const grid2 = { display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }
const inp   = { width:'100%',background:'#0f172a',border:'1px solid #334155',color:'#e2e8f0',borderRadius:8,padding:'8px 12px',fontSize:13,outline:'none',boxSizing:'border-box' }
const actions = { display:'flex',justifyContent:'flex-end',gap:10,padding:'14px 24px',borderTop:'1px solid #334155',flexShrink:0 }
const priBtn  = { background:'#2563eb',color:'white',border:'none',borderRadius:8,padding:'9px 20px',fontSize:13,fontWeight:600,cursor:'pointer' }
const secBtn  = { background:'transparent',color:'#94a3b8',border:'1px solid #334155',borderRadius:8,padding:'9px 20px',fontSize:13,cursor:'pointer' }
