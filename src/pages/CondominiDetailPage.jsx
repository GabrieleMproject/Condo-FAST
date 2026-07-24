// src/pages/CondominiDetailPage.jsx
import ConsuntivoTab from '../components/ConsuntivoTab'
import { FileBarChart } from 'lucide-react'   // se non già importato un'icona; in alternativa riusa Wallet/FileText
import RateGridTab from '../components/RateGridTab'
import PreventivoSection from '../components/PreventivoSection'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useCondomini } from '../hooks/useCondomini'
import { useAuditLog } from '../hooks/useAuditLog'
import { useMemo, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import DocumentiCondominio from '../components/DocumentiCondominio'
import ComunicazioniTab from '../components/ComunicazioniTab'
import AnagraficaCondominioTab from '../components/AnagraficaCondominioTab'
import PassaggioConsegneSection from '../components/PassaggioConsegneSection'
import SinistriTab from '../components/SinistriTab'
import {
  DoorOpen, Layers, ArrowUpDown, Wallet, ClipboardList, CalendarDays,
  MoveVertical, Trees, ParkingCircle, UserCheck,
  FileText, FolderClock, LayoutGrid, CreditCard,
  ArrowLeft, Receipt, Users,
  CheckCircle2,
  ChevronRight, Building2,
  Mail, FileSignature, ShieldAlert,
} from 'lucide-react'
import VerbaliAssembleaTab from '../components/VerbaliAssembleaTab'
import { eseguiDiagnosiConformitaFiscale } from '../lib/diagnosiFiscaleEngine'
import DiagnosiFiscaleModal from '../components/DiagnosiFiscaleModal'
import { Activity } from 'lucide-react'
import { useEsercizioCorrente } from '../hooks/useEsercizioCorrente'
import EsercizioSelectorHeader from '../components/EsercizioSelectorHeader'
import DemoCondoBanner from '../components/DemoCondoBanner'

// ── Helper date sicure ──────────────────────────────────────
const formattaData = (d) => (d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleDateString('it-IT') : '—')
const formattaDataOra = (d) => (d && !isNaN(new Date(d).getTime()) ? `${new Date(d).toLocaleDateString('it-IT')} ${new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : '—')

// ── Helper formattazione piani ─────────────────────────────
// ── Icone KPI ────────────────────────────────────────────────
const KPI_ITEMS = (c, saldoConto) => [
  { icon: DoorOpen,      label: 'Unità',                value: c.num_unita || 0 },
  { icon: Layers,        label: 'Scale',                 value: c.num_scale || 1 },
  { icon: ArrowUpDown,   label: 'Piani fuori terra',     value: c.num_piani_fuori_terra != null ? c.num_piani_fuori_terra : (c.num_piani || '—') },
  { icon: ArrowUpDown,   label: 'Piani interrati',       value: c.num_piani_interrati != null ? c.num_piani_interrati : 0 },
  { 
    icon: Wallet,        
    label: saldoConto ? `Fondo cassa (al ${formattaData(saldoConto.data)})` : 'Fondo cassa',       
    value: saldoConto 
      ? `€${Number(saldoConto.saldo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` 
      : (c.fondo_cassa ? `€${Number(c.fondo_cassa).toLocaleString('it-IT')}` : '—') 
  },
  { icon: ClipboardList, label: 'Quote annuali',         value: c.quote_annuali ? `€${Number(c.quote_annuali).toLocaleString('it-IT')}` : '—' },
  { icon: CalendarDays,  label: 'Anno costruzione',      value: c.anno_costruzione || '—' },
]

const DOTAZIONI = (c) => [
  c.presenza_ascensore  && { icon: MoveVertical,    label: 'Ascensore' },
  c.presenza_giardino   && { icon: Trees,           label: 'Giardino' },
  c.presenza_parcheggio && { icon: ParkingCircle,   label: 'Box' },
  c.presenza_portiere   && { icon: UserCheck,       label: 'Portiere' },
].filter(Boolean)

const TABS = [
  { id: 'panoramica', label: 'Panoramica', icon: LayoutGrid },
  { id: 'anagrafica', label: 'Anagrafica & Unità', icon: Users },
  { id: 'preventivo', label: 'Preventivo & Saldi', icon: ClipboardList },
  { id: 'consuntivo', label: 'Consuntivo', icon: FileBarChart },
  { id: 'rate',       label: 'Rate',       icon: CreditCard },
  { id: 'comunicazioni', label: 'Comunicazioni', icon: Mail },
  { id: 'verbali',    label: 'Verbali',    icon: FileSignature },
  { id: 'sinistri',   label: 'Sinistri',   icon: ShieldAlert },
  { id: 'finanze',    label: 'Finanze',    icon: Wallet },        // ← nuovo: accesso pagine finanziarie
  { id: 'documenti',  label: 'Documenti',  icon: FileText },
  { id: 'storico',    label: 'Storico',    icon: FolderClock },
]

// ── Tab Finanze: scorciatoie verso le pagine finanziarie (route già esistenti) ──
const FIN_LINKS = (id, esercizioId) => {
  const query = esercizioId ? `?esercizio=${esercizioId}` : ''
  return [
    { label: 'Estratto conto',         desc: 'Importa e gestisci i movimenti bancari', icon: Wallet,     to: `/condomini/${id}/estratto-conto${query}` },
    { label: 'Fatture fornitori',      desc: 'Carica e gestisci le fatture',            icon: Receipt,    to: `/condomini/${id}/fatture${query}` },
    { label: 'Riconciliazione uscite', desc: 'Abbina uscite ↔ fatture fornitori',       icon: ArrowUpDown, to: `/condomini/${id}/riconciliazioni${query}` },
    { label: 'Riconciliazione incassi',desc: 'Abbina entrate ↔ rate dei condòmini',     icon: CreditCard, to: `/condomini/${id}/riconciliazioni-incassi${query}` },
    { label: 'Ripartizione',           desc: 'Ripartizione spese per millesimi',        icon: LayoutGrid, to: `/condomini/${id}/ripartizione${query}` },
    { label: 'Config. pagante',        desc: 'Chi paga per ogni unità',                 icon: UserCheck,  to: `/condomini/${id}/config-pagante${query}` },
    { label: 'Millesimi',              desc: 'Tabelle e valori millesimali',            icon: Layers,     to: `/condomini/${id}/millesimi${query}` },
    { label: 'Dashboard finanziaria',  desc: 'Quadro economico generale',               icon: Building2,  to: `/condomini/${id}/dashboard-fin${query}` },
  ]
}

function FinanzeTab({ condominioId, esercizioId }) {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 14 }}>
      {FIN_LINKS(condominioId, esercizioId).map(({ label, desc, icon: Icon, to }) => (
        <button key={to} onClick={() => navigate(to)} style={S.finCard}>
          <div style={S.finIconWrap}>
            <Icon size={20} color="#60a5fa" strokeWidth={1.8} />
          </div>
          <div style={{ textAlign: 'left', minWidth: 0 }}>
            <div style={S.finLabel}>{label}</div>
            <div style={S.finDesc}>{desc}</div>
          </div>
        </button>
      ))}
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

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>Caricamento storico...</div>
  if (!log.length) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <FolderClock size={32} color="var(--text-muted)" style={{ marginBottom: 10 }} />
      <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nessuna modifica registrata</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8 }}>
      {log.map(ev => {
        const az = AZIONE_COLORI[ev.azione] || AZIONE_COLORI.UPDATE
        return (
          <div key={ev.id} style={{
            background: 'var(--app-bg)', borderRadius: 8, padding: '11px 14px',
            border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12
          }}>
            <span style={{
              background: az.bg, color: az.color, borderRadius: 5,
              padding: '2px 8px', fontSize: 11, fontWeight: 700, minWidth: 72, textAlign: 'center'
            }}>{az.label}</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13, flex: 1 }}>
              {ev.tabella_modificata.replace(/_/g, ' ')}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              {formattaDataOra(ev.created_at)}
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
  const { condomini, loading, refetch } = useCondomini()
  const c = useMemo(() => condomini.find(x => x.id === id), [condomini, id])
  const [activeTab, setActiveTab] = useState('panoramica')
  const [saldoConto, setSaldoConto] = useState(null)
  
  // Modal Diagnosi Conformità Fiscale
  const [modalDiagnosiOpen, setModalDiagnosiOpen] = useState(false)
  const [diagnosiResult, setDiagnosiResult] = useState(null)
  const [diagnosiBusy, setDiagnosiBusy] = useState(false)

  const handleAvviaDiagnosiFiscale = async () => {
    if (!c) return
    setDiagnosiBusy(true)
    try {
      const [resFornitori, resUnita, resOccupanti, resFatture, resDeleghe] = await Promise.all([
        supabase.from('fornitori').select('*'),
        supabase.from('unita').select('*').eq('condominio_id', id),
        supabase.from('occupanti_unita').select('*, persona:persona_id(*)'),
        supabase.from('fatture_fornitori').select('*').eq('condominio_id', id),
        supabase.from('f24_deleghe').select('*').eq('condominio_id', id)
      ])

      const resDiagnosi = eseguiDiagnosiConformitaFiscale({
        condominio: c,
        fornitori: resFornitori.data || [],
        unita: resUnita.data || [],
        occupanti: resOccupanti.data || [],
        fatture: resFatture.data || [],
        f24Deleghe: resDeleghe.data || []
      })

      setDiagnosiResult(resDiagnosi)
      setModalDiagnosiOpen(true)
    } catch (err) {
      console.error("Errore diagnosi:", err)
      alert("Errore durante l'esecuzione della diagnosi: " + err.message)
    } finally {
      setDiagnosiBusy(false)
    }
  }

  // Hook centralizzato esercizio con sincronizzazione URL
  const {
    esercizi,
    esercizioAttivo,
    esercizioId,
    setEsercizioId,
    loading: loadingEsercizi
  } = useEsercizioCorrente(id)

  useEffect(() => {
    if (!id) return
    let isMounted = true
    async function fetchSaldoConto() {
      const { data, error } = await supabase
        .from('estratto_conto')
        .select('data_movimento, saldo, importo')
        .eq('condominio_id', id)
        .order('data_movimento', { ascending: false })
      
      if (!isMounted) return

      if (!error && data && data.length > 0) {
        const movConSaldo = data.find(m => m.saldo != null && m.saldo !== '')
        if (movConSaldo) {
          setSaldoConto({
            saldo: Number(movConSaldo.saldo),
            data: movConSaldo.data_movimento,
            fonte: 'estratto'
          })
        } else {
          const totaleNetto = data.reduce((acc, m) => acc + (Number(m.importo) || 0), 0)
          setSaldoConto({
            saldo: (Number(c?.fondo_cassa) || 0) + totaleNetto,
            data: data[0].data_movimento,
            fonte: 'calcolato'
          })
        }
      } else {
        setSaldoConto(null)
      }
    }
    fetchSaldoConto()
    return () => { isMounted = false }
  }, [id, c?.fondo_cassa])

  if (loading) return <div style={S.loading}>Caricamento…</div>
  if (!c)      return <div style={S.loading}>Condominio non trovato</div>

  const dotazioni = DOTAZIONI(c)

  return (
    <div style={S.page}>
      {/* Breadcrumb */}
      <div style={S.breadcrumb}>
        <Link to="/condomini" style={S.breadLink}>Condomini</Link>
        <ChevronRight size={13} color="#475569" style={{ verticalAlign: 'middle', margin: '0 2px' }} />
        <span style={{ color: 'var(--text-secondary)' }}>{c.nome}</span>
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
          <button
            style={{ ...S.btnSuccess, background: '#10b981' }}
            onClick={handleAvviaDiagnosiFiscale}
            disabled={diagnosiBusy}
          >
            <Activity size={15} style={{ marginRight: 6 }} /> {diagnosiBusy ? 'Diagnosi...' : 'Diagnosi Conformità Fiscale'}
          </button>
          <button style={S.btnSuccess} data-tour-target="tab-spese-fatture" onClick={() => navigate(`/condomini/${id}/spese`)}>
            <Receipt size={15} style={{ marginRight: 6 }} /> Spese
          </button>
          <button style={S.btnPrimary} onClick={() => navigate(`/condomini/${id}/anagrafica`)}>
            <Users size={15} style={{ marginRight: 6 }} /> Anagrafica
          </button>
        </div>
      </div>

      {/* Banner Ambiente Demo per Condomini Demo */}
      <DemoCondoBanner condominio={c} onDeleteSuccess={refetch} />

      {/* Barra Esercizio Amministrativo Unificata */}
      <EsercizioSelectorHeader
        esercizi={esercizi}
        esercizioAttivo={esercizioAttivo}
        onSelectEsercizio={setEsercizioId}
        loading={loadingEsercizi}
      />

      {/* KPI */}
      <div style={S.kpiRow}>
        {KPI_ITEMS(c, saldoConto).map(({ icon: Icon, label, value }) => (
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
          const tourTargetMap = {
            anagrafica: 'tab-anagrafica-unita',
            preventivo: 'tab-preventivo-rate',
            consuntivo: 'tab-consuntivo-pdf',
            rate: 'tab-preventivo-rate',
            comunicazioni: 'btn-solleciti-massivi',
            verbali: 'tab-verbali-assemblea',
            finanze: 'tab-estratto-conto'
          }
          return (
            <button
              key={tid}
              data-tour-target={tourTargetMap[tid]}
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
            <div style={S.section}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ ...S.sectionTitle, margin: 0 }}>Fondo Cassa & Conto Corrente</p>
                <Link to={`/condomini/${c.id}/estratto-conto${esercizioId ? `?esercizio=${esercizioId}` : ''}`} style={{ color: '#60a5fa', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
                  Vai all'estratto conto →
                </Link>
              </div>
              <div style={S.infoGrid}>
                <div style={S.infoItem}>
                  <span style={S.infoLabel}>Fondo cassa (Iniziale / Bilancio)</span>
                  <span style={S.infoValue}>
                    {c.fondo_cassa ? `€ ${Number(c.fondo_cassa).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : 'Non specificato'}
                  </span>
                </div>
                <div style={S.infoItem}>
                  <span style={S.infoLabel}>Saldo Finale Conto (Estratto Conto)</span>
                  <span style={{ ...S.infoValue, color: saldoConto ? '#38bdf8' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {saldoConto ? (
                      <>
                        <span style={{ fontWeight: 700 }}>€ {Number(saldoConto.saldo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
                          (al {formattaData(saldoConto.data)})
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: 13 }}>Nessun movimento registrato</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

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
                      {formattaData(c.data_inizio_amministrazione)}
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
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{c.note}</p>
              </div>
            )}

            <PassaggioConsegneSection condominioId={c.id} condominio={c} />
          </>
        )}

        {activeTab === 'anagrafica' && <AnagraficaCondominioTab condominioId={c.id} condominio={c} />}
        {activeTab === 'preventivo' && <PreventivoSection condominioId={c.id} esercizioId={esercizioId} esercizioAttivo={esercizioAttivo} onSelectEsercizio={setEsercizioId} />}

        {activeTab === 'rate' && <RateGridTab condominioId={c.id} esercizioId={esercizioId} esercizioAttivo={esercizioAttivo} onSelectEsercizio={setEsercizioId} />}

        {activeTab === 'comunicazioni' && <ComunicazioniTab condominioId={c.id} />}

        {activeTab === 'verbali' && <VerbaliAssembleaTab condominioId={c.id} />}

        {activeTab === 'sinistri' && <SinistriTab condominioId={c.id} />}

        {activeTab === 'finanze' && <FinanzeTab condominioId={c.id} esercizioId={esercizioId} />}

        {activeTab === 'documenti' && <DocumentiCondominio condominioId={c.id} />}

        {activeTab === 'storico' && <StoricoTab condominioId={c.id} />}
        {activeTab === 'consuntivo' && <ConsuntivoTab condominioId={c.id} esercizioId={esercizioId} esercizioAttivo={esercizioAttivo} onSelectEsercizio={setEsercizioId} />}
      </div>

      {/* MODALE DIAGNOSI CONFORMITÀ FISCALE */}
      <DiagnosiFiscaleModal
        isOpen={modalDiagnosiOpen}
        onClose={() => setModalDiagnosiOpen(false)}
        condominioNome={c?.nome}
        diagnosiResult={diagnosiResult}
      />
    </div>
  )
}

const S = {
  page:        { padding: '28px 32px', minHeight: '100vh', fontFamily: 'Sora, sans-serif' },
  loading:     { color: 'var(--text-muted)', textAlign: 'center', padding: '80px', fontFamily: 'Sora, sans-serif' },
  breadcrumb:  { fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 },
  breadLink:   { color: '#3b82f6', textDecoration: 'none' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 },
  headerLeft:  { display: 'flex', gap: 16, alignItems: 'flex-start' },
  bigIcon:     { width: 52, height: 52, borderRadius: 12, background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:       { color: 'var(--text-primary)', fontSize: 24, fontWeight: 700, margin: '0 0 4px' },
  addr:        { color: 'var(--text-muted)', fontSize: 14, margin: '0 0 2px' },
  cf:          { color: 'var(--text-muted)', fontSize: 12, margin: 0 },
  headerActions: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  kpiRow:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 14, marginBottom: 20 },
  kpiCard:     { background: 'var(--card-bg)', borderRadius: 12, padding: '16px', display: 'flex', gap: 12, alignItems: 'center', border: '1px solid var(--border-color)' },
  kpiIconWrap: { width: 36, height: 36, borderRadius: 8, background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  kpiValue:    { color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 },
  kpiLabel:    { color: 'var(--text-muted)', fontSize: 11 },
  tabBar:      { display: 'flex', gap: 2, borderBottom: '1px solid var(--border-color)', marginBottom: 20, flexWrap: 'wrap' },
  tabBtn:      { padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', borderRadius: '8px 8px 0 0', fontFamily: 'Sora, sans-serif', transition: 'all 0.15s', display: 'flex', alignItems: 'center' },
  tabContent:  {},
  section:     { background: 'var(--card-bg)', borderRadius: 12, padding: '20px 24px', marginBottom: 14, border: '1px solid var(--border-color)' },
  sectionTitle:{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' },
  featureBadge:{ background: 'var(--app-bg)', color: '#60a5fa', fontSize: 13, padding: '6px 14px', borderRadius: 8, border: '1px solid #1e3a5f', display: 'inline-flex', alignItems: 'center' },
  infoGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 14 },
  infoItem:    { display: 'flex', flexDirection: 'column', gap: 4 },
  infoLabel:   { color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  infoValue:   { color: 'var(--text-primary)', fontSize: 15, fontWeight: 500 },
  btnPrimary:  { background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', display: 'flex', alignItems: 'center' },
  btnSuccess:  { background: '#059669', color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', display: 'flex', alignItems: 'center' },
  btnSecondary:{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'Sora, sans-serif', display: 'flex', alignItems: 'center' },
  // ── Tab Finanze ──
  finCard:     { background: 'var(--card-bg)', borderRadius: 12, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'center', border: '1px solid var(--border-color)', cursor: 'pointer', fontFamily: 'Sora, sans-serif', textAlign: 'left', transition: 'border-color 0.15s' },
  finIconWrap: { width: 40, height: 40, borderRadius: 10, background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  finLabel:    { color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 },
  finDesc:     { color: 'var(--text-muted)', fontSize: 12, marginTop: 2 },
}
