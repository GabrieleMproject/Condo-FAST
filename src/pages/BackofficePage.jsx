import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Users, Ticket, Search, Save, MessageSquare, Send, Gift, Plus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { callClaude } from '../lib/claudeClient'

export default function BackofficePage() {
  const [activeTab, setActiveTab] = useState('utenti')
  const [utenti, setUtenti] = useState([])
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  const [ticketSearch, setTicketSearch] = useState('')
  const [rispostaText, setRispostaText] = useState('')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [generaKB, setGeneraKB] = useState(true)

  // Referral & Campagne states
  const [campagne, setCampagne] = useState([])
  const [referrals, setReferrals] = useState([])
  const [newCampagna, setNewCampagna] = useState({ nome: '', codice_campagna: '', sconto_importo: 10, attiva: false })
  const [creatingCampagna, setCreatingCampagna] = useState(false)

  // Knowledge Base states
  const [knowledgeList, setKnowledgeList] = useState([])
  const [kbSearch, setKbSearch] = useState('')
  const [editingKb, setEditingKb] = useState(null)
  const [kbForm, setKbForm] = useState({ argomento: '', domanda_sintesi: '', risoluzione: '', tags: '' })

  // Stati ricerca e filtri utenti
  const [userSearch, setUserSearch] = useState('')
  const [filterPiano, setFilterPiano] = useState('tutti')
  const [filterInattivi, setFilterInattivi] = useState(false)

  // Stati form marketing
  const [marketingForm, setMarketingForm] = useState({ target: 'tutti', oggetto: '', messaggio: '' })
  const [generandoTestoAI, setGenerandoTestoAI] = useState(false)
  const [inviandoEmail, setInviandoEmail] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // ✅ Caricamento tramite RPC aggregata
      const { data: prof, error: profErr } = await supabase
        .rpc('get_utenti_statistiche')
      
      if (profErr) throw profErr
      setUtenti(prof || [])

      const { data: tick, error: tickErr } = await supabase
        .from('tickets_assistenza')
        .select('*')
        .order('created_at', { ascending: false })

      if (tickErr) throw tickErr
      setTickets(tick || [])

      // Fetch Campagne
      const { data: camp, error: campErr } = await supabase
        .from('referral_campaigns')
        .select('*')
        .order('created_at', { ascending: false })

      if (campErr) throw campErr
      setCampagne(camp || [])

      // Fetch Referrals
      const { data: refs, error: refsErr } = await supabase
        .from('referrals')
        .select(`
          *,
          referrer:profiles!referrer_id(id, email, nome, cognome),
          referred:profiles!referred_id(id, email, nome, cognome),
          campaign:referral_campaigns(nome, codice_campagna)
        `)
        .order('created_at', { ascending: false })

      if (refsErr) throw refsErr
      setReferrals(refs || [])

      // Fetch Knowledge Base
      const { data: kb, error: kbErr } = await supabase
        .from('assistenza_knowledge')
        .select('*')
        .order('created_at', { ascending: false })

      if (kbErr) throw kbErr
      setKnowledgeList(kb || [])

    } catch (err) {
      toast.error('Errore caricamento dati: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleModificaPiano = async (utenteId, nuovoPiano) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ piano: nuovoPiano })
        .eq('id', utenteId)
      
      if (error) throw error
      toast.success('Piano dell\'utente aggiornato con successo!')
      fetchData()
    } catch (err) {
      toast.error('Errore durante la modifica del piano: ' + err.message)
    }
  }

  const handleRispondi = async (ticket) => {
    if (!rispostaText.trim()) return toast.error('Inserisci una risposta')
    
    let loadingToast = null;
    if (generaKB) {
      loadingToast = toast.loading('Invio risposta e generazione articolo Knowledge Base AI...');
    } else {
      loadingToast = toast.loading('Invio risposta in corso...');
    }

    try {
      // 1. Aggiorna il ticket
      const { error } = await supabase
        .from('tickets_assistenza')
        .update({ risposta_admin: rispostaText, stato: 'chiuso', updated_at: new Date().toISOString() })
        .eq('id', ticket.id)

      if (error) throw error

      // 2. Genera articolo Knowledge Base con l'AI se richiesto
      if (generaKB) {
        try {
          const promptSintesi = `Analizza questo ticket di assistenza di CondoSmart e la relativa risoluzione.
Genera un articolo per la nostra Knowledge Base in formato JSON con le seguenti chiavi:
- "argomento": il tema principale (max 4 parole, es. "Importazione anagrafica Excel" o "Calcolo ripartizione millesimale")
- "domanda_sintesi": la domanda riassuntiva che un utente potrebbe fare per riscontrare questo problema (max 15 parole, es. "Come posso importare i condòmini da un file Excel?")
- "risoluzione": la spiegazione passo-passo della soluzione (max 100 parole, chiara, diretta e professionale, es. "Vai in Condomini, entra nel condominio desiderato, seleziona il tab Anagrafica e clicca su...")
- "tags": un array di stringhe/parole chiave utili per la ricerca (es. ["excel", "anagrafica", "importazione"])

Dettagli del ticket:
=== MESSAGGIO UTENTE ===
${ticket.messaggio}

=== RISOLUZIONE SUPPORTO ===
${rispostaText}

Rispondi esplicitamente in formato JSON valido.`

          const resAI = await callClaude(promptSintesi, { funzione: 'assistenza_sintesi', jsonMode: true })
          
          let dataKB;
          try {
            dataKB = JSON.parse(resAI)
          } catch (pe) {
            // Fallback se l'AI restituisce del testo prima o dopo il blocco JSON
            const jsonMatch = resAI.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              dataKB = JSON.parse(jsonMatch[0])
            } else {
              throw pe
            }
          }

          if (dataKB && dataKB.argomento && dataKB.domanda_sintesi && dataKB.risoluzione) {
            const { error: kbErr } = await supabase
              .from('assistenza_knowledge')
              .insert({
                argomento: dataKB.argomento,
                domanda_sintesi: dataKB.domanda_sintesi,
                risoluzione: dataKB.risoluzione,
                tags: dataKB.tags || []
              })
            
            if (kbErr) throw kbErr
          }
        } catch (aiErr) {
          console.error('Errore generazione KB AI:', aiErr)
          toast.error('Risposta inviata, ma la generazione KB AI è fallita.')
        }
      }

      toast.dismiss(loadingToast)
      toast.success('Risposta inviata e ticket chiuso con successo!')
      setRispostaText('')
      setSelectedTicket(null)
      fetchData()
    } catch (err) {
      if (loadingToast) toast.dismiss(loadingToast)
      toast.error('Errore invio risposta: ' + err.message)
    }
  }

  const handleSaveKb = async (e) => {
    e.preventDefault()
    if (!kbForm.argomento || !kbForm.domanda_sintesi || !kbForm.risoluzione) {
      return toast.error('Compila tutti i campi obbligatori')
    }

    const tagsArray = kbForm.tags
      ? kbForm.tags.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0)
      : []

    try {
      if (editingKb?.id) {
        // Update
        const { error } = await supabase
          .from('assistenza_knowledge')
          .update({
            argomento: kbForm.argomento,
            domanda_sintesi: kbForm.domanda_sintesi,
            risoluzione: kbForm.risoluzione,
            tags: tagsArray,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingKb.id)

        if (error) throw error
        toast.success('Articolo aggiornato con successo')
      } else {
        // Insert
        const { error } = await supabase
          .from('assistenza_knowledge')
          .insert({
            argomento: kbForm.argomento,
            domanda_sintesi: kbForm.domanda_sintesi,
            risoluzione: kbForm.risoluzione,
            tags: tagsArray
          })

        if (error) throw error
        toast.success('Articolo creato con successo')
      }
      setEditingKb(null)
      setKbForm({ argomento: '', domanda_sintesi: '', risoluzione: '', tags: '' })
      fetchData()
    } catch (err) {
      toast.error('Errore salvataggio articolo: ' + err.message)
    }
  }

  const handleDeleteKb = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo articolo di Knowledge Base?')) return
    try {
      const { error } = await supabase
        .from('assistenza_knowledge')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Articolo eliminato')
      fetchData()
    } catch (err) {
      toast.error('Errore eliminazione articolo: ' + err.message)
    }
  }

  const startEditKb = (item) => {
    setEditingKb(item)
    setKbForm({
      argomento: item.argomento,
      domanda_sintesi: item.domanda_sintesi,
      risoluzione: item.risoluzione,
      tags: item.tags ? item.tags.join(', ') : ''
    })
  }

  const startNewKb = () => {
    setEditingKb({ id: null })
    setKbForm({ argomento: '', domanda_sintesi: '', risoluzione: '', tags: '' })
  }

  const handleChiudiTicket = async (id) => {
    try {
      const { error } = await supabase
        .from('tickets_assistenza')
        .update({ stato: 'chiuso', updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      toast.success('Ticket chiuso')
      fetchData()
    } catch (err) {
      toast.error('Errore chiusura ticket: ' + err.message)
    }
  }

  const handleCreateCampagna = async (e) => {
    e.preventDefault()
    if (!newCampagna.nome || !newCampagna.codice_campagna || newCampagna.sconto_importo <= 0) {
      return toast.error('Inserisci tutti i dati della campagna correttamente')
    }
    setCreatingCampagna(true)
    try {
      if (newCampagna.attiva) {
        const { error: deactivateErr } = await supabase
          .from('referral_campaigns')
          .update({ attiva: false })
          .eq('attiva', true)
        if (deactivateErr) throw deactivateErr
      }

      const { error } = await supabase
        .from('referral_campaigns')
        .insert({
          nome: newCampagna.nome,
          codice_campagna: newCampagna.codice_campagna.toUpperCase().trim(),
          sconto_importo: Number(newCampagna.sconto_importo),
          attiva: newCampagna.attiva
        })

      if (error) throw error
      toast.success('Campagna creata con successo')
      setNewCampagna({ nome: '', codice_campagna: '', sconto_importo: 10, attiva: false })
      fetchData()
    } catch (err) {
      toast.error('Errore creazione campagna: ' + err.message)
    } finally {
      setCreatingCampagna(false)
    }
  }

  const handleAttivaCampagna = async (campagnaId) => {
    try {
      const { error: deactivateErr } = await supabase
        .from('referral_campaigns')
        .update({ attiva: false })
        .neq('id', campagnaId)
      if (deactivateErr) throw deactivateErr

      const { error } = await supabase
        .from('referral_campaigns')
        .update({ attiva: true })
        .eq('id', campagnaId)

      if (error) throw error
      toast.success('Campagna attivata')
      fetchData()
    } catch (err) {
      toast.error('Errore attivazione campagna: ' + err.message)
    }
  }

  const handleValidaReferral = async (referralId) => {
    try {
      const { error } = await supabase
        .from('referrals')
        .update({ 
          stato: 'convalidato', 
          validated_at: new Date().toISOString() 
        })
        .eq('id', referralId)

      if (error) throw error
      toast.success('Referral convalidato manualmente')
      fetchData()
    } catch (err) {
      toast.error('Errore validazione: ' + err.message)
    }
  }

  const handleApplicaReferral = async (referralId) => {
    try {
      const { error } = await supabase
        .from('referrals')
        .update({ 
          stato: 'applicato', 
          applied_at: new Date().toISOString() 
        })
        .eq('id', referralId)

      if (error) throw error
      toast.success('Referral applicato manualmente')
      fetchData()
    } catch (err) {
      toast.error('Errore applicazione: ' + err.message)
    }
  }

  const handlePromuovi = async (id, currentVal) => {
    if (!window.confirm('Sei sicuro di voler cambiare i permessi di superadmin per questo utente?')) return
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_superadmin: !currentVal })
        .eq('id', id)
      if (error) throw error
      toast.success('Permessi aggiornati')
      fetchData()
    } catch (err) {
      toast.error('Errore aggiornamento permessi: ' + err.message)
    }
  }

  // ── Helper Limiti e Progress Bar ──────────────────────────────────────────
  const getAiLimit = (piano) => {
    switch (piano) {
      case 'base': return 100
      case 'studio': return 500
      case 'trial': return 500
      case 'professional': return 999999 // Illimitato
      default: return 500
    }
  }

  const getColLimit = (piano) => {
    switch (piano) {
      case 'studio': return 2
      case 'professional': return 10
      default: return 0
    }
  }

  const renderAiProgressBar = (consumate, piano) => {
    const limit = getAiLimit(piano)
    if (piano === 'professional') {
      return (
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {consumate} / ∞ calls
        </span>
      )
    }
    
    const pct = Math.min(Math.round((Number(consumate) / limit) * 100), 100)
    let barColor = '#10b981' // verde
    if (pct >= 80) barColor = '#ef4444' // rosso
    else if (pct >= 50) barColor = '#eab308' // giallo
    
    return (
      <div style={{ minWidth: 110 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
          <span>{consumate}/{limit}</span>
          <span>{pct}%</span>
        </div>
        <div style={{ width: '100%', height: 6, background: 'var(--border-color-2)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 3 }} />
        </div>
      </div>
    )
  }

  // ── Filtri e Statistiche Memoizzate ───────────────────────────────────────
  const statisticheReferral = React.useMemo(() => {
    const totaleInviti = referrals.length
    const registrati = referrals.filter(r => r.referred_id !== null).length
    const paganti = referrals.filter(r => r.stato === 'convalidato' || r.stato === 'applicato').length
    const scontiApplicati = referrals.filter(r => r.stato === 'applicato').reduce((sum, r) => sum + (r.sconto_valore || 0), 0)
    const tassoRegistrazione = totaleInviti > 0 ? Math.round((registrati / totaleInviti) * 100) : 0
    const tassoConversione = registrati > 0 ? Math.round((paganti / registrati) * 100) : 0
    return {
      totaleInviti,
      registrati,
      paganti,
      scontiApplicati,
      tassoRegistrazione,
      tassoConversione
    }
  }, [referrals])

  const utentiFiltrati = React.useMemo(() => {
    return utenti.filter(u => {
      const search = userSearch.toLowerCase()
      const matchesSearch = 
        u.email?.toLowerCase().includes(search) ||
        (u.nome && u.nome.toLowerCase().includes(search)) ||
        (u.cognome && u.cognome.toLowerCase().includes(search)) ||
        (u.studio_nome && u.studio_nome.toLowerCase().includes(search)) ||
        (u.ragione_sociale && u.ragione_sociale.toLowerCase().includes(search))
      
      const matchesPiano = filterPiano === 'tutti' || u.piano === filterPiano
      const matchesInattivi = !filterInattivi || Number(u.condomini_count) === 0
      
      return matchesSearch && matchesPiano && matchesInattivi
    })
  }, [utenti, userSearch, filterPiano, filterInattivi])

  const destinatariFiltrati = React.useMemo(() => {
    return utenti.filter(u => {
      // Escludiamo i superadmin dall'invio newsletter di marketing
      if (u.is_superadmin) return false
      
      switch (marketingForm.target) {
        case 'trial':
          return u.piano === 'trial'
        case 'paganti':
          return u.piano === 'base' || u.piano === 'studio' || u.piano === 'professional'
        case 'inattivi':
          return Number(u.condomini_count) === 0
        case 'ai_high':
          const limite = getAiLimit(u.piano)
          return (Number(u.ai_calls_count) / limite) >= 0.8
        case 'tutti':
        default:
          return true
      }
    }).map(u => u.email).filter(Boolean)
  }, [utenti, marketingForm.target])

  // ── Azioni Marketing ──────────────────────────────────────────────────────
  const handleGeneraTestoMarketing = async () => {
    const spunto = window.prompt("Inserisci un breve spunto per l'email promozionale (es. Promozione Summer: 20% di sconto per passare al piano Studio):")
    if (!spunto) return

    setGenerandoTestoAI(true)
    const loadToast = toast.loading("L'AI sta redigendo il testo promozionale...")
    try {
      const prompt = `Sei l'AI Copywriter di CondoSmart, un software SaaS premium per amministratori di condominio in Italia.
Scrivi una email promozionale/newsletter accattivante basandoti su questo spunto: "${spunto}".
Usa uno stile professionale ma persuasivo. Spiega i benefici di CondoSmart (risparmio di tempo, automazione AI di fatture e anagrafiche, collaboratori illimitati).
Struttura la risposta in formato JSON con le seguenti chiavi:
- "oggetto": l'oggetto accattivante della mail
- "corpo": il testo dell'email formattato in HTML pulito e moderno (usa tag <p>, <ul>, <li>, <strong>, e se vuoi dei bottoni usa link stilizzati con colori adatti, ma NON includere layout <html> o <body> completi, solo il contenuto interno).

Rispondi ESPLICITAMENTE in formato JSON valido.`

      const resAI = await callClaude(prompt, { funzione: 'scrittura_marketing' })
      let data
      try {
        data = JSON.parse(resAI)
      } catch (pe) {
        const jsonMatch = resAI.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[0])
        } else {
          throw pe
        }
      }

      if (data && data.oggetto && data.corpo) {
        setMarketingForm(prev => ({
          ...prev,
          oggetto: data.oggetto,
          messaggio: data.corpo
        }))
        toast.success("Email promozionale generata con successo!")
      } else {
        throw new Error("Formato risposta AI non valido.")
      }
    } catch (err) {
      toast.error("Errore generazione testo: " + err.message)
    } finally {
      toast.dismiss(loadToast)
      setGenerandoTestoAI(false)
    }
  }

  const handleInviaTestMarketing = async () => {
    if (!marketingForm.oggetto || !marketingForm.messaggio) {
      return toast.error("Inserisci oggetto e corpo del messaggio per inviare il test.")
    }
    
    setInviandoEmail(true)
    const loadToast = toast.loading("Invio email di test in corso...")
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !user.email) throw new Error("Utente non autenticato o email mancante")

      const { data, error } = await supabase.functions.invoke('invia-email-marketing', {
        body: {
          destinatari: [user.email],
          oggetto: `[TEST] ${marketingForm.oggetto}`,
          messaggio: marketingForm.messaggio
        }
      })

      if (error) throw error

      toast.success(`Email di test inviata con successo a ${user.email}!`)
    } catch (err) {
      toast.error("Errore invio test: " + err.message)
    } finally {
      toast.dismiss(loadToast)
      setInviandoEmail(false)
    }
  }

  const handleInviaMarketingMassivo = async () => {
    const conteggio = destinatariFiltrati.length
    if (conteggio === 0) return toast.error("Nessun destinatario nel target selezionato.")
    
    if (!window.confirm(`Sei sicuro di voler inviare questa email promozionale a tutti i ${conteggio} utenti selezionati?`)) {
      return
    }

    setInviandoEmail(true)
    const loadToast = toast.loading(`Invio email a ${conteggio} utenti in corso...`)
    try {
      const { data, error } = await supabase.functions.invoke('invia-email-marketing', {
        body: {
          destinatari: destinatariFiltrati,
          oggetto: marketingForm.oggetto,
          messaggio: marketingForm.messaggio
        }
      })

      if (error) throw error

      toast.success(data?.message || "Invio completato!")
      setMarketingForm({ target: 'tutti', oggetto: '', messaggio: '' })
    } catch (err) {
      toast.error("Errore invio marketing: " + err.message)
    } finally {
      toast.dismiss(loadToast)
      setInviandoEmail(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>SuperAdmin Backoffice</h1>
        <p style={styles.subtitle}>Gestione piattaforma, utenti e assistenza.</p>
      </div>

      <div style={styles.tabs}>
        <button
          style={{ ...styles.tabButton, ...(activeTab === 'utenti' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('utenti')}
        >
          <Users size={16} /> Utenti & Piani
        </button>
        <button
          style={{ ...styles.tabButton, ...(activeTab === 'tickets' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('tickets')}
        >
          <Ticket size={16} /> Ticket Assistenza ({tickets.filter(t => t.stato === 'aperto').length})
        </button>
        <button
          style={{ ...styles.tabButton, ...(activeTab === 'knowledge' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('knowledge')}
        >
          <MessageSquare size={16} /> Knowledge Base
        </button>
        <button
          style={{ ...styles.tabButton, ...(activeTab === 'referral' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('referral')}
        >
          <Gift size={16} /> Referral & Campagne
        </button>
        <button
          style={{ ...styles.tabButton, ...(activeTab === 'marketing' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('marketing')}
        >
          <Send size={16} /> Marketing & Newsletter
        </button>
      </div>

      <div style={styles.content}>
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', padding: 20 }}>Caricamento in corso...</div>
        ) : (
          <>
            {activeTab === 'utenti' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Filtri e Ricerca */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      placeholder="Cerca utente, email o studio..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      style={{ ...styles.input, paddingLeft: 38 }}
                    />
                  </div>
                  <select
                    value={filterPiano}
                    onChange={e => setFilterPiano(e.target.value)}
                    style={{ ...styles.input, width: 'auto', minWidth: 150 }}
                  >
                    <option value="tutti">Tutti i piani</option>
                    <option value="trial">Trial</option>
                    <option value="base">Base</option>
                    <option value="studio">Studio</option>
                    <option value="professional">Professional</option>
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={filterInattivi}
                      onChange={e => setFilterInattivi(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    Solo senza condomini (inattivi)
                  </label>
                </div>

                <div style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ ...styles.cardTitle, margin: 0 }}>Lista Utenti ({utentiFiltrati.length})</h2>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Utente / Studio</th>
                          <th style={styles.th}>Registrato il</th>
                          <th style={styles.th}>Condomini</th>
                          <th style={styles.th}>Chiamate AI (Mese)</th>
                          <th style={styles.th}>Collab.</th>
                          <th style={styles.th}>Piano</th>
                          <th style={styles.th}>Ruolo</th>
                          <th style={styles.th}>Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {utentiFiltrati.map(u => (
                          <tr key={u.id} style={styles.tr}>
                            <td style={styles.td}>
                              <div style={{ fontWeight: 600 }}>{u.nome || u.cognome ? `${u.nome || ''} ${u.cognome || ''}`.trim() : '—'}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.email}</div>
                              {u.studio_nome && (
                                <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>🏢 {u.studio_nome}</div>
                              )}
                            </td>
                            <td style={{ ...styles.td, fontSize: 13, color: 'var(--text-secondary)' }}>
                              {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                            </td>
                            <td style={{ ...styles.td, fontWeight: 600, textAlign: 'center' }}>
                              {u.condomini_count}
                            </td>
                            <td style={styles.td}>
                              {renderAiProgressBar(u.ai_calls_count, u.piano)}
                            </td>
                            <td style={{ ...styles.td, fontSize: 13 }}>
                              {getColLimit(u.piano) > 0 ? (
                                <span>{u.collaboratori_count} / {getColLimit(u.piano)}</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                            <td style={styles.td}>
                              <select
                                value={u.piano || 'trial'}
                                onChange={(e) => handleModificaPiano(u.id, e.target.value)}
                                style={{
                                  background: 'var(--app-bg)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-primary)',
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  outline: 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                <option value="trial">Trial</option>
                                <option value="base">Base</option>
                                <option value="studio">Studio</option>
                                <option value="professional">Professional</option>
                              </select>
                            </td>
                            <td style={styles.td}>
                              {u.is_superadmin ? (
                                <span style={{ color: '#10b981', fontWeight: 600, fontSize: 12 }}>SuperAdmin</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Admin</span>
                              )}
                            </td>
                            <td style={styles.td}>
                              <button 
                                onClick={() => handlePromuovi(u.id, u.is_superadmin)}
                                style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}
                              >
                                Toggle Admin
                              </button>
                            </td>
                          </tr>
                        ))}
                        {utentiFiltrati.length === 0 && (
                          <tr>
                            <td colSpan="8" style={{ ...styles.td, color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
                              Nessun utente corrisponde ai filtri selezionati.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tickets' && (
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ ...styles.card, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ ...styles.cardTitle, margin: 0 }}>Ticket Aperti</h2>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {tickets.filter(t => t.stato === 'aperto').map(t => (
                      <div key={t.id} style={{ ...styles.ticketCard, border: selectedTicket?.id === t.id ? '1px solid #3b82f6' : '1px solid var(--border-color)' }} onClick={() => setSelectedTicket(t)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.titolo}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(t.created_at).toLocaleDateString()}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {t.messaggio}
                        </p>
                      </div>
                    ))}
                    {tickets.filter(t => t.stato === 'aperto').length === 0 && (
                      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nessun ticket aperto.</p>
                    )}
                  </div>

                  <h3 style={{ ...styles.cardTitle, marginTop: 40, marginBottom: 20 }}>Ticket Chiusi</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.7 }}>
                    {tickets.filter(t => t.stato === 'chiuso').map(t => (
                      <div key={t.id} style={styles.ticketCard} onClick={() => setSelectedTicket(t)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'line-through' }}>{t.titolo}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(t.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ticket Detail Sidebar */}
                {selectedTicket && (
                  <div style={{ ...styles.card, flex: 1, position: 'sticky', top: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                      <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 18 }}>{selectedTicket.titolo}</h2>
                      <span style={{ padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: selectedTicket.stato === 'aperto' ? '#fef08a' : '#10b981', color: selectedTicket.stato === 'aperto' ? '#854d0e' : '#fff' }}>
                        {selectedTicket.stato}
                      </span>
                    </div>

                    <div style={{ marginBottom: 20, padding: 16, background: 'var(--app-bg)', borderRadius: 8, border: '1px solid var(--border-color-2)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Messaggio Utente ({selectedTicket.utente_id.substring(0,8)})</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selectedTicket.messaggio}</div>
                    </div>

                    {selectedTicket.stato === 'aperto' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>La tua risposta</label>
                        <textarea
                          value={rispostaText}
                          onChange={e => setRispostaText(e.target.value)}
                          style={styles.textarea}
                          placeholder="Scrivi qui la tua risposta all'utente..."
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 8 }}>
                          <input
                            type="checkbox"
                            id="genera_kb"
                            checked={generaKB}
                            onChange={e => setGeneraKB(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                          />
                          <label htmlFor="genera_kb" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                            Genera articolo di Knowledge Base con l'AI
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => handleRispondi(selectedTicket)} style={styles.btnSubmit}>
                            <Send size={16} /> Rispondi e Chiudi
                          </button>
                          <button onClick={() => handleChiudiTicket(selectedTicket.id)} style={styles.btnSecondary}>
                            Chiudi Senza Rispondere
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: 16, background: 'rgba(16, 185, 129, 0.12)', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        <div style={{ fontSize: 11, color: 'var(--success, #10b981)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Risposta Inviata</div>
                        <div style={{ color: 'var(--text-primary)', fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selectedTicket.risposta_admin || 'Chiuso senza risposta testuale.'}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'knowledge' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {editingKb ? (
                  <div style={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <h2 style={{ ...styles.cardTitle, margin: 0 }}>
                        {editingKb.id ? 'Modifica Articolo' : 'Nuovo Articolo Knowledge Base'}
                      </h2>
                      <button
                        onClick={() => setEditingKb(null)}
                        style={styles.btnSecondary}
                      >
                        Annulla
                      </button>
                    </div>

                    <form onSubmit={handleSaveKb} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Argomento *</label>
                          <input
                            type="text"
                            value={kbForm.argomento}
                            onChange={e => setKbForm(prev => ({ ...prev, argomento: e.target.value }))}
                            placeholder="es. Importazione Excel"
                            style={styles.input}
                            required
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Tag (separati da virgola)</label>
                          <input
                            type="text"
                            value={kbForm.tags}
                            onChange={e => setKbForm(prev => ({ ...prev, tags: e.target.value }))}
                            placeholder="es. excel, anagrafica, import"
                            style={styles.input}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Domanda Sintetica *</label>
                        <input
                          type="text"
                          value={kbForm.domanda_sintesi}
                          onChange={e => setKbForm(prev => ({ ...prev, domanda_sintesi: e.target.value }))}
                          placeholder="La domanda tipo posta dall'utente, es: Come posso importare i condòmini da Excel?"
                          style={styles.input}
                          required
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Risoluzione / Risposta *</label>
                        <textarea
                          value={kbForm.risoluzione}
                          onChange={e => setKbForm(prev => ({ ...prev, risoluzione: e.target.value }))}
                          placeholder="La soluzione o spiegazione dettagliata..."
                          style={{ ...styles.textarea, width: '100%', boxSizing: 'border-box' }}
                          required
                        />
                      </div>

                      <button type="submit" style={{ ...styles.btnSubmit, alignSelf: 'flex-start', padding: '10px 24px', flex: 'none' }}>
                        <Save size={16} /> Salva Articolo
                      </button>
                    </form>
                  </div>
                ) : (
                  <div style={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <h2 style={{ ...styles.cardTitle, margin: 0 }}>Knowledge Base dell'Assistente</h2>
                      <button onClick={startNewKb} style={{ ...styles.btnSubmit, flex: 'none', padding: '8px 16px' }}>
                        <Plus size={16} /> Aggiungi Articolo
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                          type="text"
                          placeholder="Cerca nella knowledge base..."
                          value={kbSearch}
                          onChange={e => setKbSearch(e.target.value)}
                          style={{ ...styles.input, paddingLeft: 40 }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {knowledgeList
                        .filter(item => {
                          const s = kbSearch.toLowerCase()
                          return (
                            item.argomento.toLowerCase().includes(s) ||
                            item.domanda_sintesi.toLowerCase().includes(s) ||
                            item.risoluzione.toLowerCase().includes(s) ||
                            (item.tags && item.tags.some(t => t.includes(s)))
                          )
                        })
                        .map(item => (
                          <div key={item.id} style={{ ...styles.ticketCard, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 8, cursor: 'default' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <span style={{ padding: '2px 6px', borderRadius: 4, background: '#1e3a8a', color: '#93c5fd', fontSize: 11, fontWeight: 600, marginRight: 8 }}>
                                  {item.argomento.toUpperCase()}
                                </span>
                                {item.tags && item.tags.map(t => (
                                  <span key={t} style={{ color: 'var(--text-muted)', fontSize: 11, marginRight: 6 }}>#{t}</span>
                                ))}
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  onClick={() => startEditKb(item)}
                                  style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                                >
                                  Modifica
                                </button>
                                <button
                                  onClick={() => handleDeleteKb(item.id)}
                                  style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                                >
                                  Elimina
                                </button>
                              </div>
                            </div>

                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                              Q: {item.domanda_sintesi}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                              A: {item.risoluzione}
                            </div>
                          </div>
                        ))}
                      {knowledgeList.length === 0 && (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: 13, padding: 20 }}>Nessun articolo presente nella Knowledge Base. Chiudi un ticket con l'opzione AI o creane uno manualmente.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'referral' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Gestione Campagne */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
                  {/* Form Nuova Campagna */}
                  <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Nuova Campagna Marketing</h2>
                    <form onSubmit={handleCreateCampagna} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Nome Campagna</label>
                        <input
                          type="text"
                          value={newCampagna.nome}
                          onChange={e => setNewCampagna(prev => ({ ...prev, nome: e.target.value }))}
                          placeholder="es. Campagna Estate 2026"
                          style={styles.input}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Codice Unico (Alfanumerico)</label>
                        <input
                          type="text"
                          value={newCampagna.codice_campagna}
                          onChange={e => setNewCampagna(prev => ({ ...prev, codice_campagna: e.target.value }))}
                          placeholder="es. ESTATE26"
                          style={styles.input}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Importo Sconto (€)</label>
                        <input
                          type="number"
                          value={newCampagna.sconto_importo}
                          onChange={e => setNewCampagna(prev => ({ ...prev, sconto_importo: parseFloat(e.target.value) }))}
                          placeholder="10.00"
                          min="1"
                          step="0.01"
                          style={styles.input}
                          required
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <input
                          type="checkbox"
                          id="campagna_attiva"
                          checked={newCampagna.attiva}
                          onChange={e => setNewCampagna(prev => ({ ...prev, attiva: e.target.checked }))}
                        />
                        <label htmlFor="campagna_attiva" style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                          Attiva questa campagna immediatamente
                        </label>
                      </div>
                      <button type="submit" disabled={creatingCampagna} style={{ ...styles.btnSubmit, marginTop: 12 }}>
                        <Plus size={16} /> {creatingCampagna ? 'Creazione...' : 'Crea Campagna'}
                      </button>
                    </form>
                  </div>

                  {/* Lista Campagne */}
                  <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Campagne Attive & Storico</h2>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Nome</th>
                            <th style={styles.th}>Codice</th>
                            <th style={styles.th}>Sconto</th>
                            <th style={styles.th}>Stato</th>
                            <th style={styles.th}>Azioni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campagne.map(c => (
                            <tr key={c.id} style={styles.tr}>
                              <td style={{ ...styles.td, fontWeight: 600 }}>{c.nome}</td>
                              <td style={styles.td}><span style={{ fontFamily: 'monospace', color: '#3b82f6', background: '#1e3a8a', padding: '2px 6px', borderRadius: 4 }}>{c.codice_campagna}</span></td>
                              <td style={styles.td}>{c.sconto_importo}€</td>
                              <td style={styles.td}>
                                {c.attiva ? (
                                  <span style={{ color: '#10b981', fontWeight: 600, fontSize: 13 }}>Attiva</span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Inattiva</span>
                                )}
                              </td>
                              <td style={styles.td}>
                                {!c.attiva && (
                                  <button
                                    onClick={() => handleAttivaCampagna(c.id)}
                                    style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                                  >
                                    Attiva
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {campagne.length === 0 && (
                            <tr>
                              <td colSpan="5" style={{ ...styles.td, color: 'var(--text-muted)', textAlign: 'center' }}>Nessuna campagna creata.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Storico Referral */}
                <div style={styles.card}>
                  <h2 style={styles.cardTitle}>Storico Inviti & Referral</h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Invitante (Referrer)</th>
                          <th style={styles.th}>Invitato (Referred)</th>
                          <th style={styles.th}>Campagna</th>
                          <th style={styles.th}>Sconto</th>
                          <th style={styles.th}>Stato</th>
                          <th style={styles.th}>Data Creazione</th>
                          <th style={styles.th}>Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referrals.map(r => (
                          <tr key={r.id} style={styles.tr}>
                            <td style={styles.td}>
                              <div style={{ fontWeight: 600 }}>{r.referrer?.nome} {r.referrer?.cognome}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.referrer?.email || r.referrer_id.substring(0,8)}</div>
                            </td>
                            <td style={styles.td}>
                              <div style={{ fontWeight: 600 }}>{r.referred ? `${r.referred.nome} ${r.referred.cognome}` : '—'}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.referred_email}</div>
                            </td>
                            <td style={styles.td}>
                              <span style={{ fontSize: 13 }}>{r.campaign?.nome || '—'}</span>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.campaign?.codice_campagna}</div>
                            </td>
                            <td style={{ ...styles.td, color: '#10b981', fontWeight: 600 }}>{r.sconto_valore}€</td>
                            <td style={styles.td}>
                              {r.stato === 'registrato' && (
                                <span style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 12 }}>Registrato</span>
                              )}
                              {r.stato === 'convalidato' && (
                                <span style={{ padding: '2px 6px', borderRadius: 4, background: '#1e3a8a', color: '#93c5fd', fontSize: 12 }}>Convalidato</span>
                              )}
                              {r.stato === 'applicato' && (
                                <span style={{ padding: '2px 6px', borderRadius: 4, background: '#064e3b', color: '#6ee7b7', fontSize: 12 }}>Applicato</span>
                              )}
                            </td>
                            <td style={{ ...styles.td, fontSize: 12, color: 'var(--text-secondary)' }}>
                              {new Date(r.created_at).toLocaleDateString()}
                            </td>
                            <td style={styles.td}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {r.stato === 'registrato' && (
                                  <button
                                    onClick={() => handleValidaReferral(r.id)}
                                    style={{ background: '#10b981', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                                  >
                                    Convalida
                                  </button>
                                )}
                                {r.stato === 'convalidato' && (
                                  <button
                                    onClick={() => handleApplicaReferral(r.id)}
                                    style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                                  >
                                    Segna Applicato
                                  </button>
                                )}
                                {r.stato === 'applicato' && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {referrals.length === 0 && (
                          <tr>
                            <td colSpan="7" style={{ ...styles.td, color: 'var(--text-muted)', textAlign: 'center' }}>Nessun invito registrato nel sistema.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'marketing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* KPI Referral e Conversioni */}
                <div style={styles.kpiContainer}>
                  <div style={styles.kpiCard}>
                    <div style={styles.kpiTitle}>Totale Inviti</div>
                    <div style={styles.kpiValue}>{statisticheReferral.totaleInviti}</div>
                  </div>
                  <div style={styles.kpiCard}>
                    <div style={styles.kpiTitle}>Registrati</div>
                    <div style={styles.kpiValue}>{statisticheReferral.registrati}</div>
                    <div style={styles.kpiSub}>{statisticheReferral.tassoRegistrazione}% tasso reg.</div>
                  </div>
                  <div style={styles.kpiCard}>
                    <div style={styles.kpiTitle}>Clienti Paganti</div>
                    <div style={styles.kpiValue}>{statisticheReferral.paganti}</div>
                    <div style={styles.kpiSub}>{statisticheReferral.tassoConversione}% tasso conv.</div>
                  </div>
                  <div style={styles.kpiCard}>
                    <div style={styles.kpiTitle}>Sconti Erogati</div>
                    <div style={{ ...styles.kpiValue, color: '#10b981' }}>{statisticheReferral.scontiApplicati}€</div>
                  </div>
                </div>

                {/* Form Invio Newsletter */}
                <div style={styles.card}>
                  <h2 style={styles.cardTitle}>Invia Comunicazione di Marketing</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, alignItems: 'flex-start' }}>
                    
                    {/* Form */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Seleziona Destinatari Target</label>
                        <select
                          value={marketingForm.target}
                          onChange={e => setMarketingForm(prev => ({ ...prev, target: e.target.value }))}
                          style={styles.selectInput}
                        >
                          <option value="tutti">Tutti gli utenti registrati ({destinatariFiltrati.length})</option>
                          <option value="trial">Solo utenti in Prova (Trial) ({destinatariFiltrati.length})</option>
                          <option value="paganti">Solo utenti con piani Paganti (Base/Studio/Prof) ({destinatariFiltrati.length})</option>
                          <option value="inattivi">Solo utenti inattivi (0 condomini creati) ({destinatariFiltrati.length})</option>
                          <option value="ai_high">Consumo AI mensile &gt;= 80% ({destinatariFiltrati.length})</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Oggetto dell'Email</label>
                        <input
                          type="text"
                          value={marketingForm.oggetto}
                          onChange={e => setMarketingForm(prev => ({ ...prev, oggetto: e.target.value }))}
                          placeholder="es. Offerta Fondatori: 3 mesi gratis su CondoSmart!"
                          style={styles.input}
                          required
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Corpo del Messaggio (HTML supportato)</label>
                          <button
                            type="button"
                            onClick={handleGeneraTestoMarketing}
                            disabled={generandoTestoAI}
                            style={{
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '4px 10px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {generandoTestoAI ? 'Generazione...' : '✨ Scrivi con AI'}
                          </button>
                        </div>
                        <textarea
                          value={marketingForm.messaggio}
                          onChange={e => setMarketingForm(prev => ({ ...prev, messaggio: e.target.value }))}
                          placeholder="Scrivi qui il corpo dell'email in HTML..."
                          style={{ ...styles.textarea, minHeight: 220, width: '100%', boxSizing: 'border-box' }}
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={handleInviaTestMarketing}
                          disabled={inviandoEmail}
                          style={styles.btnSecondary}
                        >
                          Invia Mail di Test a me
                        </button>
                        <button
                          type="button"
                          onClick={handleInviaMarketingMassivo}
                          disabled={inviandoEmail || destinatariFiltrati.length === 0 || !marketingForm.oggetto || !marketingForm.messaggio}
                          style={{ ...styles.btnSubmit, flex: 2 }}
                        >
                          Invia a {destinatariFiltrati.length} utenti
                        </button>
                      </div>
                    </div>

                    {/* Anteprima Email */}
                    <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 460 }}>
                      <h3 style={{ ...styles.cardTitle, fontSize: 14, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Anteprima Grafica</h3>
                      <div style={{ background: '#ffffff', color: '#1e293b', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', textAlign: 'left' }}>
                        <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 10, marginBottom: 12, fontSize: 12, lineHeight: 1.5, color: '#64748b' }}>
                          <div><strong>Da:</strong> CondoSmart Team &lt;info@condosmart.it&gt;</div>
                          <div><strong>Oggetto:</strong> {marketingForm.oggetto || '(Nessun oggetto)'}</div>
                        </div>
                        <div 
                          style={{ fontSize: 14, lineHeight: 1.6, overflowY: 'auto', flex: 1, color: '#334155' }}
                          dangerouslySetInnerHTML={{ __html: marketingForm.messaggio || '<p style="color: #94a3b8; font-style: italic;">Il corpo del messaggio comparirà qui...</p>' }}
                        />
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { padding: '28px 32px', background: 'var(--app-bg)', minHeight: '100vh', fontFamily: 'Sora, sans-serif' },
  header: { marginBottom: 30 },
  title: { color: 'var(--text-primary)', fontSize: 26, fontWeight: 700, margin: 0, textAlign: 'left' },
  subtitle: { color: 'var(--text-muted)', fontSize: 13, marginTop: 4, textAlign: 'left' },
  tabs: { display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color-2)', paddingBottom: 16, marginBottom: 24 },
  tabButton: { display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
  tabActive: { background: 'var(--card-bg)', color: 'var(--text-primary)' },
  content: {},
  card: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 24, textAlign: 'left' },
  cardTitle: { color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, marginBottom: 20, marginTop: 0 },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  th: { padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  tr: { borderBottom: '1px solid var(--border-color-2)' },
  td: { padding: '14px 16px', color: 'var(--text-primary)', fontSize: 14 },
  ticketCard: { background: 'var(--app-bg)', padding: 16, borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s' },
  textarea: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 14px', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none', minHeight: 120, resize: 'vertical' },
  input: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' },
  selectInput: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', cursor: 'pointer' },
  btnSubmit: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', flex: 2 },
  btnSecondary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', flex: 1 },
  kpiContainer: { display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  kpiCard: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '18px 20px', flex: 1, minWidth: 150, textAlign: 'left' },
  kpiTitle: { color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
  kpiValue: { color: 'var(--text-primary)', fontSize: 24, fontWeight: 700 },
  kpiSub: { color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }
}
