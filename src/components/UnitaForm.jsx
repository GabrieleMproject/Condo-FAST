// src/components/UnitaForm.jsx
import { useState } from 'react'
import { X } from 'lucide-react'

const TIPI = ['appartamento','box','cantina','negozio','ufficio','altro']
const STATI = ['attiva','venduta','sfitta','altro']

export default function UnitaForm({ unita, onSave, onClose }) {
  const [form, setForm] = useState({
    numero:    unita?.numero    || '',
    tipo:      unita?.tipo      || 'appartamento',
    scala:     unita?.scala     || '',
    piano:     unita?.piano     ?? '',
    mq:        unita?.mq        || '',
    millesimi: unita?.millesimi || '',
    stato:     unita?.stato     || 'attiva',
    note:      unita?.note      || '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const validate = () => {
    const e = {}
    if (!form.numero.trim()) e.numero = 'Campo obbligatorio'
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    try {
      await onSave({
        ...form,
        piano:     form.piano !== '' ? Number(form.piano) : null,
        mq:        form.mq    !== '' ? Number(form.mq)    : null,
        millesimi: form.millesimi !== '' ? Number(form.millesimi) : null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={ov}>
      <div style={modal}>
        <div style={hdr}>
          <h2 style={ttl}>{unita ? 'Modifica Unità' : 'Nuova Unità'}</h2>
          <button style={cls} onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <div style={body}>
          <div style={grid2}>
            <Field label="Numero / Interno *" error={errors.numero}>
              <input style={inp} value={form.numero} onChange={e => set('numero', e.target.value)} placeholder="es. Interno 3" />
            </Field>
            <Field label="Tipo">
              <select style={inp} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {TIPI.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Scala">
              <input style={inp} value={form.scala} onChange={e => set('scala', e.target.value)} placeholder="es. A" />
            </Field>
            <Field label="Piano">
              <input style={inp} type="number" value={form.piano} onChange={e => set('piano', e.target.value)} placeholder="0 = PT" />
            </Field>
            <Field label="Superficie (mq)">
              <input style={inp} type="number" value={form.mq} onChange={e => set('mq', e.target.value)} placeholder="es. 85" />
            </Field>
            <Field label="Millesimi">
              <input style={inp} type="number" step="0.0001" value={form.millesimi} onChange={e => set('millesimi', e.target.value)} placeholder="es. 12.4500" />
            </Field>
            <Field label="Stato">
              <select style={inp} value={form.stato} onChange={e => set('stato', e.target.value)}>
                {STATI.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Note" style={{ marginTop: 12 }}>
            <textarea style={{ ...inp, minHeight: 72, resize: 'vertical' }} value={form.note} onChange={e => set('note', e.target.value)} />
          </Field>
        </div>
        <div style={actions}>
          <button style={secBtn} onClick={onClose}>Annulla</button>
          <button style={priBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Salvataggio…' : 'Salva Unità'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, error, children, style }) {
  return (
    <div style={{ ...style }}>
      <label style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
      {error && <span style={{ color: '#f87171', fontSize: 11 }}>{error}</span>}
    </div>
  )
}

const ov = { position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,backdropFilter:'blur(4px)' }
const modal = { background: 'var(--card-bg)',borderRadius:14,width:'90vw',maxWidth:560,border: '1px solid var(--border-color)',boxShadow:'0 20px 50px rgba(0,0,0,0.5)' }
const hdr = { display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom: '1px solid var(--border-color)' }
const ttl = { color: 'var(--text-primary)',fontSize:18,fontWeight:700,margin:0,fontFamily:'Sora,sans-serif' }
const cls = { background:'none',border:'none',color: 'var(--text-muted)',fontSize:18,cursor:'pointer' }
const body = { padding:'20px 24px' }
const grid2 = { display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }
const inp = { width:'100%',background: 'var(--app-bg)',border: '1px solid var(--border-color)',color: 'var(--text-primary)',borderRadius:8,padding:'8px 12px',fontSize:13,outline:'none',boxSizing:'border-box' }
const actions = { display:'flex',justifyContent:'flex-end',gap:10,padding:'16px 24px',borderTop: '1px solid var(--border-color)' }
const priBtn = { background:'#2563eb',color:'white',border:'none',borderRadius:8,padding:'9px 20px',fontSize:13,fontWeight:600,cursor:'pointer' }
const secBtn = { background:'transparent',color: 'var(--text-secondary)',border: '1px solid var(--border-color)',borderRadius:8,padding:'9px 20px',fontSize:13,cursor:'pointer' }
