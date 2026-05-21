import { useState, useEffect } from 'react'
import { callClaude } from '../lib/claudeClient'

const CATEGORIE = [
  { value: 'ordinaria', label: 'Ordinaria' },
  { value: 'straordinaria', label: 'Straordinaria' },
  { value: 'manutenzione', label: 'Manutenzione' },
  { value: 'utenze', label: 'Utenze' },
  { value: 'assicurazione', label: 'Assicurazione' },
  { value: 'altro', label: 'Altro' },
]

const inputStyle = {
  width: '100%', background: '#0f172a', color: '#f1f5f9',
  border: '1px solid #334155', borderRadius: 8, padding: '10px 12px',
  fontSize: 14, fontFamily: 'Sora, sans-serif', boxSizing: 'border-box'
}
const labelStyle = { display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }

export default function SpeseForm({ esercizioId, condominioId, tabelle, unita, documenti, spesaInEdit, onSave, onCancel }) {
  const [form, setForm] = useState({
    esercizio_id: esercizioId,
    condominio_id: condominioId,
    descrizione: '',
    importo: '',
    data_spesa: new Date().toISOString().split('T')[0],
    categoria: 'ordinaria',
    tipo_lavoro: 'ordinario',
    criterio: 'millesimi',
    tabella_millesimale_id: '',
    percentuale_millesimi: 100,
    fornitore: '',
    numero_fattura: '',
    note: '',
    suggerimento_ai: null,
    criterio_override: false,
  })

  const [ripartizioni, setRipartizioni] = useState([])
  const [showAiModal, setShowAiModal] = useState(false)
  const [loadingAi, setLoadingAi] = useState(false)
  const [aiSuggerimento, setAiSuggerimento] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (spesaInEdit) {
      setForm({ ...spesaInEdit })
    }
  }, [spesaInEdit])

  // Ricalcola ripartizioni live al cambio criterio/tabella/importo
  useEffect(() => {
    if (!form.importo || !unita?.length) return
    calcolaRipartizioni()
  }, [form.importo, form.criterio, form.tabella_millesimale_id, form.percentuale_millesimi])

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const calcolaRipartizioni = () => {
    const importo = parseFloat(form.importo)
    if (!importo) return

    if (form.criterio === 'quota_fissa') {
      const quota = importo / unita.length
      setRipartizioni(unita.map(u => ({
        unita_id: u.id,
        interno: u.interno,
        piano: u.piano,
        importo: Math.round(quota * 100) / 100,
        millesimi: null,
      })))
      return
    }

    const tabella = tabelle.find(t => t.id === form.tabella_millesimale_id)
    if (!tabella?.millesimi_unita?.length) {
      setRipartizioni([])
      return
    }

    const totMill = tabella.millesimi_unita.reduce((s, m) => s + parseFloat(m.valore || 0), 0)
    if (!totMill) return

    const importoMill = form.criterio === 'mista'
      ? importo * (parseFloat(form.percentuale_millesimi) / 100)
      : importo
    const importoFisso = importo - importoMill

    setRipartizioni(unita.map(u => {
      const mill = tabella.millesimi_unita.find(m => m.unita_id === u.id)
      const vMill = parseFloat(mill?.valore || 0)
      const qMill = (vMill / totMill) * importoMill
      const qFissa = unita.length > 0 ? importoFisso / unita.length : 0
      return {
        unita_id: u.id,
        interno: u.interno,
        piano: u.piano,
        importo: Math.round((qMill + qFissa) * 100) / 100,
        millesimi: vMill,
      }
    }))
  }

  const chiediAI = async () => {
    if (!form.descrizione.trim()) {
      setErrors({ descrizione: 'Inserisci la descrizione prima di chiedere all\'AI' })
      return
    }
    setLoadingAi(true)
    try {
      const regolamento = documenti?.find(d => d.tipo === 'regolamento' && d.testo_estratto)
      const nomiTabelle = tabelle.map(t => t.nome).join(', ')

      const prompt = `Sei un esperto di diritto condominiale italiano. Devi suggerire il criterio di ripartizione per una spesa condominiale.

SPESA: "${form.descrizione}"
IMPORTO: €${form.importo || 'non specificato'}
TIPO LAVORO: ${form.tipo_lavoro}
TABELLE MILLESIMALI DISPONIBILI: ${nomiTabelle || 'nessuna'}
${regolamento ? `\nREGOLAMENTO CONDOMINIALE:\n${regolamento.testo_estratto.slice(0, 3000)}` : ''}

Rispondi SOLO con un JSON valido (nessun testo prima o dopo) in questo formato:
{
  "criterio": "millesimi" | "quota_fissa" | "mista",
  "tabella_consigliata": "nome della tabella o null",
  "percentuale_millesimi": numero tra 0 e 100 (solo per criterio mista),
  "motivazione": "spiegazione in italiano, max 3 frasi, cita articoli di legge o regolamento se pertinenti",
  "fonti": ["Regolamento condominiale", "Art. 1123 c.c.", ...],
  "confidenza": "alta" | "media" | "bassa"
}`

      const data = await callClaude({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
      const text = data.content?.[0]?.text || '{}'
      const clean = text.replace(/```json|```/g, '').trim()
      const sug = JSON.parse(clean)
      setAiSuggerimento(sug)
      setShowAiModal(true)
    } catch (e) {
      console.error('AI error:', e)
      setAiSuggerimento({
        criterio: 'millesimi',
        tabella_consigliata: null,
        motivazione: 'Impossibile ottenere il suggerimento. Verifica la connessione.',
        fonti: [],
        confidenza: 'bassa'
      })
      setShowAiModal(true)
    } finally {
      setLoadingAi(false)
    }
  }

  const applicaAiSuggerimento = () => {
    if (!aiSuggerimento) return
    const tabella = tabelle.find(t => t.nome === aiSuggerimento.tabella_consigliata)
    setForm(f => ({
      ...f,
      criterio: aiSuggerimento.criterio,
      tabella_millesimale_id: tabella?.id || f.tabella_millesimale_id,
      percentuale_millesimi: aiSuggerimento.percentuale_millesimi || 100,
      suggerimento_ai: aiSuggerimento,
      criterio_override: false,
    }))
    setShowAiModal(false)
  }

  const validate = () => {
    const e = {}
    if (!form.descrizione.trim()) e.descrizione = 'Campo obbligatorio'
    if (!form.importo || parseFloat(form.importo) <= 0) e.importo = 'Inserisci un importo valido'
    if (!form.data_spesa) e.data_spesa = 'Campo obbligatorio'
    if (form.criterio !== 'quota_fissa' && !form.tabella_millesimale_id) e.tabella = 'Seleziona una tabella millesimale'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSalva = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        importo: parseFloat(form.importo),
        percentuale_millesimi: parseFloat(form.percentuale_millesimi) || 100,
        tabella_millesimale_id: form.tabella_millesimale_id || null,
      }
      const ripartDaSalvare = ripartizioni.map(r => ({
        unita_id: r.unita_id,
        importo: r.importo,
        millesimi_usati: r.millesimi || null,
      }))
      await onSave(payload, ripartDaSalvare)
    } finally {
      setSaving(false)
    }
  }

  const confidenzaColore = {
    alta: '#10b981', media: '#f59e0b', bassa: '#ef4444'
  }

  return (
    <div style={{ background: '#1e293b', borderRadius: 16, padding: 28, border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 24px', color: '#f1f5f9', fontSize: 18, fontWeight: 600 }}>
        {spesaInEdit ? 'Modifica spesa' : 'Nuova spesa'}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Descrizione */}
        <div style={{ gridColumn: '1/-1' }}>
          <label style={labelStyle}>Descrizione *</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              style={{ ...inputStyle, flex: 1, borderColor: errors.descrizione ? '#ef4444' : '#334155' }}
              placeholder="Es. Manutenzione ascensore, Pulizia scale..."
              value={form.descrizione}
              onChange={e => setField('descrizione', e.target.value)}
            />
            <button
              type="button"
              onClick={chiediAI}
              disabled={loadingAi}
              title="Chiedi all'AI il criterio di ripartizione"
              style={{
                background: loadingAi ? '#1e3a6e' : '#7c3aed',
                color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 16px', fontSize: 13, fontWeight: 600,
                cursor: loadingAi ? 'not-allowed' : 'pointer',
                fontFamily: 'Sora, sans-serif', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              {loadingAi ? '⏳' : '🤖'} {loadingAi ? 'Analisi...' : 'Suggerisci'}
            </button>
          </div>
          {errors.descrizione && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.descrizione}</span>}
        </div>

        {/* Importo */}
        <div>
          <label style={labelStyle}>Importo (€) *</label>
          <input
            type="number" step="0.01" min="0"
            style={{ ...inputStyle, borderColor: errors.importo ? '#ef4444' : '#334155' }}
            placeholder="0.00"
            value={form.importo}
            onChange={e => setField('importo', e.target.value)}
          />
          {errors.importo && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.importo}</span>}
        </div>

        {/* Data */}
        <div>
          <label style={labelStyle}>Data spesa *</label>
          <input
            type="date"
            style={{ ...inputStyle, borderColor: errors.data_spesa ? '#ef4444' : '#334155' }}
            value={form.data_spesa}
            onChange={e => setField('data_spesa', e.target.value)}
          />
        </div>

        {/* Categoria */}
        <div>
          <label style={labelStyle}>Categoria</label>
          <select style={inputStyle} value={form.categoria} onChange={e => setField('categoria', e.target.value)}>
            {CATEGORIE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Tipo lavoro */}
        <div>
          <label style={labelStyle}>Tipo lavoro</label>
          <select style={inputStyle} value={form.tipo_lavoro} onChange={e => setField('tipo_lavoro', e.target.value)}>
            <option value="ordinario">Ordinario</option>
            <option value="straordinario">Straordinario</option>
          </select>
        </div>

        {/* Criterio ripartizione */}
        <div>
          <label style={labelStyle}>Criterio ripartizione</label>
          <select style={inputStyle} value={form.criterio} onChange={e => setField('criterio', e.target.value)}>
            <option value="millesimi">Millesimi</option>
            <option value="quota_fissa">Quota fissa (parti uguali)</option>
            <option value="mista">Mista (millesimi + quota fissa)</option>
          </select>
        </div>

        {/* Tabella millesimale */}
        {form.criterio !== 'quota_fissa' && (
          <div>
            <label style={labelStyle}>Tabella millesimale *</label>
            <select
              style={{ ...inputStyle, borderColor: errors.tabella ? '#ef4444' : '#334155' }}
              value={form.tabella_millesimale_id}
              onChange={e => setField('tabella_millesimale_id', e.target.value)}
            >
              <option value="">— Seleziona —</option>
              {tabelle.map(t => (
                <option key={t.id} value={t.id}>{t.nome} ({t.tipo_lavoro})</option>
              ))}
            </select>
            {errors.tabella && <span style={{ color: '#ef4444', fontSize: 12 }}>{errors.tabella}</span>}
          </div>
        )}

        {/* Percentuale millesimi (solo per mista) */}
        {form.criterio === 'mista' && (
          <div>
            <label style={labelStyle}>% a millesimi</label>
            <input
              type="number" min="1" max="99"
              style={inputStyle}
              value={form.percentuale_millesimi}
              onChange={e => setField('percentuale_millesimi', e.target.value)}
            />
            <span style={{ color: '#64748b', fontSize: 12 }}>Il resto ({100 - form.percentuale_millesimi}%) in parti uguali</span>
          </div>
        )}

        {/* Fornitore */}
        <div>
          <label style={labelStyle}>Fornitore</label>
          <input style={inputStyle} placeholder="Es. Rossi Ascensori Srl"
            value={form.fornitore} onChange={e => setField('fornitore', e.target.value)} />
        </div>

        {/* N. Fattura */}
        <div>
          <label style={labelStyle}>N. Fattura</label>
          <input style={inputStyle} placeholder="Es. 2024/0042"
            value={form.numero_fattura} onChange={e => setField('numero_fattura', e.target.value)} />
        </div>

        {/* Note */}
        <div style={{ gridColumn: '1/-1' }}>
          <label style={labelStyle}>Note</label>
          <textarea
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            placeholder="Note aggiuntive..."
            value={form.note}
            onChange={e => setField('note', e.target.value)}
          />
        </div>
      </div>

      {/* Anteprima ripartizioni */}
      {ripartizioni.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 10, fontWeight: 600 }}>
            Anteprima ripartizione ({ripartizioni.length} unità)
          </div>
          <div style={{
            background: '#0f172a', borderRadius: 8, border: '1px solid #334155',
            maxHeight: 200, overflowY: 'auto'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1e293b' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b' }}>Interno</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b' }}>Piano</th>
                  {form.criterio !== 'quota_fissa' && (
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>Millesimi</th>
                  )}
                  <th style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>Quota €</th>
                </tr>
              </thead>
              <tbody>
                {ripartizioni.map((r, i) => (
                  <tr key={r.unita_id} style={{ borderTop: i > 0 ? '1px solid #1e293b' : 'none' }}>
                    <td style={{ padding: '7px 12px', color: '#f1f5f9' }}>{r.interno || '—'}</td>
                    <td style={{ padding: '7px 12px', color: '#94a3b8' }}>{r.piano ?? '—'}</td>
                    {form.criterio !== 'quota_fissa' && (
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: '#64748b' }}>
                        {r.millesimi?.toFixed(2) || '—'}
                      </td>
                    )}
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                      €{r.importo.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid #334155' }}>
                  <td colSpan={form.criterio !== 'quota_fissa' ? 3 : 2} style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 12 }}>
                    Totale
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#f1f5f9', fontWeight: 700 }}>
                    €{ripartizioni.reduce((s, r) => s + r.importo, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Azioni */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 28 }}>
        <button onClick={onCancel} style={{
          background: 'transparent', color: '#94a3b8', border: '1px solid #334155',
          borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer',
          fontFamily: 'Sora, sans-serif'
        }}>Annulla</button>
        <button
          onClick={handleSalva}
          disabled={saving}
          style={{
            background: saving ? '#1e3a6e' : '#2563eb', color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Sora, sans-serif'
          }}
        >
          {saving ? 'Salvataggio...' : 'Salva spesa'}
        </button>
      </div>

      {/* Modal AI */}
      {showAiModal && aiSuggerimento && (
        <div style={{
          position: 'fixed', inset: 0, background: '#00000099', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#1e293b', borderRadius: 16, padding: 32, maxWidth: 540,
            width: '100%', border: '1px solid #7c3aed66'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 28 }}>🤖</span>
              <div>
                <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: 17 }}>Suggerimento AI</h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>
                  Basato su regolamento, tabelle millesimali e Codice Civile
                </p>
              </div>
            </div>

            {/* Spesa analizzata */}
            <div style={{
              background: '#0f172a', borderRadius: 8, padding: '10px 14px',
              marginBottom: 16, fontSize: 13, color: '#94a3b8'
            }}>
              Spesa: <strong style={{ color: '#f1f5f9' }}>{form.descrizione}</strong>
              {form.importo && <span> · €{parseFloat(form.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>}
            </div>

            {/* Criterio suggerito */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>Criterio suggerito</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{
                  background: '#7c3aed22', color: '#a78bfa', borderRadius: 8,
                  padding: '8px 16px', fontSize: 15, fontWeight: 700
                }}>
                  {aiSuggerimento.criterio === 'millesimi' ? '📊 Millesimi' :
                    aiSuggerimento.criterio === 'quota_fissa' ? '⚖️ Quota fissa' : '🔀 Mista'}
                </span>
                {aiSuggerimento.tabella_consigliata && (
                  <span style={{ color: '#64748b', fontSize: 13 }}>
                    Tabella: <strong style={{ color: '#94a3b8' }}>{aiSuggerimento.tabella_consigliata}</strong>
                  </span>
                )}
                {aiSuggerimento.criterio === 'mista' && (
                  <span style={{ color: '#64748b', fontSize: 13 }}>
                    {aiSuggerimento.percentuale_millesimi}% millesimi
                  </span>
                )}
              </div>
            </div>

            {/* Motivazione */}
            <div style={{
              background: '#0f172a', borderRadius: 8, padding: '14px 16px',
              marginBottom: 16, borderLeft: '3px solid #7c3aed'
            }}>
              <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Motivazione</div>
              <p style={{ color: '#e2e8f0', margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                {aiSuggerimento.motivazione}
              </p>
            </div>

            {/* Fonti + confidenza */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {aiSuggerimento.fonti?.map((f, i) => (
                  <span key={i} style={{
                    background: '#1e293b', color: '#64748b', borderRadius: 4,
                    padding: '3px 8px', fontSize: 11, border: '1px solid #334155'
                  }}>{f}</span>
                ))}
              </div>
              <span style={{
                background: (confidenzaColore[aiSuggerimento.confidenza] || '#6b7280') + '22',
                color: confidenzaColore[aiSuggerimento.confidenza] || '#6b7280',
                borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600
              }}>
                Confidenza {aiSuggerimento.confidenza}
              </span>
            </div>

            {/* Azioni */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setShowAiModal(false)
                  setField('criterio_override', true)
                }}
                style={{
                  flex: 1, background: 'transparent', color: '#94a3b8',
                  border: '1px solid #334155', borderRadius: 8,
                  padding: '11px 16px', fontSize: 14, cursor: 'pointer',
                  fontFamily: 'Sora, sans-serif'
                }}
              >
                Scegli manualmente
              </button>
              <button
                onClick={applicaAiSuggerimento}
                style={{
                  flex: 1, background: '#7c3aed', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '11px 16px', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Sora, sans-serif'
                }}
              >
                ✓ Usa questo criterio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
