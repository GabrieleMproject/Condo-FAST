// src/components/SintesiSubentroModal.jsx
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useComunicazioni } from '../hooks/useComunicazioni'
import { X, Check, ExternalLink, AlertTriangle, Mail, RefreshCw, CreditCard } from 'lucide-react'
import { toast } from 'react-hot-toast'

const formattaData = (d) => (d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleDateString('it-IT') : '—')
const eur = (n) => '€ ' + (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function SintesiSubentroModal({ unita, ruolo, nuovoCondomino, exCondomino, dataSubentro, onClose }) {
  const { inviaComunicazione, loading: inviandoMail } = useComunicazioni()
  
  const [condoInfo, setCondoInfo] = useState(null)
  const [esercizioAttivo, setEsercizioAttivo] = useState(null)
  const [ultimoMovimentoCassa, setUltimoMovimentoCassa] = useState(null)
  const [rateRows, setRateRows] = useState([])
  const [loadingConti, setLoadingConti] = useState(true)
  const [confermaAllineamento, setConfermaAllineamento] = useState(false)
  
  // Stati Email
  const [emailOgg, setEmailOgg] = useState('')
  const [emailCorpo, setEmailCorpo] = useState('')
  const [inviataConSuccesso, setInviataConSuccesso] = useState(false)

  // Calcolo totali
  const dovutoTot = rateRows.reduce((a, r) => a + (Number(r.importo) || 0), 0)
  const pagatoTot = rateRows.reduce((a, r) => a + (Number(r.importo_pagato) || 0), 0)
  const residuoTot = Math.max(0, dovutoTot - pagatoTot)

  const caricaDatiContContabili = useCallback(async () => {
    if (!unita?.id || !unita?.condominio_id) return
    setLoadingConti(true)
    try {
      // 1. Carica condominio (IBAN e Nome)
      const { data: condo } = await supabase
        .from('condomini')
        .select('nome, iban, amministratore_id')
        .eq('id', unita.condominio_id)
        .single()
      setCondoInfo(condo)

      // 2. Carica esercizio attivo del condominio
      const { data: es } = await supabase
        .from('esercizi')
        .select('id, anno, data_inizio, data_fine')
        .eq('condominio_id', unita.condominio_id)
        .eq('stato', 'aperto')
        .maybeSingle()
      
      let activeEs = es
      if (!activeEs) {
        const { data: esRec } = await supabase
          .from('esercizi')
          .select('id, anno, data_inizio, data_fine')
          .eq('condominio_id', unita.condominio_id)
          .order('anno', { ascending: false })
          .limit(1)
          .maybeSingle()
        activeEs = esRec
      }
      setEsercizioAttivo(activeEs)

      // 3. Carica data dell'ultimo movimento estratto conto
      const { data: ultimoMov } = await supabase
        .from('estratto_conto')
        .select('data_movimento')
        .eq('condominio_id', unita.condominio_id)
        .order('data_movimento', { ascending: false })
        .limit(1)
        .maybeSingle()
      setUltimoMovimentoCassa(ultimoMov?.data_movimento || null)

      // 4. Carica rate dell'unità per l'esercizio attivo
      if (activeEs) {
        const { data: rateUn, error: eRate } = await supabase
          .from('rate_unita')
          .select(`
            id, importo, importo_pagato,
            rate!inner(id, nome, data_scadenza, esercizio_id)
          `)
          .eq('unita_id', unita.id)
          .eq('rate.esercizio_id', activeEs.id)
        
        if (eRate) throw eRate
        
        // Mappa e ordina le rate per data scadenza
        const rows = (rateUn || []).map(r => ({
          id: r.id,
          nome: r.rate?.nome || 'Rata',
          scadenza: r.rate?.data_scadenza || '',
          importo: Number(r.importo) || 0,
          importo_pagato: Number(r.importo_pagato) || 0,
        })).sort((a, b) => (a.scadenza || '').localeCompare(b.scadenza || ''))

        setRateRows(rows)
      }
    } catch (e) {
      console.error('[SintesiSubentroModal] Errore caricamento contabilità:', e.message)
      toast.error('Errore nel ricaricare i dati contabili: ' + e.message)
    } finally {
      setLoadingConti(false)
    }
  }, [unita])

  useEffect(() => {
    caricaDatiContContabili()
  }, [caricaDatiContContabili])

  // Precompila l'email quando cambiano le rate o i dati condominio
  useEffect(() => {
    if (!nuovoCondomino || !condoInfo || loadingConti) return
    
    setEmailOgg(`Benvenuto in CondoFAST - Situazione contabile Unità ${unita.numero} [${condoInfo.nome}]`)
    
    const dettaglioRateText = rateRows.map(r => 
      `- ${r.nome} (Scadenza: ${formattaData(r.scadenza)}): Dovuto ${eur(r.importo)} | Pagato ${eur(r.importo_pagato)} | Residuo ${eur(r.importo - r.importo_pagato)}`
    ).join('\n')

    const corpo = `Gentile ${nuovoCondomino.cognome} ${nuovoCondomino.nome},

ti diamo il benvenuto nel condominio ${condoInfo.nome || 'Condominio'}.

A seguito del tuo subentro in data ${formattaData(dataSubentro)} in qualità di ${ruolo === 'proprietario' ? 'proprietario' : 'inquilino'} per l'unità ${unita.numero}${unita.scala ? ` Scala ${unita.scala}` : ''}, ti comunichiamo che la situazione delle rate dell'esercizio attivo a tuo carico prevede un importo residuo complessivo da versare pari a ${eur(residuoTot)}.

Di seguito il dettaglio delle rate ed insoluti dell'unità:
${dettaglioRateText || 'Nessuna rata configurata per questo esercizio.'}

Coordinate bancarie per il versamento:
IBAN: ${condoInfo.iban || 'Non configurato'}
Beneficiario: Condominio ${condoInfo.nome}

Per qualsiasi chiarimento o per l'invio delle ricevute di pagamento, puoi contattare lo studio amministrativo rispondendo a questa e-mail.

Cordiali saluti,
Amministrazione Condominio ${condoInfo.nome}`
    
    setEmailCorpo(corpo)
  }, [nuovoCondomino, condoInfo, rateRows, loadingConti, unita, dataSubentro, ruolo, residuoTot])

  const handleInviaMail = async () => {
    if (!confermaAllineamento) {
      toast.error('Spunta la casella di conferma allineamento per procedere.')
      return
    }
    if (!nuovoCondomino.email) {
      toast.error('Il condòmino non ha un indirizzo email configurato.')
      return
    }

    try {
      await inviaComunicazione({
        condominio_id: unita.condominio_id,
        persona_id: nuovoCondomino.id,
        tipo: 'sollecito', // logga come sollecito/comunicazione per morosità
        mezzo: 'email',
        oggetto: emailOgg,
        testo: emailCorpo,
      })
      toast.success('E-mail di benvenuto inviata con successo!')
      setInviataConSuccesso(true)
    } catch (e) {
      console.error('[SintesiSubentroModal] Errore invio e-mail:', e)
      toast.error('Errore durante l\'invio: ' + e.message)
    }
  }

  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={st.modal} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={st.modalHeader}>
          <div>
            <h3 style={{ ...st.modalTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Check size={18} color="#10b981" /> Subentro Registrato & Sintesi Contabile
            </h3>
            <p style={st.modalSub}>
              Unità {unita.numero} {unita.scala ? `· Scala ${unita.scala}` : ''} {unita.piano != null ? `· Piano ${unita.piano}` : ''}
            </p>
          </div>
          <button style={st.closeBtn} onClick={onClose} disabled={inviandoMail}>
            <X size={18} />
          </button>
        </div>

        <div style={st.modalBody}>
          {/* Left panel: Accounting information */}
          <div style={st.leftPanel}>
            <h4 style={st.sectionTitle}>Riepilogo Subentro</h4>
            
            {/* Timeline anagrafica */}
            <div style={st.timelineCard}>
              <div style={st.timelineRow}>
                <span style={st.badgeActive}>Nuovo Condòmino</span>
                <span style={st.condominioNome}>{nuovoCondomino ? `${nuovoCondomino.cognome} ${nuovoCondomino.nome}` : '—'}</span>
                <span style={st.dataLabel}>dal {formattaData(dataSubentro)}</span>
              </div>
              {exCondomino && (
                <div style={{ ...st.timelineRow, marginTop: 8 }}>
                  <span style={st.badgePast}>Precedente</span>
                  <span style={st.condominioNome}>{exCondomino.cognome} {exCondomino.nome}</span>
                  <span style={st.dataLabel}>fino al {formattaData(new Date(new Date(dataSubentro).setDate(new Date(dataSubentro).getDate() - 1)))}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 8px' }}>
              <h4 style={{ ...st.sectionTitle, margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Situazione Rateale Unità</h4>
              <button style={st.refreshBtn} onClick={caricaDatiContContabili} disabled={loadingConti} title="Ricarica conti dal database">
                <RefreshCw size={12} className={loadingConti ? 'animate-spin' : ''} /> {loadingConti ? 'Aggiornamento...' : 'Ricarica'}
              </button>
            </div>

            {loadingConti ? (
              <div style={st.loadingBox}>Caricamento contabilità in corso...</div>
            ) : rateRows.length === 0 ? (
              <div style={st.emptyConti}>Nessuna rata configurata nell'esercizio attivo per questa unità.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Tabella rate */}
                <div style={st.tableWrap}>
                  <table style={st.table}>
                    <thead>
                      <tr>
                        <th style={st.th}>Rata</th>
                        <th style={st.th}>Scadenza</th>
                        <th style={{ ...st.th, textAlign: 'right' }}>Dovuto</th>
                        <th style={{ ...st.th, textAlign: 'right' }}>Pagato</th>
                        <th style={{ ...st.th, textAlign: 'right' }}>Residuo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rateRows.map((r, i) => (
                        <tr key={r.id || i}>
                          <td style={st.td}>{r.nome}</td>
                          <td style={st.td}>{formattaData(r.scadenza)}</td>
                          <td style={{ ...st.td, textAlign: 'right' }}>{eur(r.importo)}</td>
                          <td style={{ ...st.td, textAlign: 'right', color: r.importo_pagato > 0 ? '#10b981' : 'var(--text-primary)' }}>{eur(r.importo_pagato)}</td>
                          <td style={{ ...st.td, textAlign: 'right', fontWeight: 600, color: (r.importo - r.importo_pagato) > 0 ? '#ef4444' : 'var(--text-primary)' }}>
                            {eur(r.importo - r.importo_pagato)}
                          </td>
                        </tr>
                      ))}
                      <tr style={st.footRow}>
                        <td colSpan={2} style={st.footTd}>TOTALI</td>
                        <td style={{ ...st.footTd, textAlign: 'right' }}>{eur(dovutoTot)}</td>
                        <td style={{ ...st.footTd, textAlign: 'right' }}>{eur(pagatoTot)}</td>
                        <td style={{ ...st.footTd, textAlign: 'right', color: residuoTot > 0 ? '#ef4444' : '#10b981' }}>{eur(residuoTot)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Allineamento banca banner */}
                <div style={st.warningBox}>
                  <AlertTriangle size={15} style={{ marginRight: 8, flexShrink: 0, color: '#f59e0b' }} />
                  <div style={{ fontSize: 11.5, lineHeight: 1.4 }}>
                    <strong>Allineamento cassa:</strong> L'ultimo estratto conto caricato per il condominio risale al <b>{ultimoMovimentoCassa ? formattaData(ultimoMovimentoCassa) : 'Nessun movimento'}</b>.
                    Eventuali bonifici posteriori non sono conteggiati.
                  </div>
                </div>

                {/* Scorciatoie di allineamento */}
                <div style={st.shortcutRow}>
                  <button 
                    style={st.shortcutBtn}
                    onClick={() => window.open('/riconciliazioni-incassi', '_blank')}
                  >
                    <RefreshCw size={12} /> Riconcilia Incassi <ExternalLink size={10} style={{ marginLeft: 4 }} />
                  </button>
                  <button 
                    style={st.shortcutBtn}
                    onClick={() => window.open(`/condomini/${unita.condominio_id}?tab=rate`, '_blank')}
                  >
                    <CreditCard size={12} /> Gestisci Rate a Mano <ExternalLink size={10} style={{ marginLeft: 4 }} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right panel: Communication Send Form */}
          <div style={st.rightPanel}>
            <h4 style={{ ...st.sectionTitle, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={15} /> Comunicazione di Benvenuto
            </h4>
            
            {!nuovoCondomino?.email ? (
              <div style={st.errorBox}>
                <AlertTriangle size={15} style={{ marginRight: 6 }} />
                <span>Il nuovo condòmino <strong>non ha un indirizzo e-mail</strong> configurato in rubrica. Inseriscilo prima di inviare.</span>
              </div>
            ) : inviataConSuccesso ? (
              <div style={st.successBox}>
                <Check size={18} style={{ marginRight: 6 }} />
                <span>E-mail inviata con successo!</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                <div style={st.formGroup}>
                  <label style={st.formLabel}>Destinatario</label>
                  <input style={st.formInput} disabled value={`${nuovoCondomino.cognome} ${nuovoCondomino.nome} <${nuovoCondomino.email}>`} />
                </div>
                
                <div style={st.formGroup}>
                  <label style={st.formLabel}>Oggetto E-mail</label>
                  <input 
                    style={st.formInput} 
                    value={emailOgg} 
                    onChange={e => setEmailOgg(e.target.value)} 
                    placeholder="Oggetto..."
                    disabled={inviandoMail}
                  />
                </div>

                <div style={{ ...st.formGroup, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={st.formLabel}>Testo Messaggio</label>
                  <textarea 
                    style={st.textarea} 
                    value={emailCorpo} 
                    onChange={e => setEmailCorpo(e.target.value)}
                    disabled={inviandoMail}
                  />
                </div>

                {/* Checkbox di sblocco obbligatoria */}
                <label style={st.checkboxLabel}>
                  <input 
                    type="checkbox" 
                    checked={confermaAllineamento} 
                    onChange={e => setConfermaAllineamento(e.target.checked)}
                    disabled={inviandoMail}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                    Dichiaro di aver verificato i pagamenti/rate dell'unità e allineato l'estratto conto.
                  </span>
                </label>

                <button 
                  style={{ 
                    ...st.btnPrimary, 
                    width: '100%', 
                    opacity: (!confermaAllineamento || inviandoMail) ? 0.6 : 1,
                    cursor: (!confermaAllineamento || inviandoMail) ? 'not-allowed' : 'pointer'
                  }} 
                  onClick={handleInviaMail}
                  disabled={!confermaAllineamento || inviandoMail}
                >
                  {inviandoMail ? 'Invio in corso...' : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Mail size={14} /> Invia Benvenuto & Situazione Rate
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={st.modalFooter}>
          <button style={st.btnSecondary} onClick={onClose} disabled={inviandoMail}>Chiudi</button>
        </div>

      </div>
    </div>
  )
}

const st = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1200, padding: 16,
  },
  modal: {
    background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16,
    padding: 20, width: '100%', maxWidth: 840, boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
    maxHeight: '92vh', display: 'flex', flexDirection: 'column', gap: 14,
    fontFamily: "'Sora', sans-serif",
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: '1px solid var(--border-color)', paddingBottom: 10,
  },
  modalTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' },
  modalSub: { margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
    padding: 6, display: 'flex', alignItems: 'center', borderRadius: '50%',
  },
  modalBody: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 0.9fr',
    gap: 20,
    overflowY: 'auto',
    flex: 1,
    paddingRight: 4,
  },
  leftPanel: {
    display: 'flex', flexDirection: 'column',
    borderRight: '1px solid var(--border-color)', paddingRight: 20,
  },
  rightPanel: {
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  sectionTitle: {
    margin: '0 0 10px', fontSize: 12.5, textTransform: 'uppercase',
    letterSpacing: '0.05em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color-2)',
    paddingBottom: 6
  },
  timelineCard: {
    background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8,
    padding: '12px 14px', marginBottom: 6
  },
  timelineRow: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'
  },
  badgeActive: {
    fontSize: 9, color: '#10b981', background: '#10b98115',
    padding: '2px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase'
  },
  badgePast: {
    fontSize: 9, color: 'var(--text-secondary)', background: '#64748b15',
    padding: '2px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase'
  },
  condominioNome: { fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' },
  dataLabel: { fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' },
  
  refreshBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent',
    border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 11, fontWeight: 600,
    padding: '2px 6px', borderRadius: 4, transition: 'background 0.2s',
  },
  
  loadingBox: { fontSize: 12, color: 'var(--text-muted)', padding: 30, textAlign: 'center' },
  emptyConti: { 
    fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 10px',
    border: '1px dashed var(--border-color)', borderRadius: 8, background: 'var(--app-bg)'
  },
  
  tableWrap: { border: '1px solid var(--border-color-2)', borderRadius: 8, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 11.5 },
  th: { background: 'var(--app-bg)', color: 'var(--text-muted)', fontWeight: 700, padding: '7px 10px', textAlign: 'left', borderBottom: '1px solid var(--border-color-2)' },
  td: { padding: '7px 10px', borderBottom: '1px solid var(--border-color-2)', color: 'var(--text-primary)' },
  footRow: { background: 'var(--app-bg)' },
  footTd: { fontWeight: 700, padding: '8px 10px', borderTop: '1px solid var(--border-color)', color: 'var(--text-primary)' },

  warningBox: {
    display: 'flex', alignItems: 'center', background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 8, padding: '8px 10px',
    color: 'var(--text-primary)', marginTop: 8
  },
  
  shortcutRow: { display: 'flex', gap: 8, marginTop: 8 },
  shortcutBtn: {
    flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 6,
    padding: '6px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
    cursor: 'pointer', transition: 'all 0.2s',
  },

  formGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  formLabel: { fontSize: 10.5, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' },
  formInput: {
    background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 6,
    padding: '6px 10px', color: 'var(--text-primary)', fontFamily: "'Sora', sans-serif",
    fontSize: 12, outline: 'none'
  },
  textarea: {
    background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 6,
    padding: '8px 10px', color: 'var(--text-primary)', fontFamily: "'Sora', sans-serif",
    fontSize: 12, outline: 'none', resize: 'none', flex: 1, minHeight: 120, lineHeight: 1.4
  },
  checkboxLabel: {
    display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', padding: '4px 0'
  },
  
  errorBox: {
    background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)',
    borderRadius: 8, padding: '12px 14px', color: '#f87171', fontSize: 12, display: 'flex', alignItems: 'center', lineHeight: 1.4
  },
  successBox: {
    background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)',
    borderRadius: 8, padding: '16px', color: '#34d399', fontSize: 13, display: 'flex', alignItems: 'center',
    fontWeight: 600, justifyContent: 'center', flex: 1
  },

  btnPrimary: {
    background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 16px', fontFamily: "'Sora', sans-serif",
    fontWeight: 700, fontSize: 13, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.2s'
  },
  btnSecondary: {
    background: 'none', color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)', borderRadius: 8,
    padding: '8px 16px', fontFamily: "'Sora', sans-serif",
    fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  modalFooter: {
    display: 'flex', justifyContent: 'flex-end',
    borderTop: '1px solid var(--border-color)', paddingTop: 10,
  }
}
