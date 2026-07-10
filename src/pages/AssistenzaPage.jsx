import React, { useState, useEffect, useRef } from 'react'
import { LifeBuoy, ChevronDown, ChevronUp, Send, Ticket, Bot, User, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { callClaude, callClaudeWithHistory } from '../lib/claudeClient'
import { toast } from 'react-hot-toast'

const FAQS = [
  {
    q: 'Come faccio ad inserire un nuovo condominio?',
    a: 'Puoi inserire un nuovo condominio dalla voce "Condomini" nella barra laterale sinistra, cliccando sul pulsante "+ Nuovo Condominio" in alto a destra.'
  },
  {
    q: 'Come viene calcolato il riparto spese?',
    a: 'Il riparto spese viene calcolato automaticamente in base ai millesimi assegnati ad ogni unità e al criterio di ripartizione scelto per la singola spesa.'
  },
  {
    q: 'Posso modificare un consuntivo già generato?',
    a: 'Sì, finché non viene approvato definitivamente, puoi ricalcolare il consuntivo aggiornando le spese e le rate dell\'esercizio corrente.'
  },
  {
    q: 'Come importo l\'anagrafica da un file Excel?',
    a: 'Entra nella scheda "Anagrafica" del singolo condominio e usa il pulsante "Importa file" per far leggere il tuo Excel all\'intelligenza artificiale integrata.'
  }
]

const SYSTEM_PROMPT = `Sei l'assistente virtuale di CondoSmart, il gestionale SaaS moderno per amministratori di condominio.
Il tuo compito è aiutare l'amministratore a usare il software in modo chiaro e rapido.

MAPPA STRUTTURALE CONDOSMART:
- "Dashboard": panoramica sintetica e alert.
- "Condomini": elenco condomini, inserimento nuovo condominio, configurazione base. Entrando nel singolo condominio ci sono vari tab (Anagrafica, Spese, Consuntivo, Rate).
- "Anagrafica": gestione globale condòmini (ricerca istantanea) e anagrafiche locali per singolo condominio. Import da Excel e AI estrattiva supportata.
- "Spese": caricamento fatture (supporta estrazione AI) e ripartizione manuale o automatica.
- "Comunicazioni": invio email, solleciti dinamici ai morosi.
- "Certificazioni": area per modulo fiscale (es. ritenute, F24).
- "Storico operazioni": log completo dei movimenti e audit trail.
- "Impostazioni": gestione profilo amministratore, branding documenti studio (logo, contatti) e gestione piano abbonamento (Stripe).
- "Assistenza": questa sezione, dove si possono gestire i ticket e parlare con te.

REGOLE DI RISPOSTA:
1. Usa un tono professionale ma amichevole. Non essere prolisso.
2. Fornisci i percorsi esatti usando la mappa strutturale (es: "Per modificare il logo, vai in Impostazioni > Studio / Branding documenti").
3. Se non conosci la risposta, o se l'utente segnala un errore o bug di sistema, suggerisci esplicitamente all'utente di cliccare il pulsante "Non hai risolto? Apri Ticket" presente sotto la chat. Non inventare soluzioni a bug tecnici.`

export default function AssistenzaPage() {
  const [expandedFaq, setExpandedFaq] = useState(null)
  
  // Stati Liste Ticket
  const [tickets, setTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(true)

  // Stati Chatbot
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', content: 'Ciao! Sono l\'assistente virtuale di CondoSmart. Come posso aiutarti con il gestionale oggi?' }
  ])
  const [isTyping, setIsTyping] = useState(false)
  const [isConvertingToTicket, setIsConvertingToTicket] = useState(false)
  const chatEndRef = useRef(null)

  const salvaLogChat = async (historyToSave, risoltoConTicket = false) => {
    if (historyToSave.length <= 1) return;
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const transcript = historyToSave.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n')

      await supabase.from('chat_assistenza_logs').insert({
        user_id: user.id,
        trascrizione: transcript,
        risolto_con_ticket: risoltoConTicket
      })
    } catch (err) {
      console.error('Errore silent save log chat:', err)
    }
  }

  // Timer reset chat inattività (10 minuti = 600000 ms)
  useEffect(() => {
    if (chatHistory.length <= 1) return; // Non timerizza il messaggio di benvenuto iniziale
    const timer = setTimeout(() => {
      salvaLogChat(chatHistory, false)
      setChatHistory([
        { role: 'assistant', content: 'La chat è stata riavviata automaticamente dopo 10 minuti di inattività. Se serve altro, sono qui!' }
      ])
    }, 600000);
    return () => clearTimeout(timer);
  }, [chatHistory]);

  const handleResetChat = () => {
    salvaLogChat(chatHistory, false)
    setChatHistory([
      { role: 'assistant', content: 'Chat terminata manualmente. Posso aiutarti con qualcos\'altro?' }
    ])
    setChatInput('')
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  useEffect(() => {
    // Autoscroll chat
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, isTyping])

  const fetchTickets = async () => {
    setLoadingTickets(true)
    try {
      const { data, error } = await supabase
        .from('tickets_assistenza')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setTickets(data || [])
    } catch (err) {
      toast.error('Errore nel caricamento dei ticket: ' + err.message)
    } finally {
      setLoadingTickets(false)
    }
  }

  const handleChatSubmit = async (e) => {
    e.preventDefault()
    if (!chatInput.trim() || isTyping) return

    const userMsg = { role: 'user', content: chatInput }
    const newHistory = [...chatHistory, userMsg]
    setChatHistory(newHistory)
    setChatInput('')
    setIsTyping(true)

    try {
      const aiResponse = await callClaudeWithHistory(newHistory, { 
        system: SYSTEM_PROMPT, 
        funzione: 'assistenza_chat',
        maxTokens: 500
      })
      setChatHistory([...newHistory, { role: 'assistant', content: aiResponse }])
    } catch (err) {
      toast.error('Errore di comunicazione AI: ' + err.message)
      setChatHistory([...newHistory, { role: 'assistant', content: 'Scusa, ho riscontrato un errore di connessione. Se il problema persiste, ti consiglio di inoltrare la chat aprendo un ticket.' }])
    } finally {
      setIsTyping(false)
    }
  }

  const handleConvertiTicket = async () => {
    const lastUserMsg = chatHistory.slice().reverse().find(m => m.role === 'user')?.content
    if (!lastUserMsg) {
      toast.error('Nessuna richiesta utente trovata da poter inoltrare.')
      return
    }

    setIsConvertingToTicket(true)
    try {
      // 1. Genera titolo AI silente
      const promptTitolo = `Genera un titolo breve, professionale e senza punteggiatura finale (max 8 parole) che riassuma questo problema tecnico o domanda: "${lastUserMsg}". Rispondi SOLO col titolo, niente introduzioni.`
      let titoloGenerato = await callClaude(promptTitolo, { funzione: 'assistenza_titolo_ticket', maxTokens: 50 })
      titoloGenerato = titoloGenerato.replace(/["']/g, '').trim()
      if (!titoloGenerato) titoloGenerato = 'Richiesta di assistenza via Chat'

      // 2. Prepara messaggio
      const transcript = chatHistory.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n')
      const messaggioTicket = `=== TRASCRIZIONE CHAT ===\n${transcript}\n=========================`

      // 3. Insert DB
      const { error } = await supabase.from('tickets_assistenza').insert({
        titolo: titoloGenerato,
        messaggio: messaggioTicket
      })
      
      if (error) throw error
      toast.success('Ticket aperto con successo! Il nostro team ti risponderà al più presto.')
      fetchTickets()
      
      salvaLogChat(chatHistory, true)

      // Reset chat con avviso
      setChatHistory([
        { role: 'assistant', content: `Ho inoltrato la tua richiesta al supporto umano con il titolo: **"${titoloGenerato}"**.\nTroverai il ticket e la risposta nel riquadro di sinistra.` }
      ])
    } catch (err) {
      toast.error('Errore nella creazione del ticket: ' + err.message)
    } finally {
      setIsConvertingToTicket(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Assistenza & Supporto</h1>
        <p style={styles.subtitle}>Chatta con il nostro AI o consulta le risposte rapide. In caso di necessità, apriremo un ticket al team tecnico.</p>
      </div>

      <div style={styles.grid}>
        {/* Colonna SX: FAQ e Cronologia Ticket */}
        <div style={styles.col}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Domande Frequenti (FAQ)</h2>
            <div style={styles.faqList}>
              {FAQS.map((faq, idx) => {
                const isOpen = expandedFaq === idx
                return (
                  <div key={idx} style={styles.faqItem}>
                    <div style={styles.faqQuestion} onClick={() => setExpandedFaq(isOpen ? null : idx)}>
                      <span style={{ fontWeight: 600 }}>{faq.q}</span>
                      {isOpen ? <ChevronUp size={18} color="#60a5fa" /> : <ChevronDown size={18} color="#64748b" />}
                    </div>
                    {isOpen && (
                      <div style={styles.faqAnswer}>
                        {faq.a}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Ticket size={24} color="#10b981" />
              <h2 style={{ ...styles.cardTitle, margin: 0 }}>I Tuoi Ticket</h2>
            </div>
            
            {loadingTickets ? (
              <p style={{ color: '#64748b', fontSize: 13 }}>Caricamento in corso...</p>
            ) : tickets.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: 13 }}>Nessun ticket aperto. La cronologia delle richieste apparirà qui.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tickets.map(t => (
                  <div key={t.id} style={{ ...styles.ticketCard, borderLeft: t.stato === 'aperto' ? '4px solid #fef08a' : '4px solid #10b981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>{t.titolo}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        {t.stato.toUpperCase()} • {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', marginBottom: t.risposta_admin ? 12 : 0, whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
                      {t.messaggio}
                    </p>
                    
                    {t.risposta_admin && (
                      <div style={{ background: '#064e3b', padding: 12, borderRadius: 8, marginTop: 12 }}>
                        <span style={{ fontSize: 10, color: '#6ee7b7', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Risposta del Supporto</span>
                        <p style={{ margin: 0, fontSize: 13, color: '#fff', whiteSpace: 'pre-wrap' }}>{t.risposta_admin}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Colonna DX: Chatbot UI */}
        <div style={styles.col}>
          <div style={{...styles.card, height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 20, padding: 0, overflow: 'hidden'}}>
            
            {/* Chat Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid #334155', background: '#0f172a' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={20} color="#fff" />
              </div>
              <div>
                <h2 style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 700, margin: 0 }}>Assistente Virtuale</h2>
                <span style={{ color: '#64748b', fontSize: 12 }}>Powered by Claude AI</span>
              </div>
            </div>

            {/* Chat Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, background: '#1e293b' }}>
              {chatHistory.map((msg, i) => {
                const isUser = msg.role === 'user'
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, flexDirection: isUser ? 'row-reverse' : 'row' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: isUser ? '#2563eb' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isUser ? <User size={16} color="#fff" /> : <Bot size={16} color="#fff" />}
                    </div>
                    <div style={{ 
                      background: isUser ? '#2563eb' : '#0f172a', 
                      border: isUser ? 'none' : '1px solid #334155',
                      padding: '12px 16px', 
                      borderRadius: 12, 
                      borderTopRightRadius: isUser ? 0 : 12,
                      borderTopLeftRadius: isUser ? 12 : 0,
                      color: isUser ? '#fff' : '#e2e8f0',
                      fontSize: 14,
                      lineHeight: 1.5,
                      maxWidth: '85%',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
              
              {isTyping && (
                <div style={{ display: 'flex', gap: 12, flexDirection: 'row' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bot size={16} color="#fff" />
                  </div>
                  <div style={{ background: '#0f172a', border: '1px solid #334155', padding: '12px 16px', borderRadius: 12, borderTopLeftRadius: 0, color: '#94a3b8', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="dot-pulse">●</span><span className="dot-pulse delay-1">●</span><span className="dot-pulse delay-2">●</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Fallback & Input Area */}
            <div style={{ padding: 16, borderTop: '1px solid #334155', background: '#0f172a' }}>
              
              {/* Fallback to ticket e Reset Chat */}
              {chatHistory.length > 1 && (
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', gap: 12 }}>
                  {chatHistory.length > 2 && (
                    <button 
                      type="button" 
                      onClick={handleConvertiTicket}
                      disabled={isConvertingToTicket || isTyping}
                      style={{ background: 'transparent', border: '1px solid #3b82f6', color: '#60a5fa', borderRadius: 20, padding: '6px 16px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, transition: 'all 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {isConvertingToTicket ? 'Generazione Ticket...' : <>Non hai risolto? Apri Ticket <ArrowRight size={14}/></>}
                    </button>
                  )}
                  
                  <button 
                    type="button" 
                    onClick={handleResetChat}
                    disabled={isConvertingToTicket || isTyping}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', borderRadius: 20, padding: '6px 16px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, transition: 'all 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  >
                    Termina Chat
                  </button>
                </div>
              )}

              <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: 10 }}>
                <input 
                  type="text" 
                  placeholder="Descrivi il tuo problema..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  disabled={isTyping || isConvertingToTicket}
                  style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 24, padding: '12px 20px', color: '#e2e8f0', fontSize: 14, outline: 'none' }} 
                />
                <button 
                  type="submit" 
                  disabled={!chatInput.trim() || isTyping || isConvertingToTicket}
                  style={{ width: 44, height: 44, borderRadius: '50%', background: chatInput.trim() && !isTyping ? '#2563eb' : '#334155', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: chatInput.trim() && !isTyping ? 'pointer' : 'not-allowed', flexShrink: 0, transition: 'background 0.2s' }}
                >
                  <Send size={18} style={{ marginLeft: 2 }} />
                </button>
              </form>
            </div>

          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes blink { 0% { opacity: 0.2; } 50% { opacity: 1; } 100% { opacity: 0.2; } }
        .dot-pulse { animation: blink 1.4s infinite both; }
        .delay-1 { animation-delay: 0.2s; }
        .delay-2 { animation-delay: 0.4s; }
      `}} />
    </div>
  )
}

const styles = {
  page: { padding: '28px 32px', background: '#0f172a', minHeight: '100vh', fontFamily: 'Sora, sans-serif' },
  header: { marginBottom: 30 },
  title: { color: '#e2e8f0', fontSize: 26, fontWeight: 700, margin: 0, textAlign: 'left' },
  subtitle: { color: '#64748b', fontSize: 13, marginTop: 4, textAlign: 'left' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, alignItems: 'start' },
  col: { display: 'flex', flexDirection: 'column', gap: 24 },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 24, textAlign: 'left' },
  cardTitle: { color: '#e2e8f0', fontSize: 18, fontWeight: 700, marginBottom: 20, marginTop: 0 },
  faqList: { display: 'flex', flexDirection: 'column', gap: 12 },
  faqItem: { background: '#0f172a', border: '1px solid #334155', borderRadius: 10, overflow: 'hidden' },
  faqQuestion: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer', color: '#e2e8f0', fontSize: 14, userSelect: 'none' },
  faqAnswer: { padding: '0 20px 16px', color: '#94a3b8', fontSize: 13, lineHeight: 1.6 },
  ticketCard: { background: '#0f172a', padding: 16, borderRadius: 8, border: '1px solid #334155' }
}
