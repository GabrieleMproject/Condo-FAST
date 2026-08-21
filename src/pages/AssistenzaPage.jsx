import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, ChevronUp, Send, Ticket, Bot, User, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { callGemini, callGeminiWithHistory } from '../lib/geminiClient'
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

const SYSTEM_PROMPT = `Sei l'Assistente Virtuale Ufficiale ed esperto di CondoFAST, il gestionale SaaS di ultima generazione per l'amministrazione dei condomini.
Il tuo obiettivo è guidare gli amministratori passo-passo con istruzioni chiare, operative, esaustive e ben strutturate.

KNOWLEDGE BASE OPERATIVA DI CONDOFAST:

1. GESTIONE CONSUNTIVO & CHIUSURA ESERCIZIO:
   - Percorso: Condomini > Seleziona Condominio > Tab "Consuntivo".
   - Procedura:
     1) Assicurati che tutte le spese dell'anno siano state registrate nel Tab "Spese" con la relativa tabella millesimale assegnata.
     2) Vai nel Tab "Consuntivo" per verificare la Sezione A (Totale Spese Ordinarie/Straordinarie), la Sezione B (Fondo Cassa & Saldo Conto) e le Sezioni D/E (Riparto per Unità).
     3) Clicca sul pulsante "Calcola Conguagli / Saldi Finali": il sistema calcolerà la differenza tra preventivo/rate versate e consuntivo.
     4) Clicca su "Esporta PDF Consuntivo" per stampare il rendiconto ufficiale per l'assemblea o su "Chiudi Esercizio" per archiviare l'annata e riportare i saldi iniziali all'anno successivo.

2. GESTIONE SPESE & ESTRAZIONE FATTURE AI:
   - Percorso: Sidebar "Spese" oppure Condomini > Tab "Spese".
   - Procedura:
     1) Clicca "+ Nuova Spesa / Carica Fattura".
     2) Carica il file PDF o immagine della fattura/ricevuta. L'IA di Gemini estrarrà automaticamente Fornitore, Data, Numero Documento, Importo Totale e Ritenuta d'acconto (8%).
     3) Controlla i dati estratti, seleziona la Tabella Millesimale di riparto (es. Tabella A Generale, Scala A, Ascensore).
     4) Clicca "Salva Spesa" per registrarla nel bilancio del condominio.

3. GESTIONE RATE, INCASSI & SOLLECITI MOROSI:
   - Percorso: Condomini > Tab "Rate".
   - Registrazione Incasso: Clicca sulla cella della rata corrispondente all'unità/condomino e inserisci l'importo incassato.
   - Solleciti Morosi: Se una rata è scaduta, clicca sull'icona sollecito rapido nella cella oppure vai su "Comunicazioni" > "Proposte Solleciti". L'IA calcolerà il conguaglio aggiornato dell'unità e genererà la lettera/email di sollecito pronta da inviare via Resend/email.

4. ESTRATTO CONTO & RICONCILIAZIONE BANCARIA:
   - Percorso: Condomini > Tab "Estratto Conto" oppure "Riconciliazioni".
   - Procedura:
     1) Carica l'estratto conto bancario (file CSV/OFX o PDF).
     2) Il motore di riconciliazione confronterà ogni movimento in uscita con le spese registrate e ogni movimento in entrata con le rate previste.
     3) Per ogni corrispondenza trovata, clicca "Abbona / Riconcilia". Se manca la spesa, usa l'abbinamento rapido per crearla al volo.

5. ANAGRAFICA, SUBENTRI & IMPORT DA EXCEL:
   - Percorso: Sidebar "Anagrafica" oppure Condomini > Tab "Anagrafica".
   - Import Excel: Clicca "Importa da Excel" per far analizzare all'IA la struttura delle tue tabelle e importare automaticamente Proprietari, Inquilini, Quote e Millesimi.
   - Subentri: Per registrare un cambio proprietario o inquilino a metà anno, usa la funzione "Gestisci Subentro" nell'anagrafica dell'unità.

6. CERTIFICAZIONI FISCALI & F24:
   - Percorso: Sidebar "Certificazioni".
   - Gestisci la Diagnosi Fiscale, i modelli CU (Certificazione Unica), 770 ed il calcolo/stampa delle ritenute d'acconto versate con F24.

7. IMPOSTAZIONI STUDIO & BRANDING DOCUMENTI:
   - Percorso: Sidebar "Impostazioni" oppure clicca sull'Avatar in alto a destra per aprire il Drawer Profilo.
   - Puoi personalizzare Logo dello Studio, Ragione Sociale, Partita IVA, Codice Fiscale e Contatti per farli apparire su tutte le stampe PDF dei consuntivi e sui solleciti.

REGOLE TASSATIVE PER L'ASSISTENTE:
- Se l'utente scrive richieste brevi come "guidami", "continua", "spiegami di più", "come procedo?", rispondi facendo riferimento puntuale all'ultimo argomento trattato nella conversazione, elencando i passaggi numerati 1, 2, 3 in modo completo, chiaro ed esaustivo.
- Usa sempre formattazione Markdown con grassetti per i percorsi, i nomi dei tab ed i pulsanti.
- Mantieni sempre un tono cortese, chiaro, autorevole e professionale.
- Se l'utente segnala un bug tecnico o un'anomalia di sistema, invita con gentilezza ad usare il pulsante "Non hai risolto? Apri Ticket" posizionato sotto la chat.`

export default function AssistenzaPage() {
  const [expandedFaq, setExpandedFaq] = useState(null)
  
  // Stati Liste Ticket
  const [tickets, setTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(true)

  // Stati Chatbot
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState(() => {
    try {
      const saved = sessionStorage.getItem('assistenza_chat_history')
      if (saved) {
        const { history, timestamp } = JSON.parse(saved)
        // Check se sono passati meno di 15 minuti (900000 ms)
        if (new Date().getTime() - timestamp < 900000) {
          return history
        }
      }
    } catch (e) {
      console.error('Errore lettura session storage:', e)
    }
    return [{ role: 'assistant', content: 'Ciao! Sono l\'assistente virtuale di CondoFAST. Come posso aiutarti con il gestionale oggi?' }]
  })
  const [isTyping, setIsTyping] = useState(false)
  const [isConvertingToTicket, setIsConvertingToTicket] = useState(false)
  const chatEndRef = useRef(null)

  const salvaLogChat = useCallback(async (historyToSave, risoltoConTicket = false) => {
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
  }, [])

  // Salva cronologia in sessionStorage ad ogni aggiornamento
  useEffect(() => {
    sessionStorage.setItem('assistenza_chat_history', JSON.stringify({
      history: chatHistory,
      timestamp: new Date().getTime()
    }))
  }, [chatHistory])

  // Timer reset chat inattività (15 minuti = 900000 ms)
  useEffect(() => {
    if (chatHistory.length <= 1) return; // Non timerizza il messaggio di benvenuto iniziale o di reset
    const timer = setTimeout(() => {
      salvaLogChat(chatHistory, false)
      setChatHistory([
        { role: 'assistant', content: 'La chat è stata riavviata automaticamente dopo 15 minuti di inattività. Se serve altro, sono qui!' }
      ])
    }, 900000);
    return () => clearTimeout(timer);
  }, [chatHistory]);

  const handleResetChat = () => {
    salvaLogChat(chatHistory, false)
    setChatHistory([
      { role: 'assistant', content: 'Chat terminata manualmente. Posso aiutarti con qualcos\'altro?' }
    ])
    setChatInput('')
  }

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

  useEffect(() => {
    fetchTickets()
  }, [])

  useEffect(() => {
    // Autoscroll chat
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, isTyping])

  const handleChatSubmit = async (e) => {
    e.preventDefault()
    if (!chatInput.trim() || isTyping) return

    const originalInput = chatInput
    const userMsg = { role: 'user', content: originalInput }
    const newHistory = [...chatHistory, userMsg]
    setChatHistory(newHistory)
    setChatInput('')
    setIsTyping(true)

    try {
      // ── RAG: Ricerca articoli pertinenti nella knowledge base ────────────────
      let kbContext = ''
      try {
        const paroleSignificative = originalInput
          .toLowerCase()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 3)

        if (paroleSignificative.length > 0) {
          // Costruiamo una query OR per cercare le parole chiave significative
          const orFilter = paroleSignificative
            .map(w => `domanda_sintesi.ilike.%${w}%,risoluzione.ilike.%${w}%`)
            .join(',')

          const { data: kbData } = await supabase
            .from('assistenza_knowledge')
            .select('*')
            .or(orFilter)
            .limit(3)

          if (kbData && kbData.length > 0) {
            kbContext = kbData
              .map(k => `[Argomento: ${k.argomento}]\nDomanda: ${k.domanda_sintesi}\nRisoluzione: ${k.risoluzione}`)
              .join('\n\n')
          }
        }
      } catch (kbErr) {
        console.error('Errore caricamento KB contestuale:', kbErr)
      }

      const systemPromptDinamico = kbContext
        ? `${SYSTEM_PROMPT}\n\nKNOWLEDGE BASE CONTESTUALE (FAQ E CASI RISOLTI IN PRECEDENZA):\n${kbContext}\n\nUsa le informazioni qui sopra se sono pertinenti per formulare la tua risposta.`
        : SYSTEM_PROMPT

      // Sanificazione cronologia per Gemini: l'elenco deve iniziare sempre con un messaggio 'user'
      let historyToSend = newHistory.filter(m => m.content && m.content.trim() !== '');
      if (historyToSend[0]?.role === 'assistant') {
        historyToSend = historyToSend.slice(1);
      }
      if (historyToSend.length === 0) {
        historyToSend = [userMsg];
      }

      const aiResponse = await callGeminiWithHistory(historyToSend, { 
        system: systemPromptDinamico, 
        funzione: 'assistenza_chat',
        maxTokens: 3000
      })
      setChatHistory([...newHistory, { role: 'assistant', content: aiResponse }])
    } catch (err) {
      console.error('[AssistenzaChat] Errore risposta AI:', err)
      toast.error('Errore di comunicazione AI: ' + (err.message || 'Connessione fallita'))
      setChatHistory([...newHistory, { role: 'assistant', content: `Scusa, ho riscontrato un errore di connessione: ${err.message || 'Connessione al server fallita'}. Se il problema persiste, puoi convertire questa conversazione in un ticket col pulsante in alto.` }])
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
      let titoloGenerato = await callGemini(promptTitolo, { funzione: 'assistenza_titolo_ticket', maxTokens: 50 })
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
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Caricamento in corso...</p>
            ) : tickets.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nessun ticket aperto. La cronologia delle richieste apparirà qui.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tickets.map(t => (
                  <div key={t.id} style={{ ...styles.ticketCard, borderLeft: t.stato === 'aperto' ? '4px solid #fef08a' : '4px solid #10b981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{t.titolo}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {t.stato.toUpperCase()} • {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', marginBottom: t.risposta_admin ? 12 : 0, whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
                      {t.messaggio}
                    </p>
                    
                    {t.risposta_admin && (
                      <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: 12, borderRadius: 8, marginTop: 12 }}>
                        <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Risposta del Supporto</span>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{t.risposta_admin}</p>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--app-bg)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={20} color="#fff" />
              </div>
              <div>
                <h2 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, margin: 0 }}>Assistente Virtuale</h2>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Powered by Gemini AI</span>
              </div>
            </div>

            {/* Chat Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--card-bg)' }}>
              {chatHistory.map((msg, i) => {
                const isUser = msg.role === 'user'
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, flexDirection: isUser ? 'row-reverse' : 'row' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: isUser ? '#2563eb' : 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isUser ? <User size={16} color="#fff" /> : <Bot size={16} color="#fff" />}
                    </div>
                    <div style={{ 
                      background: isUser ? '#2563eb' : 'var(--app-bg)', 
                      border: isUser ? 'none' : '1px solid var(--border-color)',
                      padding: '12px 16px', 
                      borderRadius: 12, 
                      borderTopRightRadius: isUser ? 0 : 12,
                      borderTopLeftRadius: isUser ? 12 : 0,
                      color: isUser ? '#fff' : 'var(--text-primary)',
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
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bot size={16} color="#fff" />
                  </div>
                  <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', padding: '12px 16px', borderRadius: 12, borderTopLeftRadius: 0, color: 'var(--text-secondary)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="dot-pulse">●</span><span className="dot-pulse delay-1">●</span><span className="dot-pulse delay-2">●</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Fallback & Input Area */}
            <div style={{ padding: 16, borderTop: '1px solid var(--border-color)', background: 'var(--app-bg)' }}>
              
              {/* Fallback to ticket e Reset Chat */}
              {chatHistory.length > 1 && (
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', gap: 12 }}>
                  {chatHistory.length > 2 && (
                    <button 
                      type="button" 
                      onClick={handleConvertiTicket}
                      disabled={isConvertingToTicket || isTyping}
                      style={{ background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 20, padding: '6px 16px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, transition: 'all 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {isConvertingToTicket ? 'Generazione Ticket...' : <>Non hai risolto? Apri Ticket <ArrowRight size={14}/></>}
                    </button>
                  )}
                  
                  <button 
                    type="button" 
                    onClick={handleResetChat}
                    disabled={isConvertingToTicket || isTyping}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 20, padding: '6px 16px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, transition: 'all 0.2s' }}
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
                  style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 24, padding: '12px 20px', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} 
                />
                <button 
                  type="submit" 
                  disabled={!chatInput.trim() || isTyping || isConvertingToTicket}
                  style={{ width: 44, height: 44, borderRadius: '50%', background: chatInput.trim() && !isTyping ? '#2563eb' : 'var(--border-color)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: chatInput.trim() && !isTyping ? 'pointer' : 'not-allowed', flexShrink: 0, transition: 'background 0.2s' }}
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
  page: { padding: '28px 32px', background: 'var(--app-bg)', minHeight: '100vh', fontFamily: 'Sora, sans-serif' },
  header: { marginBottom: 30 },
  title: { color: 'var(--text-primary)', fontSize: 26, fontWeight: 700, margin: 0, textAlign: 'left' },
  subtitle: { color: 'var(--text-muted)', fontSize: 13, marginTop: 4, textAlign: 'left' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, alignItems: 'start' },
  col: { display: 'flex', flexDirection: 'column', gap: 24 },
  card: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 24, textAlign: 'left' },
  cardTitle: { color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, marginBottom: 20, marginTop: 0 },
  faqList: { display: 'flex', flexDirection: 'column', gap: 12 },
  faqItem: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' },
  faqQuestion: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 14, userSelect: 'none' },
  faqAnswer: { padding: '0 20px 16px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 },
  ticketCard: { background: 'var(--app-bg)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }
}
