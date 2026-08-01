import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCondomini } from '../hooks/useCondomini'
import { usePlan } from '../hooks/usePlan'
import { supabase } from '../lib/supabaseClient'
import OnboardingChecklist from '../components/OnboardingChecklist'
import GuidaRapidaModal from '../components/GuidaRapidaModal'
import OnboardingTourModal from '../components/OnboardingTourModal'
import InteractiveOnboarding from '../components/InteractiveOnboarding'
import ScadenzarioWidget from '../components/ScadenzarioWidget'
import {
  Building2,
  CheckCircle2,
  Home,
  Calendar,
  Clock,
  Link2,
  ArrowRight,
  Receipt,
  ShieldAlert,
  ChevronRight,
  MessageSquare,
  User,
  Inbox
} from 'lucide-react'

// Funzione helper per formattare gli importi in Euro
function formattaValuta(valore) {
  if (valore === undefined || valore === null || isNaN(valore)) return '€ 0,00'
  return `€ ${parseFloat(valore).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Funzione helper per formattare la data in italiano
function formattaData(dataInput) {
  if (!dataInput) return 'N/D'
  try {
    const d = new Date(dataInput)
    if (isNaN(d.getTime())) return 'N/D'
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return 'N/D'
  }
}

// Mesi in italiano per F24
const MESI_IT = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { condomini, loading: loadingCondo, refetch } = useCondomini()
  const { canUse, piano, isTrialActive } = usePlan()

  const [loadingStats, setLoadingStats] = useState(true)
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth > 1024)
  const generatingDemoRef = useRef(false)
  const [showTourModal, setShowTourModal] = useState(false)
  const [showGuidaModal, setShowGuidaModal] = useState(false)

  const [stats, setStats] = useState({
    insolutiTotali: 0,
    rateScaduteCount: 0,
    movimentiDaRiconciliare: 0,
    fattureAttesaCount: 0,
    fattureAttesaImporto: 0,
    f24Scadenze: [],
    eserciziInScadenza: [],
    movimentiNonRiconciliatiAlerts: [],
    condoData: {}, 
    inboxCount: 0,
    inboxSpeseCount: 0,
    inboxSubentriCount: 0,
    inboxMessaggiCount: 0,
    inboxItems: []
  })

  // Gestione responsive
  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth > 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!user) return
    let isMounted = true

    async function fetchDashboardStats() {
      if (!isMounted) return
      setLoadingStats(true)
      try {
        const oggi = new Date()
        oggi.setHours(0, 0, 0, 0)

        // 1. Carica rate_unita non pagate (con join su rate per data_scadenza)
        const { data: rateData, error: errRate } = await supabase
          .from('rate_unita')
          .select(`
            id, 
            importo, 
            importo_pagato, 
            condominio_id,
            rate:rata_id(data_scadenza)
          `)
          .neq('stato', 'pagata')

        if (errRate) throw errRate

        // 2. Carica estratto conto non riconciliato
        const { data: movData, error: errMov } = await supabase
          .from('estratto_conto')
          .select('id, condominio_id, importo, data_movimento')
          .eq('riconciliato', false)

        if (errMov) throw errMov

        // 3. Carica fatture fornitori
        const { data: fatData, error: errFat } = await supabase
          .from('fatture_fornitori')
          .select('id, condominio_id, importo_totale, stato, ritenuta_acconto, data_pagamento, ritenuta_pagata, fornitore')

        if (errFat) throw errFat

        // 4. Carica saldi cassa (ordinati per data_movimento decrescente per prendere il più recente)
        const { data: saldoData, error: errSaldo } = await supabase
          .from('estratto_conto')
          .select('condominio_id, saldo, data_movimento')
          .not('saldo', 'is', null)
          .order('data_movimento', { ascending: false })

        if (errSaldo) throw errSaldo

        // 5. Carica esercizi per allerta scadenze
        const { data: esData, error: errEs } = await supabase
          .from('esercizi')
          .select('id, condominio_id, anno, data_fine')
          .not('data_fine', 'is', null)

        if (errEs) throw errEs

        // 5b. Carica documenti inbox pendenti
        const { data: inboxData, error: errInbox } = await supabase
          .from('inbox_documenti')
          .select('id, file_name, email_mittente, data_ricezione, condominio_id, stato, dati_estratti, tipo')
          .in('stato', ['nuovo', 'rilevato', 'da_smistare', 'elaborato'])

        if (errInbox) throw errInbox

        // --- ELABORAZIONE DATI ---
        const condoMap = {}
        const initCondo = (cid) => {
          if (!condoMap[cid]) {
            condoMap[cid] = {
              insoluti: 0,
              movimenti: 0,
              fatture: 0,
              saldo: null
            }
          }
        }

        // Ultimo saldo cassa registrato per condominio
        ;(saldoData || []).forEach(s => {
          if (s.condominio_id) {
            initCondo(s.condominio_id)
            if (condoMap[s.condominio_id].saldo === null) {
              condoMap[s.condominio_id].saldo = parseFloat(s.saldo || 0)
            }
          }
        })

        // Rate Scadute (Insoluti)
        let insolutiTotali = 0
        let rateScaduteCount = 0
        ;(rateData || []).forEach(ru => {
          const scadenzaStr = ru.rate?.data_scadenza
          if (!scadenzaStr) return
          const scad = new Date(scadenzaStr)
          if (scad < oggi) {
            const dovuto = parseFloat(ru.importo || 0)
            const pagato = parseFloat(ru.importo_pagato || 0)
            const residuo = dovuto - pagato
            if (residuo > 0) {
              insolutiTotali += residuo
              rateScaduteCount++
              initCondo(ru.condominio_id)
              condoMap[ru.condominio_id].insoluti += residuo
            }
          }
        })

        // Movimenti non riconciliati
        let movimentiDaRiconciliare = 0
        const movimentiPerCondominio = {}
        ;(movData || []).forEach(m => {
          movimentiDaRiconciliare++
          if (m.condominio_id) {
            initCondo(m.condominio_id)
            condoMap[m.condominio_id].movimenti++

            if (m.data_movimento) {
              const dataMov = new Date(m.data_movimento)
              const diffGiorni = Math.floor((oggi - dataMov) / (1000 * 60 * 60 * 24))
              if (diffGiorni >= 15) {
                if (!movimentiPerCondominio[m.condominio_id]) {
                  movimentiPerCondominio[m.condominio_id] = 0
                }
                movimentiPerCondominio[m.condominio_id]++
              }
            }
          }
        })

        // Fatture in attesa
        let fattureAttesaCount = 0
        let fattureAttesaImporto = 0
        ;(fatData || []).forEach(f => {
          if (f.stato === 'attesa') {
            const imp = parseFloat(f.importo_totale || 0)
            fattureAttesaCount++
            fattureAttesaImporto += imp
            if (f.condominio_id) {
              initCondo(f.condominio_id)
              condoMap[f.condominio_id].fatture += imp
            }
          }
        })

        // Calcolo Scadenze F24 (fatture pagate nel mese precedente con ritenuta e F24 non presentato)
        const meseCorrente = oggi.getMonth()
        const annoCorrente = oggi.getFullYear()
        const mesePrecedente = meseCorrente === 0 ? 11 : meseCorrente - 1
        const annoPrecedente = meseCorrente === 0 ? annoCorrente - 1 : annoCorrente

        const f24Pendenti = (fatData || []).filter(f => {
          if (!f.ritenuta_acconto || parseFloat(f.ritenuta_acconto) <= 0) return false
          if (f.ritenuta_pagata === true) return false
          if (f.stato !== 'pagata') return false

          const dataPag = f.data_pagamento ? new Date(f.data_pagamento) : null
          if (!dataPag || isNaN(dataPag)) return false
          return dataPag.getMonth() === mesePrecedente && dataPag.getFullYear() === annoPrecedente
        })

        const perCondominioF24 = {}
        f24Pendenti.forEach(f => {
          const cid = f.condominio_id
          if (cid) {
            if (!perCondominioF24[cid]) {
              perCondominioF24[cid] = { count: 0, totale: 0 }
            }
            perCondominioF24[cid].count++
            perCondominioF24[cid].totale += parseFloat(f.ritenuta_acconto || 0)
          }
        })

        const f24ScadenzeList = Object.entries(perCondominioF24).map(([cid, data]) => {
          const scadenzaGiorno = 16
          const scadenzaData = new Date(annoCorrente, meseCorrente, scadenzaGiorno)
          const scaduto = oggi > scadenzaData
          return {
            id: `f24_${cid}_${annoPrecedente}_${mesePrecedente}`,
            condominioId: cid,
            count: data.count,
            totale: data.totale,
            scaduto,
            dataLimite: scadenzaData
          }
        })

        // Esercizi in scadenza (prossimi 30 giorni)
        const eserciziInScadenzaList = (esData || [])
          .filter(e => {
            const fine = new Date(e.data_fine)
            const diffGiorni = Math.floor((fine - oggi) / (1000 * 60 * 60 * 24))
            return diffGiorni >= 0 && diffGiorni <= 30
          })
          .map(e => {
            const fine = new Date(e.data_fine)
            const diffGiorni = Math.floor((fine - oggi) / (1000 * 60 * 60 * 24))
            return {
              id: e.id,
              condominioId: e.condominio_id,
              anno: e.anno,
              giorniRimasti: diffGiorni,
              dataFine: fine
            }
          })

        // Movimenti non riconciliati alert (più vecchi di 15 giorni)
        const movimentiNonRiconciliatiAlertsList = Object.entries(movimentiPerCondominio).map(([cid, count]) => {
          return {
            condominioId: cid,
            count
          }
        })

        let inboxSpeseCount = 0
        let inboxSubentriCount = 0
        let inboxMessaggiCount = 0

        const activeInbox = (inboxData || []).filter(item => {
          if (item.tipo === 'subentro') return item.stato !== 'conguagliato'
          if (item.tipo === 'messaggio') return item.stato !== 'elaborato'
          return item.stato !== 'inserito'
        })

        activeInbox.forEach(item => {
          if (item.tipo === 'subentro') inboxSubentriCount++
          else if (item.tipo === 'messaggio') inboxMessaggiCount++
          else inboxSpeseCount++
        })

        if (!isMounted) return
        setStats({
          insolutiTotali,
          rateScaduteCount,
          movimentiDaRiconciliare,
          fattureAttesaCount,
          fattureAttesaImporto,
          f24Scadenze: f24ScadenzeList,
          eserciziInScadenza: eserciziInScadenzaList,
          movimentiNonRiconciliatiAlerts: movimentiNonRiconciliatiAlertsList,
          condoData: condoMap,
          inboxCount: activeInbox.length,
          inboxSpeseCount,
          inboxSubentriCount,
          inboxMessaggiCount,
          inboxItems: activeInbox
        })
      } catch (err) {
        console.error("Errore caricamento statistiche dashboard:", err)
        toast.error('Errore nel caricamento della dashboard')
      } finally {
        if (isMounted) setLoadingStats(false)
      }
    }

    fetchDashboardStats()
    return () => { isMounted = false }
  }, [user])

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Amministratore'
  const attivi = condomini.filter(c => c.stato === 'attiva' || c.stato === 'attivo').length
  const archiviati = condomini.filter(c => c.stato === 'archiviato').length

  // Calcola se ci sono alert totali
  const haAlert = stats.f24Scadenze.length > 0 || stats.eserciziInScadenza.length > 0 || stats.movimentiNonRiconciliatiAlerts.length > 0

  if (loadingCondo || loadingStats) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Sora, sans-serif' }}>
        Caricamento dashboard studio in corso...
      </div>
    )
  }

  if (condomini.length === 0) {
    return <InteractiveOnboarding onComplete={() => refetch?.()} />
  }

  return (
    <div style={styles.page}>
      {/* Testata */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dashboard Studio</h1>
          <p style={styles.subtitle}>
            Bentornato, <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{userName}</span> · {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Onboarding Trial Checklist */}
      {(piano === 'trial' || isTrialActive) && (
        <OnboardingChecklist 
          condomini={condomini}
          stats={{
            fattureCount: stats.fattureAttesaCount,
            speseCount: stats.inboxSpeseCount,
            movimentiCount: stats.movimentiDaRiconciliare,
            riconciliatiCount: stats.movimentiNonRiconciliatiAlerts.length,
            consuntiviGen: 1,
            sollecitiCount: stats.rateScaduteCount
          }}
          onStartTour={() => setShowTourModal(true)}
          onOpenGuida={() => setShowGuidaModal(true)}
        />
      )}

      {/* Postbox Alert Banner */}
      {canUse('postbox_studio') && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.06) 0%, rgba(139, 92, 246, 0.1) 100%)',
          border: '1px solid var(--border-color)',
          borderRadius: 16,
          padding: '20px 24px',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 4px 15px -3px rgba(124, 58, 237, 0.03)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <h4 style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Inbox size={18} color="#7c3aed" /> Postbox Studio 
                <span style={{ 
                  fontSize: 11, 
                  background: stats.inboxCount > 0 ? '#7c3aed' : 'var(--border-color)', 
                  color: stats.inboxCount > 0 ? '#fff' : 'var(--text-secondary)', 
                  padding: '2px 8px', 
                  borderRadius: 12, 
                  fontWeight: 700 
                }}>
                  {stats.inboxCount} {stats.inboxCount === 1 ? 'pratica da elaborare' : 'pratiche da elaborare'}
                </span>
              </h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12.5 }}>
                {stats.inboxCount > 0 
                  ? "L'AI ha pre-elaborato i documenti in arrivo via email. Convalida o gestisci ciascuna pratica:"
                  : "Tutti i documenti e le email in ingresso sono stati convalidati con successo. Ottimo lavoro!"
                }
              </p>
            </div>
            
            {/* Contatori in linea */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)', background: 'var(--app-bg)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <Receipt size={14} style={{ color: '#a78bfa' }} />
                <span>Spese & Fatture: <strong>{stats.inboxSpeseCount}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)', background: 'var(--app-bg)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <User size={14} style={{ color: '#60a5fa' }} />
                <span>Subentri & Anagrafiche: <strong>{stats.inboxSubentriCount}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)', background: 'var(--app-bg)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <MessageSquare size={14} style={{ color: '#34d399' }} />
                <span>Messaggi & Segnalazioni: <strong>{stats.inboxMessaggiCount}</strong></span>
              </div>
            </div>
          </div>
          
          <Link to="/postbox" style={{
            background: '#7c3aed',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            fontSize: 13,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'background-color 0.15s',
            boxShadow: '0 4px 10px rgba(124, 58, 237, 0.15)'
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#6d28d9'}
            onMouseLeave={e => e.currentTarget.style.background = '#7c3aed'}
          >
            Apri Postbox <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* KPI Principali */}
      <div style={styles.kpiGrid}>
        <div style={{ ...styles.kpiCard, borderLeft: '4px solid #3b82f6' }}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiTitle}>Condomini Gestiti</span>
            <Building2 size={20} style={{ color: '#3b82f6' }} />
          </div>
          <div style={styles.kpiValue}>{condomini.length}</div>
          <div style={styles.kpiSub}>
            {attivi} attivi · {archiviati} archiviati
          </div>
        </div>

        <div style={{ ...styles.kpiCard, borderLeft: '4px solid #ef4444' }}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiTitle}>Morosità Totale</span>
            <ShieldAlert size={20} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ ...styles.kpiValue, color: '#ef4444' }}>{formattaValuta(stats.insolutiTotali)}</div>
          <div style={styles.kpiSub}>
            {stats.rateScaduteCount} rate scadute da riscuotere
          </div>
        </div>

        <div style={{ ...styles.kpiCard, borderLeft: '4px solid #8b5cf6' }}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiTitle}>Riconciliazioni Pendenti</span>
            <Link2 size={20} style={{ color: '#8b5cf6' }} />
          </div>
          <div style={{ ...styles.kpiValue, color: '#8b5cf6' }}>{stats.movimentiDaRiconciliare}</div>
          <div style={styles.kpiSub}>
            Movimenti e-c bank da abbinare
          </div>
        </div>

        <div style={{ ...styles.kpiCard, borderLeft: '4px solid #f59e0b' }}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiTitle}>Fatture da Pagare</span>
            <Receipt size={20} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ ...styles.kpiValue, color: '#f59e0b' }}>{formattaValuta(stats.fattureAttesaImporto)}</div>
          <div style={styles.kpiSub}>
            {stats.fattureAttesaCount} ditte in attesa di saldo
          </div>
        </div>
      </div>

      {/* Due Colonne */}
      <div style={{
        ...styles.twoCol,
        gridTemplateColumns: isLargeScreen ? '2fr 1fr' : '1fr'
      }}>
        {/* Colonna Sinistra: Tabella Condomini */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Riepilogo Condomini</h3>
            <span style={styles.badge}>{condomini.length} fabbricati</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={styles.th}>Condominio</th>
                  <th style={styles.th}>Unità</th>
                  <th style={styles.th}>Saldo Banca</th>
                  <th style={styles.th}>Insoluti</th>
                  <th style={styles.th}>Fatture Pendenti</th>
                  <th style={styles.th}>Da Ric.</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Azione</th>
                </tr>
              </thead>
              <tbody>
                {condomini.map(c => {
                  const condoStats = stats.condoData[c.id] || { insoluti: 0, movimenti: 0, fatture: 0, saldo: null }
                  return (
                    <tr key={c.id} style={styles.tr}>
                      <td style={{ ...styles.td, fontWeight: 600 }}>
                        <Link to={`/condomini/${c.id}`} style={styles.condoLink}>
                          {c.nome}
                        </Link>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Home size={14} style={{ color: 'var(--text-secondary)' }} />
                          {c.num_unita || 0}
                        </div>
                      </td>
                      <td style={{
                        ...styles.td,
                        fontWeight: 500,
                        color: condoStats.saldo === null ? 'var(--text-muted)' : condoStats.saldo >= 0 ? '#16a34a' : '#ef4444'
                      }}>
                        {condoStats.saldo === null ? 'N/D' : formattaValuta(condoStats.saldo)}
                      </td>
                      <td style={{ ...styles.td, color: condoStats.insoluti > 0 ? '#ef4444' : 'var(--text-primary)' }}>
                        {condoStats.insoluti > 0 ? formattaValuta(condoStats.insoluti) : '—'}
                      </td>
                      <td style={{ ...styles.td, color: condoStats.fatture > 0 ? '#f59e0b' : 'var(--text-primary)' }}>
                        {condoStats.fatture > 0 ? formattaValuta(condoStats.fatture) : '—'}
                      </td>
                      <td style={styles.td}>
                        {condoStats.movimenti > 0 ? (
                          <span style={styles.ricTag}>
                            {condoStats.movimenti}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <Link to={`/condomini/${c.id}`} style={styles.btnAction}>
                          Gestisci <ChevronRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
                {condomini.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                      Non hai ancora inserito alcun condominio. Clicca su "Nuovo Condominio" nella barra laterale per iniziare.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Colonna Destra: Scadenzario e Urgenze */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ScadenzarioWidget compact={true} onNavigate={(path) => navigate(path)} />

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Scadenze & Urgenze</h3>
            </div>

          <div style={styles.alertsContainer}>
            {/* F24 Ritenute */}
            {stats.f24Scadenze.map(f => {
              const condoNome = condomini.find(c => c.id === f.condominioId)?.nome || 'Condominio'
              const meseOggi = new Date().getMonth()
              return (
                <div key={f.id} style={{ ...styles.alertBox, borderColor: f.scaduto ? '#ef4444' : '#f59e0b', background: 'var(--app-bg)' }}>
                  <div style={styles.alertHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={16} style={{ color: f.scaduto ? '#ef4444' : '#f59e0b' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: f.scaduto ? '#ef4444' : '#f59e0b' }}>
                        {f.scaduto ? 'F24 SCADUTO' : 'Scadenza F24'}
                      </span>
                    </div>
                    {f.scaduto && <span style={styles.badgeScaduto}>In ritardo</span>}
                  </div>
                  <p style={styles.alertMsg}>
                    {condoNome}: {f.count} ritenut{f.count === 1 ? 'a' : 'e'} da versare per un totale di <span style={{ fontWeight: 600 }}>{formattaValuta(f.totale)}</span>.
                  </p>
                  <div style={styles.alertFooter}>
                    <span>Scadenza: 16 {MESI_IT[meseOggi]}</span>
                    <Link to={`/condomini/${f.condominioId}/fatture`} style={styles.alertLink}>
                      Apri <ArrowRight size={12} style={{ marginLeft: 2 }} />
                    </Link>
                  </div>
                </div>
              )
            })}

            {/* Esercizi in scadenza */}
            {stats.eserciziInScadenza.map(e => {
              const condoNome = condomini.find(c => c.id === e.condominioId)?.nome || 'Condominio'
              return (
                <div key={e.id} style={{ ...styles.alertBox, borderColor: '#f59e0b', background: 'var(--app-bg)' }}>
                  <div style={styles.alertHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={16} style={{ color: '#f59e0b' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>Esercizio in scadenza</span>
                    </div>
                  </div>
                  <p style={styles.alertMsg}>
                    L'esercizio {e.anno || ''} di <span style={{ fontWeight: 600 }}>{condoNome}</span> termina tra {e.giorniRimasti} giorni ({formattaData(e.dataFine)}). Prepara la rendicontazione annuale.
                  </p>
                  <div style={styles.alertFooter}>
                    <span>Rendiconto 1130-bis</span>
                    <Link to={`/condomini/${e.condominioId}`} style={styles.alertLink}>
                      Apri <ArrowRight size={12} style={{ marginLeft: 2 }} />
                    </Link>
                  </div>
                </div>
              )
            })}

            {/* Movimenti vecchi non riconciliati */}
            {stats.movimentiNonRiconciliatiAlerts.map(m => {
              const condoNome = condomini.find(c => c.id === m.condominioId)?.nome || 'Condominio'
              return (
                <div key={m.condominioId} style={{ ...styles.alertBox, borderColor: '#8b5cf6', background: 'var(--app-bg)' }}>
                  <div style={styles.alertHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Link2 size={16} style={{ color: '#8b5cf6' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#8b5cf6' }}>Riconciliazioni arretrate</span>
                    </div>
                  </div>
                  <p style={styles.alertMsg}>
                    <span style={{ fontWeight: 600 }}>{condoNome}</span> ha {m.count} moviment{m.count === 1 ? 'o' : 'i'} bancari non riconciliati da oltre 15 giorni.
                  </p>
                  <div style={styles.alertFooter}>
                    <span>Verifica estratti conto</span>
                    <Link to={`/condomini/${m.condominioId}/riconciliazioni`} style={styles.alertLink}>
                      Riconcilia <ArrowRight size={12} style={{ marginLeft: 2 }} />
                    </Link>
                  </div>
                </div>
              )
            })}

            {/* Nessun alert */}
            {!haAlert && (
              <div style={styles.emptyAlerts}>
                <CheckCircle2 size={48} style={{ color: '#16a34a', marginBottom: 12 }} />
                <h4 style={{ color: 'var(--text-primary)', margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>Tutto sotto controllo</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
                  Nessun ritardo amministrativo, scadenze F24 o esercizi in scadenza registrati nei primi giorni.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* Modali Guida e Tour Onboarding */}
      <GuidaRapidaModal 
        isOpen={showGuidaModal}
        onClose={() => setShowGuidaModal(false)}
      />

      <OnboardingTourModal
        isOpen={showTourModal}
        onClose={() => setShowTourModal(false)}
      />
    </div>
  )
}

// ─── Stili ────────────────────────────────────────────────────────────────────
const styles = {
  page: {
    padding: '32px',
    background: 'var(--app-bg)',
    minHeight: '100vh',
    fontFamily: 'Sora, sans-serif',
    color: 'var(--text-primary)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  title: {
    color: 'var(--text-primary)',
    fontSize: 28,
    fontWeight: 700,
    margin: '0 0 6px',
  },
  subtitle: {
    color: 'var(--text-muted)',
    fontSize: 14,
    margin: 0,
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 20,
    marginBottom: 32,
  },
  kpiCard: {
    background: 'var(--card-bg)',
    borderRadius: 14,
    padding: '20px',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
  },
  kpiHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiTitle: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 600,
  },
  kpiValue: {
    color: 'var(--text-primary)',
    fontSize: 28,
    fontWeight: 700,
    margin: '8px 0',
    lineHeight: 1,
  },
  kpiSub: {
    color: 'var(--text-muted)',
    fontSize: 11,
  },
  twoCol: {
    display: 'grid',
    gap: 24,
  },
  card: {
    background: 'var(--card-bg)',
    borderRadius: 14,
    border: '1px solid var(--border-color)',
    padding: '24px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    color: 'var(--text-primary)',
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
  },
  badge: {
    background: 'rgba(59, 130, 246, 0.1)',
    color: '#3b82f6',
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  thRow: {
    borderBottom: '2px solid var(--border-color)',
  },
  th: {
    textAlign: 'left',
    padding: '12px 10px',
    color: 'var(--text-secondary)',
    fontWeight: 600,
  },
  tr: {
    borderBottom: '1px solid var(--border-color)',
    transition: 'background-color 0.15s ease',
  },
  td: {
    padding: '14px 10px',
    color: 'var(--text-primary)',
    verticalAlign: 'middle',
  },
  condoLink: {
    color: 'var(--text-primary)',
    textDecoration: 'none',
    transition: 'color 0.15s ease',
  },
  ricTag: {
    background: 'rgba(139, 92, 246, 0.15)',
    color: '#7c3aed',
    borderRadius: 12,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
    display: 'inline-block',
  },
  btnAction: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: '#3b82f6',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 12,
  },
  alertsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  alertBox: {
    border: '1px solid',
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  alertHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeScaduto: {
    background: '#ef4444',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  alertMsg: {
    fontSize: 12,
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.4,
  },
  alertFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 4,
  },
  alertLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    fontWeight: 600,
  },
  emptyAlerts: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    border: '1px dashed var(--border-color)',
    borderRadius: 10,
  }
}
