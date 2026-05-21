// src/pages/CondominiDetailPage.jsx
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useCondomini } from '../hooks/useCondomini'
import { useAuditLog } from '../hooks/useAuditLog'
import { useMemo, useState, useEffect } from 'react'
import DocumentiCondominio from '../components/DocumentiCondominio'

const TABS = [
  { id: 'panoramica', label: '📋 Panoramica' },
  { id: 'documenti',  label: '📄 Documenti' },
  { id: 'storico',    label: '🗂️ Storico modifiche' },
]

const AZIONE_COLORI = {
  INSERT: { bg: '#10b98122', color: '#10b981', label: 'Creazione' },
  UPDATE: { bg: '#3b82f622', color: '#60a5fa', label: 'Modifica' },
  DELETE: { bg: '#ef444422', color: '#f87171', label: 'Eliminazione' },
}
const CATEGORIA_ICONS = {
  anagrafica: '👤', spese: '💸', ripartizioni: '📊',
  documenti: '📄', esercizi: '📅', millesimi: '🔢', altro: '📁'
}

function StoricoTab({ condominioId }) {
  const { log, loading, fetch } = useAuditLog()
  useEffect(() => { fetch({ condominioId, perPagina: 30 }) }, [condominioId])

  if (loading) return <div style={{ color: '#64748b', padding: 24, textAlign: 'center' }}>Caricamento storico...</div>
  if (!log.length) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
      <p style={{ color: '#64748b', margin: 0 }}>Nessuna modifica registrata</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8 }}>
      {log.map(ev => {
        const az = AZIONE_COLORI[ev.azione] || AZIONE_COLORI.UPDATE
        return (
          <div key={ev.id} style={{
            background: '#0f172a', borderRadius: 8, padding: '11px 14px',
            border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 12
          }}>
            <span style={{
              background: az.bg, color: az.color, borderRadius: 5,
              padding: '2px 8px', fontSize: 11, fontWeight: 700, minWidth: 72, textAlign: 'center'
            }}>{az.label}</span>
            <span style={{ fontSize: 15 }}>{CATEGORIA_ICONS[ev.categoria] || '📁'}</span>
            <span style={{ color: '#94a3b8', fontSize: 13, flex: 1 }}>
              {ev.tabella_modificata.replace(/_/g, ' ')}
            </span>
            <span style={{ color: '#475569', fontSize: 12 }}>
              {new Date(ev.created_at).toLocaleDateString('it-IT')}{' '}
              {new Date(ev.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )
      })}
      <Link to="/archivio" style={{ color: '#3b82f6', fontSize: 13, textAlign: 'center', marginTop: 8, display: 'block' }}>
        Vedi archivio completo →
      </Link>
    </div>
  )
}

export default function CondominiDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { condomini, loading } = useCondomini()
  const c = useMemo(() => condomini.find(x => x.id === id), [condomini, id])
  const [activeTab, setActiveTab] = useState('panoramica')

  if (loading) return <div style={S.loading}>Caricamento…</div>
  if (!c)      return <div style={S.loading}>Condominio non trovato</div>

  const features = [
    c.presenza_ascensore  && '🛗 Ascensore',
    c.presenza_giardino   && '🌳 Giardino',
    c.presenza_parcheggio && '🚗 Parcheggio',
    c.presenza_portiere   && '👮 Portiere',
  ].filter(Boolean)

  return (
    <div style={S.page}>
      {/* Breadcrumb */}
      <div style={S.breadcrumb}>
        <Link to="/condomini" style={S.breadLink}>Condomini</Link>
        <span style={{ color:'#475569' }}> / </span>
        <span style={{ color:'#94a3b8' }}>{c.nome}</span>
      </div>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.bigIcon}>🏢</div>
          <div>
            <h1 style={S.title}>{c.nome}</h1>
            <p style={S.addr}>{c.indirizzo} {c.civico}, {c.cap} {c.citta} ({c.provincia})</p>
            {c.codice_fiscale && <p style={S.cf}>CF: {c.codice_fiscale}</p>}
          </div>
        </div>
        <div style={S.headerActions}>
          <button style={S.btnSecondary} onClick={() => navigate('/condomini')}>← Torna</button>
          <button style={S.btnSuccess} onClick={() => navigate(`/condomini/${id}/spese`)}>
            💸 Spese
          </button>
          <button style={S.btnPrimary} onClick={() => navigate(`/condomini/${id}/anagrafica`)}>
            👥 Anagrafica
          </button>
        </div>
      </div>

      {/* KPI */}
      <div style={S.kpiRow}>
        {[
          { icon:'🚪', label:'Unità',            value: c.num_unita || 0 },
          { icon:'🏗️', label:'Scale',            value: c.num_scale || 1 },
          { icon:'📐', label:'Piani',            value: c.num_piani || '—' },
          { icon:'💰', label:'Fondo cassa',      value: c.fondo_cassa ? `€${Number(c.fondo_cassa).toLocaleString('it-IT')}` : '—' },
          { icon:'📋', label:'Quote annuali',    value: c.quote_annuali ? `€${Number(c.quote_annuali).toLocaleString('it-IT')}` : '—' },
          { icon:'📅', label:'Anno costruzione', value: c.anno_costruzione || '—' },
        ].map(k => (
          <div key={k.label} style={S.kpiCard}>
            <span style={{ fontSize:24 }}>{k.icon}</span>
            <div>
              <div style={S.kpiValue}>{k.value}</div>
              <div style={S.kpiLabel}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...S.tabBtn,
              background: activeTab === tab.id ? '#2563eb' : 'transparent',
              color: activeTab === tab.id ? '#fff' : '#64748b',
              borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={S.tabContent}>

        {/* PANORAMICA */}
        {activeTab === 'panoramica' && (
          <>
            {features.length > 0 && (
              <div style={S.section}>
                <h3 style={S.sectionTitle}>Dotazioni</h3>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {features.map(f => <span key={f} style={S.featureBadge}>{f}</span>)}
                </div>
              </div>
            )}

            <div style={S.section}>
              <h3 style={S.sectionTitle}>Amministrazione</h3>
              <div style={S.infoGrid}>
                {c.data_inizio_amministrazione && (
                  <div style={S.infoItem}>
                    <span style={S.infoLabel}>Inizio amministrazione</span>
                    <span style={S.infoValue}>
                      {new Date(c.data_inizio_amministrazione).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                )}
                <div style={S.infoItem}>
                  <span style={S.infoLabel}>Stato</span>
                  <span style={{ ...S.infoValue, color: c.stato === 'attivo' ? '#4ade80' : '#94a3b8' }}>
                    {c.stato === 'attivo' ? '✅ Attivo' : '📦 Archiviato'}
                  </span>
                </div>
              </div>
            </div>

            {c.note && (
              <div style={S.section}>
                <h3 style={S.sectionTitle}>Note</h3>
                <p style={{ color:'#94a3b8', fontSize:14, lineHeight:1.7, margin:0 }}>{c.note}</p>
              </div>
            )}
          </>
        )}

        {/* DOCUMENTI */}
        {activeTab === 'documenti' && (
          <DocumentiCondominio condominioId={c.id} />
        )}

        {/* STORICO */}
        {activeTab === 'storico' && (
          <StoricoTab condominioId={c.id} />
        )}

      </div>
    </div>
  )
}

const S = {
  page:         { padding:'28px 32px', background:'#0f172a', minHeight:'100vh', fontFamily:'Sora, sans-serif' },
  loading:      { color:'#64748b', textAlign:'center', padding:'80px', fontFamily:'Sora, sans-serif' },
  breadcrumb:   { fontSize:13, marginBottom:20 },
  breadLink:    { color:'#3b82f6', textDecoration:'none' },
  header:       { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28, flexWrap:'wrap', gap:16 },
  headerLeft:   { display:'flex', gap:16, alignItems:'flex-start' },
  bigIcon:      { fontSize:52 },
  title:        { color:'#e2e8f0', fontSize:26, fontWeight:700, margin:'0 0 4px' },
  addr:         { color:'#64748b', fontSize:14, margin:'0 0 2px' },
  cf:           { color:'#475569', fontSize:12, margin:0 },
  headerActions:{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' },
  kpiRow:       { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:14, marginBottom:20 },
  kpiCard:      { background:'#1e293b', borderRadius:12, padding:'16px', display:'flex', gap:12, alignItems:'center', border:'1px solid #334155' },
  kpiValue:     { color:'#e2e8f0', fontSize:20, fontWeight:700 },
  kpiLabel:     { color:'#64748b', fontSize:11 },
  tabBar:       { display:'flex', gap:4, borderBottom:'1px solid #334155', marginBottom:20 },
  tabBtn:       { padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', border:'none', borderRadius:'8px 8px 0 0', fontFamily:'Sora, sans-serif', transition:'all 0.15s' },
  tabContent:   { },
  section:      { background:'#1e293b', borderRadius:12, padding:'20px 24px', marginBottom:14, border:'1px solid #334155' },
  sectionTitle: { color:'#94a3b8', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 14px' },
  featureBadge: { background:'#0f172a', color:'#60a5fa', fontSize:13, padding:'6px 14px', borderRadius:8, border:'1px solid #1e3a5f' },
  infoGrid:     { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))', gap:14 },
  infoItem:     { display:'flex', flexDirection:'column', gap:4 },
  infoLabel:    { color:'#64748b', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' },
  infoValue:    { color:'#e2e8f0', fontSize:15, fontWeight:500 },
  btnPrimary:   { background:'#2563eb', color:'white', border:'none', borderRadius:8, padding:'10px 20px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'Sora, sans-serif' },
  btnSuccess:   { background:'#059669', color:'white', border:'none', borderRadius:8, padding:'10px 20px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'Sora, sans-serif' },
  btnSecondary: { background:'transparent', color:'#94a3b8', border:'1px solid #334155', borderRadius:8, padding:'10px 20px', fontSize:14, cursor:'pointer', fontFamily:'Sora, sans-serif' },
}
