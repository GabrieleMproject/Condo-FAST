import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Users, Ticket, CheckCircle, Search, Save, MessageSquare, Send, Gift, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function BackofficePage() {
  const [activeTab, setActiveTab] = useState('utenti')
  const [utenti, setUtenti] = useState([])
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  const [ticketSearch, setTicketSearch] = useState('')
  const [rispostaText, setRispostaText] = useState('')
  const [selectedTicket, setSelectedTicket] = useState(null)

  // Referral & Campagne states
  const [campagne, setCampagne] = useState([])
  const [referrals, setReferrals] = useState([])
  const [newCampagna, setNewCampagna] = useState({ nome: '', codice_campagna: '', sconto_importo: 10, attiva: false })
  const [creatingCampagna, setCreatingCampagna] = useState(false)

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

    } catch (err) {
      toast.error('Errore caricamento dati: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRispondi = async (ticket) => {
    if (!rispostaText.trim()) return toast.error('Inserisci una risposta')
    try {
      const { error } = await supabase
        .from('tickets_assistenza')
        .update({ risposta_admin: rispostaText, stato: 'chiuso', updated_at: new Date().toISOString() })
        .eq('id', ticket.id)

      if (error) throw error
      toast.success('Risposta inviata e ticket chiuso')
      setRispostaText('')
      setSelectedTicket(null)
      fetchData()
    } catch (err) {
      toast.error('Errore invio risposta: ' + err.message)
    }
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
        await supabase
          .from('referral_campaigns')
          .update({ attiva: false })
          .eq('attiva', true)
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
      await supabase
        .from('referral_campaigns')
        .update({ attiva: false })
        .neq('id', campagnaId)

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
          style={{ ...styles.tabButton, ...(activeTab === 'referral' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('referral')}
        >
          <Gift size={16} /> Referral & Campagne
        </button>
      </div>

      <div style={styles.content}>
        {loading ? (
          <div style={{ color: '#94a3b8', padding: 20 }}>Caricamento in corso...</div>
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
                          <td style={styles.td}><span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{u.id.substring(0, 8)}...</span></td>
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
                              <span style={{ color: '#64748b' }}>Admin</span>
                            )}
                          </td>
                          <td style={styles.td}>
                            <button 
                              onClick={() => handlePromuovi(u.id, u.is_superadmin)}
                              style={{ background: 'transparent', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
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
                      <div key={t.id} style={{ ...styles.ticketCard, border: selectedTicket?.id === t.id ? '1px solid #3b82f6' : '1px solid #334155' }} onClick={() => setSelectedTicket(t)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{t.titolo}</span>
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(t.created_at).toLocaleDateString()}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {t.messaggio}
                        </p>
                      </div>
                    ))}
                    {tickets.filter(t => t.stato === 'aperto').length === 0 && (
                      <p style={{ color: '#64748b', fontSize: 13 }}>Nessun ticket aperto.</p>
                    )}
                  </div>

                  <h3 style={{ ...styles.cardTitle, marginTop: 40, marginBottom: 20 }}>Ticket Chiusi</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.7 }}>
                    {tickets.filter(t => t.stato === 'chiuso').map(t => (
                      <div key={t.id} style={styles.ticketCard} onClick={() => setSelectedTicket(t)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontWeight: 600, color: '#94a3b8', textDecoration: 'line-through' }}>{t.titolo}</span>
                          <span style={{ fontSize: 12, color: '#64748b' }}>{new Date(t.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ticket Detail Sidebar */}
                {selectedTicket && (
                  <div style={{ ...styles.card, flex: 1, position: 'sticky', top: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                      <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: 18 }}>{selectedTicket.titolo}</h2>
                      <span style={{ padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: selectedTicket.stato === 'aperto' ? '#fef08a' : '#10b981', color: selectedTicket.stato === 'aperto' ? '#854d0e' : '#fff' }}>
                        {selectedTicket.stato}
                      </span>
                    </div>

                    <div style={{ marginBottom: 20, padding: 16, background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b' }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Messaggio Utente ({selectedTicket.utente_id.substring(0,8)})</div>
                      <div style={{ color: '#cbd5e1', fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selectedTicket.messaggio}</div>
                    </div>

                    {selectedTicket.stato === 'aperto' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>La tua risposta</label>
                        <textarea
                          value={rispostaText}
                          onChange={e => setRispostaText(e.target.value)}
                          style={styles.textarea}
                          placeholder="Scrivi qui la tua risposta all'utente..."
                        />
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
                      <div style={{ padding: 16, background: '#064e3b', borderRadius: 8, border: '1px solid #047857' }}>
                        <div style={{ fontSize: 11, color: '#6ee7b7', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Risposta Inviata</div>
                        <div style={{ color: '#fff', fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selectedTicket.risposta_admin || 'Chiuso senza risposta testuale.'}</div>
                      </div>
                    )}
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
                        <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Nome Campagna</label>
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
                        <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Codice Unico (Alfanumerico)</label>
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
                        <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Importo Sconto (€)</label>
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
                        <label htmlFor="campagna_attiva" style={{ fontSize: 13, color: '#e2e8f0', cursor: 'pointer' }}>
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
                                  <span style={{ color: '#64748b', fontSize: 13 }}>Inattiva</span>
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
                              <td colSpan="5" style={{ ...styles.td, color: '#64748b', textAlign: 'center' }}>Nessuna campagna creata.</td>
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
                              <div style={{ fontSize: 11, color: '#64748b' }}>{r.referrer?.email || r.referrer_id.substring(0,8)}</div>
                            </td>
                            <td style={styles.td}>
                              <div style={{ fontWeight: 600 }}>{r.referred ? `${r.referred.nome} ${r.referred.cognome}` : '—'}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{r.referred_email}</div>
                            </td>
                            <td style={styles.td}>
                              <span style={{ fontSize: 13 }}>{r.campaign?.nome || '—'}</span>
                              <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{r.campaign?.codice_campagna}</div>
                            </td>
                            <td style={{ ...styles.td, color: '#10b981', fontWeight: 600 }}>{r.sconto_valore}€</td>
                            <td style={styles.td}>
                              {r.stato === 'registrato' && (
                                <span style={{ padding: '2px 6px', borderRadius: 4, background: '#1e293b', color: '#94a3b8', fontSize: 12 }}>Registrato</span>
                              )}
                              {r.stato === 'convalidato' && (
                                <span style={{ padding: '2px 6px', borderRadius: 4, background: '#1e3a8a', color: '#93c5fd', fontSize: 12 }}>Convalidato</span>
                              )}
                              {r.stato === 'applicato' && (
                                <span style={{ padding: '2px 6px', borderRadius: 4, background: '#064e3b', color: '#6ee7b7', fontSize: 12 }}>Applicato</span>
                              )}
                            </td>
                            <td style={{ ...styles.td, fontSize: 12, color: '#94a3b8' }}>
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
                                {r.stato === 'applicato' && <span style={{ color: '#64748b', fontSize: 12 }}>—</span>}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {referrals.length === 0 && (
                          <tr>
                            <td colSpan="7" style={{ ...styles.td, color: '#64748b', textAlign: 'center' }}>Nessun invito registrato nel sistema.</td>
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
  page: { padding: '28px 32px', background: '#0f172a', minHeight: '100vh', fontFamily: 'Sora, sans-serif' },
  header: { marginBottom: 30 },
  title: { color: '#e2e8f0', fontSize: 26, fontWeight: 700, margin: 0, textAlign: 'left' },
  subtitle: { color: '#64748b', fontSize: 13, marginTop: 4, textAlign: 'left' },
  tabs: { display: 'flex', gap: 8, borderBottom: '1px solid #1e293b', paddingBottom: 16, marginBottom: 24 },
  tabButton: { display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: '#64748b', padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
  tabActive: { background: '#1e293b', color: '#f1f5f9' },
  content: {},
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 24, textAlign: 'left' },
  cardTitle: { color: '#e2e8f0', fontSize: 18, fontWeight: 700, marginBottom: 20, marginTop: 0 },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  th: { padding: '12px 16px', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  tr: { borderBottom: '1px solid #1e293b' },
  td: { padding: '14px 16px', color: '#e2e8f0', fontSize: 14 },
  ticketCard: { background: '#0f172a', padding: 16, borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s' },
  textarea: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '12px 14px', color: '#e2e8f0', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none', minHeight: 120, resize: 'vertical' },
  input: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' },
  btnSubmit: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', flex: 2 },
  btnSecondary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', flex: 1 },
}
