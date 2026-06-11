// src/pages/CondominiDetailPage.jsx
import RateGridTab from '../components/RateGridTab'
import PreventivoSection from '../components/PreventivoSection'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useCondomini } from '../hooks/useCondomini'
import { useAuditLog } from '../hooks/useAuditLog'
import { useMemo, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import DocumentiCondominio from '../components/DocumentiCondominio'
import {
  DoorOpen, Layers, ArrowUpDown, Wallet, ClipboardList, CalendarDays,
  MoveVertical, Trees, ParkingCircle, UserCheck,
  FileText, FolderClock, LayoutGrid, CreditCard,
  ArrowLeft, Receipt, Users,
  CheckCircle2, Clock, AlertCircle, Circle,
  ChevronRight, Building2,
} from 'lucide-react'

// ── Icone KPI ────────────────────────────────────────────────
const KPI_ITEMS = (c) => [
  { icon: DoorOpen,      label: 'Unità',            value: c.num_unita || 0 },
  { icon: Layers,        label: 'Scale',             value: c.num_scale || 1 },
  { icon: ArrowUpDown,   label: 'Piani',             value: c.num_piani || '—' },
  { icon: Wallet,        label: 'Fondo cassa',       value: c.fondo_cassa ? `€${Number(c.fondo_cassa).toLocaleString('it-IT')}` : '—' },
  { icon: ClipboardList, label: 'Quote annuali',     value: c.quote_annuali ? `€${Number(c.quote_annuali).toLocaleString('it-IT')}` : '—' },
  { icon: CalendarDays,  label: 'Anno costruzione',  value: c.anno_costruzione || '—' },
]

const DOTAZIONI = (c) => [
  c.presenza_ascensore  && { icon: MoveVertical,    label: 'Ascensore' },
  c.presenza_giardino   && { icon: Trees,           label: 'Giardino' },
  c.presenza_parcheggio && { icon: ParkingCircle,   label: 'Parcheggio' },
  c.presenza_portiere   && { icon: UserCheck,       label: 'Portiere' },
].filter(Boolean)

const TABS = [
  { id: 'panoramica', label: 'Panoramica', icon: LayoutGrid },
  { id: 'preventivo', label: 'Preventivo', icon: ClipboardList },  // ← nuovo
  { id: 'rate',       label: 'Rate',       icon: CreditCard },
  { id: 'documenti',  label: 'Documenti',  icon: FileText },
  { id: 'storico',    label: 'Storico',    icon: FolderClock },
]

// ── Colori / icone stato rata ────────────────────────────────
const RATA_STATO = {
  pagata:   { color: '#10b981', bg: '#10b98118', Icon: CheckCircle2, label: 'Pagata' },
  scaduta:  { color: '#ef4444', bg: '#ef444418', Icon: AlertCircle,  label: 'Scaduta' },
  in_attesa:{ color: '#f59e0b', bg: '#f59e0b18', Icon: Clock,        label: 'In attesa' },
  aperta:   { color: '#64748b', bg: '#64748b18', Icon: Circle,       label: 'Aperta' },
}

// ── Tab Rate ─────────────────────────────────────────────────
function RateTab({ condominioId }) {
  const [esercizi, setEsercizi] = useState([])
  const [esercizioAttivo, setEsercizioAttivo] = useState(null)
  const [rate, setRate] = useState([])
  const [loading, setLoading] = useState(true)
  const [aggiornando, setAggiornando] = useState(null)

  useEffect(() => {
    supabase
      .from('esercizi')
      .select('*')
      .eq('condominio_id', condominioId)
      .order('anno', { ascending: false })
      .then(({ data }) => {
        setEsercizi(data || [])
        const aperto = data?.find(e => e.stato === 'aperto') || data?.[0]
        setEsercizioAttivo(aperto || null)
      })
  }, [condominioId])

  useEffect(() => {
    if (!esercizioAttivo) { setLoading(false); return }
    setLoading(true)
    supabase
      .from('rate')
      .select('*')
      .eq('esercizio_id', esercizioAttivo.id)
      .order('scadenza', { ascending: true })
      .then(({ data }) => { setRate(data || []); setLoading(false) })
  }, [esercizioAttivo])

  const segnaComePagata = async (rataId) => {
    setAggiornando(rataId)
    await supabase
      .from('rate')
      .update({ stato: 'pagata', data_pagamento: new Date().toISOString().split('T')[0] })
      .eq('id', rataId)
    setRate(prev => prev.map(r => r.id === rataId
      ? { ...r, stato: 'pagata', data_pagamento: new Date().toISOString().split('T')[0] }
      : r
    ))
    setAggiornando(null)
  }

  const totPagato  = rate.filter(r => r.stato === 'pagata').reduce((s, r) => s + parseFloat(r.importo || 0), 0)
  const totDovuto  = rate.reduce((s, r) => s + parseFloat(r.importo || 0), 0)
  const nScadute   = rate.filter(r => r.stato === 'scaduta').length

  if (!esercizioAttivo && !loading) return (
    <div style={{ textAlign: 'center', padding: 48 }}>
      <CreditCard size={36} color="#334155" style={{ marginBottom: 12 }} />
      <p style={{ color: '#64748b', margin: 0 }}>Nessun esercizio contabile creato</p>
      <p style={{ color: '#475569', fontSize: 13, marginTop: 6 }}>Crea un esercizio dalla sezione Spese per generare le rate</p>
    </div>
  )

  return (
    <div>
      {/* Selezione esercizio */}
      {esercizi.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {esercizi.map(es => (
            <button
              key={es.id}
              onClick={() => setEsercizioAttivo(es)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                border: `1px solid ${esercizioAttivo?.id === es.id ? '#2563eb' : '#334155'}`,
                background: esercizioAttivo?.id === es.id ? 'rgba(37,99,235,0.15)' : 'transparent',
                color: esercizioAttivo?.id === es.id ? '#60a5fa' : '#64748b',
                fontFamily: 'Sora, sans-serif', fontWeight: esercizioAttivo?.id === es.id ? 600 : 400,
              }}
            >
              {es.anno}
              <span style={{
                marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: es.stato === 'aperto' ? '#10b98122' : '#64748b22',
                color: es.stato === 'aperto' ? '#10b981' : '#64748b',
              }}>{es.stato}</span>
            </button>
          ))}
        </div>
      )}

      {/* KPI rate */}
      {!loading && rate.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Totale dovuto',  value: `€${totDovuto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,  color: '#60a5fa' },
            { label: 'Totale pagato',  value: `€${totPagato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,  color: '#10b981' },
            { label: 'Rate scadute',   value: nScadute, color: nScadute > 0 ? '#ef4444' : '#64748b' },
          ].map(k => (
            <div key={k.label} style={{
              background: '#1e293b', borderRadius: 10, padding: '14px 18px',
              border: `1px solid ${k.color}33`,
            }}>
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>{k.label}</div>
              <div style={{ color: k.color, fontSize: 20, fontWeight: 700 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Lista rate */}
      {loading ? (
        <div style={{ color: '#64748b', textAlign: 'center', padding: 32 }}>Caricamento rate...</div>
      ) : rate.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <CreditCard size={32} color="#334155" style={{ marginBottom: 10 }} />
          <p style={{ color: '#64748b', margin: 0 }}>Nessuna rata per questo esercizio</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rate.map(r => {
            const stato = RATA_STATO[r.stato] || RATA_STATO.aperta
            const { Icon } = stato
            const scaduta = r.stato !== 'pagata' && new Date(r.scadenza) < new Date()
            const statoEffettivo = scaduta && r.stato !== 'pagata' ? RATA_STATO.scaduta : stato
            return (
              <div key={r.id} style={{
                background: '#1e293b', borderRadius: 10, padding: '14px 18px',
                border: `1px solid ${statoEffettivo.color}33`,
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                {/* Stato icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: statoEffettivo.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <statoEffettivo.Icon size={18} color={statoEffettivo.color} />
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>
                    {r.descrizione || `Rata ${r.numero_rata ?? ''}`}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 2, display: 'flex', gap: 10 }}>
                    <span>Scadenza: {new Date(r.scadenza).toLocaleDateString('it-IT')}</span>
                    {r.data_pagamento && (
                      <span>· Pagata il {new Date(r.data_pagamento).toLocaleDateString('it-IT')}</span>
                    )}
                  </div>
                </div>

                {/* Importo */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: statoEffettivo.color, fontSize: 16, fontWeight: 700 }}>
                    €{parseFloat(r.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{
                    fontSize: 11, marginTop: 3,
                    color: statoEffettivo.color,
                    background: statoEffettivo.bg,
                    padding: '2px 8px', borderRadius: 4, display: 'inline-block',
                  }}>
                    {statoEffettivo.label}
                  </div>
                </div>

                {/* Azione */}
                {r.stato !== 'pagata' && (
                  <button
                    onClick={() => segnaComePagata(r.id)}
                    disabled={aggiornando === r.id}
                    style={{
                      background: aggiornando === r.id ? '#1e3a6e' : 'rgba(37,99,235,0.15)',
                      color: '#60a5fa', border: '1px solid rgba(37,99,235,0.3)',
                      borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600,
                      cursor: aggiornando === r.id ? 'not-allowed' : 'pointer',
                      fontFamily: 'Sora, sans-serif', whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    {aggiornando === r.id ? '...' : '✓ Segna pagata'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab Storico ──────────────────────────────────────────────
const AZIONE_COLORI = {
  INSERT: { bg: '#10b98122', color: '#10b981', label: 'Creazione' },
  UPDATE: { bg: '#3b82f622', color: '#60a5fa', label: 'Modifica' },
  DELETE: { bg: '#ef444422', color: '#f87171', label: 'Eliminazione' },
}

function StoricoTab({ condominioId }) {
  const { log, loading, fetch } = useAuditLog()
  useEffect(() => { fetch({ condominioId, perPagina: 30 }) }, [condominioId])

  if (loading) return <div style={{ color: '#64748b', padding: 24, textAlign: 'center' }}>Caricamento storico...</div>
  if (!log.length) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <FolderClock size={32} color="#334155" style={{ marginBottom: 10 }} />
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

// ── Main component ───────────────────────────────────────────
export default function CondominiDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { condomini, loading } = useCondomini()
  const c = useMemo(() => condomini.find(x => x.id === id), [condomini, id])
  const [activeTab, setActiveTab] = useState('panoramica')

  if (loading) return <div style={S.loading}>Caricamento…</div>
  if (!c)      return <div style={S.loading}>Condominio non trovato</div>

  const dotazioni = DOTAZIONI(c)

  return (
    <div style={S.page}>
      {/* Breadcrumb */}
      <div style={S.breadcrumb}>
        <Link to="/condomini" style={S.breadLink}>Condomini</Link>
        <ChevronRight size={13} color="#475569" style={{ verticalAlign: 'middle', margin: '0 2px' }} />
        <span style={{ color: '#94a3b8' }}>{c.nome}</span>
      </div>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.bigIcon}>
            <Building2 size={28} color="#60a5fa" />
          </div>
          <div>
            <h1 style={S.title}>{c.nome}</h1>
            <p style={S.addr}>{c.indirizzo} {c.civico}, {c.cap} {c.citta} ({c.provincia})</p>
            {c.codice_fiscale && <p style={S.cf}>CF: {c.codice_fiscale}</p>}
          </div>
        </div>
        <div style={S.headerActions}>
          <button style={S.btnSecondary} onClick={() => navigate('/condomini')}>
            <ArrowLeft size={15} style={{ marginRight: 6 }} /> Torna
          </button>
          <button style={S.btnSuccess} onClick={() => navigate(`/condomini/${id}/spese`)}>
            <Receipt size={15} style={{ marginRight: 6 }} /> Spese
          </button>
          <button style={S.btnPrimary} onClick={() => navigate(`/condomini/${id}/anagrafica`)}>
            <Users size={15} style={{ marginRight: 6 }} /> Anagrafica
          </button>
        </div>
      </div>

      {/* KPI */}
      <div style={S.kpiRow}>
        {KPI_ITEMS(c).map(({ icon: Icon, label, value }) => (
          <div key={label} style={S.kpiCard}>
            <div style={S.kpiIconWrap}>
              <Icon size={18} color="#60a5fa" strokeWidth={1.8} />
            </div>
            <div>
              <div style={S.kpiValue}>{value}</div>
              <div style={S.kpiLabel}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {TABS.map(({ id: tid, label, icon: Icon }) => {
          const active = activeTab === tid
          return (
            <button
              key={tid}
              onClick={() => setActiveTab(tid)}
              style={{
                ...S.tabBtn,
                background: active ? 'rgba(37,99,235,0.12)' : 'transparent',
                color: active ? '#60a5fa' : '#64748b',
                borderBottom: `2px solid ${active ? '#2563eb' : 'transparent'}`,
              }}
            >
              <Icon size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div style={S.tabContent}>

        {activeTab === 'panoramica' && (
          <>
            {dotazioni.length > 0 && (
              <div style={S.section}>
                <p style={S.sectionTitle}>Dotazioni</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {dotazioni.map(({ icon: Icon, label }) => (
                    <span key={label} style={S.featureBadge}>
                      <Icon size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={S.section}>
              <p style={S.sectionTitle}>Amministrazione</p>
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
                  <span style={{ ...S.infoValue, color: c.stato === 'attivo' ? '#4ade80' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} color={c.stato === 'attivo' ? '#4ade80' : '#94a3b8'} />
                    {c.stato === 'attivo' ? 'Attivo' : 'Archiviato'}
                  </span>
                </div>
              </div>
            </div>

            {c.note && (
              <div style={S.section}>
                <p style={S.sectionTitle}>Note</p>
                <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{c.note}</p>
              </div>
            )}
          </>
        )}

	{activeTab === 'preventivo' && <PreventivoSection condominioId={c.id} />}

        {activeTab === 'rate' && <RateGridTab condominioId={c.id} />}

        {activeTab === 'documenti' && <DocumentiCondominio condominioId={c.id} />}

        {activeTab === 'storico' && <StoricoTab condominioId={c.id} />}

      </div>
    </div>
  )
}

const S = {
  page:        { padding: '28px 32px', minHeight: '100vh', fontFamily: 'Sora, sans-serif' },
  loading:     { color: '#64748b', textAlign: 'center', padding: '80px', fontFamily: 'Sora, sans-serif' },
  breadcrumb:  { fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 },
  breadLink:   { color: '#3b82f6', textDecoration: 'none' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 },
  headerLeft:  { display: 'flex', gap: 16, alignItems: 'flex-start' },
  bigIcon:     { width: 52, height: 52, borderRadius: 12, background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:       { color: '#e2e8f0', fontSize: 24, fontWeight: 700, margin: '0 0 4px' },
  addr:        { color: '#64748b', fontSize: 14, margin: '0 0 2px' },
  cf:          { color: '#475569', fontSize: 12, margin: 0 },
  headerActions: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  kpiRow:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 14, marginBottom: 20 },
  kpiCard:     { background: '#1e293b', borderRadius: 12, padding: '16px', display: 'flex', gap: 12, alignItems: 'center', border: '1px solid #334155' },
  kpiIconWrap: { width: 36, height: 36, borderRadius: 8, background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  kpiValue:    { color: '#e2e8f0', fontSize: 18, fontWeight: 700 },
  kpiLabel:    { color: '#64748b', fontSize: 11 },
  tabBar:      { display: 'flex', gap: 2, borderBottom: '1px solid #334155', marginBottom: 20 },
  tabBtn:      { padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', borderRadius: '8px 8px 0 0', fontFamily: 'Sora, sans-serif', transition: 'all 0.15s', display: 'flex', alignItems: 'center' },
  tabContent:  {},
  section:     { background: '#1e293b', borderRadius: 12, padding: '20px 24px', marginBottom: 14, border: '1px solid #334155' },
  sectionTitle:{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' },
  featureBadge:{ background: '#0f172a', color: '#60a5fa', fontSize: 13, padding: '6px 14px', borderRadius: 8, border: '1px solid #1e3a5f', display: 'inline-flex', alignItems: 'center' },
  infoGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 14 },
  infoItem:    { display: 'flex', flexDirection: 'column', gap: 4 },
  infoLabel:   { color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  infoValue:   { color: '#e2e8f0', fontSize: 15, fontWeight: 500 },
  btnPrimary:  { background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', display: 'flex', alignItems: 'center' },
  btnSuccess:  { background: '#059669', color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', display: 'flex', alignItems: 'center' },
  btnSecondary:{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'Sora, sans-serif', display: 'flex', alignItems: 'center' },
}
