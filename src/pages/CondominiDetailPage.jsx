// src/pages/CondominiDetailPage.jsx
import ConsuntivoTab from '../components/ConsuntivoTab'
import { FileBarChart } from 'lucide-react'   // se non già importato un'icona; in alternativa riusa Wallet/FileText
import RateGridTab from '../components/RateGridTab'
import PreventivoSection from '../components/PreventivoSection'
import WizardChiusuraEsercizio from '../components/WizardChiusuraEsercizio'
import CondominiForm from '../components/CondominiForm'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
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
  Mail, FileSignature, ShieldAlert, ShieldCheck, Activity
} from 'lucide-react'
import AssembleeTab from '../components/AssembleeTab'
import ModaleServiziTelematici from '../components/ModaleServiziTelematici'
import { eseguiDiagnosiConformitaFiscale } from '../lib/diagnosiFiscaleEngine'
import DiagnosiFiscaleModal from '../components/DiagnosiFiscaleModal'
import { useEsercizioCorrente } from '../hooks/useEsercizioCorrente'
import EsercizioSelectorHeader from '../components/EsercizioSelectorHeader'
import DemoCondoBanner from '../components/DemoCondoBanner'
import { useMasterclass } from '../hooks/useMasterclass'

// ── Helper date sicure ──────────────────────────────────────
import { formattaData, formattaDataOra } from '../lib/formatters'

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
  { icon: CalendarDays,  label: 'Anno costruzione',      value: c.anno_costruzione || '—' },
]

const DOTAZIONI = (c) => [
  c.presenza_ascensore  && { icon: MoveVertical,    label: 'Ascensore' },
  c.presenza_giardino   && { icon: Trees,           label: 'Giardino' },
  c.presenza_parcheggio && { icon: ParkingCircle,   label: 'Box' },
  c.presenza_portiere   && { icon: UserCheck,       label: 'Portiere' },
].filter(Boolean)

const MACRO_GROUPS = [
  { 
    id: 'gestione', 
    label: 'Gestione', 
    icon: Building2, 
    color: '#3b82f6', // Blue
    tabs: [
      { id: 'panoramica', label: 'Panoramica', icon: LayoutGrid },
      { id: 'anagrafica', label: 'Anagrafica & Unità', icon: Users },
      { id: 'sinistri',   label: 'Sinistri',           icon: ShieldAlert },
    ]
  },
  { 
    id: 'contabilita', 
    label: 'Contabilità', 
    icon: Wallet, 
    color: '#10b981', // Emerald
    tabs: [
      { id: 'finanze',    label: 'Gestione Finanze', icon: Wallet },
      { id: 'preventivo', label: 'Preventivo & Saldi', icon: ClipboardList },
      { id: 'consuntivo', label: 'Consuntivo', icon: FileText },
      { id: 'rate',       label: 'Rate',       icon: CreditCard },
    ]
  },
  { 
    id: 'documenti', 
    label: 'Documenti', 
    icon: FileText, 
    color: '#8b5cf6', // Violet
    tabs: [
      { id: 'documenti',  label: 'Archivio Documenti', icon: FileText },
      { id: 'verbali',    label: 'Verbali Assemblea',  icon: FileSignature },
    ]
  },
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
  const [activeGroup, setActiveGroup] = useState('gestione')
  const [activeTab, setActiveTab] = useState('panoramica')
  const [saldoConto, setSaldoConto] = useState(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  
  // Modal Diagnosi Conformità Fiscale
  const [modalDiagnosiOpen, setModalDiagnosiOpen] = useState(false)
  const [diagnosiResult, setDiagnosiResult] = useState(null)
  const [diagnosiBusy, setDiagnosiBusy] = useState(false)
  
  const [modalPrivacyOpen, setModalPrivacyOpen] = useState(false)
  const { spotlightTarget } = useMasterclass()

  useEffect(() => {
    if (spotlightTarget) {
      if (['tab-anagrafica-unita', 'btn-solleciti-massivi'].includes(spotlightTarget)) setActiveGroup('gestione')
      if (['tab-preventivo-rate', 'tab-consuntivo-pdf', 'tab-estratto-conto'].includes(spotlightTarget)) setActiveGroup('contabilita')
      if (['tab-verbali-assemblea'].includes(spotlightTarget)) setActiveGroup('documenti')
    }
  }, [spotlightTarget])

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
      // 1. Cerca il documento attivo dell'estratto conto con metadata
      const { data: docData } = await supabase
        .from('documenti_condominio')
        .select('note')
        .eq('condominio_id', id)
        .eq('tipo', 'estratto_conto')
        .maybeSingle()

      let saldoDaDoc = null
      let dataSaldoDaDoc = null

      if (docData?.note) {
        try {
          const parsed = JSON.parse(docData.note)
          if (parsed?.saldo_finale != null) {
            saldoDaDoc = Number(parsed.saldo_finale)
            dataSaldoDaDoc = parsed.data_saldo_finale || parsed.al
          }
        } catch (err) {
          console.warn('Errore parsing note JSON in estratto_conto:', err)
        }
      }

      // 2. Movimenti estratto conto
      const { data, error } = await supabase
        .from('estratto_conto')
        .select('data_movimento, saldo, importo')
        .eq('condominio_id', id)
        .order('data_movimento', { ascending: false })
      
      if (!isMounted) return

      if (saldoDaDoc != null) {
        setSaldoConto({
          saldo: saldoDaDoc,
          data: dataSaldoDaDoc || (data?.[0]?.data_movimento),
          fonte: 'estratto'
        })
      } else if (!error && data && data.length > 0) {
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
      {/* Modale Storico */}
      {activeTab === 'storico_modal' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card-bg)', width: 600, maxHeight: '80vh', borderRadius: 12, overflow: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Storico Modifiche</h3>
              <button onClick={() => setActiveTab('panoramica')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>Chiudi</button>
            </div>
            <StoricoTab condominioId={c.id} />
          </div>
        </div>
      )}

      {/* Testata: Info Base */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Link to="/condomini" style={{
              color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6,
              textDecoration: 'none', fontSize: 13, fontWeight: 500, padding: '4px 10px',
              borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--app-bg)'
            }}>
              <ArrowLeft size={16} /> Torna all'elenco
            </Link>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={14} /> Condominio
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            {c.nome}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            {c.indirizzo} — {c.comune} {c.cap && `(${c.cap})`} {c.provincia}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={() => setActiveTab('storico_modal')} style={{ background: 'var(--app-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }} title="Vedi Storico Operazioni">
            <FolderClock size={16} />
          </button>
          
          <button 
            onClick={handleAvviaDiagnosiFiscale}
            disabled={diagnosiBusy}
            style={{
              background: '#047857', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(4,120,87,0.2)', transition: 'all 0.2s', opacity: diagnosiBusy ? 0.7 : 1
            }}
          >
            {diagnosiBusy ? <Activity size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            Diagnosi Fiscale
          </button>
          <button 
            onClick={() => setIsEditModalOpen(true)}
            style={{
              background: 'var(--app-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)',
              padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Modifica
          </button>
        </div>
      </div>

      {/* Banner Ambiente Demo per Condomini Demo */}
      <DemoCondoBanner condominio={c} onDeleteSuccess={refetch} />

      {/* Barra Esercizio */}
      <div style={{ marginBottom: 24 }}>
        <EsercizioSelectorHeader 
          condominioId={c.id} 
          esercizioCorrenteId={esercizioId} 
          esercizi={esercizi} 
          onSelect={setEsercizioId}
          loading={loadingEsercizi} 
        />
        
        {/* WIZARD CHIUSURA ESERCIZIO */}
        {esercizioAttivo && (
          <div style={{ marginTop: 16 }}>
            <WizardChiusuraEsercizio 
              condominioId={c.id} 
              esercizio={esercizioAttivo} 
              onNavigateToConsuntivo={() => {
                setActiveGroup('contabilita')
                setActiveTab('consuntivo')
              }}
            />
          </div>
        )}
      </div>




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

      {/* Macro Groups Tab Bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {MACRO_GROUPS.map(group => {
          const isActiveGroup = activeGroup === group.id
          const GroupIcon = group.icon
          const color = group.color
          return (
            <button
              key={group.id}
              onClick={() => {
                setActiveGroup(group.id)
                setActiveTab(group.tabs[0].id) // Seleziona il primo tab del gruppo
              }}
              style={{
                flex: '1 1 200px',
                background: isActiveGroup ? `${color}15` : 'var(--card-bg)', // Hex alpha per background leggero
                color: isActiveGroup ? color : 'var(--text-secondary)',
                border: '2px solid',
                borderColor: isActiveGroup ? color : 'var(--border-color)',
                borderRadius: 16,
                padding: '20px 16px',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isActiveGroup ? `0 8px 24px ${color}25` : '0 2px 4px rgba(0,0,0,0.02)',
                transform: isActiveGroup ? 'translateY(-2px)' : 'none'
              }}
            >
              <GroupIcon size={28} style={{ color: isActiveGroup ? color : 'var(--text-muted)', transition: 'all 0.2s' }} />
              {group.label}
            </button>
          )
        })}
      </div>

      {/* Sub Tab Bar (relativa al macro-gruppo attivo) */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {MACRO_GROUPS.find(g => g.id === activeGroup)?.tabs.map(({ id: tid, label, icon: Icon }) => {
          const active = activeTab === tid
          const tourTargetMap = {
            anagrafica: 'tab-anagrafica-unita',
            preventivo: 'tab-preventivo-rate',
            rate: 'tab-preventivo-rate',
            verbali: 'tab-verbali-assemblea',
            sinistri: 'tab-sinistri',
            finanze: 'tab-estratto-conto'
          }
          return (
            <button
              key={tid}
              data-tour-target={tourTargetMap[tid]}
              onClick={() => setActiveTab(tid)}
              style={{
                ...S.tabBtn,
                background: active ? 'var(--accent, #2563eb)' : 'var(--card-bg)',
                color: active ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: active ? 'var(--accent, #2563eb)' : 'var(--border-color)',
                borderRadius: 8,
                boxShadow: active ? '0 4px 6px -1px rgba(37, 99, 235, 0.2)' : 'none'
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

            <div style={S.section}>
              <p style={S.sectionTitle}>Servizi Aggiuntivi</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid var(--border-color)', borderRadius: 10, background: 'var(--app-bg)', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ padding: 10, borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)' }}>
                    <ShieldCheck size={24} color="#10b981" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>Conservazione Fiscale & Privacy GDPR</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Adempimento documentale Art. 1130 c.c.</div>
                  </div>
                </div>
                <button style={{ ...S.btnSuccess, background: '#10b981' }} onClick={() => setModalPrivacyOpen(true)}>
                  <ShieldCheck size={16} style={{ marginRight: 6 }} /> Gestisci Servizio
                </button>
              </div>
            </div>

            <PassaggioConsegneSection condominioId={c.id} condominio={c} />
          </>
        )}

        {activeTab === 'anagrafica' && <AnagraficaCondominioTab condominioId={c.id} condominio={c} />}
        {activeTab === 'preventivo' && <PreventivoSection condominioId={c.id} esercizioId={esercizioId} esercizioAttivo={esercizioAttivo} onSelectEsercizio={setEsercizioId} />}

        {activeTab === 'consuntivo' && <ConsuntivoTab condominioId={c.id} esercizioId={esercizioId} esercizioAttivo={esercizioAttivo} onSelectEsercizio={setEsercizioId} />}

        {activeTab === 'rate' && <RateGridTab condominioId={c.id} esercizioId={esercizioId} esercizioAttivo={esercizioAttivo} onSelectEsercizio={setEsercizioId} />}

        {activeTab === 'verbali' && <AssembleeTab condominioId={c.id} />}

        {activeTab === 'sinistri' && <SinistriTab condominioId={c.id} />}

        {activeTab === 'finanze' && <FinanzeTab condominioId={c.id} esercizioId={esercizioId} />}

        {activeTab === 'documenti' && <DocumentiCondominio condominioId={c.id} />}
      </div>

      {/* MODALE DIAGNOSI CONFORMITÀ FISCALE */}
      <DiagnosiFiscaleModal
        isOpen={modalDiagnosiOpen}
        onClose={() => setModalDiagnosiOpen(false)}
        condominioNome={c?.nome}
        diagnosiResult={diagnosiResult}
      />

      <ModaleServiziTelematici
        isOpen={modalPrivacyOpen}
        onClose={() => setModalPrivacyOpen(false)}
        condominio={c}
      />

      {isEditModalOpen && (
        <CondominiForm 
          condominio={c} 
          onClose={() => setIsEditModalOpen(false)} 
          onSave={() => {
            refetch()
            setIsEditModalOpen(false)
          }} 
        />
      )}
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
  tabBtn:      { padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', transition: 'all 0.15s', display: 'flex', alignItems: 'center' },
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
