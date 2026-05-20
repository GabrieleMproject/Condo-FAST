// src/pages/CondominiDetailPage.jsx
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useCondomini } from '../hooks/useCondomini'
import { useMemo } from 'react'

export default function CondominiDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { condomini, loading } = useCondomini()
  const c = useMemo(() => condomini.find(x => x.id === id), [condomini, id])

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
          <button style={S.btnPrimary} onClick={() => navigate(`/condomini/${id}/anagrafica`)}>
            👥 Gestisci Anagrafica
          </button>
        </div>
      </div>

      {/* KPI */}
      <div style={S.kpiRow}>
        {[
          { icon:'🚪', label:'Unità',          value: c.num_unita || 0 },
          { icon:'🏗️', label:'Scale',          value: c.num_scale || 1 },
          { icon:'📐', label:'Piani',          value: c.num_piani || '—' },
          { icon:'💰', label:'Fondo cassa',    value: c.fondo_cassa ? `€${Number(c.fondo_cassa).toLocaleString('it-IT')}` : '—' },
          { icon:'📋', label:'Quote annuali',  value: c.quote_annuali ? `€${Number(c.quote_annuali).toLocaleString('it-IT')}` : '—' },
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

      {/* Features */}
      {features.length > 0 && (
        <div style={S.section}>
          <h3 style={S.sectionTitle}>Dotazioni</h3>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {features.map(f => (
              <span key={f} style={S.featureBadge}>{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* Amministrazione */}
      <div style={S.section}>
        <h3 style={S.sectionTitle}>Amministrazione</h3>
        <div style={S.infoGrid}>
          {c.data_inizio_amministrazione && (
            <div style={S.infoItem}>
              <span style={S.infoLabel}>Inizio amministrazione</span>
              <span style={S.infoValue}>{new Date(c.data_inizio_amministrazione).toLocaleDateString('it-IT')}</span>
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

      {/* Note */}
      {c.note && (
        <div style={S.section}>
          <h3 style={S.sectionTitle}>Note</h3>
          <p style={{ color:'#94a3b8', fontSize:14, lineHeight:1.7, margin:0 }}>{c.note}</p>
        </div>
      )}
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
  headerActions:{ display:'flex', gap:10, alignItems:'center' },
  kpiRow:       { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:14, marginBottom:20 },
  kpiCard:      { background:'#1e293b', borderRadius:12, padding:'16px', display:'flex', gap:12, alignItems:'center', border:'1px solid #334155' },
  kpiValue:     { color:'#e2e8f0', fontSize:20, fontWeight:700 },
  kpiLabel:     { color:'#64748b', fontSize:11 },
  section:      { background:'#1e293b', borderRadius:12, padding:'20px 24px', marginBottom:14, border:'1px solid #334155' },
  sectionTitle: { color:'#94a3b8', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 14px' },
  featureBadge: { background:'#0f172a', color:'#60a5fa', fontSize:13, padding:'6px 14px', borderRadius:8, border:'1px solid #1e3a5f' },
  infoGrid:     { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))', gap:14 },
  infoItem:     { display:'flex', flexDirection:'column', gap:4 },
  infoLabel:    { color:'#64748b', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' },
  infoValue:    { color:'#e2e8f0', fontSize:15, fontWeight:500 },
  btnPrimary:   { background:'#2563eb', color:'white', border:'none', borderRadius:8, padding:'10px 20px', fontSize:14, fontWeight:600, cursor:'pointer' },
  btnSecondary: { background:'transparent', color:'#94a3b8', border:'1px solid #334155', borderRadius:8, padding:'10px 20px', fontSize:14, cursor:'pointer' },
}
