// src/components/AnagraficaCondominioTab.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { 
  Search, UserCog, Edit, X, Mail, Phone, Home, Download, 
  FileText, Upload, Plus, RefreshCw, Building2, Check, AlertTriangle 
} from 'lucide-react'
import { exportAnagraficaXlsx } from '../lib/exportXlsx'
import { exportAnagraficaPdf } from '../lib/exportPdf'
import { exportRegistroAnagrafePdf } from '../lib/exportPdf'
import { estraiDatiAnagrafeDaModulo } from '../lib/fileExtractor'
import { usePlan } from '../hooks/usePlan'
import { useWatermark } from '../hooks/useWatermark'
import { useComunicazioni } from '../hooks/useComunicazioni'
import AnagraficaImport from './AnagraficaImport'
import { toast } from 'react-hot-toast'

export default function AnagraficaCondominioTab({ condominioId, condominio }) {
  const { profile, isCollaboratore } = usePlan()
  const { checkWatermark, WatermarkModal } = useWatermark()
  const { inviaComunicazione, loading: inviandoMail } = useComunicazioni()
  
  // Tab Interno: 'registro' (Unità & Catasto) | 'rubrica' (Contatti & Persone)
  const [vistaAttiva, setVistaAttiva] = useState('registro')

  // --- STATI VISTA CLASSICA (RUBRICA) ---
  const [persone, setPersone] = useState([])
  const [loadingPersone, setLoadingPersone] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroRuolo, setFiltroRuolo] = useState('tutti') // 'tutti' | 'proprietario' | 'inquilino'
  const [editingPersona, setEditingPersona] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [showNuovoModal, setShowNuovoModal] = useState(false)

  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [indirizzo, setIndirizzo] = useState('')
  const [citta, setCitta] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [nuovoNome, setNuovoNome] = useState('')
  const [nuovoCognome, setNuovoCognome] = useState('')
  const [nuovoEmail, setNuovoEmail] = useState('')
  const [nuovoTelefono, setNuovoTelefono] = useState('')
  const [nuovoTelefonoAlt, setNuovoTelefonoAlt] = useState('')
  const [nuovoIndirizzo, setNuovoIndirizzo] = useState('')
  const [nuovoCitta, setNuovoCitta] = useState('')
  const [nuovoCap, setNuovoCap] = useState('')
  const [nuovoProvincia, setNuovoProvincia] = useState('')
  const [nuovoCf, setNuovoCf] = useState('')
  const [nuovoDataNascita, setNuovoDataNascita] = useState('')
  const [nuovoNote, setNuovoNote] = useState('')
  const [nuovoUnitaId, setNuovoUnitaId] = useState('')
  const [nuovoRuolo, setNuovoRuolo] = useState('proprietario')
  const [salvandoNuovo, setSalvandoNuovo] = useState(false)

  // --- STATI VISTA REGISTRO ---
  const [unitaList, setUnitaList] = useState([])
  const [loadingRegistro, setLoadingRegistro] = useState(true)
  const [selectedUnitaForOcr, setSelectedUnitaForOcr] = useState(null)
  const [ocrData, setOcrData] = useState(null)
  const [analysing, setAnalysing] = useState(false)
  const fileInputRefs = useRef({})
  const [showSendModal, setShowSendModal] = useState(false)
  const [selectedDestinatari, setSelectedDestinatari] = useState([])

  // Stati per la creazione manuale dell'unità
  const [showNuovaUnitaModal, setShowNuovaUnitaModal] = useState(false)
  const [editUnitaId, setEditUnitaId] = useState(null)
  const [nuovoNumeroUnita, setNuovoNumeroUnita] = useState('')
  const [nuovaScala, setNuovaScala] = useState('')
  const [nuovoPiano, setNuovoPiano] = useState('')
  const [nuovoMq, setNuovoMq] = useState('')
  const [nuovoTipoUnita, setNuovoTipoUnita] = useState('appartamento')
  const [nuovoCatastoFoglio, setNuovoCatastoFoglio] = useState('')
  const [nuovoCatastoParticella, setNuovoCatastoParticella] = useState('')
  const [nuovoCatastoSubalterno, setNuovoCatastoSubalterno] = useState('')
  const [nuovoCatastoCategoria, setNuovoCatastoCategoria] = useState('')
  const [nuovoCatastoRendita, setNuovoCatastoRendita] = useState('')
  const [salvandoUnita, setSalvandoUnita] = useState(false)

  // Stati per popup preventivo di esportazione
  const [showExportConfirmModal, setShowExportConfirmModal] = useState(false)
  const [unitaIncompletePerExport, setUnitaIncompletePerExport] = useState([])

  // Lista di tutte le unità per il dropdown
  const [unitaListDropdown, setUnitaListDropdown] = useState([])

  const caricaUnitaDropdown = async () => {
    try {
      const { data, error } = await supabase
        .from('unita')
        .select('id, numero, scala, piano')
        .eq('condominio_id', condominioId)
        .order('numero', { ascending: true })
      if (!error && data) {
        setUnitaListDropdown(data)
      }
    } catch (e) {
      console.warn('Errore caricamento unità:', e.message)
    }
  }

  const caricaPersone = async () => {
    setLoadingPersone(true)
    try {
      const { data, error } = await supabase
        .from('persone')
        .select(`
          id, nome, cognome, email, telefono, indirizzo, citta,
          occupanti_unita(id, ruolo, attivo, unita(id, numero, scala, condominio_id))
        `)
        .eq('occupanti_unita.unita.condominio_id', condominioId)
        .eq('occupanti_unita.attivo', true)

      if (error) throw error

      const personeFiltrate = (data || []).filter(p =>
        (p.occupanti_unita || []).some(o => o.unita?.condominio_id === condominioId)
      )

      const personeMappate = personeFiltrate.map(p => {
        const occupazioni = (p.occupanti_unita || []).filter(o => o.unita?.condominio_id === condominioId)
        const unitaNomi = occupazioni.map(o => `Unità ${o.unita.numero}${o.unita.scala ? ` (Sc. ${o.unita.scala})` : ''}`).join(', ')
        const ruoli = Array.from(new Set(occupazioni.map(o => o.ruolo))).map(r => r === 'proprietario' ? 'Proprietario' : 'Inquilino').join(' / ')
        
        return {
          ...p,
          unitaNomi,
          ruoli,
          isProprietario: occupazioni.some(o => o.ruolo === 'proprietario'),
          isInquilino: occupazioni.some(o => o.ruolo === 'inquilino')
        }
      })

      setPersone(personeMappate)
    } catch (err) {
      console.error('Errore caricamento anagrafica condominio:', err.message)
    } finally {
      setLoadingPersone(false)
    }
  }

  const fetchDatiRegistro = useCallback(async () => {
    if (!condominioId) return
    setLoadingRegistro(true)
    try {
      const { data, error } = await supabase
        .from('unita')
        .select(`
          *,
          occupanti_unita (
            id,
            ruolo,
            attivo,
            persona: persone (
              id,
              nome,
              cognome,
              codice_fiscale,
              email,
              telefono,
              indirizzo,
              citta,
              cap,
              provincia
            )
          )
        `)
        .eq('condominio_id', condominioId)
        .order('numero', { ascending: true })

      if (error) throw error
      setUnitaList(data || [])
    } catch (err) {
      console.error(err)
      toast.error('Errore nel caricamento del registro anagrafe.')
    } finally {
      setLoadingRegistro(false)
    }
  }, [condominioId])

  useEffect(() => {
    if (condominioId) {
      caricaPersone()
      caricaUnitaDropdown()
      fetchDatiRegistro()
    }
  }, [condominioId, fetchDatiRegistro])

  // Filtra le persone in base a ricerca e ruolo (Rubrica)
  const personeFiltrate = useMemo(() => {
    return persone.filter(p => {
      const matchSearch = 
        `${p.nome} ${p.cognome}`.toLowerCase().includes(search.toLowerCase()) ||
        `${p.cognome} ${p.nome}`.toLowerCase().includes(search.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.unitaNomi || '').toLowerCase().includes(search.toLowerCase())

      const matchRuolo = 
        filtroRuolo === 'tutti' ||
        (filtroRuolo === 'proprietario' && p.isProprietario) ||
        (filtroRuolo === 'inquilino' && p.isInquilino)

      return matchSearch && matchRuolo
    })
  }, [persone, search, filtroRuolo])

  const apriModifica = (p) => {
    setEditingPersona(p)
    setNome(p.nome || '')
    setCognome(p.cognome || '')
    setEmail(p.email || '')
    setTelefono(p.telefono || '')
    setIndirizzo(p.indirizzo || '')
    setCitta(p.citta || '')
  }

  const handleSalva = async (e) => {
    e.preventDefault()
    if (!editingPersona) return
    setSalvando(true)
    try {
      const { error } = await supabase
        .from('persone')
        .update({ nome, cognome, email, telefono, indirizzo, citta })
        .eq('id', editingPersona.id)

      if (error) throw error

      toast.success('Dati anagrafici salvati con successo!')
      setEditingPersona(null)
      await caricaPersone()
      await fetchDatiRegistro()
    } catch (err) {
      toast.error('Errore durante il salvataggio: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  const handleCreaNuovo = async (e) => {
    e.preventDefault()
    if (!nuovoNome.trim() || !nuovoCognome.trim()) {
      toast.error('Nome e Cognome sono obbligatori!')
      return
    }
    setSalvandoNuovo(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Utente non autenticato")

      const { data: persona, error: pErr } = await supabase
        .from('persone')
        .insert([{
          user_id: user.id,
          nome: nuovoNome.trim(),
          cognome: nuovoCognome.trim(),
          email: nuovoEmail.trim() || null,
          telefono: nuovoTelefono.trim() || null,
          telefono_alt: nuovoTelefonoAlt.trim() || null,
          indirizzo: nuovoIndirizzo.trim() || null,
          citta: nuovoCitta.trim() || null,
          cap: nuovoCap.trim() || null,
          provincia: nuovoProvincia.toUpperCase().trim() || null,
          codice_fiscale: nuovoCf.toUpperCase().trim() || null,
          data_nascita: nuovoDataNascita || null,
          note: nuovoNote.trim() || null
        }])
        .select()
        .single()

      if (pErr) throw pErr

      if (nuovoUnitaId) {
        const oggi = new Date().toISOString().split('T')[0]
        const subDate = new Date()
        subDate.setDate(subDate.getDate() - 1)
        const ieri = subDate.toISOString().split('T')[0]

        await supabase
          .from('occupanti_unita')
          .update({ attivo: false, data_fine: ieri })
          .eq('unita_id', nuovoUnitaId)
          .eq('ruolo', nuovoRuolo)
          .eq('attivo', true)

        const { error: oErr } = await supabase
          .from('occupanti_unita')
          .insert([{
            unita_id: nuovoUnitaId,
            persona_id: persona.id,
            ruolo: nuovoRuolo,
            attivo: true,
            data_inizio: oggi
          }])
        if (oErr) throw oErr
      }

      toast.success('Nuovo condòmino creato con successo!')
      setShowNuovoModal(false)
      setNuovoNome('')
      setNuovoCognome('')
      setNuovoEmail('')
      setNuovoTelefono('')
      setNuovoTelefonoAlt('')
      setNuovoIndirizzo('')
      setNuovoCitta('')
      setNuovoCap('')
      setNuovoProvincia('')
      setNuovoCf('')
      setNuovoDataNascita('')
      setNuovoNote('')
      setNuovoUnitaId('')
      setNuovoRuolo('proprietario')
      
      await caricaPersone()
      await fetchDatiRegistro()
    } catch (err) {
      toast.error('Errore durante la creazione: ' + err.message)
    } finally {
      setSalvandoNuovo(false)
    }
  }

  const handleImport = async (rows) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: unitaCondoData } = await supabase
      .from('unita')
      .select('id, numero, scala, piano, tipo')
      .eq('condominio_id', condominioId)
    const unitaCondominio = unitaCondoData || []
    const results = { created: 0, errors: [] }

    for (const r of rows) {
      try {
        let unita_id = r.unita_id || null
        const strUnita = String(r.unita || '').trim()
        const strUnitaLower = strUnita.toLowerCase()

        if (!unita_id && strUnita) {
          const match = unitaCondominio.find(u => {
            const num = String(u.numero || '').trim().toLowerCase()
            const cleanNum = num.replace(/^0+/, '') || '0'
            const cleanStr = strUnitaLower.replace(/^0+/, '') || '0'
            return num === strUnitaLower || cleanNum === cleanStr ||
              strUnitaLower === `int. ${num}` || strUnitaLower === `int ${num}` ||
              strUnitaLower === `interno ${num}` || strUnitaLower.endsWith(` ${num}`)
          })
          if (match) {
            unita_id = match.id
          } else {
            const cleanNumero = strUnita.replace(/^(unita|unità|app\.|appartamento|int\.|interno|n\.|num\.)\s*/i, '').trim() || strUnita
            const { data: newU, error: errU } = await supabase
              .from('unita')
              .insert([{ condominio_id: condominioId, numero: cleanNumero, tipo: 'appartamento' }])
              .select().single()
            if (!errU && newU) { unita_id = newU.id; unitaCondominio.push(newU) }
          }
        }

        const { data: persona, error: pErr } = await supabase
          .from('persone')
          .insert([{
            user_id: user.id,
            nome: r.nome || '',
            cognome: r.cognome || '',
            email: r.email || null,
            telefono: r.telefono || null,
            indirizzo: r.indirizzo || null,
            citta: r.citta || null,
            cap: r.cap || null,
            provincia: r.provincia || null,
            codice_fiscale: r.codice_fiscale || null,
          }])
          .select().single()
        if (pErr) throw pErr

        if (unita_id) {
          const ruolo = ['proprietario', 'inquilino'].includes(String(r.ruolo || '').toLowerCase())
            ? r.ruolo.toLowerCase() : 'proprietario'
          const oggi = new Date().toISOString().split('T')[0]
          const subDate = new Date()
          subDate.setDate(subDate.getDate() - 1)
          const ieri = subDate.toISOString().split('T')[0]

          await supabase.from('occupanti_unita')
            .update({ attivo: false, data_fine: ieri })
            .eq('unita_id', unita_id).eq('ruolo', ruolo).eq('attivo', true)
          const { error: aErr } = await supabase.from('occupanti_unita')
            .insert([{ unita_id, persona_id: persona.id, ruolo, attivo: true, data_inizio: oggi }])
          if (aErr) console.warn(`Assegnazione unità fallita per ${r.nome} ${r.cognome}:`, aErr.message)
        }

        results.created++
      } catch (err) {
        results.errors.push({ row: r, error: err.message })
      }
    }

    await caricaPersone()
    await fetchDatiRegistro()
    return results
  }

  // --- LOGICA REGISTRO CATASTALE ---
  const checkCompletezzaUnita = (u) => {
    const catastaliMancanti = !u.catasto_foglio || !u.catasto_particella || !u.catasto_subalterno
    const occupanti = Array.isArray(u.occupanti_unita) ? u.occupanti_unita.filter(o => o.attivo) : []
    
    if (occupanti.length === 0) {
      return { completa: false, motivi: ['Nessun occupante attivo registrato'] }
    }

    const motivi = []
    if (catastaliMancanti) motivi.push('Dati catastali incompleti (F/P/S)')
    
    occupanti.forEach(occ => {
      const p = occ.persona || {}
      if (!p.codice_fiscale) motivi.push(`C.F. mancante per ${p.nome || ''} ${p.cognome || ''}`)
      if (!p.indirizzo || !p.citta) motivi.push(`Residenza incompleta per ${p.nome || ''} ${p.cognome || ''}`)
    })

    return { completa: motivi.length === 0, motivi }
  }

  const apriInvioRichieste = () => {
    const destinatariIncompleti = []
    
    unitaList.forEach(u => {
      const { completa } = checkCompletezzaUnita(u)
      if (!completa) {
        const occupanti = Array.isArray(u.occupanti_unita) ? u.occupanti_unita.filter(o => o.attivo) : []
        occupanti.forEach(occ => {
          const p = occ.persona || {}
          if (p.email && !destinatariIncompleti.some(d => d.email === p.email)) {
            destinatariIncompleti.push({
              email: p.email,
              nome: `${p.nome || ''} ${p.cognome || ''}`.trim(),
              unitaNumero: u.numero
            })
          }
        })
      }
    })

    if (destinatariIncompleti.length === 0) {
      toast.success('Tutte le anagrafiche dei condòmini registrati sono già complete!')
      return
    }

    setSelectedDestinatari(destinatariIncompleti)
    setShowSendModal(true)
  }

  const handleInviaRichieste = async () => {
    try {
      const destinatariPayload = selectedDestinatari.map(d => ({ email: d.email, nome: d.nome }))
      const oggetto = `Richiesta Aggiornamento Dati Anagrafe Condominiale - ${condominio.nome}`
      const messaggio = `Gentile Condòmino,

in allegato e ai sensi dell'art. 1130, comma 1, n. 6, del codice civile, Le richiediamo di compilare, firmare e restituire la scheda di anagrafe condominiale allegata per l'aggiornamento dei registri del condominio.

Le ricordiamo che i dati fondamentali da fornire includono i dati anagrafici e fiscali del proprietario ed eventuali inquilini, nonché i dati catastali di proprietà (Foglio, Particella, Subalterno).

La preghiamo di trasmettere il modulo compilato rispondendo a questa e-mail o consegnandolo allo studio dell'amministratore.

Cordiali saluti,
Lo Studio Amministrativo`

      await inviaComunicazione({
        condominioId,
        destinatari: destinatariPayload,
        oggetto,
        messaggio,
        tipo: 'avviso',
        skipFetch: true
      })

      toast.success(`Richieste inviate a ${selectedDestinatari.length} condòmini!`)
      setShowSendModal(false)
    } catch (e) {
      console.error(e)
      toast.error("Errore durante l'invio delle richieste.")
    }
  }

  const handleFileChange = async (u, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setAnalysing(true)
    setSelectedUnitaForOcr(u)
    setOcrData(null)
    
    try {
      const data = await estraiDatiAnagrafeDaModulo(file, condominioId)
      setSelectedUnitaForOcr(current => {
        if (current?.id === u.id) {
          setOcrData(data)
          toast.success('Modulo analizzato con successo!')
        }
        return current
      })
    } catch (err) {
      console.error(err)
      toast.error('Impossibile estrarre i dati dal modulo. Verifica la qualità del file.')
      setSelectedUnitaForOcr(current => current?.id === u.id ? null : current)
    } finally {
      setAnalysing(false)
      e.target.value = ''
    }
  }

  const handleApprovaOcr = async () => {
    if (!selectedUnitaForOcr || !ocrData) return
    setLoadingRegistro(true)
    try {
      const { error: condoErr } = await supabase
        .from('unita')
        .update({
          catasto_foglio: ocrData.unita?.catasto_foglio || selectedUnitaForOcr.catasto_foglio,
          catasto_particella: ocrData.unita?.catasto_particella || selectedUnitaForOcr.catasto_particella,
          catasto_subalterno: ocrData.unita?.catasto_subalterno || selectedUnitaForOcr.catasto_subalterno,
          catasto_categoria: ocrData.unita?.catasto_categoria || selectedUnitaForOcr.catasto_categoria,
          catasto_rendita: ocrData.unita?.catasto_rendita != null ? parseFloat(ocrData.unita.catasto_rendita) : selectedUnitaForOcr.catasto_rendita
        })
        .eq('id', selectedUnitaForOcr.id)

      if (condoErr) throw condoErr

      const occupanti = Array.isArray(selectedUnitaForOcr.occupanti_unita) 
        ? selectedUnitaForOcr.occupanti_unita.filter(o => o.attivo) 
        : []
      
      if (occupanti.length > 0 && ocrData.persona) {
        const personaCorrente = occupanti[0].persona || {}
        
        const { error: persErr } = await supabase
          .from('persone')
          .update({
            nome: ocrData.persona.nome || personaCorrente.nome,
            cognome: ocrData.persona.cognome || personaCorrente.cognome,
            codice_fiscale: ocrData.persona.codice_fiscale || personaCorrente.codice_fiscale,
            email: ocrData.persona.email || personaCorrente.email,
            telefono: ocrData.persona.telefono || personaCorrente.telefono,
            indirizzo: ocrData.persona.residenza_indirizzo || personaCorrente.indirizzo,
            citta: ocrData.persona.residenza_comune || personaCorrente.citta,
            cap: ocrData.persona.residenza_cap || personaCorrente.cap,
            provincia: ocrData.persona.residenza_provincia || personaCorrente.provincia
          })
          .eq('id', personaCorrente.id)

        if (persErr) throw persErr
      }

      toast.success('Anagrafica e dati catastali aggiornati con successo!')
      setSelectedUnitaForOcr(null)
      setOcrData(null)
      await fetchDatiRegistro()
      await caricaPersone()
    } catch (e) {
      console.error(e)
      toast.error('Errore durante l\'aggiornamento del DB.')
    } finally {
      setLoadingRegistro(false)
    }
  }

  const handleEsportaRegistroPdf = () => {
    if (unitaList.length === 0) {
      toast.error('Nessun dato catastale da esportare.')
      return
    }

    const incomplete = unitaList.filter(u => {
      const { completa } = checkCompletezzaUnita(u)
      return !completa
    })

    if (incomplete.length > 0) {
      setUnitaIncompletePerExport(incomplete)
      setShowExportConfirmModal(true)
    } else {
      exportRegistroAnagrafePdf(condominio, unitaList)
    }
  }

  const apriModificaUnita = (u) => {
    setEditUnitaId(u.id)
    setNuovoNumeroUnita(u.numero || '')
    setNuovaScala(u.scala || '')
    setNuovoPiano(u.piano != null ? String(u.piano) : '')
    setNuovoMq(u.mq != null ? String(u.mq) : '')
    setNuovoTipoUnita(u.tipo || 'appartamento')
    setNuovoCatastoFoglio(u.catasto_foglio || '')
    setNuovoCatastoParticella(u.catasto_particella || '')
    setNuovoCatastoSubalterno(u.catasto_subalterno || '')
    setNuovoCatastoCategoria(u.catasto_categoria || '')
    setNuovoCatastoRendita(u.catasto_rendita != null ? String(u.catasto_rendita) : '')
    setShowNuovaUnitaModal(true)
  }

  const apriNuovaUnita = () => {
    setEditUnitaId(null)
    setNuovoNumeroUnita('')
    setNuovaScala('')
    setNuovoPiano('')
    setNuovoMq('')
    setNuovoTipoUnita('appartamento')
    setNuovoCatastoFoglio('')
    setNuovoCatastoParticella('')
    setNuovoCatastoSubalterno('')
    setNuovoCatastoCategoria('')
    setNuovoCatastoRendita('')
    setShowNuovaUnitaModal(true)
  }

  const handleSalvaUnitaManuale = async (e) => {
    e.preventDefault()
    if (!nuovoNumeroUnita.trim()) {
      toast.error("Il numero dell'unità è obbligatorio!")
      return
    }
    setSalvandoUnita(true)
    try {
      const payload = {
        numero: nuovoNumeroUnita.trim(),
        scala: nuovaScala.trim() || null,
        piano: nuovoPiano !== '' ? parseInt(nuovoPiano) : null,
        mq: nuovoMq !== '' ? parseFloat(nuovoMq) : null,
        tipo: nuovoTipoUnita,
        catasto_foglio: nuovoCatastoFoglio.trim() || null,
        catasto_particella: nuovoCatastoParticella.trim() || null,
        catasto_subalterno: nuovoCatastoSubalterno.trim() || null,
        catasto_categoria: nuovoCatastoCategoria.trim() || null,
        catasto_rendita: nuovoCatastoRendita !== '' ? parseFloat(nuovoCatastoRendita) : null
      }

      if (editUnitaId) {
        const { error } = await supabase
          .from('unita')
          .update(payload)
          .eq('id', editUnitaId)
        if (error) throw error
        toast.success('Unità immobiliare aggiornata con successo!')
      } else {
        const { error } = await supabase
          .from('unita')
          .insert([{ condominio_id: condominioId, ...payload }])
        if (error) throw error
        toast.success('Unità immobiliare inserita con successo!')
      }

      setShowNuovaUnitaModal(false)
      setEditUnitaId(null)
      setNuovoNumeroUnita('')
      setNuovaScala('')
      setNuovoPiano('')
      setNuovoMq('')
      setNuovoTipoUnita('appartamento')
      setNuovoCatastoFoglio('')
      setNuovoCatastoParticella('')
      setNuovoCatastoSubalterno('')
      setNuovoCatastoCategoria('')
      setNuovoCatastoRendita('')

      await fetchDatiRegistro()
      await caricaUnitaDropdown()
    } catch (err) {
      toast.error('Errore salvataggio unità: ' + err.message)
    } finally {
      setSalvandoUnita(false)
    }
  }

  return (
    <div style={styles.container}>
      <WatermarkModal />

      {/* Switch di visualizzazione premium */}
      <div style={styles.viewSelector}>
        <button 
          onClick={() => setVistaAttiva('registro')}
          style={styles.selectorBtn(vistaAttiva === 'registro')}
        >
          <Building2 size={15} style={{ marginRight: 6 }} /> Proprietà & Catasto
        </button>
        <button 
          onClick={() => setVistaAttiva('rubrica')}
          style={styles.selectorBtn(vistaAttiva === 'rubrica')}
        >
          <Search size={15} style={{ marginRight: 6 }} /> Rubrica Contatti
        </button>
      </div>
      
      {/* -------------------- VISTA REGISTRO (PROPRIETA & CATASTO) -------------------- */}
      {vistaAttiva === 'registro' && (
        <div>
          {/* Top Actions Registro */}
          <div style={styles.filterRow}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={fetchDatiRegistro} style={styles.filterBtn(false)} disabled={loadingRegistro}>
                <RefreshCw size={14} style={{ marginRight: 6 }} /> Aggiorna
              </button>
              {!isCollaboratore && (
                <>
                  <button onClick={apriNuovaUnita} style={{ ...styles.filterBtn(false), color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }} disabled={loadingRegistro}>
                    <Plus size={14} style={{ marginRight: 6 }} /> Nuova Unità
                  </button>
                  <button onClick={apriInvioRichieste} style={styles.filterBtn(false)} disabled={loadingRegistro}>
                    <Mail size={14} style={{ marginRight: 6 }} /> Sollecita mancanti
                  </button>
                </>
              )}
            </div>
            
            <button onClick={handleEsportaRegistroPdf} style={{ ...styles.filterBtn(false), background: '#2563eb', color: '#fff', fontWeight: 600 }} disabled={loadingRegistro || unitaList.length === 0}>
              <Download size={14} style={{ marginRight: 6 }} /> REGISTRO ANAGRAFE PDF
            </button>
          </div>

          {/* Tabella Registro */}
          {loadingRegistro && unitaList.length === 0 ? (
            <div style={styles.loading}>Caricamento registro catastale...</div>
          ) : unitaList.length === 0 ? (
            <div style={styles.empty}>Nessuna unità immobiliare censita in questo condominio.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Unità</th>
                    <th style={styles.th}>Dati Catastali (F/P/S)</th>
                    <th style={styles.th}>Soggetti (C.F. - Ruolo)</th>
                    <th style={styles.th}>Residenza / Domicilio</th>
                    {!isCollaboratore && <th style={{ ...styles.th, textAlign: 'center' }}>Azioni</th>}
                  </tr>
                </thead>
                <tbody>
                  {unitaList.map(u => {
                    const catastaliMancanti = !u.catasto_foglio || !u.catasto_particella || !u.catasto_subalterno
                    const occupanti = Array.isArray(u.occupanti_unita) ? u.occupanti_unita.filter(o => o.attivo) : []
                    const unitaDescr = `${u.numero}${u.scala ? ` (Sc. ${u.scala})` : ''}${u.piano != null ? ` - Piano ${u.piano}` : ''}`

                    return (
                      <tr key={u.id} style={styles.tr}>
                        <td style={{ ...styles.td, fontWeight: 700 }}>{unitaDescr}</td>

                        <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 13 }}>
                          {catastaliMancanti 
                            ? '-' 
                            : `F.${u.catasto_foglio} P.${u.catasto_particella} S.${u.catasto_subalterno}`}
                        </td>

                        <td style={styles.td}>
                          {occupanti.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setNuovoUnitaId(u.id)
                                setNuovoRuolo('proprietario')
                                setShowNuovoModal(true)
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#3b82f6',
                                cursor: 'pointer',
                                fontSize: 13,
                                textDecoration: 'underline',
                                padding: 0,
                                fontWeight: 500,
                                textAlign: 'left'
                              }}
                            >
                              ➕ Aggiungi Soggetto
                            </button>
                          ) : (
                            occupanti.map(occ => (
                              <div key={occ.id} style={{ marginBottom: 4 }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {occ.persona?.cognome} {occ.persona?.nome}
                                </span>
                                <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                                  ({occ.persona?.codice_fiscale || 'C.F. assente'})
                                </span>
                                <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'var(--border-color)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                                  {occ.ruolo}
                                </span>
                              </div>
                            ))
                          )}
                        </td>

                        <td style={styles.td}>
                          {occupanti.map(occ => {
                            const p = occ.persona || {}
                            if (!p.indirizzo) return <span key={occ.id} style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13, display: 'block' }}>Non specificata</span>
                            return (
                              <div key={occ.id} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>
                                {p.indirizzo}, {p.citta} ({p.provincia || ''})
                              </div>
                            )
                          })}
                          {occupanti.length === 0 && '-'}
                        </td>

                        {!isCollaboratore && (
                          <td style={{ ...styles.td, textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button
                                onClick={() => apriModificaUnita(u)}
                                title="Modifica dati unità e dati catastali"
                                style={{ ...styles.btnEdit, border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                              >
                                📝 Modifica
                              </button>

                              {occupanti.length === 0 ? (
                                <button
                                  onClick={() => {
                                    setNuovoUnitaId(u.id)
                                    setNuovoRuolo('proprietario')
                                    setShowNuovoModal(true)
                                  }}
                                  title="Aggiungi proprietario o inquilino a questa unità"
                                  style={{ ...styles.btnEdit, background: '#10b981', color: '#fff', border: '1px solid #10b981' }}
                                >
                                  <Plus size={12} style={{ marginRight: 4 }} /> Soggetto
                                </button>
                              ) : (
                                <>
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    ref={el => fileInputRefs.current[u.id] = el}
                                    onChange={e => handleFileChange(u, e)}
                                    style={{ display: 'none' }}
                                  />
                                  <button 
                                    onClick={() => fileInputRefs.current[u.id]?.click()}
                                    title="Carica modulo autocertificazione compilato"
                                    style={styles.btnEdit}
                                  >
                                    <Upload size={14} style={{ marginRight: 6 }} /> Carica Modulo
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* -------------------- VISTA CLASSICA (RUBRICA CONTATTI) -------------------- */}
      {vistaAttiva === 'rubrica' && (
        <div>
          {/* Sezione Filtri Rubrica */}
          <div style={styles.filterRow}>
            <div style={styles.searchSec}>
              <Search size={16} color="#64748b" style={{ marginLeft: 10 }} />
              <input
                type="text"
                placeholder="Cerca condomino per nome, email o unità..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={styles.searchInput}
              />
            </div>

            <div style={styles.tabFilters}>
              {[
                { id: 'tutti', label: 'Tutti' },
                { id: 'proprietario', label: 'Proprietari' },
                { id: 'inquilino', label: 'Inquilini' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroRuolo(f.id)}
                  style={styles.filterBtn(filtroRuolo === f.id)}
                >
                  {f.label}
                </button>
              ))}
              <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                <button
                  type="button"
                 onClick={() => {
                    setNuovoUnitaId('')
                    setNuovoRuolo('proprietario')
                    setShowNuovoModal(true)
                  }}
                  style={{ ...styles.filterBtn(false), display: 'flex', alignItems: 'center', gap: 6, color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', padding: '6px 10px' }}
                  title="Crea manualmente un nuovo condòmino"
                >
                  <Plus size={14} /> Nuovo
                </button>
                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  style={{ ...styles.filterBtn(false), display: 'flex', alignItems: 'center', gap: 6, color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', padding: '6px 10px' }}
                  title="Importa anagrafica da file Excel, Word o PDF"
                >
                  <Upload size={14} /> Importa
                </button>
                <button
                  type="button"
                  onClick={() => exportAnagraficaXlsx({ condominio: { nome: 'Condominio' }, persone: personeFiltrate })}
                  style={{ ...styles.filterBtn(false), display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '6px 10px' }}
                  title="Esporta in Excel"
                >
                  <Download size={14} /> Excel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    checkWatermark((withWatermark) => {
                    exportAnagraficaPdf({ condominio: condominio || { nome: 'Condominio' }, persone: personeFiltrate }, withWatermark)
                    })
                  }}
                  style={{ ...styles.filterBtn(false), display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '6px 10px' }}
                  title="Esporta in PDF"
                >
                  <FileText size={14} /> PDF
                </button>
              </div>
            </div>
          </div>

          {/* Tabella Rubrica */}
          {loadingPersone ? (
            <div style={styles.loading}>Caricamento anagrafica...</div>
          ) : personeFiltrate.length === 0 ? (
            <div style={styles.empty}>Nessun condòmino corrispondente ai filtri impostati.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Condòmino</th>
                    <th style={styles.th}>Ruolo</th>
                    <th style={styles.th}>Contatti</th>
                    <th style={styles.th}>Unità Collegate</th>
                    <th style={styles.th}>Residenza</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {personeFiltrate.map(p => {
                    const iniziali = `${p.nome?.[0] || ''}${p.cognome?.[0] || ''}`.toUpperCase()
                    return (
                      <tr key={p.id} style={styles.tr}>
                        <td style={styles.td}>
                          <div style={styles.profileRow}>
                            <div style={styles.avatar}>{iniziali || '?'}</div>
                            <div style={{ textAlign: 'left' }}>
                              <div style={styles.fullName}>{p.cognome} {p.nome}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>ID: {p.id.slice(0, 8)}</div>
                            </div>
                          </div>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.roleBadge(p.isProprietario)}>
                            {p.ruoli}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.contactItem}><Mail size={12} color="#64748b" /> {p.email || '—'}</div>
                          <div style={{ ...styles.contactItem, marginTop: 4 }}><Phone size={12} color="#64748b" /> {p.telefono || '—'}</div>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.contactItem}><Home size={12} color="#64748b" /> {p.unitaNomi || 'Nessuna'}</div>
                        </td>
                        <td style={styles.td}>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{p.indirizzo || '—'}</div>
                          {p.citta && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.citta}</div>}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <button onClick={() => apriModifica(p)} style={styles.btnEdit} title="Modifica Anagrafica">
                            <UserCog size={14} style={{ marginRight: 6 }} /> Modifica
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* -------------------- SEZIONE MODALI CONDIVISE -------------------- */}

      {/* MODALE CONFRONTO AI (OCR) */}
      {selectedUnitaForOcr && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, width: 680, display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: 18, margin: '0 0 8px', fontWeight: 700 }}>Modulo Autocertificazione AI Reader</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
              Verifica ed approva i dati estratti per l'unità <strong>{selectedUnitaForOcr.numero}</strong>.
            </p>

            {analysing ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 16 }}>
                <div style={{ width: 36, height: 36, border: '4px solid var(--border-color)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Gemini sta elaborando il documento...</p>
              </div>
            ) : ocrData ? (
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: 24, paddingRight: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  
                  {/* Sezione Catasto */}
                  <div style={{ gridColumn: 'span 2', padding: 12, background: 'var(--app-bg)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 10px', color: '#3b82f6', fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>Dati Catastali Unità</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 13 }}>
                      <div>
                        <span style={styles.lbl}>Foglio</span>
                        <div style={styles.val}>{ocrData.unita?.catasto_foglio || '-'}</div>
                      </div>
                      <div>
                        <span style={styles.lbl}>Particella</span>
                        <div style={styles.val}>{ocrData.unita?.catasto_particella || '-'}</div>
                      </div>
                      <div>
                        <span style={styles.lbl}>Subalterno</span>
                        <div style={styles.val}>{ocrData.unita?.catasto_subalterno || '-'}</div>
                      </div>
                      <div>
                        <span style={styles.lbl}>Categoria</span>
                        <div style={styles.val}>{ocrData.unita?.catasto_categoria || '-'}</div>
                      </div>
                      <div>
                        <span style={styles.lbl}>Rendita</span>
                        <div style={styles.val}>{ocrData.unita?.catasto_rendita != null ? `€ ${ocrData.unita.catasto_rendita}` : '-'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Sezione Persona / Residenza */}
                  <div style={{ gridColumn: 'span 2', padding: 12, background: 'var(--app-bg)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 10px', color: '#10b981', fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>Dati Occupante ({ocrData.ruolo || 'proprietario'})</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                      <div>
                        <span style={styles.lbl}>Cognome e Nome</span>
                        <div style={styles.val}>{ocrData.persona?.cognome || '-'} {ocrData.persona?.nome || ''}</div>
                      </div>
                      <div>
                        <span style={styles.lbl}>Codice Fiscale</span>
                        <div style={{ ...styles.val, fontFamily: 'monospace', fontWeight: 600 }}>{ocrData.persona?.codice_fiscale || '-'}</div>
                      </div>
                      <div>
                        <span style={styles.lbl}>Email</span>
                        <div style={styles.val}>{ocrData.persona?.email || '-'}</div>
                      </div>
                      <div>
                        <span style={styles.lbl}>Telefono</span>
                        <div style={styles.val}>{ocrData.persona?.telefono || '-'}</div>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={styles.lbl}>Residenza</span>
                        <div style={styles.val}>
                          {ocrData.persona?.residenza_indirizzo || '-'}, {ocrData.persona?.residenza_comune || ''} {ocrData.persona?.residenza_cap || ''} ({ocrData.persona?.residenza_provincia || ''})
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <p style={{ color: '#ef4444', textAlign: 'center', padding: '20px 0' }}>Errore caricamento dati.</p>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
              <button 
                onClick={() => { setSelectedUnitaForOcr(null); setOcrData(null); }}
                disabled={analysing}
                style={{ 
                  flex: 1, background: 'transparent', color: 'var(--text-secondary)', 
                  border: '1px solid var(--border-color)', padding: 12, borderRadius: 8, 
                  cursor: analysing ? 'not-allowed' : 'pointer', fontWeight: 600,
                  opacity: analysing ? 0.5 : 1
                }}
              >
                Annulla
              </button>
              <button 
                onClick={handleApprovaOcr}
                disabled={analysing || !ocrData}
                style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', padding: 12, borderRadius: 8, cursor: (analysing || !ocrData) ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                Approva ed Aggiorna
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE SOLLECITI MASSIVI */}
      {showSendModal && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, width: 480, display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: 18, margin: '0 0 8px', fontWeight: 700 }}>Sollecita Dati Anagrafe</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
              Verrà inviata un'email di sollecito con allegata autocertificazione ai seguenti condòmini incompleti:
            </p>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedDestinatari.map(d => (
                <div key={d.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>{d.nome}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{d.email}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#1e3a5f', color: '#60a5fa', fontWeight: 600 }}>
                    Unità {d.unitaNumero}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" style={styles.btnCancel} onClick={() => setShowSendModal(false)}>Annulla</button>
              <button 
                onClick={handleInviaRichieste} 
                disabled={inviandoMail} 
                style={{ ...styles.btnSave, flex: 1 }}
              >
                {inviandoMail ? 'Invio...' : `Invia a ${selectedDestinatari.length} condòmini`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Modifica Rubrica */}
      {editingPersona && (
        <div style={styles.overlay} onClick={() => setEditingPersona(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <UserCog size={18} color="#60a5fa" />
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>Modifica Anagrafica Condòmino</span>
              </div>
              <button style={styles.btnClose} onClick={() => setEditingPersona(null)}><X size={16} /></button>
            </div>
            
            <form onSubmit={handleSalva}>
              <div style={styles.modalBody}>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Nome</label>
                    <input style={styles.input} type="text" required value={nome} onChange={e => setNome(e.target.value)} />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Cognome</label>
                    <input style={styles.input} type="text" required value={cognome} onChange={e => setCognome(e.target.value)} />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Email</label>
                  <input style={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Telefono</label>
                  <input style={styles.input} type="text" value={telefono} onChange={e => setTelefono(e.target.value)} />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Indirizzo di Residenza</label>
                  <input style={styles.input} type="text" value={indirizzo} onChange={e => setIndirizzo(e.target.value)} />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Città</label>
                  <input style={styles.input} type="text" value={citta} onChange={e => setCitta(e.target.value)} />
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button type="button" style={styles.btnCancel} onClick={() => setEditingPersona(null)}>Annulla</button>
                <button type="submit" disabled={salvando} style={styles.btnSave}>
                  {salvando ? 'Salvataggio...' : 'Salva Modifiche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Nuovo Condòmino */}
      {showNuovoModal && (
        <div style={styles.overlay} onClick={() => setShowNuovoModal(false)}>
          <div style={{ ...styles.modal, width: 550 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Plus size={18} color="#60a5fa" />
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>Nuovo Condòmino</span>
              </div>
              <button style={styles.btnClose} onClick={() => setShowNuovoModal(false)}><X size={16} /></button>
            </div>
            
            <form onSubmit={handleCreaNuovo}>
              <div style={{ ...styles.modalBody, maxHeight: '65vh', overflowY: 'auto', paddingRight: 6 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, borderBottom: '1px solid var(--border-color)', paddingBottom: 4, textAlign: 'left' }}>Dati Anagrafici</div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Cognome *</label>
                    <input style={styles.input} type="text" required value={nuovoCognome} onChange={e => setNuovoCognome(e.target.value)} placeholder="es. Rossi" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Nome *</label>
                    <input style={styles.input} type="text" required value={nuovoNome} onChange={e => setNuovoNome(e.target.value)} placeholder="es. Mario" />
                  </div>
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Codice Fiscale</label>
                    <input style={styles.input} type="text" value={nuovoCf} onChange={e => setNuovoCf(e.target.value)} maxLength={16} placeholder="es. RSSMRA80A01F205X" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Data di Nascita</label>
                    <input style={styles.input} type="date" value={nuovoDataNascita} onChange={e => setNuovoDataNascita(e.target.value)} />
                  </div>
                </div>

                <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 12, marginBottom: 6, borderBottom: '1px solid var(--border-color)', paddingBottom: 4, textAlign: 'left' }}>Contatti</div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Email</label>
                    <input style={styles.input} type="email" value={nuovoEmail} onChange={e => setNuovoEmail(e.target.value)} placeholder="es. email@esempio.it" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Telefono</label>
                    <input style={styles.input} type="text" value={nuovoTelefono} onChange={e => setNuovoTelefono(e.target.value)} placeholder="es. 3331234567" />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Telefono Alternativo</label>
                  <input style={styles.input} type="text" value={nuovoTelefonoAlt} onChange={e => setNuovoTelefonoAlt(e.target.value)} placeholder="es. 02123456" />
                </div>

                <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 12, marginBottom: 6, borderBottom: '1px solid var(--border-color)', paddingBottom: 4, textAlign: 'left' }}>Residenza</div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Indirizzo</label>
                  <input style={styles.input} type="text" value={nuovoIndirizzo} onChange={e => setNuovoIndirizzo(e.target.value)} placeholder="es. Via Roma 10" />
                </div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Città</label>
                    <input style={styles.input} type="text" value={nuovoCitta} onChange={e => setNuovoCitta(e.target.value)} placeholder="es. Milano" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>CAP</label>
                      <input style={styles.input} type="text" value={nuovoCap} onChange={e => setNuovoCap(e.target.value)} maxLength={5} placeholder="20100" />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Prov.</label>
                      <input style={styles.input} type="text" value={nuovoProvincia} onChange={e => setNuovoProvincia(e.target.value)} maxLength={2} placeholder="MI" />
                    </div>
                  </div>
                </div>

                <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 12, marginBottom: 6, borderBottom: '1px solid var(--border-color)', paddingBottom: 4, textAlign: 'left' }}>Assegnazione Unità</div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Unità</label>
                    <select style={styles.input} value={nuovoUnitaId} onChange={e => setNuovoUnitaId(e.target.value)}>
                      <option value="">-- Nessuna Associazione --</option>
                      {unitaListDropdown.map(u => (
                        <option key={u.id} value={u.id}>
                          Unità {u.numero} {u.scala ? `(Scala ${u.scala})` : ''} {u.piano !== null ? `(Piano ${u.piano})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Ruolo</label>
                    <select style={styles.input} value={nuovoRuolo} onChange={e => setNuovoRuolo(e.target.value)} disabled={!nuovoUnitaId}>
                      <option value="proprietario">Proprietario</option>
                      <option value="inquilino">Inquilino</option>
                    </select>
                  </div>
                </div>

                <div style={{ ...styles.formGroup, marginTop: 12 }}>
                  <label style={styles.label}>Note</label>
                  <textarea style={{ ...styles.input, minHeight: 50, resize: 'vertical' }} value={nuovoNote} onChange={e => setNuovoNote(e.target.value)} />
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button type="button" style={styles.btnCancel} onClick={() => setShowNuovoModal(false)}>Annulla</button>
                <button type="submit" disabled={salvandoNuovo} style={styles.btnSave}>
                  {salvandoNuovo ? 'Salvataggio...' : 'Crea Condòmino'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE NUOVA UNITÀ MANUALE */}
      {showNuovaUnitaModal && (
        <div style={styles.overlay} onClick={() => setShowNuovaUnitaModal(false)}>
          <div style={{ ...styles.modal, width: 520 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {editUnitaId ? <Plus size={18} color="#fbbf24" /> : <Plus size={18} color="#60a5fa" />}
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>
                  {editUnitaId ? 'Modifica Unità Immobiliare' : 'Nuova Unità Immobiliare'}
                </span>
              </div>
              <button style={styles.btnClose} onClick={() => { setShowNuovaUnitaModal(false); setEditUnitaId(null); }}><X size={16}/></button>
            </div>

            <form onSubmit={handleSalvaUnitaManuale}>
              <div style={{ ...styles.modalBody, maxHeight: '65vh', overflowY: 'auto', paddingRight: 6 }}>
                
                <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, borderBottom: '1px solid var(--border-color)', paddingBottom: 4, textAlign: 'left' }}>Dati Immobile</div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Numero Unità *</label>
                    <input style={styles.input} type="text" required value={nuovoNumeroUnita} onChange={e => setNuovoNumeroUnita(e.target.value)} placeholder="es. A10 o 15" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Scala</label>
                    <input style={styles.input} type="text" value={nuovaScala} onChange={e => setNuovaScala(e.target.value)} placeholder="es. A" />
                  </div>
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Piano</label>
                    <input style={styles.input} type="number" value={nuovoPiano} onChange={e => setNuovoPiano(e.target.value)} placeholder="es. 3" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Superficie (mq)</label>
                    <input style={styles.input} type="number" step="any" value={nuovoMq} onChange={e => setNuovoMq(e.target.value)} placeholder="es. 85" />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Tipo Unità</label>
                  <select style={styles.input} value={nuovoTipoUnita} onChange={e => setNuovoTipoUnita(e.target.value)}>
                    <option value="appartamento">Appartamento</option>
                    <option value="box">Box Auto / Garage</option>
                    <option value="cantina">Cantina</option>
                    <option value="negozio">Negozio / Ufficio</option>
                    <option value="altro">Altro</option>
                  </select>
                </div>

                <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 12, marginBottom: 6, borderBottom: '1px solid var(--border-color)', paddingBottom: 4, textAlign: 'left' }}>Dati Catastali</div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Foglio</label>
                    <input style={styles.input} type="text" value={nuovoCatastoFoglio} onChange={e => setNuovoCatastoFoglio(e.target.value)} placeholder="es. 12" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Particella / Mappale</label>
                    <input style={styles.input} type="text" value={nuovoCatastoParticella} onChange={e => setNuovoCatastoParticella(e.target.value)} placeholder="es. 450" />
                  </div>
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Subalterno</label>
                    <input style={styles.input} type="text" value={nuovoCatastoSubalterno} onChange={e => setNuovoCatastoSubalterno(e.target.value)} placeholder="es. 3" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Categoria</label>
                    <input style={styles.input} type="text" value={nuovoCatastoCategoria} onChange={e => setNuovoCatastoCategoria(e.target.value)} placeholder="es. A/3" />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Rendita Catastale (€)</label>
                  <input style={styles.input} type="number" step="any" value={nuovoCatastoRendita} onChange={e => setNuovoCatastoRendita(e.target.value)} placeholder="es. 520.00" />
                </div>

              </div>

              <div style={styles.modalFooter}>
                <button type="button" style={styles.btnCancel} onClick={() => setShowNuovaUnitaModal(false)}>Annulla</button>
                <button type="submit" disabled={salvandoUnita} style={styles.btnSave}>
                  {salvandoUnita ? 'Salvataggio...' : (editUnitaId ? 'Salva Modifiche' : 'Crea Unità')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP CONFERMA ESPORTAZIONE REGISTRO INCOMPLETO */}
      {showExportConfirmModal && (
        <div style={styles.overlay} onClick={() => setShowExportConfirmModal(false)}>
          <div style={{ ...styles.modal, width: 480 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={20} color="#eab308" />
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>Dati Registro Incompleti</span>
              </div>
              <button style={styles.btnClose} onClick={() => setShowExportConfirmModal(false)}><X size={16}/></button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, margin: '0 0 12px' }}>
                Attenzione: le seguenti unità abitative non sono ancora complete. Mancano i dati catastali o non vi sono associati condòmini completi:
              </p>
              <div style={{ maxHeight: 120, overflowY: 'auto', background: 'var(--app-bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {unitaIncompletePerExport.map(u => (
                  <span key={u.id} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(234,179,8,0.15)', color: '#facc15', fontWeight: 600 }}>
                    Unità {u.numero}
                  </span>
                ))}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 12, margin: 0 }}>
                Vuoi procedere comunque con il download del PDF del Registro Anagrafe?
              </p>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" style={styles.btnCancel} onClick={() => setShowExportConfirmModal(false)}>Annulla</button>
              <button 
                onClick={() => {
                  setShowExportConfirmModal(false)
                  exportRegistroAnagrafePdf(condominio, unitaList)
                }} 
                style={{ ...styles.btnSave, background: '#2563eb' }}
              >
                Procedi ed Esporta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Importazione AI */}
      {showImport && (
        <AnagraficaImport onImport={handleImport} onClose={() => setShowImport(false)} />
      )}
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', width: '100%', fontFamily: 'Sora, sans-serif' },
  viewSelector: { display: 'flex', gap: 10, borderBottom: '1px solid var(--border-color)', paddingBottom: 14, marginBottom: 20 },
  selectorBtn: (active) => ({
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer',
    border: 'none', background: active ? 'rgba(37,99,235,0.12)' : 'transparent',
    color: active ? '#60a5fa' : '#64748b', transition: 'all 0.15s', fontFamily: 'Sora, sans-serif',
    display: 'flex', alignItems: 'center'
  }),
  filterRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  searchSec: { display: 'flex', alignItems: 'center', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, width: 340, maxWidth: '100%' },
  searchInput: { background: 'transparent', border: 'none', padding: '9px 10px', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 13, outline: 'none', width: '100%' },
  tabFilters: { display: 'flex', gap: 6, background: 'var(--app-bg)', padding: 4, borderRadius: 8, border: '1px solid var(--border-color-2)', flexWrap: 'wrap' },
  filterBtn: (active) => ({ padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: 'none', background: active ? '#2563eb' : 'transparent', color: active ? '#fff' : '#64748b', fontFamily: 'Sora, sans-serif', fontWeight: active ? 600 : 400, transition: 'all 0.15s' }),
  loading: { textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 },
  empty: { textAlign: 'center', padding: 40, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border-color)', color: 'var(--text-muted)' },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 12 },
  table: { borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontFamily: 'Sora, sans-serif' },
  th: { background: 'var(--app-bg)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, padding: '14px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' },
  tr: { background: 'var(--card-bg)', transition: 'background 0.15s' },
  td: { padding: '12px 12px', borderBottom: '1px solid var(--border-color-2)', verticalAlign: 'middle', fontSize: 13, color: 'var(--text-primary)' },
  profileRow: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  fullName: { color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 },
  roleBadge: (isProprietario) => ({ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: isProprietario ? 'rgba(37,99,235,0.15)' : 'rgba(16,185,129,0.15)', color: isProprietario ? '#60a5fa' : '#34d399' }),
  contactItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)' },
  btnEdit: { background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 12px', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: 600, display: 'inline-flex', alignItems: 'center' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  modal: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 22, width: 440, maxWidth: '90vw', fontFamily: 'Sora, sans-serif' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  btnClose: { background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  modalBody: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { width: '100%', boxSizing: 'border-box', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '9px 10px', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border-color)', paddingTop: 14 },
  btnCancel: { background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 8, padding: '9px 20px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontSize: 13 },
  btnSave: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
  badgeWarn: { background: '#450a0a', color: '#f87171', border: '1px solid #991b1b', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, display: 'inline-block' },
  badgeOk: { background: '#064e3b', color: '#34d399', border: '1px solid #065f46', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, display: 'inline-block' },
  lbl: { display: 'block', color: 'var(--text-muted)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' },
  val: { color: 'var(--text-primary)', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '8px 10px', minHeight: 18 }
}
