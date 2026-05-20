import { useState, useEffect } from 'react'
import { useCondomini } from '../hooks/useCondomini'

const PROVINCE_IT = [
  'AG','AL','AN','AO','AQ','AR','AP','AT','AV','BA','BT','BL','BN','BG','BI','BO',
  'BZ','BS','BR','CA','CL','CB','CI','CE','CT','CZ','CH','CO','CS','CR','KR','CN',
  'EN','FM','FE','FI','FG','FC','FR','GE','GO','GR','IM','IS','SP','LT','LE','LC',
  'LI','LO','LU','MC','MN','MS','MT','VS','ME','MI','MO','MB','NA','NO','NU','OG',
  'OT','OR','PD','PA','PR','PV','PG','PU','PE','PC','PI','PT','PN','PZ','PO','RG',
  'RA','RC','RE','RI','RN','RM','RO','SA','SS','SV','SI','SR','SO','TA','TE','TR',
  'TO','OT','TP','TN','TV','TS','UD','VA','VE','VB','VC','VR','VV','VI','VT'
]

const EMPTY_FORM = {
  nome: '',
  codice_fiscale: '',
  indirizzo: '',
  civico: '',
  cap: '',
  citta: '',
  provincia: 'MI',
  anno_costruzione: '',
  num_unita: '',
  num_scale: '1',
  num_piani: '',
  presenza_ascensore: false,
  presenza_giardino: false,
  presenza_parcheggio: false,
  presenza_portiere: false,
  data_inizio_amministrazione: '',
  stato: 'attivo',
  fondo_cassa: '',
  quote_annuali: '',
  note: '',
}

export default function CondominiForm({ condominio, onClose }) {
  const { createCondominio, updateCondominio } = useCondomini()
  const isEdit = !!condominio

  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [activeTab, setActiveTab] = useState('anagrafica')

  useEffect(() => {
    if (condominio) {
      setForm({
        ...EMPTY_FORM,
        ...condominio,
        anno_costruzione: condominio.anno_costruzione ?? '',
        num_unita: condominio.num_unita ?? '',
        num_scale: condominio.num_scale ?? '1',
        num_piani: condominio.num_piani ?? '',
        fondo_cassa: condominio.fondo_cassa ?? '',
        quote_annuali: condominio.quote_annuali ?? '',
        data_inizio_amministrazione: condominio.data_inizio_amministrazione ?? '',
      })
    }
  }, [condominio])

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }))
  }

  const validate = () => {
    const e = {}
    if (!form.nome.trim()) e.nome = 'Nome obbligatorio'
    if (!form.indirizzo.trim()) e.indirizzo = 'Indirizzo obbligatorio'
    if (!form.civico.trim()) e.civico = 'Civico obbligatorio'
    if (!form.cap.trim()) e.cap = 'CAP obbligatorio'
    if (form.cap && !/^\d{5}$/.test(form.cap)) e.cap = 'CAP non valido (5 cifre)'
    if (!form.citta.trim()) e.citta = 'Città obbligatoria'
    if (!form.provincia) e.provincia = 'Provincia obbligatoria'
    if (!form.num_unita || parseInt(form.num_unita) < 1) e.num_unita = 'Almeno 1 unità'
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) {
      setErrors(e)
      // Vai alla tab con l'errore
      if (e.nome || e.indirizzo || e.civico || e.cap || e.citta || e.provincia) {
        setActiveTab('anagrafica')
      }
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        anno_costruzione: form.anno_costruzione ? parseInt(form.anno_costruzione) : null,
        num_unita: parseInt(form.num_unita) || 0,
        num_scale: parseInt(form.num_scale) || 1,
        num_piani: form.num_piani ? parseInt(form.num_piani) : null,
        fondo_cassa: form.fondo_cassa ? parseFloat(form.fondo_cassa) : 0,
        quote_annuali: form.quote_annuali ? parseFloat(form.quote_annuali) : 0,
        data_inizio_amministrazione: form.data_inizio_amministrazione || null,
      }

      // Rimuovi campi non modificabili in update
      if (isEdit) {
        delete payload.amministratore_id
        delete payload.created_at
        delete payload.updated_at
        delete payload.id
        await updateCondominio(condominio.id, payload)
      } else {
        await createCondominio(payload)
      }
      onClose()
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const TABS = [
    { id: 'anagrafica', label: 'Anagrafica' },
    { id: 'struttura', label: 'Struttura' },
    { id: 'amministrazione', label: 'Amministrazione' },
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box form-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>{isEdit ? 'Modifica condominio' : 'Nuovo condominio'}</h2>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 2l12 12M14 2L2 14"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="form-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`form-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="form-body">
          {activeTab === 'anagrafica' && (
            <div className="form-section">
              <div className="form-row">
                <Field label="Nome condominio *" error={errors.nome} fullWidth>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={e => set('nome', e.target.value)}
                    placeholder="Es. Condominio Centrale"
                  />
                </Field>
                <Field label="Codice fiscale">
                  <input
                    type="text"
                    value={form.codice_fiscale}
                    onChange={e => set('codice_fiscale', e.target.value.toUpperCase())}
                    placeholder="Es. 97123456789"
                    maxLength={16}
                  />
                </Field>
              </div>

              <div className="form-row">
                <Field label="Indirizzo *" error={errors.indirizzo}>
                  <input
                    type="text"
                    value={form.indirizzo}
                    onChange={e => set('indirizzo', e.target.value)}
                    placeholder="Via/Piazza/Corso..."
                  />
                </Field>
                <Field label="Civico *" error={errors.civico} small>
                  <input
                    type="text"
                    value={form.civico}
                    onChange={e => set('civico', e.target.value)}
                    placeholder="1"
                  />
                </Field>
              </div>

              <div className="form-row">
                <Field label="CAP *" error={errors.cap} small>
                  <input
                    type="text"
                    value={form.cap}
                    onChange={e => set('cap', e.target.value)}
                    placeholder="20100"
                    maxLength={5}
                  />
                </Field>
                <Field label="Città *" error={errors.citta}>
                  <input
                    type="text"
                    value={form.citta}
                    onChange={e => set('citta', e.target.value)}
                    placeholder="Milano"
                  />
                </Field>
                <Field label="Provincia *" error={errors.provincia} small>
                  <select value={form.provincia} onChange={e => set('provincia', e.target.value)}>
                    {PROVINCE_IT.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          )}

          {activeTab === 'struttura' && (
            <div className="form-section">
              <div className="form-row">
                <Field label="Numero unità abitative *" error={errors.num_unita}>
                  <input
                    type="number"
                    value={form.num_unita}
                    onChange={e => set('num_unita', e.target.value)}
                    placeholder="12"
                    min="1"
                  />
                </Field>
                <Field label="Numero scale">
                  <input
                    type="number"
                    value={form.num_scale}
                    onChange={e => set('num_scale', e.target.value)}
                    placeholder="1"
                    min="1"
                  />
                </Field>
                <Field label="Numero piani">
                  <input
                    type="number"
                    value={form.num_piani}
                    onChange={e => set('num_piani', e.target.value)}
                    placeholder="5"
                    min="1"
                  />
                </Field>
              </div>

              <div className="form-row">
                <Field label="Anno di costruzione">
                  <input
                    type="number"
                    value={form.anno_costruzione}
                    onChange={e => set('anno_costruzione', e.target.value)}
                    placeholder="1980"
                    min="1800"
                    max={new Date().getFullYear()}
                  />
                </Field>
              </div>

              <div className="checkbox-group">
                <p className="checkbox-group-label">Caratteristiche</p>
                <div className="checkbox-grid">
                  {[
                    { field: 'presenza_ascensore', label: '🛗 Ascensore' },
                    { field: 'presenza_giardino', label: '🌳 Giardino / Aree verdi' },
                    { field: 'presenza_parcheggio', label: '🅿️ Parcheggio' },
                    { field: 'presenza_portiere', label: '👤 Portiere / Custode' },
                  ].map(({ field, label }) => (
                    <label key={field} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={form[field]}
                        onChange={e => set(field, e.target.checked)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'amministrazione' && (
            <div className="form-section">
              <div className="form-row">
                <Field label="Data inizio amministrazione">
                  <input
                    type="date"
                    value={form.data_inizio_amministrazione}
                    onChange={e => set('data_inizio_amministrazione', e.target.value)}
                  />
                </Field>
                <Field label="Stato">
                  <select value={form.stato} onChange={e => set('stato', e.target.value)}>
                    <option value="attivo">Attivo</option>
                    <option value="sospeso">Sospeso</option>
                    <option value="archiviato">Archiviato</option>
                  </select>
                </Field>
              </div>

              <div className="form-row">
                <Field label="Fondo cassa (€)">
                  <input
                    type="number"
                    value={form.fondo_cassa}
                    onChange={e => set('fondo_cassa', e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </Field>
                <Field label="Quote annuali (€)">
                  <input
                    type="number"
                    value={form.quote_annuali}
                    onChange={e => set('quote_annuali', e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </Field>
              </div>

              <Field label="Note" fullWidth>
                <textarea
                  value={form.note}
                  onChange={e => set('note', e.target.value)}
                  placeholder="Note aggiuntive sul condominio..."
                  rows={4}
                />
              </Field>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Annulla</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Crea condominio'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────

function Field({ label, error, children, fullWidth, small }) {
  return (
    <div className={`field ${fullWidth ? 'full' : ''} ${small ? 'small' : ''} ${error ? 'has-error' : ''}`}>
      <label>{label}</label>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}
