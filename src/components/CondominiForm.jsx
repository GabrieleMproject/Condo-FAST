import { useState, useEffect, useRef } from 'react'
import { useCondomini } from '../hooks/useCondomini'
import { useAutoDraft } from '../hooks/useAutoDraft'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { useFormShortcuts } from '../hooks/useFormShortcuts'
import StickyFormActionBar from './StickyFormActionBar'
import { RotateCcw, Trash2, Sparkles } from 'lucide-react'

const PROVINCE_IT = [
  'AG','AL','AN','AO','AQ','AR','AP','AT','AV','BA','BT','BL','BN','BG','BI','BO',
  'BZ','BS','BR','CA','CL','CB','CE','CT','CZ','CH','CO','CS','CR','KR','CN',
  'EN','FM','FE','FI','FG','FC','FR','GE','GO','GR','IM','IS','SP','LT','LE','LC',
  'LI','LO','LU','MC','MN','MS','MT','ME','MI','MO','MB','NA','NO','NU','OG',
  'OT','OR','PD','PA','PR','PV','PG','PU','PE','PC','PI','PT','PN','PZ','PO','RG',
  'RA','RC','RE','RI','RN','RM','RO','SA','SS','SV','SI','SR','SO','SU','TA','TE','TR',
  'TO','TP','TN','TV','TS','UD','VA','VE','VB','VC','VR','VV','VI','VT'
]

const MAPPA_CAP_PROVINCIA = {
  '00': 'RM', '01': 'VT', '02': 'RI', '03': 'FR', '04': 'LT', '05': 'TR', '06': 'PG', '07': 'SS', '08': 'NU', '09': 'CA',
  '10': 'TO', '11': 'AO', '12': 'CN', '13': 'VC', '14': 'AT', '15': 'AL', '16': 'GE', '17': 'SV', '18': 'IM', '19': 'SP',
  '20': 'MI', '21': 'VA', '22': 'CO', '23': 'LC', '24': 'BG', '25': 'BS', '26': 'CR', '27': 'PV', '28': 'NO', '29': 'PC',
  '30': 'VE', '31': 'TV', '32': 'BL', '33': 'UD', '34': 'TS', '35': 'PD', '36': 'VI', '37': 'VR', '38': 'TN', '39': 'BZ',
  '40': 'BO', '41': 'MO', '42': 'RE', '43': 'PR', '44': 'FE', '45': 'RO', '46': 'MN', '47': 'FC', '48': 'RA', '50': 'FI',
  '51': 'PT', '52': 'AR', '53': 'SI', '54': 'MS', '55': 'LU', '56': 'PI', '57': 'LI', '58': 'GR', '59': 'PO', '60': 'AN',
  '61': 'PU', '62': 'MC', '63': 'AP', '64': 'TE', '65': 'PE', '66': 'CH', '67': 'AQ', '70': 'BA', '71': 'FG', '72': 'BR',
  '73': 'LE', '74': 'TA', '75': 'MT', '76': 'BT', '80': 'NA', '81': 'CE', '82': 'BN', '83': 'AV', '84': 'SA', '85': 'PZ',
  '86': 'CB', '87': 'CS', '88': 'CZ', '89': 'RC', '90': 'PA', '91': 'TP', '92': 'AG', '93': 'CL', '94': 'EN', '95': 'CT',
  '96': 'SR', '97': 'RG', '98': 'ME'
}

const EMPTY_FORM = {
  nome: '',
  codice_fiscale: '',
  indirizzo: '',
  civico: '',
  cap: '',
  citta: '',
  provincia: 'MI',
  num_unita: '',
  num_scale: '1',
  num_piani: '',
  num_piani_fuori_terra: '',
  num_piani_interrati: '',
  presenza_ascensore: false,
  presenza_giardino: false,
  presenza_parcheggio: false,
  presenza_portiere: false,
  impianto_termico: 'Autonomo',
  presenza_fotovoltaico: false,
  data_inizio_amministrazione: '',
  stato: 'attivo',
  note: '',
  iban: '',
}

export default function CondominiForm({ condominio, onSave, onClose }) {
  const { createCondominio, updateCondominio } = useCondomini()
  const isEdit = !!condominio

  const [form, setForm] = useState(EMPTY_FORM)
  const originalForm = useRef(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [activeTab, setActiveTab] = useState('amministrazione')

  const draftKey = !isEdit ? 'draft_condominio_new' : null
  const { hasDraft, restoreDraft, clearDraft, lastSavedAt } = useAutoDraft(draftKey, form, setForm, !isEdit)

  const isDirty = JSON.stringify(form) !== JSON.stringify(originalForm.current)
  useUnsavedChanges(isDirty && !saving)
  useFormShortcuts({ onSave: () => handleSubmit(), onCancel: () => handleClose(), isEnabled: true })

  useEffect(() => {
    if (condominio) {
      const payload = {
        ...EMPTY_FORM,
        ...condominio,
        num_unita: condominio.num_unita ?? '',
        num_scale: condominio.num_scale ?? '1',
        num_piani: condominio.num_piani ?? '',
        num_piani_fuori_terra: condominio.num_piani_fuori_terra ?? condominio.num_piani ?? '',
        num_piani_interrati: condominio.num_piani_interrati ?? '',
        impianto_termico: condominio.impianto_termico ?? 'Autonomo',
        presenza_fotovoltaico: condominio.presenza_fotovoltaico ?? false,
        data_inizio_amministrazione: condominio.data_inizio_amministrazione ?? '',
        iban: condominio.iban ?? '',
      }
      setForm(payload)
      originalForm.current = payload
    } else {
      setForm(EMPTY_FORM)
      originalForm.current = EMPTY_FORM
    }
  }, [condominio])

  // Autocompletamento Provincia da CAP (Local mapping)
  useEffect(() => {
    if (form.cap && /^\d{5}$/.test(form.cap)) {
      const prefix = form.cap.substring(0, 2)
      const provincia = MAPPA_CAP_PROVINCIA[prefix]
      if (provincia) {
        setForm(prev => ({
          ...prev,
          provincia: prev.provincia !== 'MI' && prev.provincia ? prev.provincia : provincia // MI is default, overwrite if default or empty
        }))
        if (errors.provincia) {
          setErrors(prev => ({ ...prev, provincia: null }))
        }
      }
    }
  }, [form.cap])

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }))
  }

  const validate = () => {
    const e = {}
    if (!form.nome?.trim()) e.nome = 'Nome obbligatorio'
    if (!form.indirizzo?.trim()) e.indirizzo = 'Indirizzo obbligatorio'
    if (!form.civico?.trim()) e.civico = 'Civico obbligatorio'
    if (!form.cap?.trim()) e.cap = 'CAP obbligatorio'
    if (form.cap && !/^\d{5}$/.test(form.cap)) e.cap = 'CAP non valido (5 cifre)'
    if (!form.citta?.trim()) e.citta = 'Città obbligatoria'
    if (!form.provincia) e.provincia = 'Provincia obbligatoria'
    if (!form.codice_fiscale?.trim()) e.codice_fiscale = 'Codice Fiscale obbligatorio'
    if (!form.iban?.trim()) e.iban = 'IBAN obbligatorio'
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) {
      setErrors(e)
      if (e.nome || e.indirizzo || e.civico || e.cap || e.citta || e.provincia || e.codice_fiscale || e.iban) {
        setActiveTab('anagrafica')
      }
      const firstErrorKey = Object.keys(e)[0]
      if (firstErrorKey) {
        setTimeout(() => {
          const el = document.querySelector(`[name="${firstErrorKey}"], #${firstErrorKey}`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            el.focus()
          }
        }, 80)
      }
      return
    }

    setSaving(true)
    try {
      const ft = form.num_piani_fuori_terra !== '' && form.num_piani_fuori_terra !== null ? parseInt(form.num_piani_fuori_terra) : null
      const int = form.num_piani_interrati !== '' && form.num_piani_interrati !== null ? parseInt(form.num_piani_interrati) : null
      const totalPiani = (ft !== null || int !== null)
        ? (ft ?? 0) + (int ?? 0)
        : (form.num_piani ? parseInt(form.num_piani) : null)

      const payload = {
        ...form,
        num_unita: parseInt(form.num_unita) || 0,
        num_scale: parseInt(form.num_scale) || 1,
        num_piani_fuori_terra: ft,
        num_piani_interrati: int,
        num_piani: totalPiani,
        data_inizio_amministrazione: form.data_inizio_amministrazione || null,
        iban: form.iban || null,
      }

      let res
      if (isEdit) {
        delete payload.amministratore_id
        delete payload.created_at
        delete payload.updated_at
        delete payload.id
        res = await updateCondominio(condominio.id, payload)
      } else {
        res = await createCondominio(payload)
      }
      if (clearDraft) clearDraft()
      if (onSave) onSave(res)
      onClose()
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (JSON.stringify(form) !== JSON.stringify(originalForm.current)) {
      if (!window.confirm("Hai delle modifiche non salvate. Sei sicuro di voler chiudere senza salvare?")) {
        return;
      }
    }
    onClose();
  }

  const TABS = [
    { id: 'amministrazione', label: 'Amministrazione' },
    { id: 'anagrafica', label: 'Anagrafica' },
    { id: 'struttura', label: 'Struttura' },
  ]

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-box form-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Modifica condominio' : 'Nuovo condominio'}</h2>
          <button className="modal-close" onClick={handleClose}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 2l12 12M14 2L2 14"/>
            </svg>
          </button>
        </div>

        {hasDraft && !isEdit && !isDirty && (
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 10, padding: '10px 14px', margin: '0 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3b82f6', fontWeight: 600 }}>
              <Sparkles size={16} /> È disponibile una bozza non salvata di un condominio.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={restoreDraft} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Ripristina Bozza
              </button>
              <button type="button" onClick={clearDraft} style={{ background: 'transparent', color: '#94a3b8', border: 'none', padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>
                Elimina
              </button>
            </div>
          </div>
        )}

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
                <Field label="Codice fiscale *" error={errors.codice_fiscale}>
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

              <div className="form-row">
                <Field label="IBAN Conto Corrente Condominiale *" error={errors.iban} fullWidth>
                  <input
                    type="text"
                    value={form.iban}
                    onChange={e => set('iban', e.target.value.toUpperCase().replace(/\s+/g, ''))}
                    placeholder="Es. IT60X0542403200000001234567"
                    maxLength={34}
                  />
                </Field>
              </div>
            </div>
          )}

          {activeTab === 'struttura' && (
            <div className="form-section">
              <div className="form-row">
                <Field label="Numero unità abitative" error={errors.num_unita}>
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
                <Field label="Piani fuori terra">
                  <input
                    type="number"
                    value={form.num_piani_fuori_terra}
                    onChange={e => set('num_piani_fuori_terra', e.target.value)}
                    placeholder="5"
                    min="0"
                  />
                </Field>
                <Field label="Piani interrati">
                  <input
                    type="number"
                    value={form.num_piani_interrati}
                    onChange={e => set('num_piani_interrati', e.target.value)}
                    placeholder="1"
                    min="0"
                  />
                </Field>
              </div>

              <div className="form-row">
                <Field label="Impianto termico">
                  <select value={form.impianto_termico} onChange={e => set('impianto_termico', e.target.value)}>
                    <option value="Autonomo">Autonomo</option>
                    <option value="Centralizzato">Centralizzato</option>
                  </select>
                </Field>
              </div>

              <div className="checkbox-group">
                <p className="checkbox-group-label">Caratteristiche</p>
                <div className="checkbox-grid">
                  {[
                    { field: 'presenza_ascensore', label: 'Ascensore' },
                    { field: 'presenza_giardino', label: 'Giardino / Aree verdi' },
                    { field: 'presenza_parcheggio', label: 'Box' },
                    { field: 'presenza_portiere', label: 'Portiere / Custode' },
                    { field: 'presenza_fotovoltaico', label: 'Impianto Fotovoltaico' },
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

        <div className="modal-footer">
          <button className="btn-ghost" onClick={handleClose}>Annulla</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Crea condominio'}
          </button>
        </div>

        <StickyFormActionBar
          isDirty={isDirty}
          isSaving={saving}
          lastSavedAt={lastSavedAt}
          onSave={handleSubmit}
          onCancel={handleClose}
          saveText={saving ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Crea condominio'}
        />
      </div>
    </div>
  )
}

function Field({ label, error, children, fullWidth, small }) {
  return (
    <div className={`field ${fullWidth ? 'full' : ''} ${small ? 'small' : ''} ${error ? 'has-error' : ''}`}>
      <label>{label}</label>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}
