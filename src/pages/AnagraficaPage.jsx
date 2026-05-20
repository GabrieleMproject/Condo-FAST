// src/pages/AnagraficaPage.jsx
import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUnita } from '../hooks/useUnita'
import { usePersone } from '../hooks/usePersone'
import AnagraficaImport from '../components/AnagraficaImport'
import UnitaForm from '../components/UnitaForm'
import PersonaForm from '../components/PersonaForm'

// ── Badge tipo unità ──────────────────────────────────────────────────────
const TIPO_COLORS = {
  appartamento: { bg: '#1d3557', text: '#60a5fa', label: 'Appartamento' },
  box:          { bg: '#1a2e1a', text: '#4ade80', label: 'Box' },
  cantina:      { bg: '#2d1f0e', text: '#fb923c', label: 'Cantina' },
  negozio:      { bg: '#2d1b2e', text: '#c084fc', label: 'Negozio' },
  ufficio:      { bg: '#1a2535', text: '#38bdf8', label: 'Ufficio' },
  altro:        { bg: '#1e293b', text: '#94a3b8', label: 'Altro' },
}

const RUOLO_ICON = { proprietario: '🏠', inquilino: '🔑' }

function TipoBadge({ tipo }) {
  const c = TIPO_COLORS[tipo] || TIPO_COLORS.altro
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {c.label}
    </span>
  )
}

function PersonaChip({ persona, ruolo }) {
  if (!persona) return <span style={{ color: '#475569', fontSize: 12, fontStyle: 'italic' }}>—</span>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span>{RUOLO_ICON[ruolo]}</span>
      <div>
        <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500 }}>
          {persona.cognome} {persona.nome}
        </div>
        {persona.email && <div style={{ color: '#60a5fa', fontSize: 11 }}>{persona.email}</div>}
        {persona.telefono && <div style={{ color: '#64748b', fontSize: 11 }}>{persona.telefono}</div>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
export default function AnagraficaPage() {
  const { condominioId } = useParams()
  const { unita, loading: loadingUnita, fetchUnita, createUnita, updateUnita, deleteUnita, getProprietario, getInquilino } = useUnita(condominioId)
  const { importPersone, assegnaPersona, createPersona } = usePersone()

  const [search, setSearch]           = useState('')
  const [filterTipo, setFilterTipo]   = useState('tutti')
  const [showImport, setShowImport]   = useState(false)
  const [showUnitaForm, setShowUnitaForm] = useState(false)
  const [editUnita, setEditUnita]     = useState(null)
  const [showPersonaForm, setShowPersonaForm] = useState(null) // { unitaId, ruolo }
  const [expandedRow, setExpandedRow] = useState(null)
  const [toast, setToast]             = useState(null)

  // ── Filtro/ricerca ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return unita.filter(u => {
      const prop = getProprietario(u)
      const inq  = getInquilino(u)
      const matchSearch = !search || [
        u.numero, u.scala, u.tipo,
        prop?.nome, prop?.cognome, prop?.email,
        inq?.nome,  inq?.cognome,  inq?.email,
      ].some(v => v?.toLowerCase().includes(search.toLowerCase()))
      const matchTipo = filterTipo === 'tutti' || u.tipo === filterTipo
      return matchSearch && matchTipo
    })
  }, [unita, search, filterTipo])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Import handler ────────────────────────────────────────────────────
  const handleImport = async (rows) => {
    const result = await importPersone(rows)
    await fetchUnita()
    showToast(`${result.created} persone importate con successo`)
    return result
  }

  // ── Salva unità ───────────────────────────────────────────────────────
  const handleSaveUnita = async (data) => {
    try {
      if (editUnita) await updateUnita(editUnita.id, data)
      else await createUnita(data)
      setShowUnitaForm(false)
      setEditUnita(null)
      showToast('Unità salvata')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // ── Salva persona + assegna ───────────────────────────────────────────
  const handleSavePersona = async (data) => {
    try {
      const persona = await createPersona(data)
      if (showPersonaForm?.unitaId) {
        await assegnaPersona(showPersonaForm.unitaId, persona.id, showPersonaForm.ruolo)
      }
      await fetchUnita()
      setShowPersonaForm(null)
      showToast('Persona aggiunta')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div style={styles.page}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{ ...styles.toast, background: toast.type === 'error' ? '#7f1d1d' : '#14532d' }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>
            <Link to="/condomini" style={styles.breadLink}>Condomini</Link>
            <span style={{ color: '#475569' }}> / </span>
            <span style={{ color: '#94a3b8' }}>Anagrafica</span>
          </div>
          <h1 style={styles.title}>Anagrafica Unità</h1>
          <p style={styles.subtitle}>{unita.length} unità totali · {filtered.length} visualizzate</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.btnSecondary} onClick={() => setShowImport(true)}>
            📂 Importa file
          </button>
          <button style={styles.btnPrimary} onClick={() => { setEditUnita(null); setShowUnitaForm(true) }}>
            + Nuova unità
          </button>
        </div>
      </div>

      {/* ── Filtri ── */}
      <div style={styles.filters}>
        <input
          style={styles.search}
          placeholder="Cerca per unità, proprietario, inquilino, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={styles.select} value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
          <option value="tutti">Tutti i tipi</option>
          {Object.entries(TIPO_COLORS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* ── Tabella ── */}
      {loadingUnita ? (
        <div style={styles.loading}>Caricamento…</div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          <p style={{ fontSize: 48, marginBottom: 8 }}>🏢</p>
          <p style={{ color: '#94a3b8' }}>Nessuna unità trovata</p>
          <p style={{ color: '#475569', fontSize: 13 }}>Aggiungi unità manualmente o importa un file</p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Unità','Tipo','Piano / Scala','Proprietario','Inquilino','mq','Millesimi',''].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const prop = getProprietario(u)
                const inq  = getInquilino(u)
                const isExpanded = expandedRow === u.id
                return [
                  <tr key={u.id} style={styles.tr} onClick={() => setExpandedRow(isExpanded ? null : u.id)}>
                    <td style={{ ...styles.td, fontWeight: 700, color: '#e2e8f0' }}>
                      {u.numero}
                    </td>
                    <td style={styles.td}><TipoBadge tipo={u.tipo} /></td>
                    <td style={{ ...styles.td, color: '#94a3b8' }}>
                      {u.piano != null ? `Piano ${u.piano}` : '—'}
                      {u.scala ? ` · Sc.${u.scala}` : ''}
                    </td>
                    <td style={styles.td}><PersonaChip persona={prop} ruolo="proprietario" /></td>
                    <td style={styles.td}><PersonaChip persona={inq}  ruolo="inquilino" /></td>
                    <td style={{ ...styles.td, color: '#94a3b8' }}>{u.mq ? `${u.mq} m²` : '—'}</td>
                    <td style={{ ...styles.td, color: '#94a3b8' }}>{u.millesimi || '—'}</td>
                    <td style={styles.td}>
                      <div style={styles.rowActions} onClick={e => e.stopPropagation()}>
                        <button style={styles.iconBtn} title="Modifica" onClick={() => { setEditUnita(u); setShowUnitaForm(true) }}>✏️</button>
                        <button style={styles.iconBtn} title="Aggiungi proprietario" onClick={() => setShowPersonaForm({ unitaId: u.id, ruolo: 'proprietario' })}>🏠</button>
                        <button style={styles.iconBtn} title="Aggiungi inquilino"   onClick={() => setShowPersonaForm({ unitaId: u.id, ruolo: 'inquilino' })}>🔑</button>
                        <button style={{ ...styles.iconBtn, color: '#ef4444' }} title="Elimina" onClick={() => deleteUnita(u.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>,

                  // ── Riga espansa (dettaglio contatti) ──
                  isExpanded && (
                    <tr key={`${u.id}-expanded`} style={{ background: '#0f172a' }}>
                      <td colSpan={8} style={{ padding: '0 16px 16px' }}>
                        <div style={styles.expandedGrid}>
                          {[
                            { label: 'Proprietario', persona: prop, ruolo: 'proprietario' },
                            { label: 'Inquilino',     persona: inq,  ruolo: 'inquilino' },
                          ].map(({ label, persona, ruolo }) => (
                            <div key={ruolo} style={styles.expandedCard}>
                              <div style={styles.expandedTitle}>{RUOLO_ICON[ruolo]} {label}</div>
                              {persona ? (
                                <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.8 }}>
                                  <div><b>Nome:</b> {persona.cognome} {persona.nome}</div>
                                  <div><b>Email:</b> {persona.email || '—'}</div>
                                  <div><b>Tel:</b> {persona.telefono || '—'}</div>
                                  <div><b>Indirizzo:</b> {persona.indirizzo || '—'} {persona.citta || ''}</div>
                                </div>
                              ) : (
                                <button style={styles.addPersonaBtn}
                                  onClick={() => setShowPersonaForm({ unitaId: u.id, ruolo })}>
                                  + Aggiungi {label.toLowerCase()}
                                </button>
                              )}
                            </div>
                          ))}
                          {u.note && (
                            <div style={{ ...styles.expandedCard, gridColumn: '1/-1' }}>
                              <div style={styles.expandedTitle}>📝 Note</div>
                              <div style={{ color: '#94a3b8', fontSize: 13 }}>{u.note}</div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                ]
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modali ── */}
      {showImport && (
        <AnagraficaImport onImport={handleImport} onClose={() => setShowImport(false)} />
      )}
      {showUnitaForm && (
        <UnitaForm
          unita={editUnita}
          condominioId={condominioId}
          onSave={handleSaveUnita}
          onClose={() => { setShowUnitaForm(false); setEditUnita(null) }}
        />
      )}
      {showPersonaForm && (
        <PersonaForm
          ruolo={showPersonaForm.ruolo}
          onSave={handleSavePersona}
          onClose={() => setShowPersonaForm(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
const styles = {
  page: { padding: '28px 32px', background: '#0f172a', minHeight: '100vh', fontFamily: 'Sora, sans-serif' },
  toast: {
    position: 'fixed', top: 20, right: 20, zIndex: 2000,
    color: 'white', padding: '12px 20px', borderRadius: 10,
    fontSize: 14, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  breadcrumb: { fontSize: 13, marginBottom: 6 },
  breadLink: { color: '#3b82f6', textDecoration: 'none' },
  title: { color: '#e2e8f0', fontSize: 26, fontWeight: 700, margin: 0 },
  subtitle: { color: '#64748b', fontSize: 13, marginTop: 4 },
  headerActions: { display: 'flex', gap: 10 },
  filters: { display: 'flex', gap: 12, marginBottom: 20 },
  search: {
    flex: 1, background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0',
    borderRadius: 10, padding: '10px 16px', fontSize: 14, outline: 'none',
  },
  select: {
    background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0',
    borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none',
  },
  loading: { color: '#64748b', textAlign: 'center', padding: '60px' },
  empty: { textAlign: 'center', padding: '80px 20px', color: '#64748b' },
  tableWrap: { overflowX: 'auto', borderRadius: 12, border: '1px solid #1e293b' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    background: '#1e293b', color: '#64748b', padding: '10px 16px',
    textAlign: 'left', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.05em', fontSize: 11, whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid #1e293b', cursor: 'pointer',
    transition: 'background .15s',
  },
  td: { padding: '12px 16px', verticalAlign: 'middle' },
  rowActions: { display: 'flex', gap: 2 },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
    fontSize: 15, borderRadius: 6, transition: 'background .15s',
  },
  expandedGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 16,
  },
  expandedCard: {
    background: '#1e293b', borderRadius: 10, padding: '14px 18px',
    border: '1px solid #334155',
  },
  expandedTitle: { color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: 10 },
  addPersonaBtn: {
    background: 'transparent', border: '1px dashed #334155', color: '#3b82f6',
    borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13,
  },
  btnPrimary: {
    background: '#2563eb', color: 'white', border: 'none', borderRadius: 8,
    padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  btnSecondary: {
    background: 'transparent', color: '#94a3b8', border: '1px solid #334155',
    borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer',
  },
}
