import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCondomini } from '../hooks/useCondomini'
import CondominiForm from '../components/CondominiForm'

const STATO_CONFIG = {
  attivo:     { label: 'Attivo',     color: '#22c55e' },
  archiviato: { label: 'Archiviato', color: '#6b7280' },
  sospeso:    { label: 'Sospeso',    color: '#f59e0b' },
}

export default function CondominiPage() {
  const { condomini, loading, error, deleteCondominio, archiviaCondominio } = useCondomini()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [filterStato, setFilterStato] = useState('tutti')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const filtered = useMemo(() => {
    return condomini.filter(c => {
      const matchSearch =
        c.nome.toLowerCase().includes(search.toLowerCase()) ||
        c.indirizzo.toLowerCase().includes(search.toLowerCase()) ||
        c.citta.toLowerCase().includes(search.toLowerCase())
      const matchStato = filterStato === 'tutti' || c.stato === filterStato
      return matchSearch && matchStato
    })
  }, [condomini, search, filterStato])

  const stats = useMemo(() => ({
    totale: condomini.length,
    attivi: condomini.filter(c => c.stato === 'attivo').length,
    unita: condomini.reduce((s, c) => s + (c.num_unita || 0), 0),
  }), [condomini])

  const handleEdit = (c) => {
    setEditTarget(c)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditTarget(null)
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setActionLoading(true)
    try {
      await deleteCondominio(confirmDelete.id)
    } catch (e) {
      alert('Errore: ' + e.message)
    } finally {
      setActionLoading(false)
      setConfirmDelete(null)
    }
  }

  const handleArchivia = async (c) => {
    setActionLoading(true)
    try {
      await archiviaCondominio(c.id)
    } catch (e) {
      alert('Errore: ' + e.message)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Condomini</h1>
          <p className="page-subtitle">Gestisci il tuo portafoglio immobiliare</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M8 2v12M2 8h12"/>
          </svg>
          Nuovo Condominio
        </button>
      </div>

      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stat-chip">
          <span className="stat-value">{stats.totale}</span>
          <span className="stat-label">Totali</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-chip">
          <span className="stat-value" style={{ color: '#22c55e' }}>{stats.attivi}</span>
          <span className="stat-label">Attivi</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-chip">
          <span className="stat-value">{stats.unita}</span>
          <span className="stat-label">Unità totali</span>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="toolbar">
        <div className="search-wrapper">
          <svg className="search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="6.5" cy="6.5" r="4.5"/>
            <path d="M10.5 10.5l3 3"/>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Cerca per nome, indirizzo, città…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4l8 8M12 4l-8 8"/>
              </svg>
            </button>
          )}
        </div>
        <div className="filter-tabs">
          {['tutti', 'attivo', 'sospeso', 'archiviato'].map(stato => (
            <button
              key={stato}
              className={`filter-tab ${filterStato === stato ? 'active' : ''}`}
              onClick={() => setFilterStato(stato)}
            >
              {stato === 'tutti' ? 'Tutti' : STATO_CONFIG[stato]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="state-empty">
          <div className="spinner" />
          <p>Caricamento condomini…</p>
        </div>
      ) : error ? (
        <div className="state-error">
          <p>Errore nel caricamento: {error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="state-empty">
          {search || filterStato !== 'tutti' ? (
            <>
              <EmptySearchIcon />
              <p>Nessun risultato per "<strong>{search}</strong>"</p>
              <button className="btn-ghost" onClick={() => { setSearch(''); setFilterStato('tutti') }}>
                Azzera filtri
              </button>
            </>
          ) : (
            <>
              <EmptyBuildingIcon />
              <p>Nessun condominio ancora.</p>
              <p className="hint">Aggiungi il tuo primo condominio per iniziare.</p>
              <button className="btn-primary" onClick={() => setShowForm(true)}>
                Aggiungi condominio
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="condomini-grid">
          {filtered.map(c => (
            <CondominiCard
              key={c.id}
              condominio={c}
              onView={() => navigate(`/condomini/${c.id}`)}
              onEdit={() => handleEdit(c)}
              onArchivia={() => handleArchivia(c)}
              onDelete={() => setConfirmDelete(c)}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <CondominiForm
          condominio={editTarget}
          onClose={handleCloseForm}
        />
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-box danger" onClick={e => e.stopPropagation()}>
            <h3>Elimina condominio</h3>
            <p>
              Sei sicuro di voler eliminare <strong>{confirmDelete.nome}</strong>?
              <br />
              <span className="text-muted">Questa azione è irreversibile.</span>
            </p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>
                Annulla
              </button>
              <button className="btn-danger" onClick={handleDelete} disabled={actionLoading}>
                {actionLoading ? 'Eliminazione…' : 'Elimina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Card Component ────────────────────────────────────────────

function CondominiCard({ condominio: c, onView, onEdit, onArchivia, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const statoConf = STATO_CONFIG[c.stato] || STATO_CONFIG.attivo

  return (
    <div className="condo-card" onClick={onView}>
      <div className="condo-card-header">
        <div className="condo-avatar">
          {c.nome.slice(0, 2).toUpperCase()}
        </div>
        <div className="condo-card-meta">
          <h3 className="condo-name">{c.nome}</h3>
          <p className="condo-address">
            {c.indirizzo} {c.civico}, {c.cap} {c.citta} ({c.provincia})
          </p>
        </div>
        <div className="condo-card-actions" onClick={e => e.stopPropagation()}>
          <span className="stato-badge" style={{ '--stato-color': statoConf.color }}>
            {statoConf.label}
          </span>
          <div className="menu-wrapper">
            <button
              className="menu-trigger"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="3" r="1.2"/>
                <circle cx="8" cy="8" r="1.2"/>
                <circle cx="8" cy="13" r="1.2"/>
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="dropdown-menu">
                  <button onClick={() => { onView(); setMenuOpen(false) }}>
                    <EyeIcon /> Visualizza
                  </button>
                  <button onClick={() => { onEdit(); setMenuOpen(false) }}>
                    <EditIcon /> Modifica
                  </button>
                  {c.stato !== 'archiviato' && (
                    <button onClick={() => { onArchivia(); setMenuOpen(false) }}>
                      <ArchiveIcon /> Archivia
                    </button>
                  )}
                  <button className="danger" onClick={() => { onDelete(); setMenuOpen(false) }}>
                    <TrashIcon /> Elimina
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="condo-card-stats">
        <div className="condo-stat">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 14V6l6-4 6 4v8"/>
            <rect x="5" y="9" width="2.5" height="5"/>
            <rect x="8.5" y="9" width="2.5" height="5"/>
          </svg>
          <span>{c.num_unita} unità</span>
        </div>
        <div className="condo-stat">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="4" width="6" height="10" rx="0.5"/>
            <rect x="9" y="1" width="6" height="13" rx="0.5"/>
          </svg>
          <span>{c.num_scale} {c.num_scale === 1 ? 'scala' : 'scale'}</span>
        </div>
        {c.anno_costruzione && (
          <div className="condo-stat">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="3" width="14" height="12" rx="1"/>
              <path d="M5 3V1M11 3V1M1 7h14"/>
            </svg>
            <span>{c.anno_costruzione}</span>
          </div>
        )}
        <div className="condo-stat-icons">
          {c.presenza_ascensore && <span title="Ascensore">🛗</span>}
          {c.presenza_giardino && <span title="Giardino">🌳</span>}
          {c.presenza_parcheggio && <span title="Parcheggio">🅿️</span>}
          {c.presenza_portiere && <span title="Portiere">👤</span>}
        </div>
      </div>

      {c.fondo_cassa > 0 && (
        <div className="condo-card-footer">
          <span className="text-muted">Fondo cassa</span>
          <span className="fondo-value">
            € {c.fondo_cassa.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Small Icons ───────────────────────────────────────────────

function EyeIcon() {
  return <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.5"/></svg>
}
function EditIcon() {
  return <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 10L9.5 2.5a1.5 1.5 0 012 2L4 12H2v-2z"/></svg>
}
function ArchiveIcon() {
  return <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="12" height="3.5" rx="0.5"/><path d="M2 4.5v7a1 1 0 001 1h8a1 1 0 001-1v-7"/><path d="M5 7h4"/></svg>
}
function TrashIcon() {
  return <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h10M5 4V2h4v2M4 4l.7 8h4.6L10 4"/></svg>
}
function EmptyBuildingIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" width="64" height="64" opacity="0.3">
      <rect x="8" y="20" width="20" height="38" rx="1"/>
      <rect x="36" y="8" width="20" height="50" rx="1"/>
      <path d="M1 58h62"/>
      <rect x="13" y="28" width="6" height="6" rx="0.5"/>
      <rect x="13" y="40" width="6" height="6" rx="0.5"/>
      <rect x="41" y="16" width="6" height="6" rx="0.5"/>
      <rect x="41" y="28" width="6" height="6" rx="0.5"/>
      <rect x="41" y="40" width="6" height="6" rx="0.5"/>
    </svg>
  )
}
function EmptySearchIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" width="64" height="64" opacity="0.3">
      <circle cx="26" cy="26" r="18"/>
      <path d="M40 40l16 16"/>
      <path d="M20 26h12M26 20v12"/>
    </svg>
  )
}
