import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'react-hot-toast'
import { Mail, Upload, Download, Send, Check, AlertTriangle, Building2, Eye, RefreshCw } from 'lucide-react'
import { estraiDatiAnagrafeDaModulo } from '../lib/fileExtractor'
import { exportRegistroAnagrafePdf } from '../lib/exportPdf'
import { useComunicazioni } from '../hooks/useComunicazioni'
import { usePlan } from '../hooks/usePlan'

export default function RegistroAnagrafeTab({ condominio }) {
  const condominioId = condominio?.id
  const { isCollaboratore } = usePlan()
  const { inviaComunicazione, loading: inviandoMail } = useComunicazioni()
  
  const [unitaList, setUnitaList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Stati per la modale di validazione AI
  const [selectedUnitaForOcr, setSelectedUnitaForOcr] = useState(null)
  const [ocrData, setOcrData] = useState(null)
  const [analysing, setAnalysing] = useState(false)
  const fileInputRefs = useRef({})

  // Stati per invio email massivo
  const [showSendModal, setShowSendModal] = useState(false)
  const [selectedDestinatari, setSelectedDestinatari] = useState([])

  const fetchDatiAnagrafe = useCallback(async () => {
    if (!condominioId) return
    setLoading(true)
    setError(null)
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
              residenza_indirizzo,
              residenza_comune,
              residenza_cap,
              residenza_provincia
            )
          )
        `)
        .eq('condominio_id', condominioId)
        .order('numero', { ascending: true })

      if (error) throw error
      setUnitaList(data || [])
    } catch (err) {
      console.error(err)
      setError('Errore nel caricamento del registro anagrafe.')
    } finally {
      setLoading(false)
    }
  }, [condominioId])

  useEffect(() => {
    fetchDatiAnagrafe()
  }, [fetchDatiAnagrafe])

  // Identifica se un'unità ha dati mancanti
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
      if (!p.residenza_indirizzo || !p.residenza_comune) motivi.push(`Residenza incompleta per ${p.nome || ''} ${p.cognome || ''}`)
    })

    return {
      completa: motivi.length === 0,
      motivi
    }
  }

  // Prepara l'invio delle email
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

  // Invio effettivo delle email tramite l'edge function
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
      toast.error('Errore durante l\'invio delle richieste.')
    }
  }

  // Gestione caricamento e analisi file con Gemini OCR
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
      e.target.value = '' // reset input
    }
  }

  // Salvataggio dei dati approvati sul Database (spese/anagrafica)
  const handleApprovaOcr = async () => {
    if (!selectedUnitaForOcr || !ocrData) return
    setLoading(true)
    try {
      // 1. Aggiorna i dati catastali dell'unità
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

      // 2. Aggiorna l'anagrafica della persona collegata
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
            residenza_indirizzo: ocrData.persona.residenza_indirizzo || personaCorrente.residenza_indirizzo,
            residenza_comune: ocrData.persona.residenza_comune || personaCorrente.residenza_comune,
            residenza_cap: ocrData.persona.residenza_cap || personaCorrente.residenza_cap,
            residenza_provincia: ocrData.persona.residenza_provincia || personaCorrente.residenza_provincia
          })
          .eq('id', personaCorrente.id)

        if (persErr) throw persErr
      }

      toast.success('Anagrafica e dati catastali aggiornati con successo!')
      setSelectedUnitaForOcr(null)
      setOcrData(null)
      await fetchDatiAnagrafe()
    } catch (e) {
      console.error(e)
      toast.error('Errore durante l\'aggiornamento del DB.')
    } finally {
      setLoading(false)
    }
  }

  // Esporta il PDF del registro
  const handleEsportaPdf = () => {
    if (unitaList.length === 0) {
      toast.error('Nessun dato da esportare.')
      return
    }
    exportRegistroAnagrafePdf(condominio, unitaList)
  }

  return (
    <div>
      {/* Top Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={fetchDatiAnagrafe} style={styles.btnSec} disabled={loading}>
            <RefreshCw size={14} style={{ marginRight: 6 }} /> Aggiorna
          </button>
          {!isCollaboratore && (
            <button onClick={apriInvioRichieste} style={styles.btnSec} disabled={loading}>
              <Mail size={14} style={{ marginRight: 6 }} /> Sollecita mancanti
            </button>
          )}
        </div>
        
        <button onClick={handleEsportaPdf} style={styles.btnPri} disabled={loading || unitaList.length === 0}>
          <Download size={14} style={{ marginRight: 6 }} /> Esporta Registro (PDF)
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {/* Main Grid */}
      <div style={styles.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Unità</th>
                <th style={styles.th}>Scala/Piano</th>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Stato Catasto</th>
                <th style={styles.th}>Dati Catastali (F/P/S)</th>
                <th style={styles.th}>Soggetti (Ruolo)</th>
                <th style={styles.th}>Residenza</th>
                <th style={styles.th}>Stato Anagrafe</th>
                {!isCollaboratore && <th style={styles.th} style={{ textAlign: 'right' }}>Azioni</th>}
              </tr>
            </thead>
            <tbody>
              {loading && unitaList.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ ...styles.td, textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
                    Caricamento dati registro anagrafe...
                  </td>
                </tr>
              ) : unitaList.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ ...styles.td, textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Nessuna unità immobiliare censita in questo condominio.
                  </td>
                </tr>
              ) : (
                unitaList.map(u => {
                  const { completa, motivi } = checkCompletezzaUnita(u)
                  const catastaliMancanti = !u.catasto_foglio || !u.catasto_particella || !u.catasto_subalterno
                  const occupanti = Array.isArray(u.occupanti_unita) ? u.occupanti_unita.filter(o => o.attivo) : []

                  return (
                    <tr key={u.id} style={styles.tr}>
                      <td style={{ ...styles.td, fontWeight: 700 }}>{u.numero}</td>
                      <td style={styles.td}>{u.scala || '-'}{u.piano != null ? ` / P.${u.piano}` : ''}</td>
                      <td style={styles.td} style={{ textTransform: 'capitalize' }}>{u.tipo || 'Appartamento'}</td>
                      
                      {/* Stato Catasto */}
                      <td style={styles.td}>
                        {catastaliMancanti ? (
                          <span style={styles.badgeWarn}>Catasto Incompleto</span>
                        ) : (
                          <span style={styles.badgeOk}>OK</span>
                        )}
                      </td>

                      {/* Dati Catastali */}
                      <td style={styles.td} style={{ fontFamily: 'monospace', fontSize: 13 }}>
                        {catastaliMancanti 
                          ? '-' 
                          : `F.${u.catasto_foglio} P.${u.catasto_particella} S.${u.catasto_subalterno}`}
                      </td>

                      {/* Occupanti */}
                      <td style={styles.td}>
                        {occupanti.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Non registrato</span>
                        ) : (
                          occupanti.map(occ => (
                            <div key={occ.id} style={{ marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {occ.persona?.cognome} {occ.persona?.nome}
                              </span>
                              <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'var(--border-color)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                                {occ.ruolo}
                              </span>
                            </div>
                          ))
                        )}
                      </td>

                      {/* Residenza */}
                      <td style={styles.td}>
                        {occupanti.map(occ => {
                          const p = occ.persona || {}
                          if (!p.residenza_indirizzo) return <span key={occ.id} style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Non specificato</span>
                          return (
                            <div key={occ.id} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                              {p.residenza_indirizzo}, {p.residenza_comune} ({p.residenza_provincia || ''})
                            </div>
                          )
                        })}
                        {occupanti.length === 0 && '-'}
                      </td>

                      {/* Stato Anagrafe */}
                      <td style={styles.td}>
                        {completa ? (
                          <span style={styles.badgeOk}>Completo</span>
                        ) : (
                          <span style={styles.badgeWarn} title={motivi.join('\n')}>Incompleto ⚠️</span>
                        )}
                      </td>

                      {/* Azioni */}
                      {!isCollaboratore && (
                        <td style={styles.td} style={{ textAlign: 'right' }}>
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
                            style={styles.actionBtn}
                          >
                            <Upload size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALE CONFRONTO AI (OCR) */}
      {selectedUnitaForOcr && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--card-bg)', width: 680, borderRadius: 16, padding: 32, border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: 20, margin: '0 0 8px', fontFamily: 'Sora, sans-serif' }}>Modulo Autocertificazione AI Reader</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
              Gemini ha analizzato la scansione del modulo per l'unità <strong>{selectedUnitaForOcr.numero}</strong>. Verifica i dati estratti prima di confermare.
            </p>

            {analysing ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 16 }}>
                <div style={{ width: 40, height: 40, border: '4px solid var(--border-color)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Analisi del modulo in corso...</p>
              </div>
            ) : ocrData ? (
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: 24, paddingRight: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  
                  {/* Sezione Catasto */}
                  <div style={{ gridColumn: 'span 2', padding: 12, background: 'var(--app-bg)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 10px', color: 'var(--accent)', fontSize: 14 }}>Dati Catastali dell'Unità</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 13 }}>
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
                        <span style={styles.lbl}>Rendita Catastale</span>
                        <div style={styles.val}>{ocrData.unita?.catasto_rendita != null ? `€ ${ocrData.unita.catasto_rendita}` : '-'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Sezione Persona / Residenza */}
                  <div style={{ gridColumn: 'span 2', padding: 12, background: 'var(--app-bg)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 10px', color: 'var(--accent)', fontSize: 14 }}>Anagrafica e Residenza dell'Occupante ({ocrData.ruolo || 'proprietario'})</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                      <div>
                        <span style={styles.lbl}>Cognome e Nome</span>
                        <div style={styles.val}>
                          {ocrData.persona?.cognome || '-'} {ocrData.persona?.nome || ''}
                        </div>
                      </div>
                      <div>
                        <span style={styles.lbl}>Codice Fiscale</span>
                        <div style={styles.val} style={{ fontFamily: 'monospace', fontWeight: 600 }}>{ocrData.persona?.codice_fiscale || '-'}</div>
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
                        <span style={styles.lbl}>Indirizzo di Residenza</span>
                        <div style={styles.val}>
                          {ocrData.persona?.residenza_indirizzo || '-'}, {ocrData.persona?.residenza_comune || ''} {ocrData.persona?.residenza_cap || ''} ({ocrData.persona?.residenza_provincia || ''})
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <p style={{ color: '#f87171', textAlign: 'center', padding: '20px 0' }}>Nessun dato estratto.</p>
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

      {/* MODALE INVIO EMAIL MASSIVO */}
      {showSendModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--card-bg)', width: 500, borderRadius: 16, padding: 32, border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: 20, margin: '0 0 8px', fontFamily: 'Sora, sans-serif' }}>Sollecita Dati Mancanti</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
              Verrà inviata un'e-mail di sollecito con allegata la richiesta di autocertificazione ai seguenti condòmini con dati incompleti:
            </p>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 8 }}>
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
              <button 
                onClick={() => setShowSendModal(false)}
                style={{ flex: 1, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: 12, borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                Annulla
              </button>
              <button 
                onClick={handleInviaRichieste}
                disabled={inviandoMail}
                style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', padding: 12, borderRadius: 8, cursor: inviandoMail ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                {inviandoMail ? 'Invio in corso...' : `Invia a ${selectedDestinatari.length} condòmini`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stili custom locali ────────────────────────────────────────────────────
const styles = {
  card: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24, marginTop: 12 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' },
  tr: { borderBottom: '1px solid var(--border-color-2)' },
  td: { padding: '16px', fontSize: 14, color: 'var(--text-primary)' },
  badgeWarn: { background: '#450a0a', color: '#f87171', border: '1px solid #991b1b', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, display: 'inline-block' },
  badgeOk: { background: '#064e3b', color: '#34d399', border: '1px solid #065f46', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, display: 'inline-block' },
  btnPri: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center' },
  btnSec: { background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center' },
  actionBtn: { background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'inline-flex', alignItems: 'center', transition: 'background 0.2s' },
  errorBox: { background: '#450a0a', border: '1px solid #991b1b', color: '#fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14 },
  lbl: { display: 'block', color: 'var(--text-muted)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' },
  val: { color: 'var(--text-primary)', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '8px 10px', minHeight: 18 }
}
