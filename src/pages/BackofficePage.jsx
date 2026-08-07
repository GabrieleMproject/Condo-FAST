import React, { useState, useEffect } from 'react'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import { supabase } from '../lib/supabaseClient'
import { 
  Users, Ticket, Search, Save, MessageSquare, Send, Gift, Plus, 
  Building2, Sparkles, Activity, ShieldCheck, DollarSign, Cpu, Eye, 
  FileText, ToggleLeft, ToggleRight, CheckCircle2, AlertTriangle, RefreshCw, 
  Layers, Zap, X, ChevronRight, HelpCircle, BookOpen, Bot,
  Store, Star, Award, Phone, Mail, MapPin, TrendingUp, Clock, FileSpreadsheet, Check
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { callGemini } from '../lib/geminiClient'
import { 
  fetchFornitoriPartner, 
  fetchPartnerMatchLogs, 
  fetchRichiestePreventivo, 
  saveFornitorePartner, 
  updateStatoCommissione 
} from '../lib/partnerEngine'

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
  const [kbSubTab, setKbSubTab] = useState('articoli') // 'articoli' | 'supervisione'
  const [chatLogsAll, setChatLogsAll] = useState([])
  const [generandoKbDaChatId, setGenerandoKbDaChatId] = useState(null)

  // Stati ricerca e filtri utenti
  const [userSearch, setUserSearch] = useState('')
  const [filterPiano, setFilterPiano] = useState('tutti')
  const [filterStato, setFilterStato] = useState('tutti') // 'tutti', 'beta', 'waiting'
  const [filterInattivi, setFilterInattivi] = useState(false)

  // Stati Scheda Utente 360° (Fase 1)
  const [selectedUser360, setSelectedUser360] = useState(null)
  const [user360Tab, setUser360Tab] = useState('panoramica') // 'panoramica', 'note', 'bonus', 'flags', 'chat_tickets'
  const [userNoteText, setUserNoteText] = useState('')
  const [userBonusInput, setUserBonusInput] = useState(0)
  const [userFlagsState, setUserFlagsState] = useState({
    open_banking: false,
    f24_v2: false,
    recon_ai_v2: false,
    invoice_batch_v2: false
  })
  const [saving360, setSaving360] = useState(false)

  // Stati System Health & Audit (Fase 1)
  const [auditLogs, setAuditLogs] = useState([])
  const [aiLogs, setAiLogs] = useState([])

  // Stati form marketing
  const [marketingForm, setMarketingForm] = useState({ target: 'tutti', oggetto: '', messaggio: '' })
  const [generandoTestoAI, setGenerandoTestoAI] = useState(false)
  const [inviandoEmail, setInviandoEmail] = useState(false)
  const [criticalError, setCriticalError] = useState(null)

  // Stati Fornitori Partner & Marketplace
  const [partnerList, setPartnerList] = useState([])
  const [partnerMatchLogs, setPartnerMatchLogs] = useState([])
  const [richiestePreventivoList, setRichiestePreventivoList] = useState([])
  const [partnerSubTab, setPartnerSubTab] = useState('gestione') // 'gestione' | 'match_logs' | 'richieste' | 'report'
  const [partnerSearch, setPartnerSearch] = useState('')
  const [modalPartnerOpen, setModalPartnerOpen] = useState(false)
  const [savingPartner, setSavingPartner] = useState(false)
  const [partnerForm, setPartnerForm] = useState({
    id: null,
    ragione_sociale: '',
    partita_iva: '',
    codice_fiscale: '',
    email: '',
    telefono: '',
    referente_nome: '',
    categoria: 'manutenzione',
    provincia_esclusiva: 'MI',
    tipo_contratto: 'pioneer_esclusivo',
    data_inizio_contratto: new Date().toISOString().split('T')[0],
    data_fine_contratto: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    quota_fissa_annuale: 290.00,
    percentuale_commissione: 5.00,
    data_scadenza_durc: '',
    durc_verificato: true,
    note_contrattuali: '',
    invited_by: null,
    attivo: true
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setCriticalError(null)
    try {
      // 1. Utenti & Statistiche tramite RPC
      const { data: prof, error: profErr } = await supabase
        .rpc('get_utenti_statistiche')
      
      if (profErr) {
        console.error("ERRORE RPC GET_UTENTI_STATISTICHE:", profErr);
        throw profErr;
      }
      setUtenti(prof || [])

      // 2. Ticket di assistenza
      const { data: tick, error: tickErr } = await supabase
        .from('tickets_assistenza')
        .select('*')
        .order('created_at', { ascending: false })

      if (tickErr) throw tickErr
      setTickets(tick || [])

      // 3. Campagne Referral
      const { data: camp, error: campErr } = await supabase
        .from('referral_campaigns')
        .select('*')
        .order('created_at', { ascending: false })

      if (campErr) throw campErr
      setCampagne(camp || [])

      // 4. Referrals
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

      // 5. Knowledge Base
      const { data: kb, error: kbErr } = await supabase
        .from('assistenza_knowledge')
        .select('*')
        .order('created_at', { ascending: false })

      if (kbErr) throw kbErr
      setKnowledgeList(kb || [])

      // 6. Log Chat Assistenza (Supervisione RLHF)
      const { data: chatLogs, error: chatErr } = await supabase
        .from('chat_assistenza_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!chatErr && chatLogs) {
        setChatLogsAll(chatLogs)
      }

      // 7. Audit Logs recenti
      const { data: audit, error: auditErr } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (!auditErr && audit) {
        setAuditLogs(audit)
      }

      // 8. Log Chiamate AI per monitoraggio token e costi
      const { data: aiCallData, error: aiErr } = await supabase
        .from('ai_call_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200)

      if (!aiErr && aiCallData) {
        setAiLogs(aiCallData)
      }

      // 9. Fornitori Partner, Match Logs e Richieste Preventivo
      try {
        const pList = await fetchFornitoriPartner()
        setPartnerList(pList)
        const mLogs = await fetchPartnerMatchLogs()
        setPartnerMatchLogs(mLogs)
        const rList = await fetchRichiestePreventivo()
        setRichiestePreventivoList(rList)
      } catch (pErr) {
        console.warn("Dati partner non ancora presenti o schema in inizializzazione:", pErr.message)
      }

    } catch (err) {
      toast.error('Errore caricamento dati: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Azioni Scheda Utente 360° (Fase 1) ─────────────────────────────────────
  const openNewPartnerModal = () => {
    setPartnerForm({
      id: null,
      ragione_sociale: '',
      partita_iva: '',
      codice_fiscale: '',
      email: '',
      telefono: '',
      referente_nome: '',
      categoria: 'manutenzione',
      provincia_esclusiva: 'MI',
      tipo_contratto: 'pioneer_esclusivo',
      data_inizio_contratto: new Date().toISOString().split('T')[0],
      data_fine_contratto: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      quota_fissa_annuale: 290.00,
      percentuale_commissione: 5.00,
      data_scadenza_durc: '',
      durc_verificato: true,
      note_contrattuali: '',
      invited_by: null,
      attivo: true
    })
    setModalPartnerOpen(true)
  }

  const openEditPartnerModal = (p) => {
    setPartnerForm({
      id: p.id,
      ragione_sociale: p.ragione_sociale || '',
      partita_iva: p.partita_iva || '',
      codice_fiscale: p.codice_fiscale || '',
      email: p.email || '',
      telefono: p.telefono || '',
      referente_nome: p.referente_nome || '',
      categoria: p.categoria || 'manutenzione',
      provincia_esclusiva: p.provincia_esclusiva || 'MI',
      tipo_contratto: p.tipo_contratto || 'pioneer_esclusivo',
      data_inizio_contratto: p.data_inizio_contratto || new Date().toISOString().split('T')[0],
      data_fine_contratto: p.data_fine_contratto || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      quota_fissa_annuale: p.quota_fissa_annuale || 290.00,
      percentuale_commissione: p.percentuale_commissione || 5.00,
      data_scadenza_durc: p.data_scadenza_durc || '',
      durc_verificato: p.durc_verificato !== false,
      note_contrattuali: p.note_contrattuali || '',
      invited_by: p.invited_by || null,
      attivo: p.attivo !== false
    })
    setModalPartnerOpen(true)
  }

  const handleSavePartnerSubmit = async (e) => {
    e.preventDefault()
    if (!partnerForm.ragione_sociale || !partnerForm.partita_iva || !partnerForm.provincia_esclusiva) {
      toast.error("Compilare Ragione Sociale, P.IVA e Provincia Esclusiva.")
      return
    }
    setSavingPartner(true)
    try {
      await saveFornitorePartner(partnerForm)
      toast.success(partnerForm.id ? "Partner aggiornato con successo!" : "Nuovo Partner registrato con successo!")
      setModalPartnerOpen(false)
      fetchData()
    } catch (err) {
      toast.error("Errore salvataggio partner: " + err.message)
    } finally {
      setSavingPartner(false)
    }
  }

  const handleToggleStatoCommissione = async (logId, currentStato) => {
    const prossimoStato = currentStato === 'da_fatturare' ? 'fatturato' : (currentStato === 'fatturato' ? 'saldato' : 'da_fatturare')
    try {
      await updateStatoCommissione(logId, prossimoStato)
      toast.success(`Stato commissione aggiornato in '${prossimoStato}'`)
      fetchData()
    } catch (err) {
      toast.error("Errore aggiornamento stato: " + err.message)
    }
  }

  const openUser360Modal = (user) => {
    setSelectedUser360(user)
    setUser360Tab('panoramica')
    setUserNoteText(user.note_admin || '')
    setUserBonusInput(user.ai_bonus_calls || 0)
    setUserFlagsState({
      open_banking: !!user.feature_flags?.open_banking,
      f24_v2: !!user.feature_flags?.f24_v2,
      recon_ai_v2: !!user.feature_flags?.recon_ai_v2,
      invoice_batch_v2: !!user.feature_flags?.invoice_batch_v2
    })
  }

  const handleSaveUserNote = async () => {
    if (!selectedUser360) return
    setSaving360(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ note_admin: userNoteText })
        .eq('id', selectedUser360.id)

      if (error) throw error
      toast.success('Note amministrative salvate con successo!')
      setSelectedUser360(prev => ({ ...prev, note_admin: userNoteText }))
      fetchData()
    } catch (err) {
      toast.error('Errore salvataggio note: ' + err.message)
    } finally {
      setSaving360(false)
    }
  }

  const handleSaveUserBonusCalls = async () => {
    if (!selectedUser360) return
    setSaving360(true)
    try {
      const bonusVal = Math.max(0, parseInt(userBonusInput) || 0)
      const { error } = await supabase
        .from('profiles')
        .update({ ai_bonus_calls: bonusVal })
        .eq('id', selectedUser360.id)

      if (error) throw error
      toast.success(`Chiamate AI bonus aggiornate a ${bonusVal}!`)
      setSelectedUser360(prev => ({ ...prev, ai_bonus_calls: bonusVal }))
      fetchData()
    } catch (err) {
      toast.error('Errore aggiornamento bonus: ' + err.message)
    } finally {
      setSaving360(false)
    }
  }

  const handleToggleFeatureFlag = async (flagKey) => {
    if (!selectedUser360) return
    const newFlags = {
      ...(selectedUser360.feature_flags || {}),
      ...userFlagsState,
      [flagKey]: !userFlagsState[flagKey]
    }
    setUserFlagsState(newFlags)

    setSaving360(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ feature_flags: newFlags })
        .eq('id', selectedUser360.id)

      if (error) throw error
      toast.success(`Feature Flag ${flagKey} aggiornata!`)
      setSelectedUser360(prev => ({ ...prev, feature_flags: newFlags }))
      fetchData()
    } catch (err) {
      toast.error('Errore aggiornamento feature flag: ' + err.message)
    } finally {
      setSaving360(false)
    }
  }

  // ── Modifica Piano ────────────────────────────────────────────────────────
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
          const promptSintesi = `Analizza questo ticket di assistenza di CondoFAST e la relativa risoluzione.
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

          const resAI = await callGemini(promptSintesi, { funzione: 'assistenza_sintesi', jsonMode: true })
          
          let dataKB;
          try {
            dataKB = JSON.parse(resAI)
          } catch (pe) {
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

  // ── Supervisione Chatbot AI -> KB (Fase 2) ─────────────────────────────────
  const handleGeneraKbDaChat = async (chatLog) => {
    setGenerandoKbDaChatId(chatLog.id)
    const loadToast = toast.loading("Analisi trascrizione chat ed estrazione articolo KB...")
    try {
      const prompt = `Analizza la seguente trascrizione di una conversazione tra un amministratore di condominio e l'assistente virtuale AI di CondoFAST.
Estrai i punti chiave e crea un articolo per la Knowledge Base in formato JSON con le chiavi:
- "argomento": (max 4 parole)
- "domanda_sintesi": la domanda tipo che sintetizza il dubbio dell'utente (max 15 parole)
- "risoluzione": la risposta chiara e dettagliata (max 100 parole)
- "tags": array di keyword utili per la ricerca

TRASCRIZIONE CHAT:
${chatLog.trascrizione}

Rispondi ESPLICITAMENTE in formato JSON valido.`

      const resAI = await callGemini(prompt, { funzione: 'assistenza_sintesi', jsonMode: true })
      let dataKB;
      try {
        dataKB = JSON.parse(resAI)
      } catch (pe) {
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
        toast.success("Articolo KB generato e aggiunto con successo dalla chat!")
        fetchData()
      } else {
        throw new Error("Formato risposta AI non valido")
      }
    } catch (err) {
      toast.error("Errore generazione KB da chat: " + err.message)
    } finally {
      toast.dismiss(loadToast)
      setGenerandoKbDaChatId(null)
    }
  }

  // ── KB CRUD ────────────────────────────────────────────────────────────────
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

  const handleToggleBeta = async (id, currentVal) => {
    try {
      const { error } = await supabase.rpc('toggle_beta_tester', {
        target_user_id: id,
        target_status: !currentVal
      })
      if (error) throw error
      toast.success('Stato Beta Tester aggiornato')
      fetchData()
    } catch (err) {
      toast.error('Errore aggiornamento stato beta: ' + err.message)
    }
  }

  // ── Helper Limiti e Progress Bar ──────────────────────────────────────────
  const getAiLimit = (piano) => {
    switch (piano) {
      case 'base': return 100
      case 'studio': return 500
      case 'trial': return 500
      case 'professional': return 999999
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

  const renderAiProgressBar = (consumate, piano, bonus = 0) => {
    const limit = getAiLimit(piano) + Number(bonus || 0)
    if (piano === 'professional') {
      return (
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {consumate} / ∞ calls {bonus > 0 ? `(+${bonus} bonus)` : ''}
        </span>
      )
    }
    
    const pct = Math.min(Math.round((Number(consumate) / limit) * 100), 100)
    let barColor = '#10b981'
    if (pct >= 80) barColor = '#ef4444'
    else if (pct >= 50) barColor = '#eab308'
    
    return (
      <div style={{ minWidth: 110 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
          <span>{consumate}/{limit}</span>
          <span>{pct}% {bonus > 0 ? `(+${bonus})` : ''}</span>
        </div>
        <div style={{ width: '100%', height: 6, background: 'var(--border-color-2)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 3 }} />
        </div>
      </div>
    )
  }

  // ── Calcoli Finanziari & Costi LLM (Fase 2) ───────────────────────────────
  const calcoliFinanziari = React.useMemo(() => {
    const prezziPiani = { trial: 0, base: 29, studio: 79, professional: 199 }
    
    let mrr = 0
    let utentiPaganti = 0

    utenti.forEach(u => {
      const p = u.piano || 'trial'
      if (prezziPiani[p] !== undefined) {
        mrr += prezziPiani[p]
        if (p !== 'trial') utentiPaganti++
      }
    })

    const arpu = utentiPaganti > 0 ? Math.round(mrr / utentiPaganti) : 0

    // Calcolo consumo Token e Costo stimato API
    let totaleTokensInput = 0
    let totaleTokensOutput = 0
    const perFunzione = {}

    aiLogs.forEach(log => {
      const inp = Number(log.token_input || 0)
      const out = Number(log.token_output || 0)
      totaleTokensInput += inp
      totaleTokensOutput += out

      const fn = log.funzione || 'generico'
      if (!perFunzione[fn]) {
        perFunzione[fn] = { count: 0, inputTokens: 0, outputTokens: 0, costoStimato: 0 }
      }
      perFunzione[fn].count++
      perFunzione[fn].inputTokens += inp
      perFunzione[fn].outputTokens += out
      
      // Tariffa stimata media ($3/1M In, $15/1M Out per Claude 3.5 Sonnet; $0.075/1M In per Gemini)
      let costIn = (inp / 1000000) * 3.0
      let costOut = (out / 1000000) * 15.0
      if (fn.includes('gemini') || fn.includes('marketing') || fn.includes('sintesi')) {
        costIn = (inp / 1000000) * 0.075
        costOut = (out / 1000000) * 0.30
      }
      perFunzione[fn].costoStimato += (costIn + costOut)
    })

    const costoStimatoTotaleDollar = Object.values(perFunzione).reduce((acc, curr) => acc + curr.costoStimato, 0)
    const costoStimatoTotaleEur = costoStimatoTotaleDollar * 0.92 // Tasso di cambio indicativo USD/EUR

    return {
      mrr,
      arpu,
      utentiPaganti,
      totaleUtenti: utenti.length,
      totaleTokensInput,
      totaleTokensOutput,
      costoStimatoTotaleEur,
      perFunzione
    }
  }, [utenti, aiLogs])

  // ── Edge Functions Status (Fase 1) ────────────────────────────────────────
  const edgeFunctionsStatus = [
    { name: 'claude-proxy', desc: 'Proxy LLM Anthropic Claude 3.5 Sonnet', status: 'operativo', env: 'Supabase Edge', auth: 'JWT + Security Definer' },
    { name: 'gemini-proxy', desc: 'Proxy LLM Google Gemini Flash/Pro', status: 'operativo', env: 'Supabase Edge', auth: 'JWT Auth' },
    { name: 'inbound-email', desc: 'Parsing & OCR Fatture via Email', status: 'operativo', env: 'Resend Webhook', auth: 'Secret Header' },
    { name: 'gocardless-proxy', desc: 'Direct Connect Open Banking API', status: 'operativo', env: 'Supabase Edge', auth: 'OAuth 2.0' },
    { name: 'sync-bank-transactions', desc: 'Sincronizzazione automatica C/C', status: 'operativo', env: 'Supabase Edge', auth: 'Cron Schedule' },
    { name: 'stripe-checkout', desc: 'Gestione Piani & Abbonamenti SaaS', status: 'operativo', env: 'Stripe Webhook', auth: 'Stripe Signature' },
    { name: 'invia-comunicazione', desc: 'Invio Solleciti & Email Condòmini', status: 'operativo', env: 'Resend API', auth: 'JWT Auth' },
    { name: 'invia-email-marketing', desc: 'Invio Newsletter SuperAdmin', status: 'operativo', env: 'Resend API', auth: 'SuperAdmin Guard' }
  ]

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
      const search = userSearch.toLowerCase().trim()
      const matchesSearch = !search ||
        (u.email && u.email.toLowerCase().includes(search)) ||
        (u.nome && u.nome.toLowerCase().includes(search)) ||
        (u.cognome && u.cognome.toLowerCase().includes(search)) ||
        (u.studio_nome && u.studio_nome.toLowerCase().includes(search)) ||
        (u.ragione_sociale && u.ragione_sociale.toLowerCase().includes(search))
      
      const matchesPiano = filterPiano === 'tutti' || u.piano === filterPiano
      const matchesStato = 
        filterStato === 'tutti' ? true :
        filterStato === 'beta' ? (u.is_beta_tester === true || u.is_superadmin === true) :
        filterStato === 'waiting' ? (u.is_beta_tester !== true && u.is_superadmin !== true) : true
      const matchesInattivi = !filterInattivi || Number(u.condomini_count) === 0
      
      return matchesSearch && matchesPiano && matchesStato && matchesInattivi
    })
  }, [utenti, userSearch, filterPiano, filterStato, filterInattivi])

  const targetCounts = React.useMemo(() => {
    const nonSuper = utenti.filter(u => !u.is_superadmin && Boolean(u.email))
    return {
      tutti: nonSuper.length,
      trial: nonSuper.filter(u => (u.piano || 'trial') === 'trial').length,
      paganti: nonSuper.filter(u => u.piano === 'base' || u.piano === 'studio' || u.piano === 'professional').length,
      inattivi: nonSuper.filter(u => Number(u.condomini_count) === 0).length,
      ai_high: nonSuper.filter(u => (Number(u.ai_calls_count) / getAiLimit(u.piano)) >= 0.8).length
    }
  }, [utenti])

  const destinatariFiltrati = React.useMemo(() => {
    return utenti.filter(u => {
      if (u.is_superadmin) return false
      
      switch (marketingForm.target) {
        case 'trial':
          return (u.piano || 'trial') === 'trial'
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
      const prompt = `Sei l'AI Copywriter di CondoFAST, un software SaaS premium per amministratori di condominio in Italia.
Scrivi una email promozionale/newsletter accattivante basandoti su questo spunto: "${spunto}".
Usa uno stile professionale ma persuasivo. Spiega i benefici di CondoFAST (risparmio di tempo, automazione AI di fatture e anagrafiche, collaboratori illimitati).
Struttura la risposta in formato JSON con le seguenti chiavi:
- "oggetto": l'oggetto accattivante della mail
- "corpo": il testo dell'email formattato in HTML pulito e moderno (usa tag <p>, <ul>, <li>, <strong>, e se vuoi dei bottoni usa link stilizzati con colori adatti, ma NON includere layout <html> o <body> completi, solo il contenuto interno).

Rispondi ESPLICITAMENTE in formato JSON valido.`

      const resAI = await callGemini(prompt, { funzione: 'scrittura_marketing', jsonMode: true })
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
        <p style={styles.subtitle}>Gestione piattaforma, supporto utenti, telemetria e crescita del SaaS.</p>
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
          <Ticket size={16} /> Ticket ({tickets.filter(t => t.stato === 'aperto').length})
        </button>
        <button
          style={{ ...styles.tabButton, ...(activeTab === 'knowledge' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('knowledge')}
        >
          <MessageSquare size={16} /> Knowledge Base & QA
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
          <Send size={16} /> Marketing
        </button>
        <button
          style={{ ...styles.tabButton, ...(activeTab === 'health' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('health')}
        >
          <Activity size={16} /> System Health & Telemetria
        </button>
        <button
          style={{ ...styles.tabButton, ...(activeTab === 'financials' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('financials')}
        >
          <DollarSign size={16} /> MRR & Costi API LLM
        </button>
        <button
          style={{ ...styles.tabButton, ...(activeTab === 'fornitori' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('fornitori')}
        >
          <Store size={16} /> Fornitori Partner ({partnerList.filter(p => p.attivo).length})
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
                    value={filterStato}
                    onChange={e => setFilterStato(e.target.value)}
                    style={{ ...styles.input, width: 'auto', minWidth: 150 }}
                  >
                    <option value="tutti">Tutti gli stati</option>
                    <option value="beta">Solo Beta Tester / Attivi</option>
                    <option value="waiting">Solo In Attesa (Waitlist)</option>
                  </select>
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
                          <th style={styles.th}>Onboarding</th>
                          <th style={styles.th}>Chiamate AI</th>
                          <th style={styles.th}>Collab.</th>
                          <th style={styles.th}>Piano</th>
                          <th style={styles.th}>Ruolo</th>
                          <th style={styles.th}>Azioni SuperAdmin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {utentiFiltrati.map(u => (
                          <tr key={u.id} style={styles.tr}>
                            <td style={styles.td}>
                              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {u.nome || u.cognome ? `${u.nome || ''} ${u.cognome || ''}`.trim() : '—'}
                                {u.note_admin && (
                                  <span title={`Note Admin: ${u.note_admin}`} style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center' }}>
                                    <FileText size={14} color="#3b82f6" />
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.email}</div>
                              {u.studio_nome && (
                                <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Building2 size={12} /> {u.studio_nome}
                                </div>
                              )}
                            </td>
                            <td style={{ ...styles.td, fontSize: 13, color: 'var(--text-secondary)' }}>
                              {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                            </td>
                            <td style={{ ...styles.td, fontWeight: 600, textAlign: 'center' }}>
                              {u.condomini_count}
                            </td>
                            <td style={styles.td}>
                              {(() => {
                                const compCount = u.onboarding_state?.completedSteps?.length || 0
                                const pct = Math.round((compCount / 10) * 100)
                                return (
                                  <div style={{ minWidth: 100 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>
                                      <span style={{ color: 'var(--text-muted)' }}>Prog:</span>
                                      <span style={{ color: compCount === 10 ? '#22c55e' : '#3b82f6' }}>{compCount}/10</span>
                                    </div>
                                    <div style={{ width: '100%', height: 5, background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                                      <div style={{ width: `${pct}%`, height: '100%', background: compCount === 10 ? '#22c55e' : 'linear-gradient(90deg, #3b82f6, #22c55e)', borderRadius: 3 }} />
                                    </div>
                                  </div>
                                )
                              })()}
                            </td>
                            <td style={styles.td}>
                              {renderAiProgressBar(u.ai_calls_count, u.piano, u.ai_bonus_calls)}
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
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {u.is_superadmin ? (
                                  <span style={{ color: '#10b981', fontWeight: 600, fontSize: 12 }}>SuperAdmin</span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Admin</span>
                                )}
                                {u.is_superadmin ? null : u.is_beta_tester ? (
                                  <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: 12 }}>Beta Tester</span>
                                ) : (
                                  <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 12 }}>In Attesa</span>
                                )}
                              </div>
                            </td>
                            <td style={styles.td}>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => openUser360Modal(u)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    background: '#2563eb',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '4px 10px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 600
                                  }}
                                >
                                  <Eye size={12} /> Scheda 360°
                                </button>

                                <button 
                                  onClick={() => handleToggleBeta(u.id, u.is_beta_tester)}
                                  style={{ 
                                    background: u.is_beta_tester ? 'transparent' : 'rgba(245, 158, 11, 0.1)', 
                                    border: '1px solid #f59e0b', 
                                    color: u.is_beta_tester ? '#f59e0b' : '#d97706', 
                                    padding: '4px 8px', 
                                    borderRadius: 6, 
                                    cursor: 'pointer', 
                                    fontSize: 11,
                                    fontWeight: 600
                                  }}
                                >
                                  {u.is_beta_tester ? 'Revoca Beta' : 'Accetta Beta'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {utentiFiltrati.length === 0 && (
                          <tr>
                            <td colSpan="9" style={{ ...styles.td, color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
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
                    <h2 style={{ ...styles.cardTitle, margin: 0 }}>Ticket Aperti ({tickets.filter(t => t.stato === 'aperto').length})</h2>
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
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Messaggio Utente ({selectedTicket.utente_id?.substring(0,8) || 'N/D'})</div>
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
                {/* Sotto Tab Knowledge Base */}
                <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                  <button
                    onClick={() => setKbSubTab('articoli')}
                    style={{
                      background: kbSubTab === 'articoli' ? '#2563eb' : 'transparent',
                      color: kbSubTab === 'articoli' ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                  >
                    <BookOpen size={14} style={{ marginRight: 6 }} /> Articoli Knowledge Base ({knowledgeList.length})
                  </button>
                  <button
                    onClick={() => setKbSubTab('supervisione')}
                    style={{
                      background: kbSubTab === 'supervisione' ? '#2563eb' : 'transparent',
                      color: kbSubTab === 'supervisione' ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                  >
                    <Bot size={14} style={{ marginRight: 6 }} /> Supervisione Chatbot AI & QA ({chatLogsAll.length})
                  </button>
                </div>

                {kbSubTab === 'articoli' ? (
                  editingKb ? (
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
                                  <span style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--accent-glow)', color: 'var(--accent)', fontSize: 11, fontWeight: 600, marginRight: 8 }}>
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
                  )
                ) : (
                  /* Supervisione Chatbot AI & RLHF -> KB */
                  <div style={styles.card}>
                    <div style={{ marginBottom: 20 }}>
                      <h2 style={{ ...styles.cardTitle, margin: '0 0 6px 0' }}>Supervisione Registro Chatbot AI (RLHF)</h2>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                        Consulta le trascrizioni reali dell'assistente AI e convertile con 1 clic in nuovi articoli di Knowledge Base per migliorare continuamente l'AI.
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {chatLogsAll.map(log => (
                        <div key={log.id} style={{ ...styles.ticketCard, border: '1px solid var(--border-color)', cursor: 'default' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                                Utente: {log.user_id?.substring(0, 8)}...
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {new Date(log.created_at).toLocaleString()}
                              </span>
                              {log.risolto_con_ticket && (
                                <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', fontSize: 11, fontWeight: 600 }}>
                                  Convertito in Ticket
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => handleGeneraKbDaChat(log)}
                              disabled={generandoKbDaChatId === log.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                background: '#2563eb',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              <Sparkles size={14} />
                              {generandoKbDaChatId === log.id ? 'Generazione...' : 'Converti in Articolo KB AI'}
                            </button>
                          </div>

                          <div style={{ background: 'var(--app-bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', maxHeight: 180, overflowY: 'auto' }}>
                            {log.trascrizione}
                          </div>
                        </div>
                      ))}

                      {chatLogsAll.length === 0 && (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Nessuna chat registrata nelle ultime 30 giornate.</p>
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
                              <td style={styles.td}><span style={{ fontFamily: 'monospace', color: 'var(--accent)', background: 'var(--accent-glow)', padding: '2px 6px', borderRadius: 4 }}>{c.codice_campagna}</span></td>
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
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.referrer?.email || r.referrer_id?.substring(0,8) || 'N/D'}</div>
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
                                <span style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--border-color)', color: 'var(--text-secondary)', fontSize: 12 }}>Registrato</span>
                              )}
                              {r.stato === 'convalidato' && (
                                <span style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--accent-glow)', color: 'var(--accent)', fontSize: 12 }}>Convalidato</span>
                              )}
                              {r.stato === 'applicato' && (
                                <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', fontSize: 12 }}>Applicato</span>
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
                          <option value="tutti">Tutti gli utenti registrati ({targetCounts.tutti})</option>
                          <option value="trial">Solo utenti in Prova (Trial) ({targetCounts.trial})</option>
                          <option value="paganti">Solo utenti con piani Paganti ({targetCounts.paganti})</option>
                          <option value="inattivi">Solo utenti inattivi (0 condomini creati) ({targetCounts.inattivi})</option>
                          <option value="ai_high">Consumo AI mensile &gt;= 80% ({targetCounts.ai_high})</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>Oggetto dell'Email</label>
                        <input
                          type="text"
                          value={marketingForm.oggetto}
                          onChange={e => setMarketingForm(prev => ({ ...prev, oggetto: e.target.value }))}
                          placeholder="es. Offerta Fondatori: 3 mesi gratis su CondoFAST!"
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
                            {generandoTestoAI ? 'Generazione...' : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Sparkles size={12} /> Scrivi con AI
                              </span>
                            )}
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
                          disabled={inviandoEmail || destinatariFiltrati.length === 0}
                          style={styles.btnSubmit}
                        >
                          <Send size={16} /> Invia a {destinatariFiltrati.length} utenti
                        </button>
                      </div>
                    </div>

                    {/* Anteprima Email */}
                    <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                        Anteprima Rendering HTML
                      </div>
                      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Oggetto: </span>
                        <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{marketingForm.oggetto || '—'}</strong>
                      </div>
                      {marketingForm.messaggio ? (
                        <div
                          style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(marketingForm.messaggio) }}
                        />
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>
                          L'anteprima del corpo dell'email apparirà qui...
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* TAB SYSTEM HEALTH & TELEMETRIA (Fase 1) */}
            {activeTab === 'health' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                      <h2 style={{ ...styles.cardTitle, margin: 0 }}>Stato Operativo Edge Functions & Integrazioni</h2>
                      <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                        Monitoraggio del backend Supabase, protocolli di autenticazione e servizi terzi (Resend, GoCardless, Stripe).
                      </p>
                    </div>
                    <button onClick={fetchData} style={{ ...styles.btnSecondary, flex: 'none', padding: '6px 12px' }}>
                      <RefreshCw size={14} /> Aggiorna Telemetria
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {edgeFunctionsStatus.map(ef => (
                      <div key={ef.name} style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#3b82f6' }}>{ef.name}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
                            <CheckCircle2 size={12} /> {ef.status}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 10px 0', fontSize: 12, color: 'var(--text-secondary)' }}>{ef.desc}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                          <span>Ambiente: <strong>{ef.env}</strong></span>
                          <span>Auth: <strong>{ef.auth}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audit Logs Recenti */}
                <div style={styles.card}>
                  <h2 style={styles.cardTitle}>Registro Audit Logs di Sicurezza (Ultimi 20 Eventi)</h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Data/Ora (UTC)</th>
                          <th style={styles.th}>Utente ID</th>
                          <th style={styles.th}>Azione</th>
                          <th style={styles.th}>Entità</th>
                          <th style={styles.th}>Dettagli Evento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map(log => (
                          <tr key={log.id} style={styles.tr}>
                            <td style={{ ...styles.td, fontSize: 12, color: 'var(--text-secondary)' }}>
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 11 }}>
                              {log.user_id ? log.user_id.substring(0, 8) : 'Sistema / Anonymous'}
                            </td>
                            <td style={styles.td}>
                              <span style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--accent-glow)', color: 'var(--accent)', fontSize: 11, fontWeight: 600 }}>
                                {log.azione}
                              </span>
                            </td>
                            <td style={{ ...styles.td, fontSize: 12, fontWeight: 600 }}>{log.entita}</td>
                            <td style={{ ...styles.td, fontSize: 12, color: 'var(--text-secondary)' }}>
                              {typeof log.dettagli === 'object' ? JSON.stringify(log.dettagli) : String(log.dettagli || '—')}
                            </td>
                          </tr>
                        ))}
                        {auditLogs.length === 0 && (
                          <tr>
                            <td colSpan="5" style={{ ...styles.td, color: 'var(--text-muted)', textAlign: 'center' }}>Nessun evento registrato in audit log.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB FINANCIALS & COSTI API LLM (Fase 2) */}
            {activeTab === 'financials' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* KPI Finanziari SaaS */}
                <div style={styles.kpiContainer}>
                  <div style={styles.kpiCard}>
                    <div style={styles.kpiTitle}>MRR Stimato (Fatturato Ricorrente)</div>
                    <div style={{ ...styles.kpiValue, color: '#10b981' }}>{calcoliFinanziari.mrr}€ <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>/ mese</span></div>
                    <div style={styles.kpiSub}>Basato sugli abbonamenti attivi</div>
                  </div>
                  <div style={styles.kpiCard}>
                    <div style={styles.kpiTitle}>ARPU (Ricavo Medio / Utente Pagante)</div>
                    <div style={styles.kpiValue}>{calcoliFinanziari.arpu}€</div>
                    <div style={styles.kpiSub}>{calcoliFinanziari.utentiPaganti} utenti paganti su {calcoliFinanziari.totaleUtenti}</div>
                  </div>
                  <div style={styles.kpiCard}>
                    <div style={styles.kpiTitle}>Token LLM Consumati (Mese)</div>
                    <div style={styles.kpiValue}>
                      {((calcoliFinanziari.totaleTokensInput + calcoliFinanziari.totaleTokensOutput) / 1000).toFixed(1)}k
                    </div>
                    <div style={styles.kpiSub}>In: {(calcoliFinanziari.totaleTokensInput / 1000).toFixed(1)}k | Out: {(calcoliFinanziari.totaleTokensOutput / 1000).toFixed(1)}k</div>
                  </div>
                  <div style={styles.kpiCard}>
                    <div style={styles.kpiTitle}>Costo Stimato API LLM (Mese)</div>
                    <div style={{ ...styles.kpiValue, color: '#ef4444' }}>~{calcoliFinanziari.costoStimatoTotaleEur.toFixed(2)}€</div>
                    <div style={styles.kpiSub}>Claude 3.5 Sonnet & Gemini Flash/Pro</div>
                  </div>
                </div>

                {/* Breakdown Costi per Funzione AI */}
                <div style={styles.card}>
                  <h2 style={styles.cardTitle}>Ripartizione Consumi & Costi API per Funzione AI</h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Funzione AI</th>
                          <th style={styles.th}>Chiamate Eseguite</th>
                          <th style={styles.th}>Tokens Input</th>
                          <th style={styles.th}>Tokens Output</th>
                          <th style={styles.th}>Costo Stimato ($ USD)</th>
                          <th style={styles.th}>Costo Stimato (€ EUR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(calcoliFinanziari.perFunzione).map(([fnName, stats]) => (
                          <tr key={fnName} style={styles.tr}>
                            <td style={{ ...styles.td, fontWeight: 600, fontFamily: 'monospace', color: '#3b82f6' }}>
                              {fnName}
                            </td>
                            <td style={{ ...styles.td, fontWeight: 600 }}>{stats.count}</td>
                            <td style={{ ...styles.td, fontSize: 13 }}>{stats.inputTokens.toLocaleString()}</td>
                            <td style={{ ...styles.td, fontSize: 13 }}>{stats.outputTokens.toLocaleString()}</td>
                            <td style={{ ...styles.td, fontSize: 13, color: 'var(--text-secondary)' }}>${stats.costoStimato.toFixed(4)}</td>
                            <td style={{ ...styles.td, fontWeight: 700, color: '#ef4444' }}>€{(stats.costoStimato * 0.92).toFixed(4)}</td>
                          </tr>
                        ))}
                        {Object.keys(calcoliFinanziari.perFunzione).length === 0 && (
                          <tr>
                            <td colSpan="6" style={{ ...styles.td, color: 'var(--text-muted)', textAlign: 'center' }}>Nessun dato di consumo AI registrato per il mese corrente.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB FORNITORI PARTNER & MARKETPLACE (Dedicato) */}
            {activeTab === 'fornitori' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                
                {/* KPI Header Marketplace */}
                <div style={styles.kpiContainer}>
                  <div style={styles.kpiCard}>
                    <div style={styles.kpiTitle}>Partner Convenzionati Attivi</div>
                    <div style={{ ...styles.kpiValue, color: '#3b82f6' }}>
                      {partnerList.filter(p => p.attivo).length}
                    </div>
                    <div style={styles.kpiSub}>Fornitori registrati nella rete</div>
                  </div>
                  <div style={styles.kpiCard}>
                    <div style={styles.kpiTitle}>Province Coperte in Esclusiva</div>
                    <div style={{ ...styles.kpiValue, color: '#8b5cf6' }}>
                      {[...new Set(partnerList.filter(p => p.attivo).map(p => p.provincia_esclusiva))].length}
                    </div>
                    <div style={styles.kpiSub}>Sigle provinciali attive</div>
                  </div>
                  <div style={styles.kpiCard}>
                    <div style={styles.kpiTitle}>Lavori Rilevati (Match AI)</div>
                    <div style={{ ...styles.kpiValue, color: '#10b981' }}>
                      €{partnerMatchLogs.reduce((sum, m) => sum + (Number(m.importo_fattura) || 0), 0).toLocaleString()}
                    </div>
                    <div style={styles.kpiSub}>Totale fatturato nei condomini</div>
                  </div>
                  <div style={styles.kpiCard}>
                    <div style={styles.kpiTitle}>Provvigioni Maturate CondoFAST</div>
                    <div style={{ ...styles.kpiValue, color: '#f59e0b' }}>
                      €{partnerMatchLogs.reduce((sum, m) => sum + (Number(m.importo_commissione) || 0), 0).toFixed(2)}
                    </div>
                    <div style={styles.kpiSub}>Da fatturare ai fornitori</div>
                  </div>
                </div>

                {/* Alert Banner Scadenza DURC SuperAdmin */}
                {(() => {
                  const partnerDurcInScadenza = partnerList.filter(p => {
                    if (!p.data_scadenza_durc) return false
                    const diffDays = Math.ceil((new Date(p.data_scadenza_durc) - new Date()) / (1000 * 60 * 60 * 24))
                    return diffDays <= 30
                  })
                  if (partnerDurcInScadenza.length === 0) return null
                  return (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <AlertTriangle size={22} color="#ef4444" />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#ef4444' }}>
                            🚨 Avviso SuperAdmin: {partnerDurcInScadenza.length} Partner con DURC in Scadenza o Scaduto!
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            Richiedere l'invio del DURC aggiornato entro la data limite per mantenere attiva l'esclusiva ed il badge H24:{' '}
                            <strong>{partnerDurcInScadenza.map(p => `${p.ragione_sociale} (Scad: ${p.data_scadenza_durc || 'N/D'})`).join(', ')}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Sub-Navigazione Sezione Fornitori */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setPartnerSubTab('gestione')}
                      style={{ ...styles.subTabBtn, ...(partnerSubTab === 'gestione' ? styles.subTabActive : {}) }}
                    >
                      <Store size={14} /> Gestione Partner & Contratti
                    </button>
                    <button
                      onClick={() => setPartnerSubTab('match_logs')}
                      style={{ ...styles.subTabBtn, ...(partnerSubTab === 'match_logs' ? styles.subTabActive : {}) }}
                    >
                      <FileSpreadsheet size={14} /> Rendicontazione Match AI ({partnerMatchLogs.length})
                    </button>
                    <button
                      onClick={() => setPartnerSubTab('richieste')}
                      style={{ ...styles.subTabBtn, ...(partnerSubTab === 'richieste' ? styles.subTabActive : {}) }}
                    >
                      <MessageSquare size={14} /> Richieste Preventivo ({richiestePreventivoList.length})
                    </button>
                    <button
                      onClick={() => setPartnerSubTab('report')}
                      style={{ ...styles.subTabBtn, ...(partnerSubTab === 'report' ? styles.subTabActive : {}) }}
                    >
                      <TrendingUp size={14} /> Report ROI & Negoziazione
                    </button>
                  </div>
                  {partnerSubTab === 'gestione' && (
                    <button onClick={openNewPartnerModal} style={{ ...styles.btnSubmit, flex: 'none', padding: '8px 14px' }}>
                      <Plus size={16} /> Nuovo Partner Convenzionato
                    </button>
                  )}
                </div>

                {/* 1. SUB-TAB GESTIONE PARTNER */}
                {partnerSubTab === 'gestione' && (
                  <div style={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                      <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
                        <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                          type="text"
                          placeholder="Cerca partner per Ragione Sociale, P.IVA o Provincia..."
                          value={partnerSearch}
                          onChange={e => setPartnerSearch(e.target.value)}
                          style={{ ...styles.input, paddingLeft: 38 }}
                        />
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Partner / Ragione Sociale</th>
                            <th style={styles.th}>P.IVA / CF</th>
                            <th style={styles.th}>Provincia & Categoria</th>
                            <th style={styles.th}>Tipo Contratto</th>
                            <th style={styles.th}>Scadenza 12 Mesi</th>
                            <th style={styles.th}>Quota Annua</th>
                            <th style={styles.th}>Provvigione %</th>
                            <th style={styles.th}>Azioni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {partnerList
                            .filter(p => {
                              if (!partnerSearch) return true
                              const q = partnerSearch.toLowerCase()
                              return (
                                p.ragione_sociale?.toLowerCase().includes(q) ||
                                p.partita_iva?.includes(q) ||
                                p.provincia_esclusiva?.toLowerCase().includes(q)
                              )
                            })
                            .map(p => {
                              const dataFine = new Date(p.data_fine_contratto)
                              const oggi = new Date()
                              const giorniRimanenti = Math.ceil((dataFine - oggi) / (1000 * 60 * 60 * 24))
                              return (
                                <tr key={p.id} style={styles.tr}>
                                  <td style={styles.td}>
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.ragione_sociale}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                      {p.referente_nome ? `Ref: ${p.referente_nome} • ` : ''}{p.email || p.telefono || ''}
                                    </div>
                                  </td>
                                  <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 12 }}>
                                    {p.partita_iva}
                                  </td>
                                  <td style={styles.td}>
                                    <span style={{ padding: '2px 8px', borderRadius: 6, background: '#2563eb15', color: '#3b82f6', fontWeight: 700, fontSize: 11, marginRight: 6 }}>
                                      {p.provincia_esclusiva}
                                    </span>
                                    <span style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                                      {p.categoria}
                                    </span>
                                  </td>
                                  <td style={styles.td}>
                                    <span style={{ padding: '2px 6px', borderRadius: 4, background: p.tipo_contratto === 'pioneer_esclusivo' ? 'rgba(16, 185, 129, 0.15)' : 'var(--accent-glow)', color: p.tipo_contratto === 'pioneer_esclusivo' ? '#10b981' : 'var(--accent)', fontSize: 11, fontWeight: 700 }}>
                                      {p.tipo_contratto === 'pioneer_esclusivo' ? 'Pioneer Esclusivo' : 'Multi-Vendor'}
                                    </span>
                                  </td>
                                  <td style={styles.td}>
                                    <div style={{ fontSize: 12, fontWeight: 600 }}>{p.data_fine_contratto}</div>
                                    <div style={{ fontSize: 11, color: giorniRimanenti < 30 ? '#ef4444' : 'var(--text-muted)' }}>
                                      {giorniRimanenti > 0 ? `${giorniRimanenti} giorni alla scadenza` : 'Contratto Scaduto'}
                                    </div>
                                  </td>
                                  <td style={{ ...styles.td, fontWeight: 600 }}>€{Number(p.quota_fissa_annuale || 0).toFixed(2)}</td>
                                  <td style={{ ...styles.td, fontWeight: 700, color: '#f59e0b' }}>{p.percentuale_commissione}%</td>
                                  <td style={styles.td}>
                                    <button onClick={() => openEditPartnerModal(p)} style={{ ...styles.btnSecondary, padding: '4px 8px', fontSize: 11 }}>
                                      <Eye size={13} /> Modifica
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          {partnerList.length === 0 && (
                            <tr>
                              <td colSpan="8" style={{ ...styles.td, textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>
                                Nessun fornitore partner registrato. Clicca su <strong>"Nuovo Partner Convenzionato"</strong> per aggiungerne uno.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. SUB-TAB RENDICONTAZIONE MATCH AI */}
                {partnerSubTab === 'match_logs' && (
                  <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Rendicontazione Automatica Match AI Fatture nei Condomini</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                      Tutte le fatture lette dall'AI di CondoFAST le cui Partite IVA corrispondono ai partner convenzionati attivi.
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Data Fattura</th>
                            <th style={styles.th}>Partner Convenzionato</th>
                            <th style={styles.th}>Condominio / Amministratore</th>
                            <th style={styles.th}>Importo Fattura</th>
                            <th style={styles.th}>Provvigione %</th>
                            <th style={styles.th}>Spettante CondoFAST</th>
                            <th style={styles.th}>Stato Provvigione</th>
                            <th style={styles.th}>Azioni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {partnerMatchLogs.map(m => (
                            <tr key={m.id} style={styles.tr}>
                              <td style={{ ...styles.td, fontSize: 12 }}>{m.data_fattura || new Date(m.created_at).toLocaleDateString()}</td>
                              <td style={styles.td}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.partner?.ragione_sociale || 'Partner Sconosciuto'}</div>
                                <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>P.IVA: {m.partita_iva_rilevata}</div>
                              </td>
                              <td style={styles.td}>
                                <div style={{ fontWeight: 600 }}>{m.condominio?.nome || 'Condominio'}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  Admin: {m.amministratore?.nome ? `${m.amministratore.nome} ${m.amministratore.cognome || ''}` : (m.amministratore?.email || '—')}
                                </div>
                              </td>
                              <td style={{ ...styles.td, fontWeight: 700 }}>€{Number(m.importo_fattura || 0).toLocaleString()}</td>
                              <td style={{ ...styles.td, color: '#f59e0b', fontWeight: 700 }}>{m.percentuale_applicata}%</td>
                              <td style={{ ...styles.td, fontWeight: 700, color: '#10b981', fontSize: 14 }}>
                                €{Number(m.importo_commissione || 0).toFixed(2)}
                              </td>
                              <td style={styles.td}>
                                <span style={{
                                  padding: '3px 8px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: m.stato_commissione === 'saldato' ? 'rgba(16, 185, 129, 0.15)' : (m.stato_commissione === 'fatturato' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
                                  color: m.stato_commissione === 'saldato' ? '#10b981' : (m.stato_commissione === 'fatturato' ? '#3b82f6' : '#f59e0b')
                                }}>
                                  {m.stato_commissione === 'saldato' ? 'SALDATO' : (m.stato_commissione === 'fatturato' ? 'FATTURATO' : 'DA FATTURARE')}
                                </span>
                              </td>
                              <td style={styles.td}>
                                <button
                                  onClick={() => handleToggleStatoCommissione(m.id, m.stato_commissione)}
                                  style={{ ...styles.btnSecondary, padding: '4px 8px', fontSize: 11 }}
                                >
                                  Cambia Stato
                                </button>
                              </td>
                            </tr>
                          ))}
                          {partnerMatchLogs.length === 0 && (
                            <tr>
                              <td colSpan="8" style={{ ...styles.td, textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>
                                Nessun match di fatture rilevato al momento. Non appena un amministratore carica una fattura con la P.IVA di un partner convenzionato, apparirà qui!
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. SUB-TAB RICHIESTE PREVENTIVO */}
                {partnerSubTab === 'richieste' && (
                  <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Registro Richieste Preventivo dagli Amministratori</h2>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Data</th>
                            <th style={styles.th}>Amministratore & Condominio</th>
                            <th style={styles.th}>Categoria & Provincia</th>
                            <th style={styles.th}>Titolo & Dettaglio</th>
                            <th style={styles.th}>Partner Assegnato</th>
                            <th style={styles.th}>Stato</th>
                          </tr>
                        </thead>
                        <tbody>
                          {richiestePreventivoList.map(r => (
                            <tr key={r.id} style={styles.tr}>
                              <td style={{ ...styles.td, fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString()}</td>
                              <td style={styles.td}>
                                <div style={{ fontWeight: 600 }}>{r.amministratore?.nome ? `${r.amministratore.nome} ${r.amministratore.cognome || ''}` : (r.amministratore?.email || '—')}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.condominio?.nome || 'Condominio'}</div>
                              </td>
                              <td style={styles.td}>
                                <span style={{ padding: '2px 6px', borderRadius: 4, background: '#2563eb15', color: '#3b82f6', fontWeight: 700, fontSize: 11 }}>
                                  {r.provincia}
                                </span>
                                <span style={{ marginLeft: 6, fontSize: 12, textTransform: 'capitalize' }}>{r.categoria}</span>
                              </td>
                              <td style={styles.td}>
                                <div style={{ fontWeight: 600 }}>{r.titolo}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.descrizione}</div>
                              </td>
                              <td style={styles.td}>
                                <div style={{ fontWeight: 600 }}>{r.partner?.ragione_sociale || 'Partner provinciale'}</div>
                              </td>
                              <td style={styles.td}>
                                <span style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--accent-glow)', color: 'var(--accent)', fontSize: 11, fontWeight: 700 }}>
                                  {r.stato}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {richiestePreventivoList.length === 0 && (
                            <tr>
                              <td colSpan="6" style={{ ...styles.td, textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>
                                Nessuna richiesta di preventivo inoltrata al momento.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. SUB-TAB REPORT ROI & NEGOZIAZIONE RINNOVO */}
                {partnerSubTab === 'report' && (
                  <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Report ROI Fornitori per Negoziazione Rinnovo (Fine 12 Mesi)</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                      Dati aggregati di fatturato procurato al fornitore tramite CondoFAST per giustificare gli aumenti di quota fisso o commissione al rinnovo annuale.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                      {partnerList.map(p => {
                        const logsPartner = partnerMatchLogs.filter(m => m.partner_id === p.id)
                        const totaleFatturatoProcurato = logsPartner.reduce((sum, m) => sum + (Number(m.importo_fattura) || 0), 0)
                        const totaleCommissioniMaturate = logsPartner.reduce((sum, m) => sum + (Number(m.importo_commissione) || 0), 0)
                        const commDaFatturare = logsPartner.filter(m => m.stato_commissione === 'da_fatturare').reduce((sum, m) => sum + (Number(m.importo_commissione) || 0), 0)
                        const commSaldato = logsPartner.filter(m => m.stato_commissione === 'saldato' || m.stato_commissione === 'fatturato').reduce((sum, m) => sum + (Number(m.importo_commissione) || 0), 0)
                        const roiFornitore = p.quota_fissa_annuale > 0 ? (totaleFatturatoProcurato / p.quota_fissa_annuale).toFixed(1) : '∞'
                        
                        const sponsor = p.invited_by ? utenti.find(u => u.id === p.invited_by) : null;

                        return (
                          <div key={p.id} style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 18 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                              <div>
                                <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>{p.ragione_sociale}</h3>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                  {p.provincia_esclusiva} • P.IVA: {p.partita_iva}
                                </div>
                                {sponsor && (
                                  <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 4, fontWeight: 600 }}>
                                    ✨ Sponsorizzato da: {sponsor.nome} {sponsor.cognome}
                                  </div>
                                )}
                              </div>
                              <span style={{ padding: '2px 6px', borderRadius: 4, background: '#10b98115', color: '#10b981', fontWeight: 700, fontSize: 11 }}>
                                ROI: {roiFornitore}x
                              </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                              <div style={styles.infoBox}>
                                <div style={styles.infoLabel}>Fatturato Procurato</div>
                                <div style={{ ...styles.infoValue, color: '#10b981', fontSize: 16 }}>€{totaleFatturatoProcurato.toLocaleString()}</div>
                              </div>
                              <div style={styles.infoBox}>
                                <div style={styles.infoLabel}>Totale Commissioni</div>
                                <div style={{ ...styles.infoValue, color: '#f59e0b', fontSize: 16 }}>€{totaleCommissioniMaturate.toFixed(2)}</div>
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, padding: '8px 12px', background: 'var(--border-color-2)', borderRadius: 6 }}>
                               <div style={{ fontSize: 12 }}>
                                 <span style={{ color: 'var(--text-secondary)' }}>Da fatturare: </span>
                                 <strong style={{ color: '#ef4444' }}>€{commDaFatturare.toFixed(2)}</strong>
                               </div>
                               <div style={{ fontSize: 12 }}>
                                 <span style={{ color: 'var(--text-secondary)' }}>Già Incassato: </span>
                                 <strong style={{ color: '#10b981' }}>€{commSaldato.toFixed(2)}</strong>
                               </div>
                            </div>

                            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-secondary)' }}>
                              Contratto: <strong>{p.data_inizio_contratto} → {p.data_fine_contratto}</strong>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

              </div>
            )}
          </>
        )}
      </div>

      {/* MODALE SCHEDA UTENTE 360° (Fase 1) */}
      {selectedUser360 && (
        <div style={styles.modalBackdrop} onClick={() => setSelectedUser360(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)' }}>
                  Scheda Utente 360° — {selectedUser360.nome || selectedUser360.cognome ? `${selectedUser360.nome || ''} ${selectedUser360.cognome || ''}`.trim() : 'Studio Admin'}
                </h2>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {selectedUser360.email} • ID: <span style={{ fontFamily: 'monospace' }}>{selectedUser360.id}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser360(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Navigazione interna alla Scheda 360° */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
              <button
                onClick={() => setUser360Tab('panoramica')}
                style={{ ...styles.subTabBtn, ...(user360Tab === 'panoramica' ? styles.subTabActive : {}) }}
              >
                <Building2 size={14} /> Panoramica & KPI
              </button>
              <button
                onClick={() => setUser360Tab('note')}
                style={{ ...styles.subTabBtn, ...(user360Tab === 'note' ? styles.subTabActive : {}) }}
              >
                <FileText size={14} /> Note Admin
              </button>
              <button
                onClick={() => setUser360Tab('bonus')}
                style={{ ...styles.subTabBtn, ...(user360Tab === 'bonus' ? styles.subTabActive : {}) }}
              >
                <Zap size={14} /> Bonus Chiamate AI ({selectedUser360.ai_bonus_calls || 0})
              </button>
              <button
                onClick={() => setUser360Tab('flags')}
                style={{ ...styles.subTabBtn, ...(user360Tab === 'flags' ? styles.subTabActive : {}) }}
              >
                <Layers size={14} /> Feature Flags
              </button>
              <button
                onClick={() => setUser360Tab('chat_tickets')}
                style={{ ...styles.subTabBtn, ...(user360Tab === 'chat_tickets' ? styles.subTabActive : {}) }}
              >
                <MessageSquare size={14} /> Ticket & Chat
              </button>
            </div>

            {/* Contenuto Tab Scheda 360° */}
            {user360Tab === 'panoramica' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={styles.infoBox}>
                    <div style={styles.infoLabel}>Studio / Ragione Sociale</div>
                    <div style={styles.infoValue}>{selectedUser360.studio_nome || selectedUser360.ragione_sociale || 'Non inserito'}</div>
                  </div>
                  <div style={styles.infoBox}>
                    <div style={styles.infoLabel}>Piano Attivo</div>
                    <div style={{ ...styles.infoValue, textTransform: 'uppercase', color: '#3b82f6', fontWeight: 700 }}>{selectedUser360.piano || 'trial'}</div>
                  </div>
                  <div style={styles.infoBox}>
                    <div style={styles.infoLabel}>Condomini Gestiti</div>
                    <div style={styles.infoValue}>{selectedUser360.condomini_count} condomini</div>
                  </div>
                  <div style={styles.infoBox}>
                    <div style={styles.infoLabel}>Collaboratori Attivi</div>
                    <div style={styles.infoValue}>{selectedUser360.collaboratori_count} / {getColLimit(selectedUser360.piano)}</div>
                  </div>
                </div>

                <div style={styles.infoBox}>
                  <div style={styles.infoLabel}>Consumo Chiamate AI (Mese Corrente)</div>
                  <div style={{ marginTop: 8 }}>
                    {renderAiProgressBar(selectedUser360.ai_calls_count, selectedUser360.piano, selectedUser360.ai_bonus_calls)}
                  </div>
                </div>
              </div>
            )}

            {user360Tab === 'note' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Note Amministrative ad Uso Interno (Visibili solo dai SuperAdmin)
                </label>
                <textarea
                  value={userNoteText}
                  onChange={e => setUserNoteText(e.target.value)}
                  placeholder="Inserisci qui annotazioni sul cliente, storico contatti telefonici, richieste particolari..."
                  style={{ ...styles.textarea, minHeight: 140 }}
                />
                <button
                  onClick={handleSaveUserNote}
                  disabled={saving360}
                  style={{ ...styles.btnSubmit, alignSelf: 'flex-start', flex: 'none', padding: '8px 16px' }}
                >
                  <Save size={16} /> Salva Note Admin
                </button>
              </div>
            )}

            {user360Tab === 'bonus' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Concedi Chiamate AI Extra / Bonus per il Mese Corrente
                </label>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                  Le chiamate bonus vengono sommate al limite standard del piano dell'utente ({getAiLimit(selectedUser360.piano)} chiamate base).
                </p>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <input
                    type="number"
                    value={userBonusInput}
                    onChange={e => setUserBonusInput(e.target.value)}
                    min="0"
                    style={{ ...styles.input, width: 140 }}
                  />
                  <button
                    onClick={() => setUserBonusInput(prev => Number(prev) + 50)}
                    style={styles.btnSecondary}
                  >
                    +50
                  </button>
                  <button
                    onClick={() => setUserBonusInput(prev => Number(prev) + 100)}
                    style={styles.btnSecondary}
                  >
                    +100
                  </button>
                  <button
                    onClick={() => setUserBonusInput(prev => Number(prev) + 500)}
                    style={styles.btnSecondary}
                  >
                    +500
                  </button>
                </div>

                <button
                  onClick={handleSaveUserBonusCalls}
                  disabled={saving360}
                  style={{ ...styles.btnSubmit, alignSelf: 'flex-start', flex: 'none', padding: '8px 16px', marginTop: 8 }}
                >
                  <Save size={16} /> Aggiorna Bonus AI
                </button>
              </div>
            )}

            {user360Tab === 'flags' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Feature Flags Sperimentali (Abilitazione Funzionalità in Anteprima)
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { key: 'open_banking', title: 'Direct Connect Open Banking API', desc: 'Sincronizzazione bancaria diretta GoCardless.' },
                    { key: 'f24_v2', title: 'Modulo F24 Avanzato Multicondominio', desc: 'Gestione invio e tracciamento adempimenti F24.' },
                    { key: 'recon_ai_v2', title: 'Riconciliazione Bancaria AI V2', desc: 'Algoritmo avanzato di abbinamento entrate/uscite.' },
                    { key: 'invoice_batch_v2', title: 'Caricamento Massivo Fatture Zip/PDF', desc: 'Elaborazione in parallelo di fatture multiple.' }
                  ].map(ff => (
                    <div key={ff.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{ff.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{ff.desc}</div>
                      </div>
                      <button
                        onClick={() => handleToggleFeatureFlag(ff.key)}
                        disabled={saving360}
                        style={{
                          background: userFlagsState[ff.key] ? '#10b981' : 'var(--border-color)',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {userFlagsState[ff.key] ? 'ATTIVO' : 'DISATTIVO'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {user360Tab === 'chat_tickets' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h4 style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>Storico Ticket Aperte da questo Utente</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tickets.filter(t => t.utente_id === selectedUser360.id).map(t => (
                    <div key={t.id} style={{ padding: 10, background: 'var(--app-bg)', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>{t.titolo}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(t.created_at).toLocaleDateString()} — Stato: {t.stato}</div>
                    </div>
                  ))}
                  {tickets.filter(t => t.utente_id === selectedUser360.id).length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nessun ticket aperto da questo utente.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALE REGISTRAZIONE / MODIFICA FORNITORE PARTNER */}
      {modalPartnerOpen && (
        <div style={styles.modalBackdrop} onClick={() => setModalPartnerOpen(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>
                {partnerForm.id ? 'Modifica Partner Convenzionato' : 'Registra Nuovo Partner Convenzionato'}
              </h2>
              <button onClick={() => setModalPartnerOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePartnerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Ragione Sociale *</label>
                  <input
                    type="text"
                    required
                    value={partnerForm.ragione_sociale}
                    onChange={e => setPartnerForm({ ...partnerForm, ragione_sociale: e.target.value })}
                    placeholder="Es. Mario Rossi Termoidraulica SRL"
                    style={styles.input}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Partita IVA *</label>
                  <input
                    type="text"
                    required
                    value={partnerForm.partita_iva}
                    onChange={e => setPartnerForm({ ...partnerForm, partita_iva: e.target.value })}
                    placeholder="Es. 01234567890"
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Provincia Esclusiva *</label>
                  <input
                    type="text"
                    required
                    maxLength="5"
                    value={partnerForm.provincia_esclusiva}
                    onChange={e => setPartnerForm({ ...partnerForm, provincia_esclusiva: e.target.value.toUpperCase() })}
                    placeholder="Es. MI, BG, RM"
                    style={styles.input}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Categoria Servizio</label>
                  <select
                    value={partnerForm.categoria}
                    onChange={e => setPartnerForm({ ...partnerForm, categoria: e.target.value })}
                    style={styles.selectInput}
                  >
                    <option value="manutenzione">Manutenzione Generale</option>
                    <option value="idraulico">Idraulico & Termoidraulica</option>
                    <option value="elettricista">Elettricista & Impianti</option>
                    <option value="spurghi">Spurghi & Fognature</option>
                    <option value="ascensori">Ascensori & Elevatori</option>
                    <option value="pulizie">Pulizie & Giardinaggio</option>
                    <option value="assicurazioni">Polizze Assicurative Fabbricato</option>
                    <option value="energia">Forniture Luce & Gas</option>
                    <option value="altro">Altro</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Tipo Contratto</label>
                  <select
                    value={partnerForm.tipo_contratto}
                    onChange={e => setPartnerForm({ ...partnerForm, tipo_contratto: e.target.value })}
                    style={styles.selectInput}
                  >
                    <option value="pioneer_esclusivo">Pioneer Esclusivo (12 mesi)</option>
                    <option value="multi_vendor">Multi-Vendor Convenzionato</option>
                    <option value="sospeso">Sospeso / Inattivo</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Email Contatti</label>
                  <input
                    type="email"
                    value={partnerForm.email}
                    onChange={e => setPartnerForm({ ...partnerForm, email: e.target.value })}
                    placeholder="fornitore@azienda.it"
                    style={styles.input}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Telefono / Reperibilità</label>
                  <input
                    type="text"
                    value={partnerForm.telefono}
                    onChange={e => setPartnerForm({ ...partnerForm, telefono: e.target.value })}
                    placeholder="+39 333 1234567"
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Inizio Contratto</label>
                  <input
                    type="date"
                    value={partnerForm.data_inizio_contratto}
                    onChange={e => setPartnerForm({ ...partnerForm, data_inizio_contratto: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Scadenza (12 Mesi)</label>
                  <input
                    type="date"
                    value={partnerForm.data_fine_contratto}
                    onChange={e => setPartnerForm({ ...partnerForm, data_fine_contratto: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Quota Annua (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={partnerForm.quota_fissa_annuale}
                    onChange={e => setPartnerForm({ ...partnerForm, quota_fissa_annuale: parseFloat(e.target.value) || 0 })}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Provvigione % sui Lavori</label>
                  <input
                    type="number"
                    step="0.1"
                    value={partnerForm.percentuale_commissione}
                    onChange={e => setPartnerForm({ ...partnerForm, percentuale_commissione: parseFloat(e.target.value) || 0 })}
                    style={styles.input}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Nome Referente</label>
                  <input
                    type="text"
                    value={partnerForm.referente_nome}
                    onChange={e => setPartnerForm({ ...partnerForm, referente_nome: e.target.value })}
                    placeholder="Mario Rossi (Titolare)"
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Scadenza DURC (Data Limit)</label>
                  <input
                    type="date"
                    value={partnerForm.data_scadenza_durc}
                    onChange={e => setPartnerForm({ ...partnerForm, data_scadenza_durc: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                  <input
                    type="checkbox"
                    id="durc_verificato"
                    checked={partnerForm.durc_verificato}
                    onChange={e => setPartnerForm({ ...partnerForm, durc_verificato: e.target.checked })}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <label htmlFor="durc_verificato" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    DURC in Regola (Verificato)
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Sponsor (Amministratore)</label>
                  <select
                    value={partnerForm.invited_by || ''}
                    onChange={e => setPartnerForm({ ...partnerForm, invited_by: e.target.value || null })}
                    style={styles.input}
                  >
                    <option value="">Nessuno Sponsor (Commissione Piena)</option>
                    {utenti.filter(u => !u.is_superadmin).map(u => (
                      <option key={u.id} value={u.id}>{u.nome} {u.cognome} ({u.email})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Note Contrattuali & Accordi Speciali</label>
                <textarea
                  value={partnerForm.note_contrattuali}
                  onChange={e => setPartnerForm({ ...partnerForm, note_contrattuali: e.target.value })}
                  placeholder="Es. Esclusiva valida per i comuni della provincia di Milano. Primo anno promozione lancio."
                  style={{ ...styles.textarea, minHeight: 80 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" onClick={() => setModalPartnerOpen(false)} style={styles.btnSecondary}>
                  Annulla
                </button>
                <button type="submit" disabled={savingPartner} style={{ ...styles.btnSubmit, flex: 'none', padding: '10px 24px' }}>
                  <Save size={16} /> {savingPartner ? 'Salvataggio...' : 'Salva Contratto Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  page: { padding: '24px 32px', maxWidth: 1400, margin: '0 auto', fontFamily: 'Sora, sans-serif' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' },
  subtitle: { fontSize: 14, color: 'var(--text-secondary)', margin: 0 },
  tabs: { display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color)', paddingBottom: 12, marginBottom: 24, overflowX: 'auto' },
  tabButton: { display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' },
  tabActive: { background: '#2563eb', color: '#fff' },
  subTabBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' },
  subTabActive: { background: 'rgba(37, 99, 235, 0.15)', color: '#3b82f6' },
  content: {},
  card: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 24 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  th: { padding: '12px 14px', borderBottom: '1px solid var(--border-color)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' },
  tr: { borderBottom: '1px solid var(--border-color-2)' },
  td: { padding: '12px 14px', fontSize: 13, color: 'var(--text-primary)' },
  ticketCard: { background: 'var(--app-bg)', padding: 16, borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s' },
  textarea: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 14px', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none', minHeight: 120, resize: 'vertical' },
  input: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' },
  selectInput: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', cursor: 'pointer' },
  btnSubmit: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', flex: 2 },
  btnSecondary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
  kpiContainer: { display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  kpiCard: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '18px 20px', flex: 1, minWidth: 150, textAlign: 'left' },
  kpiTitle: { color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
  kpiValue: { color: 'var(--text-primary)', fontSize: 24, fontWeight: 700 },
  kpiSub: { color: 'var(--text-muted)', fontSize: 11, marginTop: 4 },
  modalBackdrop: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24, width: '90%', maxWidth: 750, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' },
  infoBox: { background: 'var(--app-bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' },
  infoLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 },
  infoValue: { fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }
}
