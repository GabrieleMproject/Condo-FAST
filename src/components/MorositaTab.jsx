// src/components/MorositaTab.jsx
import { useState, useEffect, useMemo } from 'react'
import {
  ShieldAlert, Scale, FileText, AlertTriangle, Download,
  Send, Settings, CheckCircle2, ChevronRight, Search,
  Filter, Check, Copy, RefreshCw, Layers, CreditCard,
  Mail, Printer, Clock, Building2, UserCheck, X, Sparkles, Loader2
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useUnita } from '../hooks/useUnita'
import { useComunicazioni } from '../hooks/useComunicazioni'
import { formattaValuta, formattaData } from '../lib/formatters'
import {
  getCondominioMorositaConfig,
  calcolaMorositaCondominio,
  TASSI_PREDEFINITI,
  DEFAULT_MOROSITA_CONFIG
} from '../lib/morositaEngine'
import {
  exportFascicoloMorositaPdf,
  exportLetteraSollecitoPdf,
  exportLetteraSollecitoPdfBytes
} from '../lib/exportPdf'
import MorositaModal from './MorositaModal'

export default function MorositaTab({
  condominioId,
  condominio,
  esercizioId: esercizioIdProp,
  esercizioAttivo: esercizioAttivoProp,
  onSelectEsercizio
}) {
  const { unita, fetchUnita } = useUnita(condominioId)
  const { comunicazioni, fetchComunicazioni, inviaComunicazione } = useComunicazioni()

  const [esercizi, setEsercizi] = useState([])
  const [esercizio, setEsercizio] = useState(esercizioAttivoProp || null)
  const [rate, setRate] = useState([])
  const [cells, setCells] = useState([])
  const [configPagante, setConfigPagante] = useState({})
  const [studioProfile, setStudioProfile] = useState({})
  const [loading, setLoading] = useState(true)

  // Configurazione morosità del condominio
  const [configMorosita, setConfigMorosita] = useState(() => getCondominioMorositaConfig(condominio))
  const [showConfigDrawer, setShowConfigDrawer] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  // Filtri & Selezione
  const [filtroLivello, setFiltroLivello] = useState('tutti') // 'tutti' | '1' | '2' | '3' | 'gravi'
  const [searchTerm, setSearchTerm] = useState('')
  const [selezionati, setSelezionati] = useState([]) // array di morositaUnita

  // Modale Dettaglio / Invio singolo
  const [modalMorosoTarget, setModalMorosoTarget] = useState(null)

  // Modale Invio Massivo
  const [invioMassivoStato, setInvioMassivoStato] = useState({
    inCorso: false,
    totale: 0,
    corrente: 0,
    falliti: 0,
    showModal: false
  })

  // Tracciamento liquidazioni studio salvate in localStorage
  const storageKeyLiquidazioni = `condo_liquidazioni_${condominioId}`
  const [speseLiquidateIds, setSpeseLiquidateIds] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKeyLiquidazioni)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Caricamento profilo studio dell'amministratore
  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('studio_nome, studio_indirizzo, studio_telefono, studio_email, studio_pec, ragione_sociale, partita_iva, codice_fiscale')
            .eq('id', user.id)
            .maybeSingle()
          if (data) setStudioProfile(data)
        }
      } catch (err) {
        console.warn('[MorositaTab] Errore fetch profilo studio:', err)
      }
    }
    loadProfile()
  }, [])

  // Caricamento esercizi
  useEffect(() => {
    if (!condominioId) return
    supabase
      .from('esercizi')
      .select('*')
      .eq('condominio_id', condominioId)
      .order('anno', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setEsercizi(data)
          if (esercizioIdProp) {
            const match = data.find(e => e.id === esercizioIdProp)
            if (match) { setEsercizio(match); return }
          }
          setEsercizio(data.find(e => e.stato === 'aperto') || data[0] || null)
        }
      })
  }, [condominioId, esercizioIdProp])

  // Caricamento rate e dati contabili
  const loadData = async () => {
    if (!condominioId) return
    setLoading(true)
    try {
      await fetchComunicazioni(condominioId)

      if (esercizio) {
        const { data: rateData } = await supabase
          .from('rate')
          .select('*')
          .eq('esercizio_id', esercizio.id)
          .order('numero_rata', { ascending: true })

        const rateList = rateData || []
        setRate(rateList)

        if (rateList.length > 0) {
          const { data: cellData } = await supabase
            .from('rate_unita')
            .select('*')
            .in('rata_id', rateList.map(r => r.id))
          setCells(cellData || [])
        } else {
          setCells([])
        }

        const { data: configData } = await supabase
          .from('config_pagante_unita')
          .select('unita_id, pagante')
          .eq('esercizio_id', esercizio.id)

        const map = {}
        ;(configData || []).forEach(c => { map[c.unita_id] = c.pagante })
        setConfigPagante(map)
      }
    } catch (err) {
      console.error('[MorositaTab] Errore caricamento:', err)
      toast.error('Errore durante il caricamento dei dati: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [condominioId, esercizio?.id])

  useEffect(() => {
    if (condominio) {
      setConfigMorosita(getCondominioMorositaConfig(condominio))
    }
  }, [condominio])

  // Calcolo globale morosità
  const morositaGlobale = useMemo(() => {
    return calcolaMorositaCondominio({
      unitaList: unita || [],
      rateUnitaList: cells || [],
      rateList: rate || [],
      configPagante,
      configMorosita,
      comunicazioniList: comunicazioni || [],
      speseLiquidateIds
    })
  }, [unita, cells, rate, configPagante, configMorosita, comunicazioni, speseLiquidateIds])

  // Filtro morosi per ricerca e scaglione
  const morosiFiltrati = useMemo(() => {
    return (morositaGlobale.morosi || []).filter(m => {
      // Filtro Scaglione
      if (filtroLivello === '1' && m.livelloSuggerito !== 1) return false
      if (filtroLivello === '2' && m.livelloSuggerito !== 2) return false
      if (filtroLivello === '3' && m.livelloSuggerito !== 3) return false
      if (filtroLivello === 'gravi' && !m.isOltreSeiMesi) return false

      // Ricerca testo
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchNome = m.debitore ? `${m.debitore.nome} ${m.debitore.cognome}`.toLowerCase().includes(q) : false
        const matchUnita = m.unita ? `interno ${m.unita.numero} scala ${m.unita.scala || ''}`.toLowerCase().includes(q) : false
        const matchCf = m.debitore?.codice_fiscale?.toLowerCase().includes(q) || false
        if (!matchNome && !matchUnita && !matchCf) return false
      }

      return true
    })
  }, [morositaGlobale.morosi, filtroLivello, searchTerm])

  // Gestione selezione multipla
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelezionati(morosiFiltrati)
    } else {
      setSelezionati([])
    }
  }

  const handleToggleSelect = (m) => {
    if (selezionati.some(s => s.unita.id === m.unita.id)) {
      setSelezionati(selezionati.filter(s => s.unita.id !== m.unita.id))
    } else {
      setSelezionati([...selezionati, m])
    }
  }

  const isAllSelected = morosiFiltrati.length > 0 && selezionati.length === morosiFiltrati.length

  // Salvataggio Configurazione Condominio
  const handleSaveConfig = async (newConfig) => {
    setSavingConfig(true)
    try {
      const { error } = await supabase
        .from('condomini')
        .update({ config_morosita: newConfig })
        .eq('id', condominioId)

      if (error) throw error

      setConfigMorosita(newConfig)
      setShowConfigDrawer(false)
      toast.success('Parametri di recupero crediti salvati con successo per questo condominio!')
    } catch (err) {
      console.error('Errore salvataggio config:', err)
      toast.error('Errore salvataggio configurazione: ' + err.message)
    } finally {
      setSavingConfig(false)
    }
  }

  // Copia dicitura per fattura studio
  const handleCopiaDicituraFattura = () => {
    const importo = formattaValuta(morositaGlobale.totaleSpeseIncassateLiquidabili)
    const anno = esercizio?.anno || new Date().getFullYear()
    const dicitura = `Rimborso spese amministrative e gestione solleciti morosi Esercizio ${anno} - ${condominio?.nome || 'Condominio'}: ${importo}`
    
    navigator.clipboard.writeText(dicitura)
    toast.success('Dicitura per la fattura copiata negli appunti!')
  }

  // Segna spese come liquidate in fattura
  const handleSegnaComeLiquidate = () => {
    const nuoviIds = morositaGlobale.praticheSaldate.map(p => p.comunicazioneId)
    const unione = Array.from(new Set([...speseLiquidateIds, ...nuoviIds]))
    setSpeseLiquidateIds(unione)
    localStorage.setItem(storageKeyLiquidazioni, JSON.stringify(unione))
    toast.success('Spese di sollecito contrassegnate come liquidate in fattura!')
  }

  // Download Fascicolo PDF Massivo
  const handleDownloadFascicolo = (listaDaEsportare = morosiFiltrati) => {
    if (!listaDaEsportare.length) {
      toast.error('Nessuna unità selezionata per l\'esportazione.')
      return
    }
    try {
      exportFascicoloMorositaPdf({
        condominio,
        esercizio,
        listaMorosi: listaDaEsportare,
        studioProfile
      })
      toast.success(`Fascicolo PDF generato con ${listaDaEsportare.length} lettere di sollecito/diffida!`)
    } catch (err) {
      console.error('Errore fascicolo PDF:', err)
      toast.error('Errore generazione fascicolo PDF: ' + err.message)
    }
  }

  // Invio Massivo Batch 1-Click
  const handleAvviaInvioMassivo = async () => {
    if (!selezionati.length) {
      toast.error('Seleziona almeno un condomino moroso da sollecitare.')
      return
    }

    setInvioMassivoStato({
      inCorso: true,
      totale: selezionati.length,
      corrente: 0,
      falliti: 0,
      showModal: true
    })

    let falliti = 0
    let corrente = 0

    for (const m of selezionati) {
      corrente++
      setInvioMassivoStato(prev => ({ ...prev, corrente }))

      try {
        const dest = m.debitore
        const destEmail = dest?.email || dest?.pec
        const destNome = `${dest?.nome || ''} ${dest?.cognome || ''}`.trim() || 'Condòmino'

        if (!destEmail) {
          throw new Error('Email non configurata')
        }

        // 1. Genera PDF base64
        const pdfBase64 = await exportLetteraSollecitoPdfBytes({
          condominio,
          esercizio,
          unita: m.unita,
          destinatario: dest,
          morositaUnita: m,
          livello: m.livelloSuggerito,
          studioProfile
        })

        const prefisso = m.livelloSuggerito === 3 ? 'Diffida_Legale' : (m.livelloSuggerito === 2 ? '2_Sollecito' : 'Sollecito_Bonario')
        const nomeAllegato = `${prefisso}_Unita_${m.unita.numero}.pdf`
        const tipoInvio = m.livelloSuggerito === 3 ? 'diffida' : 'sollecito'

        // 2. Invia comunicazione
        await inviaComunicazione({
          condominioId,
          destinatari: [{ email: destEmail, nome: destNome }],
          oggetto: `Sollecito pagamento quote esercizio ${esercizio?.anno || ''} - Unità ${m.unita.numero}`,
          messaggio: `Gentile ${destNome}, in allegato trasmettiamo il sollecito di pagamento per l'unità ${m.unita.numero}. Saluti, L'Amministrazione.`,
          tipo: tipoInvio,
          allegati: [{
            filename: nomeAllegato,
            content: pdfBase64,
            type: 'application/pdf'
          }],
          skipFetch: true
        })

      } catch (err) {
        console.error(`Errore invio massivo unità ${m.unita.numero}:`, err)
        falliti++
        setInvioMassivoStato(prev => ({ ...prev, falliti }))
      }
    }

    await fetchComunicazioni(condominioId)
    setInvioMassivoStato(prev => ({ ...prev, inCorso: false }))

    if (falliti > 0) {
      toast.error(`Invio massivo completato: ${selezionati.length - falliti} inviati, ${falliti} falliti.`);
    } else {
      toast.success(`Tutti i ${selezionati.length} solleciti sono stati inviati con successo!`);
    }

    setSelezionati([])
  }

  return (
    <div style={styles.container}>
      
      {/* ── BARRA SUPERIORE: INTESTAZIONE & SELETTORE ESERCIZIO ── */}
      <div style={styles.topBar}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={styles.pageTitle}>Modulo Morosità & Recupero Crediti</h2>
            <span style={styles.badgeLive}>Real-Time Art. 63 c.c.</span>
          </div>
          <p style={styles.pageSubtitle}>
            Rilevamento automatico quote insolute, calcolo interessi legali/mora giorno per giorno e diffide legali in 1-Click
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Selettore Esercizio */}
          {esercizi.length > 0 && (
            <select
              value={esercizio?.id || ''}
              onChange={e => {
                const found = esercizi.find(x => x.id === e.target.value)
                if (found) {
                  setEsercizio(found)
                  if (onSelectEsercizio) onSelectEsercizio(found.id)
                }
              }}
              style={styles.select}
            >
              {esercizi.map(es => (
                <option key={es.id} value={es.id}>
                  Esercizio {es.anno} ({es.tipo || 'ordinario'}) {es.stato === 'aperto' ? '· Aperto' : '· Chiuso'}
                </option>
              ))}
            </select>
          )}

          {/* Pulsante Configurazione Condominio */}
          <button
            type="button"
            onClick={() => setShowConfigDrawer(true)}
            style={styles.btnSecondary}
          >
            <Settings size={15} /> Parametri Condominio
          </button>

          {/* Pulsante Fascicolo PDF */}
          <button
            type="button"
            onClick={() => handleDownloadFascicolo()}
            style={styles.btnSecondary}
          >
            <Download size={15} /> Fascicolo PDF Morosità
          </button>
        </div>
      </div>

      {/* ── BANNER INTELLIGENTE: SPESE INCASSATE & LIQUIDABILI ALLO STUDIO ── */}
      {morositaGlobale.totaleSpeseIncassateLiquidabili > 0 && (
        <div style={styles.bannerStudio}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={styles.bannerIconWrap}>
              <Sparkles size={24} color="#f59e0b" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#92400e' }}>
                  💰 Spese di Sollecito Incassate & Liquidabili allo Studio: {formattaValuta(morositaGlobale.totaleSpeseIncassateLiquidabili)}
                </span>
                <span style={{ fontSize: 11, background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                  {morositaGlobale.praticheSaldate.filter(p => !p.liquidato).length} solleciti saldati
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#78350f', margin: '4px 0 0', lineHeight: 1.5 }}>
                I condòmini morosi hanno saldato le quote con l'addebito delle spese di sollecito/gestione pratica. Puoi ora inserire questa voce nella tua fattura verso il condominio e prelevarla dal c/c condominiale (art. 1129 comma 14 c.c.).
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, borderTop: '1px solid rgba(245, 158, 11, 0.25)', paddingTop: 10 }}>
            <button
              type="button"
              onClick={handleCopiaDicituraFattura}
              style={styles.bannerBtnPrimary}
            >
              <Copy size={14} /> Copia Dicitura per la tua Fattura
            </button>

            <button
              type="button"
              onClick={handleSegnaComeLiquidate}
              style={styles.bannerBtnSecondary}
            >
              <CheckCircle2 size={14} /> Segna come Liquidate in Fattura
            </button>
          </div>
        </div>
      )}

      {/* ── 4 KPI CARDS ── */}
      <div style={styles.kpiGrid}>
        
        {/* KPI 1: Totale Insoluto Capitale */}
        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIconWrap, background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <div style={styles.kpiLabel}>Totale Quote Insolute</div>
            <div style={{ ...styles.kpiValue, color: '#ef4444' }}>
              {formattaValuta(morositaGlobale.totaleInsolutoCondominio)}
            </div>
            <div style={styles.kpiSub}>Capitale da riscuotere</div>
          </div>
        </div>

        {/* KPI 2: Interessi & Spese Recuperabili */}
        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIconWrap, background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
            <Scale size={20} />
          </div>
          <div>
            <div style={styles.kpiLabel}>Interessi & Spese Maturati</div>
            <div style={{ ...styles.kpiValue, color: '#3b82f6' }}>
              {formattaValuta(morositaGlobale.totaleInteressiCondominio + morositaGlobale.totaleSpesePotenziali)}
            </div>
            <div style={styles.kpiSub}>
              {formattaValuta(morositaGlobale.totaleInteressiCondominio)} int. + {formattaValuta(morositaGlobale.totaleSpesePotenziali)} spese
            </div>
          </div>
        </div>

        {/* KPI 3: Unità Morose */}
        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIconWrap, background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
            <UserCheck size={20} />
          </div>
          <div>
            <div style={styles.kpiLabel}>Unità Morose</div>
            <div style={styles.kpiValue}>
              {morositaGlobale.unitaMoroseCount} / {morositaGlobale.totaleUnitaCount}
            </div>
            <div style={styles.kpiSub}>
              {morositaGlobale.percentualeUnitaMorose}% delle unità dello stabile
            </div>
          </div>
        </div>

        {/* KPI 4: Morosità Gravi / Oltre 6 Mesi */}
        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIconWrap, background: 'rgba(153, 27, 27, 0.12)', color: '#991b1b' }}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <div style={styles.kpiLabel}>Critiche &gt; 6 Mesi (Art. 63)</div>
            <div style={{ ...styles.kpiValue, color: '#991b1b' }}>
              {morositaGlobale.unitaGraviCount} Pratiche
            </div>
            <div style={styles.kpiSub}>Pronte per Decreto Ingiuntivo</div>
          </div>
        </div>

      </div>

      {/* ── BARRA FILTRI & AZIONI MASSIVE ── */}
      <div style={styles.filterBar}>
        
        {/* Tabs Scaglioni */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setFiltroLivello('tutti')}
            style={{
              ...styles.filterPill,
              background: filtroLivello === 'tutti' ? 'var(--accent)' : 'var(--card-bg)',
              color: filtroLivello === 'tutti' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            Tutti i Morosi ({morositaGlobale.morosi?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setFiltroLivello('1')}
            style={{
              ...styles.filterPill,
              background: filtroLivello === '1' ? '#3b82f6' : 'var(--card-bg)',
              color: filtroLivello === '1' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            1° Sollecito Bonario ({morositaGlobale.conteggioLivello1})
          </button>

          <button
            type="button"
            onClick={() => setFiltroLivello('2')}
            style={{
              ...styles.filterPill,
              background: filtroLivello === '2' ? '#f59e0b' : 'var(--card-bg)',
              color: filtroLivello === '2' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            2° Sollecito con Spese ({morositaGlobale.conteggioLivello2})
          </button>

          <button
            type="button"
            onClick={() => setFiltroLivello('3')}
            style={{
              ...styles.filterPill,
              background: filtroLivello === '3' ? '#ef4444' : 'var(--card-bg)',
              color: filtroLivello === '3' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            Diffida Legale ({morositaGlobale.conteggioLivello3})
          </button>
        </div>

        {/* Ricerca Testo */}
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Cerca condòmino o int..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>

      </div>

      {/* ── BARRA FLUTTUANTE AZIONI SELEZIONATI ── */}
      {selezionati.length > 0 && (
        <div style={styles.floatingActionBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              {selezionati.length} {selezionati.length === 1 ? 'unità selezionata' : 'unità selezionate'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              (Totale recuperabile: {formattaValuta(selezionati.reduce((s, m) => s + m.totaleComplessivoRichiesto, 0))})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => handleDownloadFascicolo(selezionati)}
              style={styles.btnSecondary}
            >
              <Download size={14} /> Scarica Fascicolo ({selezionati.length})
            </button>

            <button
              type="button"
              onClick={handleAvviaInvioMassivo}
              style={styles.btnPrimary}
            >
              <Send size={14} /> Invio Massivo 1-Click ({selezionati.length})
            </button>
          </div>
        </div>
      )}

      {/* ── TABELLA MOROSITÀ & RECUPERO CREDITI ── */}
      <div style={styles.tableCard}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={28} className="spin" style={{ margin: '0 auto 10px', display: 'block' }} />
            Calcolo posizioni debitorie in corso...
          </div>
        ) : morosiFiltrati.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Nessuna morosità rilevata
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              {morositaGlobale.morosi?.length === 0
                ? 'Tutti i condòmini sono in regola con i versamenti delle rate per questo esercizio!'
                : 'Nessuna posizione corrisponde ai filtri di ricerca selezionati.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: 40, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th style={styles.th}>Unità</th>
                  <th style={styles.th}>Condòmino / Debitore</th>
                  <th style={styles.th}>Rate Insolute</th>
                  <th style={styles.thRight}>Quota Capitale</th>
                  <th style={styles.thRight}>Interessi</th>
                  <th style={styles.thRight}>Spese</th>
                  <th style={styles.thRight}>Totale Dovuto</th>
                  <th style={styles.thCenter}>Stato / Livello</th>
                  <th style={styles.thCenter}>Ultimo Invio</th>
                  <th style={{ ...styles.thRight, width: 140 }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {morosiFiltrati.map(m => {
                  const isSelected = selezionati.some(s => s.unita.id === m.unita.id)
                  const u = m.unita
                  const deb = m.debitore
                  const nomeCompleto = deb ? `${deb.cognome} ${deb.nome}` : 'Non assegnato'

                  return (
                    <tr
                      key={u.id}
                      style={{
                        ...styles.tr,
                        background: isSelected ? 'rgba(59, 130, 246, 0.06)' : 'transparent'
                      }}
                    >
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(m)}
                        />
                      </td>

                      {/* Unità */}
                      <td style={styles.td}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>
                          Interno {u.numero}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {u.scala ? `Scala ${u.scala}` : ''} {u.piano != null ? `· Piano ${u.piano}` : ''}
                        </div>
                      </td>

                      {/* Debitore */}
                      <td style={styles.td}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                          {nomeCompleto}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{m.paganteTipo === 'inquilino' ? 'Inquilino' : 'Proprietario'}</span>
                          {deb?.email && <span>· {deb.email}</span>}
                          {deb?.pec && <span style={{ color: '#8b5cf6' }}>· PEC</span>}
                        </div>
                      </td>

                      {/* Rate Insolute & Giorni Ritardo */}
                      <td style={styles.td}>
                        <div style={{ fontWeight: 600, color: '#ef4444', fontSize: 12 }}>
                          {m.rateScaduteCount} {m.rateScaduteCount === 1 ? 'rata scaduta' : 'rate scadute'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Max ritardo: <strong style={{ color: m.isOltreSeiMesi ? '#ef4444' : 'var(--text-secondary)' }}>{m.maxGiorniRitardo} gg</strong>
                        </div>
                      </td>

                      {/* Quota Capitale */}
                      <td style={styles.tdRight}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>
                          {formattaValuta(m.totaleCapitaleInsoluto)}
                        </span>
                      </td>

                      {/* Interessi */}
                      <td style={styles.tdRight}>
                        <span style={{ fontWeight: 600, color: '#3b82f6', fontSize: 12 }}>
                          +{formattaValuta(m.totaleInteressiMaturati)}
                        </span>
                      </td>

                      {/* Spese */}
                      <td style={styles.tdRight}>
                        <span style={{ fontWeight: 600, color: '#f59e0b', fontSize: 12 }}>
                          +{formattaValuta(m.speseApplicate)}
                        </span>
                      </td>

                      {/* Totale Dovuto */}
                      <td style={styles.tdRight}>
                        <span style={{
                          fontWeight: 800,
                          fontSize: 14,
                          color: m.livelloSuggerito === 3 ? '#ef4444' : (m.livelloSuggerito === 2 ? '#f59e0b' : '#3b82f6')
                        }}>
                          {formattaValuta(m.totaleComplessivoRichiesto)}
                        </span>
                      </td>

                      {/* Badge Livello Suggerito */}
                      <td style={styles.tdCenter}>
                        {m.livelloSuggerito === 3 ? (
                          <span style={styles.badgeDiffida}>
                            <ShieldAlert size={12} /> Diffida Legale
                          </span>
                        ) : m.livelloSuggerito === 2 ? (
                          <span style={styles.badgeLivello2}>
                            <Scale size={12} /> 2° Sollecito
                          </span>
                        ) : (
                          <span style={styles.badgeLivello1}>
                            <FileText size={12} /> 1° Bonario
                          </span>
                        )}
                      </td>

                      {/* Ultimo Sollecito Inviato */}
                      <td style={styles.tdCenter}>
                        {m.ultimoSollecito ? (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {formattaData(m.ultimoSollecito.created_at)}
                            </div>
                            <div style={{ fontSize: 10, color: m.ultimoSollecito.stato === 'inviata' ? '#10b981' : '#ef4444' }}>
                              {m.ultimoSollecito.stato === 'inviata' ? 'Inviato con successo' : 'Fallito'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mai inviato</span>
                        )}
                      </td>

                      {/* Azioni per riga */}
                      <td style={styles.tdRight}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            type="button"
                            title="Scarica Lettera PDF"
                            onClick={() => {
                              exportLetteraSollecitoPdf({
                                condominio,
                                esercizio,
                                unita: m.unita,
                                destinatario: m.debitore,
                                morositaUnita: m,
                                livello: m.livelloSuggerito,
                                studioProfile
                              })
                              toast.success('Lettera PDF scaricata!')
                            }}
                            style={styles.iconBtn}
                          >
                            <Download size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setModalMorosoTarget(m)}
                            style={styles.actionBtnPrimary}
                          >
                            <Send size={13} style={{ marginRight: 4 }} /> 1-Click
                          </button>
                        </div>
                      </td>

                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODALE GESTIONE & INVIO 1-CLICK SINGOLA UNITÀ ── */}
      {modalMorosoTarget && (
        <MorositaModal
          morositaUnita={modalMorosoTarget}
          condominio={condominio}
          esercizio={esercizio}
          configMorosita={configMorosita}
          studioProfile={studioProfile}
          onClose={() => setModalMorosoTarget(null)}
          onSuccess={() => {
            loadData()
          }}
        />
      )}

      {/* ── DRAWER / MODALE CONFIGURAZIONE PARAMETRI CONDOMINIO ── */}
      {showConfigDrawer && (
        <ConfigurazioneMorositaModal
          currentConfig={configMorosita}
          saving={savingConfig}
          onClose={() => setShowConfigDrawer(false)}
          onSave={handleSaveConfig}
        />
      )}

    </div>
  )
}

// ── Modale Configurazione Parametri per Condominio ──
function ConfigurazioneMorositaModal({ currentConfig, saving, onClose, onSave }) {
  const [cfg, setCfg] = useState({ ...currentConfig })

  return (
    <div style={styles.modalOverlay}>
      <div style={{ ...styles.modalBox, maxWidth: 620 }}>
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings size={20} color="#3b82f6" />
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              Parametri di Recupero Crediti per questo Condominio
            </h3>
          </div>
          <button style={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            Personalizza le soglie di ritardo, gli importi delle spese amministrative e i tassi di mora per adattarli al regolamento o alle delibere di questo stabile.
          </p>

          {/* TASSO INTERESSI */}
          <div style={styles.configBlock}>
            <span style={styles.configBlockTitle}>Tasso di Interesse di Default</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
              <div>
                <label style={styles.label}>Tipologia Tasso</label>
                <select
                  value={cfg.tassoTipo || 'legale_mef'}
                  onChange={e => setCfg(prev => ({ ...prev, tassoTipo: e.target.value }))}
                  style={styles.selectInput}
                >
                  <option value="legale_mef">Tasso Legale MEF (Art. 1284 c.c. - 2.50%)</option>
                  <option value="mora_commerciale">Mora Commerciale (D.Lgs. 231/02 - 10.50%)</option>
                  <option value="personalizzato">Personalizzato / Regolamento Condominiale</option>
                </select>
              </div>

              {cfg.tassoTipo === 'personalizzato' && (
                <div>
                  <label style={styles.label}>Aliquota Tasso (% annuo)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={cfg.tassoPersonalizzatoValore || 5.0}
                    onChange={e => setCfg(prev => ({ ...prev, tassoPersonalizzatoValore: parseFloat(e.target.value) || 0 }))}
                    style={styles.textInput}
                  />
                </div>
              )}
            </div>
          </div>

          {/* SCAGLIONE 1: BONARIO */}
          <div style={styles.configBlock}>
            <span style={{ ...styles.configBlockTitle, color: '#3b82f6' }}>1° Sollecito Bonario (Promemoria)</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 8 }}>
              <div>
                <label style={styles.label}>Soglia Min (gg ritardo)</label>
                <input
                  type="number"
                  value={cfg.livello1?.minGiorniRitardo ?? 10}
                  onChange={e => setCfg(prev => ({
                    ...prev,
                    livello1: { ...prev.livello1, minGiorniRitardo: parseInt(e.target.value, 10) || 0 }
                  }))}
                  style={styles.textInput}
                />
              </div>
              <div>
                <label style={styles.label}>Spese Addebitate (€)</label>
                <input
                  type="number"
                  value={cfg.livello1?.speseAmministrative ?? 0}
                  onChange={e => setCfg(prev => ({
                    ...prev,
                    livello1: { ...prev.livello1, speseAmministrative: parseFloat(e.target.value) || 0 }
                  }))}
                  style={styles.textInput}
                />
              </div>
              <div>
                <label style={styles.label}>Termine Pagamento (gg)</label>
                <input
                  type="number"
                  value={cfg.livello1?.giorniTerminePagamento ?? 10}
                  onChange={e => setCfg(prev => ({
                    ...prev,
                    livello1: { ...prev.livello1, giorniTerminePagamento: parseInt(e.target.value, 10) || 10 }
                  }))}
                  style={styles.textInput}
                />
              </div>
            </div>
          </div>

          {/* SCAGLIONE 2: MESSA IN MORA */}
          <div style={styles.configBlock}>
            <span style={{ ...styles.configBlockTitle, color: '#f59e0b' }}>2° Sollecito con Messa in Mora</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 8 }}>
              <div>
                <label style={styles.label}>Soglia Min (gg ritardo)</label>
                <input
                  type="number"
                  value={cfg.livello2?.minGiorniRitardo ?? 31}
                  onChange={e => setCfg(prev => ({
                    ...prev,
                    livello2: { ...prev.livello2, minGiorniRitardo: parseInt(e.target.value, 10) || 31 }
                  }))}
                  style={styles.textInput}
                />
              </div>
              <div>
                <label style={styles.label}>Spese Addebitate (€)</label>
                <input
                  type="number"
                  value={cfg.livello2?.speseAmministrative ?? 15}
                  onChange={e => setCfg(prev => ({
                    ...prev,
                    livello2: { ...prev.livello2, speseAmministrative: parseFloat(e.target.value) || 0 }
                  }))}
                  style={styles.textInput}
                />
              </div>
              <div>
                <label style={styles.label}>Termine Pagamento (gg)</label>
                <input
                  type="number"
                  value={cfg.livello2?.giorniTerminePagamento ?? 10}
                  onChange={e => setCfg(prev => ({
                    ...prev,
                    livello2: { ...prev.livello2, giorniTerminePagamento: parseInt(e.target.value, 10) || 10 }
                  }))}
                  style={styles.textInput}
                />
              </div>
            </div>
          </div>

          {/* SCAGLIONE 3: DIFFIDA LEGALE */}
          <div style={styles.configBlock}>
            <span style={{ ...styles.configBlockTitle, color: '#ef4444' }}>Diffida Legale ad Adempiere (Art. 63 c.c.)</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 8 }}>
              <div>
                <label style={styles.label}>Soglia Min (gg ritardo)</label>
                <input
                  type="number"
                  value={cfg.livello3?.minGiorniRitardo ?? 91}
                  onChange={e => setCfg(prev => ({
                    ...prev,
                    livello3: { ...prev.livello3, minGiorniRitardo: parseInt(e.target.value, 10) || 91 }
                  }))}
                  style={styles.textInput}
                />
              </div>
              <div>
                <label style={styles.label}>Spese Addebitate (€)</label>
                <input
                  type="number"
                  value={cfg.livello3?.speseAmministrative ?? 35}
                  onChange={e => setCfg(prev => ({
                    ...prev,
                    livello3: { ...prev.livello3, speseAmministrative: parseFloat(e.target.value) || 0 }
                  }))}
                  style={styles.textInput}
                />
              </div>
              <div>
                <label style={styles.label}>Termine Perentorio (gg)</label>
                <input
                  type="number"
                  value={cfg.livello3?.giorniTerminePagamento ?? 7}
                  onChange={e => setCfg(prev => ({
                    ...prev,
                    livello3: { ...prev.livello3, giorniTerminePagamento: parseInt(e.target.value, 10) || 7 }
                  }))}
                  style={styles.textInput}
                />
              </div>
            </div>
          </div>

        </div>

        <div style={styles.modalFooter}>
          <button type="button" onClick={onClose} style={styles.cancelBtn}>
            Annulla
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(cfg)}
            style={styles.btnPrimary}
          >
            {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
            Salva Parametri per il Condominio
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    fontFamily: 'Sora, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    gap: 18
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 16
  },
  pageTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text-primary)'
  },
  pageSubtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: 'var(--text-muted)'
  },
  badgeLive: {
    background: 'rgba(16, 185, 129, 0.12)',
    color: '#10b981',
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 6
  },
  select: {
    background: 'var(--card-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    fontFamily: 'Sora, sans-serif',
    cursor: 'pointer'
  },
  btnSecondary: {
    background: 'var(--card-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'Sora, sans-serif',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },
  btnPrimary: {
    background: 'var(--accent)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'Sora, sans-serif',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
  },
  bannerStudio: {
    background: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)',
    border: '1px solid #fde68a',
    borderRadius: 12,
    padding: '16px 20px',
    boxShadow: '0 2px 6px rgba(245, 158, 11, 0.08)'
  },
  bannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: '#fef3c7',
    border: '1px solid #fde68a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  bannerBtnPrimary: {
    background: '#b45309',
    color: '#ffffff',
    border: 'none',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'Sora, sans-serif'
  },
  bannerBtnSecondary: {
    background: 'transparent',
    color: '#92400e',
    border: '1px solid #d97706',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'Sora, sans-serif'
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 14
  },
  kpiCard: {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 14
  },
  kpiIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: '2px 0'
  },
  kpiSub: {
    fontSize: 11,
    color: 'var(--text-muted)'
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    background: 'var(--app-bg)',
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid var(--border-color)'
  },
  filterPill: {
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif',
    transition: 'all 0.15s'
  },
  searchInput: {
    width: '100%',
    padding: '7px 10px 7px 32px',
    borderRadius: 6,
    border: '1px solid var(--border-color)',
    background: 'var(--card-bg)',
    color: 'var(--text-primary)',
    fontSize: 12,
    fontFamily: 'Sora, sans-serif',
    boxSizing: 'border-box'
  },
  floatingActionBanner: {
    background: 'var(--card-bg)',
    border: '2px solid var(--accent)',
    borderRadius: 10,
    padding: '12px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    boxShadow: '0 8px 24px rgba(37, 99, 235, 0.18)'
  },
  tableCard: {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    overflow: 'hidden'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13
  },
  th: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--app-bg)',
    textAlign: 'left',
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: 12
  },
  thCenter: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--app-bg)',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: 12
  },
  thRight: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--app-bg)',
    textAlign: 'right',
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: 12
  },
  tr: {
    borderBottom: '1px solid var(--border-color)',
    transition: 'background 0.15s'
  },
  td: {
    padding: '12px 14px',
    verticalAlign: 'middle'
  },
  tdCenter: {
    padding: '12px 14px',
    textAlign: 'center',
    verticalAlign: 'middle'
  },
  tdRight: {
    padding: '12px 14px',
    textAlign: 'right',
    verticalAlign: 'middle'
  },
  badgeLivello1: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 6,
    background: 'rgba(59, 130, 246, 0.12)',
    color: '#3b82f6'
  },
  badgeLivello2: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 6,
    background: 'rgba(245, 158, 11, 0.12)',
    color: '#f59e0b'
  },
  badgeDiffida: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 6,
    background: 'rgba(239, 68, 68, 0.12)',
    color: '#ef4444'
  },
  iconBtn: {
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-secondary)',
    padding: '6px 8px',
    borderRadius: 6,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionBtnPrimary: {
    background: 'var(--accent)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'Sora, sans-serif',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 20
  },
  modalBox: {
    backgroundColor: 'var(--card-bg)',
    borderRadius: 14,
    width: '100%',
    boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
    border: '1px solid var(--border-color)',
    overflow: 'hidden'
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--app-bg)'
  },
  modalFooter: {
    padding: '14px 20px',
    borderTop: '1px solid var(--border-color)',
    background: 'var(--app-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer'
  },
  cancelBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: '8px 14px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif'
  },
  configBlock: {
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    padding: 12
  },
  configBlockTitle: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.4px'
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 4
  },
  selectInput: {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid var(--border-color)',
    background: 'var(--card-bg)',
    color: 'var(--text-primary)',
    fontSize: 12,
    fontFamily: 'Sora, sans-serif',
    boxSizing: 'border-box'
  },
  textInput: {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid var(--border-color)',
    background: 'var(--card-bg)',
    color: 'var(--text-primary)',
    fontSize: 12,
    fontFamily: 'Sora, sans-serif',
    boxSizing: 'border-box'
  }
}
