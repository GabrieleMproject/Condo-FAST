// src/pages/PostboxPage.jsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../hooks/usePlan'
import SpeseForm from '../components/SpeseForm'
import SubentroValidator from '../components/SubentroValidator'
import { toast } from 'react-hot-toast'
import PlanGate from '../components/PlanGate'
import {
  UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2,
  Building2, ArrowRight, Clock, RefreshCw, X, Receipt, Eye,
  Inbox, User, Mail, MessageSquare, Trash2, Check, ExternalLink, Zap, Wrench, Shield
} from 'lucide-react'

// Helper per formattare la dimensione del file
const formatSize = (bytes) => {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// // Componente Paywall premium e interattivo per la Postbox
function PostboxPaywall() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100vh - 64px)', background: 'var(--app-bg)', padding: '40px 24px',
      fontFamily: 'Sora, sans-serif', overflowY: 'auto'
    }}>
      {/* CSS Keyframes per animazioni premium */}
      <style>{`
        @keyframes laserScan {
          0% { top: 0%; opacity: 0.3; }
          50% { top: 100%; opacity: 0.8; }
          100% { top: 0%; opacity: 0.3; }
        }
        @keyframes pulseGlow {
          0% { transform: scale(0.95); opacity: 0.5; }
          70% { transform: scale(1.02); opacity: 0.9; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
        .paywall-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 24px -10px rgba(124, 58, 237, 0.25) !important;
          border-color: rgba(124, 58, 237, 0.4) !important;
        }
      `}</style>

      {/* Badge e Titolo */}
      <div style={{ textAlign: 'center', marginBottom: 40, maxWidth: 700 }}>
        <span style={{
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(139, 92, 246, 0.2) 100%)',
          color: '#a78bfa', border: '1px solid rgba(124, 58, 237, 0.3)',
          padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.1em', display: 'inline-block', marginBottom: 16
        }}>
          Esclusiva Piano Studio o Superiore
        </span>
        <h1 style={{
          fontSize: 36, fontWeight: 800, margin: '0 0 16px',
          background: 'linear-gradient(135deg, var(--text-primary) 30%, #a78bfa 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          lineHeight: 1.2
        }}>
          Postbox Studio: la tua posta, automatizzata
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.5, margin: 0 }}>
          Centralizza la corrispondenza dello studio. L'intelligenza artificiale estrae spese, classifica i messaggi e gestisce i subentri in due tempi senza errori.
        </p>
      </div>

      {/* Griglia delle Funzionalità con Mockup Grafici CSS */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 24, width: '100%', maxWidth: 1100, marginBottom: 48
      }}>
        
        {/* Card 1: Scansione AI Spese */}
        <div className="paywall-card" style={{
          background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16,
          padding: 24, display: 'flex', flexDirection: 'column', gap: 20, transition: 'all 0.3s ease',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
        }}>
          {/* Mockup Scansione AI */}
          <div style={{
            height: 140, background: 'var(--app-bg)', borderRadius: 12, border: '1px solid var(--border-color)',
            position: 'relative', overflow: 'hidden', padding: 16, display: 'flex', flexDirection: 'column', gap: 8
          }}>
            {/* Linea Laser */}
            <div style={{
              position: 'absolute', left: 0, right: 0, height: 2, background: '#7c3aed',
              boxShadow: '0 0 8px #7c3aed', animation: 'laserScan 3s infinite ease-in-out'
            }} />
            
            {/* Finto Foglio Fattura */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: 6 }}>
              <div style={{ width: 60, height: 8, background: 'var(--border-color)', borderRadius: 4 }} />
              <div style={{ width: 40, height: 8, background: 'var(--border-color)', borderRadius: 4 }} />
            </div>
            <div style={{ width: '80%', height: 6, background: 'var(--border-color)', borderRadius: 3 }} />
            <div style={{ width: '60%', height: 6, background: 'var(--border-color)', borderRadius: 3 }} />
            
            {/* Campi Rilevati dall'AI */}
            <div style={{ display: 'flex', gap: 6, marginTop: 'auto', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, background: 'rgba(124, 58, 237, 0.1)', color: '#a78bfa', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(124, 58, 237, 0.2)', fontWeight: 600 }}>
                Fornitore: Rossi Srl
              </span>
              <span style={{ fontSize: 9, background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(16, 185, 129, 0.2)', fontWeight: 600 }}>
                Importo: €450,00
              </span>
            </div>
          </div>
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Receipt size={20} style={{ color: '#a78bfa' }} /> Estrattore AI Spese
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.5 }}>
              L'AI legge le fatture e le ricevute allegate alle email. Estrae automaticamente fornitore, importo, data e propone la ripartizione millesimale pronta da registrare.
            </p>
          </div>
        </div>

        {/* Card 2: Subentri Guidati in 2 Tempi */}
        <div className="paywall-card" style={{
          background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16,
          padding: 24, display: 'flex', flexDirection: 'column', gap: 20, transition: 'all 0.3s ease',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
        }}>
          {/* Mockup Timeline Subentri */}
          <div style={{
            height: 140, background: 'var(--app-bg)', borderRadius: 12, border: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, position: 'relative'
          }}>
            {/* Linea di collegamento */}
            <div style={{ position: 'absolute', width: '60%', height: 2, background: 'var(--border-color)', zIndex: 1 }} />
            <div style={{ position: 'absolute', width: '30%', height: 2, background: '#3b82f6', left: '20%', zIndex: 1 }} />
            
            {/* Step A */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 2, width: '40%' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: '#3b82f6', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                boxShadow: '0 0 10px rgba(59, 130, 246, 0.4)'
              }}>
                A
              </div>
              <span style={{ fontSize: 9, color: 'var(--text-primary)', fontWeight: 600 }}>Anagrafica & Benvenuto</span>
            </div>

            {/* Step B */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 2, width: '40%' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: 'var(--card-bg)', color: 'var(--text-secondary)',
                border: '2px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700
              }}>
                B
              </div>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Calcolo Pro-Rata</span>
            </div>
          </div>
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={20} style={{ color: '#60a5fa' }} /> Subentri Guidati a 2 Tempi
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.5 }}>
              Dividi l'aggiornamento giuridico (subito email di benvenuto e modulo autocertificazione catastale) dal conguaglio finanziario pro-rata, calcolato solo dopo la riconciliazione contabile.
            </p>
          </div>
        </div>

        {/* Card 3: Registro Messaggi Unificato */}
        <div className="paywall-card" style={{
          background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16,
          padding: 24, display: 'flex', flexDirection: 'column', gap: 20, transition: 'all 0.3s ease',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
        }}>
          {/* Mockup Registro Inbox */}
          <div style={{
            height: 140, background: 'var(--app-bg)', borderRadius: 12, border: '1px solid var(--border-color)',
            padding: 12, display: 'flex', flexDirection: 'column', gap: 8
          }}>
            {/* Messaggio 1 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-bg)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ width: '70%', height: 6, background: 'var(--text-primary)', opacity: 0.8, borderRadius: 2 }} />
                <div style={{ width: '40%', height: 4, background: 'var(--text-muted)', borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '1px 4px', borderRadius: 4, fontWeight: 700 }}>SPESA</span>
            </div>
            
            {/* Messaggio 2 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-bg)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ width: '60%', height: 6, background: 'var(--text-primary)', opacity: 0.8, borderRadius: 2 }} />
                <div style={{ width: '50%', height: 4, background: 'var(--text-muted)', borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 8, background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', padding: '1px 4px', borderRadius: 4, fontWeight: 700 }}>INFO</span>
            </div>
          </div>
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={20} style={{ color: '#34d399' }} /> Comunicazioni Ricevute
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.5 }}>
              Ricevi ed archivia automaticamente tutte le email dei condòmini (anche solo testo senza allegati). Crea un diario storico ordinato delle comunicazioni per condomino e condominio.
            </p>
          </div>
        </div>

        {/* Card 4: Ticket & Sinistri Integrati */}
        <div className="paywall-card" style={{
          background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16,
          padding: 24, display: 'flex', flexDirection: 'column', gap: 20, transition: 'all 0.3s ease',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
        }}>
          {/* Mockup Ticket e Sinistri */}
          <div style={{
            height: 140, background: 'var(--app-bg)', borderRadius: 12, border: '1px solid var(--border-color)',
            padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, position: 'relative'
          }}>
            {/* Ticket di Manutenzione */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card-bg)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wrench size={14} style={{ color: '#3b82f6' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Rottura Serratura</span>
              </div>
              <span style={{ fontSize: 8, background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '2px 6px', borderRadius: 4, fontWeight: 700, marginLeft: 'auto' }}>
                APERTO
              </span>
            </div>

            {/* Segnalazione Sinistro */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card-bg)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={14} style={{ color: '#ef4444' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Infiltrazione A/1</span>
              </div>
              <span style={{ fontSize: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '2px 6px', borderRadius: 4, fontWeight: 700, marginLeft: 'auto' }}>
                SINISTRO
              </span>
            </div>
          </div>
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wrench size={20} style={{ color: '#3b82f6' }} /> Ticket & Sinistri Integrati
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.5 }}>
              Apri ticket di manutenzione o registra sinistri condominiali direttamente dai messaggi ricevuti. Tutto integrato con scadenze, stati e allegati per non dimenticare nulla.
            </p>
          </div>
        </div>

      </div>

      {/* CTA Box (Upgrade Box) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
        border: '1px solid rgba(124, 58, 237, 0.3)', borderRadius: 16,
        padding: '32px 40px', maxWidth: 600, width: '100%', textAlign: 'center',
        boxShadow: '0 8px 30px rgba(124, 58, 237, 0.06)'
      }}>
        <div style={{ fontSize: 13, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          SBLOCCA ORA POSTBOX STUDIO
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)' }}>249€</span>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>/ mese + IVA (include 50 condomini)</span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5, margin: '0 0 24px' }}>
          Passa al piano <strong>Studio</strong> per sbloccare la Postbox Studio, l'AI inclusa (500 scansioni/mese), l'invio solleciti con Resend, l'assemblea digitale AI e il portale per ciascun condomino.
        </p>
        <a href="/impostazioni#piani-abbonamento" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
          color: '#fff', textDecoration: 'none', padding: '14px 32px', borderRadius: 10,
          fontSize: 15, fontWeight: 700, transition: 'transform 0.15s, box-shadow 0.15s',
          boxShadow: '0 4px 15px rgba(124, 58, 237, 0.35)', cursor: 'pointer'
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.45)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(124, 58, 237, 0.35)'; }}
        >
          Passa a Studio <Zap size={16} />
        </a>
      </div>
    </div>
  )
}

// Helper per formattare la data
const formattaData = (d) => {
  if (!d) return ''
  return new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function PostboxPage() {
  const { user } = useAuth()
  const { profile, canUse, loading: loadingPlan } = usePlan()
  
  const [condomini, setCondomini] = useState([])
  const [loadingCondomini, setLoadingCondomini] = useState(true)
  
  // Coda di elaborazione persistente
  const [queue, setQueue] = useState([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  
  // Stati di tab attivi
  const [activeTab, setActiveTab] = useState('spese') // 'spese', 'subentri', 'messaggi'
  
  // Stati ID attivi per tab
  const [activeSpesaId, setActiveSpesaId] = useState(null)
  const [activeSubentroId, setActiveSubentroId] = useState(null)
  const [activeMessaggioId, setActiveMessaggioId] = useState(null)
  
  // Stati di processo
  const [saving, setSaving] = useState(false)
  const [activeFileUrl, setActiveFileUrl] = useState(null)
  const [loadingFileUrl, setLoadingFileUrl] = useState(false)
  const [showZoomModal, setShowZoomModal] = useState(false)
  const [showSegnalazioneModal, setShowSegnalazioneModal] = useState(false)
  const [segnalazioneTipo, setSegnalazioneTipo] = useState('manutenzione')
  const [segnalazioneTitolo, setSegnalazioneTitolo] = useState('')
  const [segnalazioneDescrizione, setSegnalazioneDescrizione] = useState('')
  const [segnalazioneUnitaId, setSegnalazioneUnitaId] = useState('')
  const [segnalazionePersonaId, setSegnalazionePersonaId] = useState('')

  if (loadingPlan) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)', background: 'var(--app-bg)', color: 'var(--text-muted)' }}>
        <Loader2 className="animate-spin" size={32} />
      </div>
    )
  }

  if (!canUse('postbox_studio')) {
    return <PostboxPaywall />
  }

  // 1. Carica i condomini all'avvio
  useEffect(() => {
    const fetchCondomini = async () => {
      try {
        const { data, error } = await supabase
          .from('condomini')
          .select('*')
          .order('nome', { ascending: true })
        if (error) throw error
        setCondomini(data || [])
      } catch (err) {
        console.error('Errore caricamento condomini:', err)
      } finally {
        setLoadingCondomini(false)
      }
    }
    fetchCondomini()
  }, [])

  // 2. Caricamento Coda da Database
  const fetchQueue = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('inbox_documenti')
        .select('*')
        .in('stato', ['nuovo', 'rilevato', 'da_smistare', 'elaborato'])
        .order('data_ricezione', { ascending: true })
      
      if (error) throw error

      const uniqueCondoIds = [...new Set((data || []).map(doc => doc.condominio_id).filter(Boolean))]
      const cacheMap = new Map()
      
      await Promise.all(uniqueCondoIds.map(async (cid) => {
        const d = await fetchCondominioDati(cid)
        cacheMap.set(cid, d)
      }))
      
      const mapped = (data || []).map((doc) => {
        const condoDati = doc.condominio_id
          ? cacheMap.get(doc.condominio_id) || { esercizi: [], unita: [], tabelle: [], documenti: [] }
          : { esercizi: [], unita: [], tabelle: [], documenti: [] }

        const aperto = condoDati.esercizi.find(e => e.stato === 'aperto') || condoDati.esercizi[0]
        const selectedEsercizioId = aperto?.id || null
        
        return {
          id: doc.id,
          file_path: doc.file_path,
          file_name: doc.file_name,
          email_mittente: doc.email_mittente,
          email_oggetto: doc.email_oggetto,
          email_corpo: doc.email_corpo,
          data_ricezione: doc.data_ricezione,
          tipo: doc.tipo || 'spesa',
          stato: doc.stato,
          extractedData: doc.dati_estratti,
          condominioId: doc.condominio_id,
          esercizioId: selectedEsercizioId,
          esercizi: condoDati.esercizi,
          unita: condoDati.unita,
          tabelle: condoDati.tabelle,
          documenti: condoDati.documenti,
          profilo: profile
        }
      })
      
      setQueue(mapped)
      
      // Imposta gli ID attivi per tab se non presenti
      const spese = mapped.filter(q => q.tipo === 'spesa' && q.stato !== 'inserito')
      if (spese.length > 0 && !activeSpesaId) setActiveSpesaId(spese[0].id)

      const subentri = mapped.filter(q => q.tipo === 'subentro' && q.stato !== 'conguagliato')
      if (subentri.length > 0 && !activeSubentroId) setActiveSubentroId(subentri[0].id)

      const messaggi = mapped.filter(q => q.tipo === 'messaggio' && q.stato !== 'elaborato')
      if (messaggi.length > 0 && !activeMessaggioId) setActiveMessaggioId(messaggi[0].id)

    } catch (err) {
      console.error('Errore recupero coda inbox:', err)
    } finally {
      setLoadingQueue(false)
    }
  }

  // 3. Inizializza Realtime Listener per la coda
  useEffect(() => {
    if (!user) return
    fetchQueue()
    
    const channel = supabase
      .channel('inbox_global_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inbox_documenti'
      }, () => {
        fetchQueue()
      })
      .subscribe()
      
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, profile])

  // Helper per caricare i dettagli del condominio
  const fetchCondominioDati = async (condoId) => {
    if (!condoId) return { tabelle: [], unita: [], documenti: [], esercizi: [] }
    try {
      const [resEsercizi, resUnita, resTabelle, resDocumenti] = await Promise.all([
        supabase.from('esercizi').select('*').eq('condominio_id', condoId).order('anno', { ascending: false }),
        supabase.from('unita').select('id, numero, scala, piano, tipo').eq('condominio_id', condoId),
        supabase.from('tabelle_millesimali').select('*, millesimi_unita(*)').eq('condominio_id', condoId),
        supabase.from('documenti_condominio').select('*').eq('condominio_id', condoId)
      ])
      return {
        esercizi: resEsercizi.data || [],
        unita: resUnita.data || [],
        tabelle: resTabelle.data || [],
        documenti: resDocumenti.data || []
      }
    } catch (err) {
      console.error('Errore caricamento dettagli condominio:', err)
      return { tabelle: [], unita: [], documenti: [], esercizi: [] }
    }
  }

  // 4. Carica Signed URL del PDF quando cambia l'elemento attivo
  const getActiveItem = () => {
    if (activeTab === 'spese') return queue.find(q => q.id === activeSpesaId)
    if (activeTab === 'subentri') return queue.find(q => q.id === activeSubentroId)
    return queue.find(q => q.id === activeMessaggioId)
  }
  
  const activeItem = getActiveItem()

  useEffect(() => {
    if (!activeItem || !activeItem.file_path) {
      setActiveFileUrl(null)
      return
    }

    const getSignedUrl = async () => {
      setLoadingFileUrl(true)
      try {
        const { data, error } = await supabase.storage
          .from('inbox-ricezione')
          .createSignedUrl(activeItem.file_path, 900)
        
        if (!error && data?.signedUrl) {
          setActiveFileUrl(data.signedUrl)
        }
      } catch (err) {
        console.error('Errore recupero Signed URL:', err)
      } finally {
        setLoadingFileUrl(false)
      }
    }
    getSignedUrl()
  }, [activeSpesaId, activeSubentroId, activeMessaggioId, activeTab, queue])

  // Cestina / Ignora
  const handleIgnoraDocumento = async (doc) => {
    if (!confirm('Sei sicuro di voler ignorare e cestinare questa comunicazione?')) return
    try {
      const { error: dbErr } = await supabase
        .from('inbox_documenti')
        .update({ stato: 'scartato' })
        .eq('id', doc.id)
      if (dbErr) throw dbErr

      if (doc.file_path) {
        await supabase.storage.from('inbox-ricezione').remove([doc.file_path])
      }

      toast.success('Comunicazione cestinata con successo.')
      fetchQueue()
    } catch (err) {
      console.error(err)
      toast.error('Errore durante la cancellazione.')
    }
  }

  // Segna come lavorato (per Messaggi)
  const handleLavoratoMessaggio = async (docId) => {
    try {
      const { error } = await supabase
        .from('inbox_documenti')
        .update({ 
          stato: 'elaborato',
          email_corpo: 'Rimosso per conformità GDPR (Minimizzazione dei Dati)'
        })
        .eq('id', docId)
      if (error) throw error
      toast.success('Comunicazione contrassegnata come lavorata.')
      fetchQueue()
    } catch (err) {
      console.error(err)
      toast.error('Errore nell\'aggiornamento dello stato.')
    }
  }

  // Salvataggio Spesa
  const handleSaveSpesa = async (spesaPayload) => {
    setSaving(true)
    try {
      const { data: spesa, error: spesaErr } = await supabase
        .from('spese')
        .insert([{
          condominio_id: activeItem.condominioId,
          esercizio_id: activeItem.esercizioId,
          descrizione: spesaPayload.descrizione,
          importo: spesaPayload.importo,
          data_spesa: spesaPayload.data_spesa,
          fornitore_nome: spesaPayload.fornitore_nome || null,
          categoria: spesaPayload.categoria || 'altro',
          criterio: spesaPayload.criterio || 'millesimi'
        }])
        .select()
        .single()

      if (spesaErr) throw spesaErr

      // Salva le ripartizioni
      if (spesaPayload.ripartizioni && spesaPayload.ripartizioni.length > 0) {
        const rips = spesaPayload.ripartizioni.map(r => ({
          spesa_id: spesa.id,
          unita_id: r.unita_id,
          importo: r.importo,
          millesimi_usati: r.millesimi_usati || 0,
          override_manuale: r.override_manuale || false,
          importo_override: r.importo_override || null
        }))
        const { error: ripErr } = await supabase.from('ripartizioni').insert(rips)
        if (ripErr) throw ripErr
      }

      // Sposta il file in documenti condominio definitivi
      if (activeItem.file_path) {
        const cleanName = activeItem.file_name.replace(/\s+/g, '_')
        const newPath = `${activeItem.condominioId}/${Date.now()}_${cleanName}`
        
        // Scarica temporaneamente il file dal bucket di ricezione email
        const { data: fileData, error: downloadErr } = await supabase.storage
          .from('inbox-ricezione')
          .download(activeItem.file_path)

        if (downloadErr) throw downloadErr

        // Carica il file nel bucket documenti definitivo
        const { error: uploadErr } = await supabase.storage
          .from('documenti-condominio')
          .upload(newPath, fileData, {
            contentType: fileData.type || 'application/pdf',
            upsert: true
          })

        if (uploadErr) throw uploadErr
        
        await supabase.from('documenti_condominio').insert([{
          condominio_id: activeItem.condominioId,
          nome: activeItem.file_name,
          tipo: 'fattura',
          pdf_url: newPath,
          data_documento: spesaPayload.data_spesa
        }])
        await supabase.storage.from('inbox-ricezione').remove([activeItem.file_path])
      }

      // Aggiorna lo stato in Postbox ed elimina il corpo mail per GDPR
      await supabase
        .from('inbox_documenti')
        .update({ 
          stato: 'inserito', 
          spesa_id: spesa.id,
          email_corpo: 'Rimosso per conformità GDPR (Minimizzazione dei Dati)'
        })
        .eq('id', activeItem.id)

      toast.success('Spesa inserita e ripartita correttamente!')
      fetchQueue()
    } catch (err) {
      console.error(err)
      toast.error("Errore durante l'inserimento della spesa.")
    } finally {
      setSaving(false)
    }
  }

  const apriSegnalazioneForm = (tipo) => {
    setSegnalazioneTipo(tipo)
    setSegnalazioneTitolo(activeItem.email_oggetto || '')
    setSegnalazioneDescrizione(activeItem.extractedData?.sintesi_richiesta || activeItem.email_corpo || '')
    setSegnalazioneUnitaId('')
    setSegnalazionePersonaId('')
    setShowSegnalazioneModal(true)
  }

  const handleSalvaSegnalazione = async (e) => {
    e.preventDefault()
    if (!segnalazioneTitolo.trim() || !segnalazioneDescrizione.trim()) {
      toast.error('Inserisci titolo e descrizione per la segnalazione.')
      return
    }

    setSaving(true)
    try {
      let personaId = segnalazionePersonaId || null
      if (!personaId && activeItem.email_mittente) {
        const { data: p } = await supabase
          .from('persone')
          .select('id')
          .eq('email', activeItem.email_mittente.trim().toLowerCase())
          .maybeSingle()
        if (p) {
          personaId = p.id
        }
      }

      const { error: insErr } = await supabase
        .from('segnalazioni_condominio')
        .insert([{
          condominio_id: activeItem.condominioId,
          unita_id: segnalazioneUnitaId || null,
          persona_id: personaId,
          titolo: segnalazioneTitolo.trim(),
          descrizione: segnalazioneDescrizione.trim(),
          tipo: segnalazioneTipo,
          stato: 'nuovo',
          inbox_documento_id: activeItem.id
        }])

      if (insErr) throw insErr

      await supabase
        .from('inbox_documenti')
        .update({ 
          stato: 'elaborato',
          email_corpo: 'Rimosso per conformità GDPR (Minimizzazione dei Dati)'
        })
        .eq('id', activeItem.id)

      toast.success(segnalazioneTipo === 'sinistro' 
        ? 'Sinistro registrato correttamente!' 
        : 'Ticket di manutenzione aperto correttamente!'
      )
      setShowSegnalazioneModal(false)
      fetchQueue()
    } catch (err) {
      console.error('[PostboxPage] Errore salvataggio segnalazione:', err)
      toast.error('Errore durante la registrazione.')
    } finally {
      setSaving(false)
    }
  }

  // Filtra la coda in base al tab attivo
  const queueSpese = queue.filter(q => q.tipo === 'spesa' && q.stato !== 'inserito')
  const queueSubentri = queue.filter(q => q.tipo === 'subentro' && q.stato !== 'conguagliato')
  const queueMessaggi = queue.filter(q => q.tipo === 'messaggio' && q.stato !== 'elaborato')

  const getActiveQueue = () => {
    if (activeTab === 'spese') return queueSpese
    if (activeTab === 'subentri') return queueSubentri
    return queueMessaggi
  }

  const activeQueueList = getActiveQueue()

  return (
    <PlanGate feature="postbox_studio">
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: 'var(--app-bg)' }}>
      
      {/* Tab in testa */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--card-bg)', padding: '0 24px' }}>
        <button 
          onClick={() => setActiveTab('spese')}
          style={{ 
            padding: '16px 20px', background: 'transparent', border: 'none',
            borderBottom: activeTab === 'spese' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'spese' ? '#2563eb' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
          }}
        >
          <Receipt size={16} /> Spese & Fatture
          {queueSpese.length > 0 && (
            <span style={{ fontSize: 11, background: '#ef4444', color: '#fff', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
              {queueSpese.length}
            </span>
          )}
        </button>

        <button 
          onClick={() => setActiveTab('subentri')}
          style={{ 
            padding: '16px 20px', background: 'transparent', border: 'none',
            borderBottom: activeTab === 'subentri' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'subentri' ? '#2563eb' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
          }}
        >
          <User size={16} /> Anagrafiche & Subentri
          {queueSubentri.length > 0 && (
            <span style={{ fontSize: 11, background: '#2563eb', color: '#fff', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
              {queueSubentri.length}
            </span>
          )}
        </button>

        <button 
          onClick={() => setActiveTab('messaggi')}
          style={{ 
            padding: '16px 20px', background: 'transparent', border: 'none',
            borderBottom: activeTab === 'messaggi' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'messaggi' ? '#2563eb' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
          }}
        >
          <MessageSquare size={16} /> Messaggi & Segnalazioni
          {queueMessaggi.length > 0 && (
            <span style={{ fontSize: 11, background: '#10b981', color: '#fff', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
              {queueMessaggi.length}
            </span>
          )}
        </button>
      </div>

      {/* Corpo principale diviso (Lista a sinistra, Convalida a destra) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Lista Documenti (Sinistra) */}
        <div style={{ width: 340, borderRight: '1px solid var(--border-color)', background: 'var(--card-bg)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {loadingQueue ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 20, alignItems: 'center', color: 'var(--text-muted)' }}>
              <Loader2 className="animate-spin" size={24} />
              <span style={{ fontSize: 13 }}>Caricamento Postbox...</span>
            </div>
          ) : activeQueueList.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 20, color: 'var(--text-muted)', gap: 8 }}>
              <Inbox size={32} style={{ opacity: 0.5 }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Coda Postbox vuota</span>
              <span style={{ fontSize: 11, textAlign: 'center' }}>Tutte le email sono state elaborate correttamente.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {activeQueueList.map((doc) => {
                const isSelected = (activeTab === 'spese' && doc.id === activeSpesaId) || 
                                   (activeTab === 'subentri' && doc.id === activeSubentroId) || 
                                   (activeTab === 'messaggi' && doc.id === activeMessaggioId)
                
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      if (activeTab === 'spese') setActiveSpesaId(doc.id)
                      else if (activeTab === 'subentri') setActiveSubentroId(doc.id)
                      else setActiveMessaggioId(doc.id)
                    }}
                    style={{
                      padding: '16px 20px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer',
                      background: isSelected ? 'var(--border-color)' : 'transparent',
                      transition: 'background 0.2s', borderLeft: isSelected ? '4px solid #2563eb' : '4px solid transparent'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} /> {formattaData(doc.data_ricezione)}
                        {(() => {
                          const giacenzaGiorni = doc.data_ricezione 
                            ? Math.floor((new Date() - new Date(doc.data_ricezione)) / (1000 * 60 * 60 * 24))
                            : 0
                          return giacenzaGiorni >= 5 ? (
                            <span style={{ fontSize: 9, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1px 5px', borderRadius: 4, marginLeft: 6, fontWeight: 700 }}>
                              ⚠️ Giacenza: {giacenzaGiorni}gg
                            </span>
                          ) : null
                        })()}
                      </span>
                      {doc.stato === 'elaborato' && doc.tipo === 'subentro' && (
                        <span style={{ fontSize: 10, background: '#eab308', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Fase B</span>
                      )}
                    </div>
                    
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
                      {doc.email_oggetto || doc.file_name || 'Comunicazione senza oggetto'}
                    </div>
                    
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Da: {doc.email_mittente || 'Mittente sconosciuto'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Dettaglio/Convalida (Destra) */}
        <div style={{ flex: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!activeItem ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', gap: 8 }}>
              <Inbox size={40} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: 14 }}>Seleziona un elemento dalla lista per visualizzarlo</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              
              {/* Sezione Convalida */}
              <div style={{ flex: 1, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                
                {/* Banner Mittente / Informazioni Mail */}
                <div style={{ padding: '16px 24px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>EMAIL RICEVUTA</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>
                      <strong>Oggetto:</strong> {activeItem.email_oggetto || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                      <strong>Da:</strong> {activeItem.email_mittente || '—'}
                    </div>
                    {activeItem.file_path && (
                      <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <FileText size={12} /> Allegato: <span style={{ fontWeight: 600 }}>{activeItem.file_name}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {activeItem.file_path && (
                      <button 
                        onClick={() => setShowZoomModal(true)}
                        style={{ 
                          padding: '8px 14px', background: '#2563eb', border: 'none', color: '#fff', 
                          borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, 
                          fontSize: 12, fontWeight: 600, boxShadow: '0 2px 4px rgba(37,99,235,0.2)' 
                        }}
                      >
                        <Eye size={14} /> Visualizza Documento
                      </button>
                    )}
                    <button 
                      onClick={() => handleIgnoraDocumento(activeItem)}
                      style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--border-color)', color: '#ef4444', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}
                    >
                      <Trash2 size={14} /> Cestina
                    </button>
                  </div>
                </div>

                {/* Alert Giacenza in Dettaglio */}
                {(() => {
                  const giacenza = activeItem.data_ricezione
                    ? Math.floor((new Date() - new Date(activeItem.data_ricezione)) / (1000 * 60 * 60 * 24))
                    : 0
                  if (giacenza >= 5) {
                    return (
                      <div style={{ margin: '16px 24px 0', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AlertTriangle size={16} color="#f87171" />
                        <span style={{ fontSize: 13, color: '#f87171', fontWeight: 600 }}>
                          Questa comunicazione è in sospeso da ben {giacenza} giorni e richiede attenzione prioritaria.
                        </span>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Switch form in base alla tipologia */}
                {activeTab === 'spese' && (
                  <div style={{ padding: '24px 0' }}>
                    <SpeseForm
                      initialData={activeItem.extractedData}
                      condomini={condomini}
                      esercizi={activeItem.esercizi}
                      unita={activeItem.unita}
                      tabelle={activeItem.tabelle}
                      documenti={activeItem.documenti}
                      condominioId={activeItem.condominioId}
                      esercizioId={activeItem.esercizioId}
                      loading={saving}
                      onSubmit={handleSaveSpesa}
                    />
                  </div>
                )}

                {activeTab === 'subentri' && (
                  <div style={{ padding: '24px 0', flex: 1 }}>
                    <SubentroValidator
                      item={activeItem}
                      condomini={condomini}
                      onComplete={fetchQueue}
                      onCancel={() => handleIgnoraDocumento(activeItem)}
                    />
                  </div>
                )}

                {activeTab === 'messaggi' && (
                  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ padding: 20, background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12 }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                        Testo del messaggio
                      </div>
                      <div 
                        style={{ 
                          fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', 
                          fontFamily: 'inherit', lineHeight: 1.5, maxHeight: '40vh', overflowY: 'auto', 
                          padding: 12, background: 'var(--app-bg)', borderRadius: 8, border: '1px solid var(--border-color)' 
                        }}
                      >
                        {activeItem.email_corpo || 'Nessun testo nel corpo del messaggio.'}
                      </div>
                    </div>

                    {activeItem.extractedData?.sintesi_richiesta && (
                      <div style={{ padding: 16, background: 'rgba(37, 99, 235, 0.05)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', marginBottom: 4 }}>Analisi Intelligente AI</div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                          <strong>Sintesi:</strong> {activeItem.extractedData.sintesi_richiesta}
                        </div>
                        {activeItem.extractedData.categoria_messaggio && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            Categoria: <span style={{ textTransform: 'uppercase', fontWeight: 600, background: 'var(--border-color)', padding: '1px 6px', borderRadius: 4 }}>{activeItem.extractedData.categoria_messaggio.replace('_', ' ')}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                      <button 
                        onClick={() => apriSegnalazioneForm('manutenzione')}
                        style={{ flex: 1, padding: '12px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}
                      >
                        <Wrench size={16} /> Apri Manutenzione
                      </button>
                      <button 
                        onClick={() => apriSegnalazioneForm('sinistro')}
                        style={{ flex: 1, padding: '12px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}
                      >
                        <Shield size={16} /> Registra Sinistro
                      </button>
                      <button 
                        onClick={() => handleLavoratoMessaggio(activeItem.id)}
                        style={{ flex: 1, padding: '12px 8px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}
                      >
                        <Check size={16} /> Segna Lavorato
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>

      </div>

      {/* Modale Zoom Anteprima Schermo Intero */}
      {showZoomModal && activeFileUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '90vw', height: '90vh', background: 'var(--app-bg)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>{activeItem?.file_name}</span>
              <button 
                onClick={() => setShowZoomModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ flex: 1, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {activeItem?.file_name?.toLowerCase().endsWith('.pdf') ? (
                <iframe src={activeFileUrl} style={{ width: '100%', height: '100%', border: 'none' }} />
              ) : (
                <img src={activeFileUrl} alt="Zoom" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modale per Apertura Segnalazione / Sinistro */}
      {showSegnalazioneModal && activeItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form 
            onSubmit={handleSalvaSegnalazione}
            style={{ width: 500, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--app-bg)' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                {segnalazioneTipo === 'sinistro' ? (
                  <>
                    <Shield size={18} color="#ef4444" /> Registra Segnalazione Sinistro
                  </>
                ) : (
                  <>
                    <Wrench size={18} color="#3b82f6" /> Apri Ticket Manutenzione
                  </>
                )}
              </span>
              <button 
                type="button"
                onClick={() => setShowSegnalazioneModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Titolo / Oggetto</label>
                <input 
                  type="text"
                  value={segnalazioneTitolo}
                  onChange={(e) => setSegnalazioneTitolo(e.target.value)}
                  placeholder="Es: Rottura serratura cancello carraio"
                  required
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Dettaglio Guasto / Descrizione</label>
                <textarea 
                  value={segnalazioneDescrizione}
                  onChange={(e) => setSegnalazioneDescrizione(e.target.value)}
                  placeholder="Inserisci dettagli utili..."
                  required
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, resize: 'none', lineHeight: 1.4 }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Unità Immobiliare Associata (Opzionale)</label>
                <select
                  value={segnalazioneUnitaId}
                  onChange={(e) => setSegnalazioneUnitaId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13 }}
                >
                  <option value="">— Condominio Generale (Parti Comuni) —</option>
                  {(activeItem.unita || []).map((u) => (
                    <option key={u.id} value={u.id}>
                      Scala {u.scala || '—'} · Piano {u.piano ?? '—'} · Int. {u.numero}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'var(--app-bg)' }}>
              <button 
                type="button"
                onClick={() => setShowSegnalazioneModal(false)}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Annulla
              </button>
              <button 
                type="submit"
                disabled={saving}
                style={{ 
                  padding: '8px 20px', 
                  background: segnalazioneTipo === 'sinistro' ? '#dc2626' : '#2563eb', 
                  color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 8
                }}
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" size={14} /> Salvataggio...
                  </>
                ) : (
                  <>
                    Salva Segnalazione
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
    </PlanGate>
  )
}
