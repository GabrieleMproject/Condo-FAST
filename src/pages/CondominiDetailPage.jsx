import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import CondominiForm from '../components/CondominiForm'

const STATO_CONFIG = {
  attivo:     { label: 'Attivo',     color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  archiviato: { label: 'Archiviato', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  sospeso:    { label: 'Sospeso',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
}

export default function CondominiDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [condominio, setCondominio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showEdit, setShowEdit] = useState(false)

  const fetchCondominio = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('condomini')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setCondominio(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCondominio()
  }, [id])

  const handleEditClose = () => {
    setShowEdit(false)
    fetchCondominio() // ricarica i dati aggiornati
  }

  if (loading) return (
    <div className="page">
      <div className="state-empty">
        <div className="spinner" />
        <p>Caricamento…</p>
      </div>
    </div>
  )

  if (error || !condominio) return (
    <div className="page">
      <div className="state-error">
        <p>Condominio non trovato.</p>
        <button className="btn-ghost" onClick={() => navigate('/condomini')}>
          ← Torna alla lista
        </button>
      </div>
    </div>
  )

  const statoConf = STATO_CONFIG[condominio.stato] || STATO_CONFIG.attivo
  const inizioAmm = condominio.data_inizio_amministrazione
    ? new Date(condominio.data_inizio_amministrazione).toLocaleDateString('it-IT')
    : '—'

  return (
    <div className="page">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <button onClick={() => navigate('/condomini')} className="breadcrumb-link">
          Condomini
        </button>
        <span className="breadcrumb-sep">›</span>
        <span>{condominio.nome}</span>
      </div>

      {/* Header */}
      <div className="page-header">
        <div className="detail-title-row">
          <div className="detail-avatar">{condominio.nome.slice(0, 2).toUpperCase()}</div>
          <div>
            <h1 className="page-title">{condominio.nome}</h1>
            <p className="page-subtitle">
              {condominio.indirizzo} {condominio.civico}, {condominio.cap} {condominio.citta} ({condominio.provincia})
            </p>
          </div>
          <span
            className="stato-badge-large"
            style={{ '--stato-color': statoConf.color, '--stato-bg': statoConf.bg }}
          >
            {statoConf.label}
          </span>
        </div>
        <button className="btn-primary" onClick={() => setShowEdit(true)}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
            <path d="M2 10L9.5 2.5a1.5 1.5 0 012 2L4 12H2v-2z"/>
          </svg>
          Modifica
        </button>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid">
        <KpiCard
          icon="🏠"
          label="Unità abitative"
          value={condominio.num_unita}
          sub={`${condominio.num_scale} ${condominio.num_scale === 1 ? 'scala' : 'scale'}`}
        />
        <KpiCard
          icon="💶"
          label="Fondo cassa"
          value={`€ ${(condominio.fondo_cassa || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
        />
        <KpiCard
          icon="📅"
          label="Quote annuali"
          value={`€ ${(condominio.quote_annuali || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
        />
        <KpiCard
          icon="📋"
          label="In amministrazione dal"
          value={inizioAmm}
        />
      </div>

      {/* Detail cards grid */}
      <div className="detail-grid">
        {/* Dati anagrafici */}
        <div className="detail-card">
          <h3 className="detail-card-title">Anagrafica</h3>
          <div className="detail-rows">
            <DetailRow label="Nome" value={condominio.nome} />
            <DetailRow label="Codice fiscale" value={condominio.codice_fiscale || '—'} />
            <DetailRow label="Indirizzo" value={`${condominio.indirizzo} ${condominio.civico}`} />
            <DetailRow label="CAP / Città" value={`${condominio.cap} ${condominio.citta} (${condominio.provincia})`} />
          </div>
        </div>

        {/* Dati strutturali */}
        <div className="detail-card">
          <h3 className="detail-card-title">Struttura</h3>
          <div className="detail-rows">
            <DetailRow label="Unità abitative" value={condominio.num_unita} />
            <DetailRow label="Scale" value={condominio.num_scale} />
            <DetailRow label="Piani" value={condominio.num_piani || '—'} />
            <DetailRow label="Anno costruzione" value={condominio.anno_costruzione || '—'} />
          </div>
          <div className="features-chips">
            <FeatureChip active={condominio.presenza_ascensore} label="Ascensore" emoji="🛗" />
            <FeatureChip active={condominio.presenza_giardino} label="Giardino" emoji="🌳" />
            <FeatureChip active={condominio.presenza_parcheggio} label="Parcheggio" emoji="🅿️" />
            <FeatureChip active={condominio.presenza_portiere} label="Portiere" emoji="👤" />
          </div>
        </div>

        {/* Note */}
        {condominio.note && (
          <div className="detail-card full-width">
            <h3 className="detail-card-title">Note</h3>
            <p className="note-text">{condominio.note}</p>
          </div>
        )}
      </div>

      {/* Coming soon sections */}
      <div className="coming-soon-sections">
        {['Condomini', 'Assemblee', 'Contabilità', 'Documenti'].map(section => (
          <div key={section} className="coming-soon-card">
            <span>{section}</span>
            <span className="badge-soon">Prossimamente</span>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <CondominiForm condominio={condominio} onClose={handleEditClose} />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function KpiCard({ icon, label, value, sub }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-content">
        <p className="kpi-label">{label}</p>
        <p className="kpi-value">{value}</p>
        {sub && <p className="kpi-sub">{sub}</p>}
      </div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  )
}

function FeatureChip({ active, label, emoji }) {
  return (
    <span className={`feature-chip ${active ? 'active' : 'inactive'}`}>
      {emoji} {label}
    </span>
  )
}
