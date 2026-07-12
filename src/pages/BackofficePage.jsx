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

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id, piano, is_superadmin, studio_nome, ragione_sociale, email')
      
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
      </div>

      <div style={styles.content}>
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', padding: 20 }}>Caricamento in corso...</div>
        ) : (
          <>
            {activeTab === 'utenti' && (
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>Lista Utenti</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>ID Utente</th>
                        <th style={styles.th}>Nome Studio / Ragione Sociale</th>
                        <th style={styles.th}>Piano</th>
                        <th style={styles.th}>Ruolo</th>
                        <th style={styles.th}>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {utenti.map(u => (
                        <tr key={u.id} style={styles.tr}>
                          <td style={styles.td}><span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{u.id.substring(0, 8)}...</span></td>
                          <td style={styles.td}>{u.ragione_sociale || u.studio_nome || '—'}</td>
                          <td style={styles.td}>
                            <span style={{ padding: '4px 8px', borderRadius: 4, background: '#1e3a8a', color: '#bfdbfe', fontSize: 12, fontWeight: 600 }}>
                              {(u.piano || 'trial').toUpperCase()}
                            </span>
                          </td>
                          <td style={styles.td}>
                            {u.is_superadmin ? (
                              <span style={{ color: '#10b981', fontWeight: 600 }}>SuperAdmin</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>Admin</span>
                            )}
                          </td>
                          <td style={styles.td}>
                            <button 
                              onClick={() => handlePromuovi(u.id, u.is_superadmin)}
                              style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                            >
                              Toggle SuperAdmin
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
  btnSubmit: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', flex: 2 },
  btnSecondary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', flex: 1 },
}
