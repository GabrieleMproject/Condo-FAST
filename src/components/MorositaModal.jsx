// src/components/MorositaModal.jsx
import { useState, useEffect, useMemo } from 'react'
import {
  X, Send, Download, Eye, FileText, CheckCircle2,
  AlertTriangle, ShieldAlert, Scale, Sparkles,
  Mail, Printer, Building2, User, CreditCard, ChevronRight, Loader2, Edit3
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useComunicazioni } from '../hooks/useComunicazioni'
import { formattaValuta, formattaData } from '../lib/formatters'
import {
  generaLetteraSollecito,
  calcolaInteresseRata,
  calcolaGiorniRitardo
} from '../lib/morositaEngine'
import {
  exportLetteraSollecitoPdfBytes,
  exportLetteraSollecitoPdf
} from '../lib/exportPdf'

export default function MorositaModal({
  morositaUnita,
  condominio,
  esercizio,
  configMorosita,
  studioProfile,
  onClose,
  onSuccess
}) {
  const { inviaComunicazione } = useComunicazioni()

  const [livello, setLivello] = useState(morositaUnita?.livelloSuggerito || 1)
  const [canale, setCanale] = useState('email')
  const [tassoOverride, setTassoOverride] = useState(morositaUnita?.tassoApplicato ?? 2.50)
  const [speseOverride, setSpeseOverride] = useState(
    morositaUnita?.livelloSuggerito === 3 ? (configMorosita?.livello3?.speseAmministrative ?? 35) :
    (morositaUnita?.livelloSuggerito === 2 ? (configMorosita?.livello2?.speseAmministrative ?? 15) : (configMorosita?.livello1?.speseAmministrative ?? 0))
  )
  const [giorniTermine, setGiorniTermine] = useState(
    morositaUnita?.livelloSuggerito === 3 ? (configMorosita?.livello3?.giorniTerminePagamento ?? 7) : 10
  )
  const [ibanUsato, setIbanUsato] = useState(condominio?.iban || '')
  
  const [activeSubTab, setActiveSubTab] = useState('anteprima') // 'anteprima' | 'rate' | 'modifica'
  const [inviando, setInviando] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const [emailDestinatario, setEmailDestinatario] = useState(
    morositaUnita?.debitore?.email || ''
  )
  const [pecDestinatario, setPecDestinatario] = useState(
    morositaUnita?.debitore?.pec || ''
  )

  // Quando cambia il livello, aggiorna automaticamente le spese e il termine consigliati
  const handleCambiaLivello = (nuovoLivello) => {
    setLivello(nuovoLivello)
    if (nuovoLivello === 1) {
      setSpeseOverride(parseFloat(configMorosita?.livello1?.speseAmministrative || 0))
      setGiorniTermine(parseInt(configMorosita?.livello1?.giorniTerminePagamento || 10, 10))
    } else if (nuovoLivello === 2) {
      setSpeseOverride(parseFloat(configMorosita?.livello2?.speseAmministrative || 15))
      setGiorniTermine(parseInt(configMorosita?.livello2?.giorniTerminePagamento || 10, 10))
    } else if (nuovoLivello === 3) {
      setSpeseOverride(parseFloat(configMorosita?.livello3?.speseAmministrative || 35))
      setGiorniTermine(parseInt(configMorosita?.livello3?.giorniTerminePagamento || 7, 10))
    }
  }

  // Ricalcolo dinamico rate con tasso e spese correnti
  const rateCalcolate = useMemo(() => {
    const rateList = morositaUnita?.rateDettaglio || []
    return rateList.map(r => {
      const gg = r.giorniRitardo || 0
      const cap = r.capitaleInsoluto || 0
      const int = r.isScaduta ? calcolaInteresseRata(cap, tassoOverride, gg) : 0
      return {
        ...r,
        interesseMaturato: int,
        totaleRataConInteressi: Math.round((cap + int + Number.EPSILON) * 100) / 100
      }
    })
  }, [morositaUnita, tassoOverride])

  const totaleCapitale = useMemo(() => {
    return rateCalcolate.reduce((s, r) => s + (r.isScaduta ? r.capitaleInsoluto : 0), 0)
  }, [rateCalcolate])

  const totaleInteressi = useMemo(() => {
    return rateCalcolate.reduce((s, r) => s + (r.isScaduta ? r.interesseMaturato : 0), 0)
  }, [rateCalcolate])

  const totaleComplessivo = useMemo(() => {
    return Math.round((totaleCapitale + totaleInteressi + parseFloat(speseOverride || 0) + Number.EPSILON) * 100) / 100
  }, [totaleCapitale, totaleInteressi, speseOverride])

  // Generazione del testo ed oggetto in base al livello selezionato
  const letteraGenerata = useMemo(() => {
    const morositaRicalcolata = {
      ...morositaUnita,
      rateScaduteList: rateCalcolate.filter(r => r.isScaduta),
      totaleCapitaleInsoluto: totaleCapitale,
      totaleInteressiMaturati: totaleInteressi,
      speseApplicate: parseFloat(speseOverride || 0),
      tassoApplicato: tassoOverride,
      giorniTermine
    }

    return generaLetteraSollecito({
      livello,
      morositaUnita: morositaRicalcolata,
      condominio: { ...condominio, iban: ibanUsato },
      esercizio,
      studioProfile,
      opzioniOverride: {
        tassoPercentuale: tassoOverride,
        speseApplicate: parseFloat(speseOverride || 0),
        giorniTermine,
        iban: ibanUsato
      }
    })
  }, [livello, morositaUnita, rateCalcolate, totaleCapitale, totaleInteressi, speseOverride, tassoOverride, giorniTermine, ibanUsato, condominio, esercizio, studioProfile])

  const [testoPersonalizzato, setTestoPersonalizzato] = useState('')
  const [oggettoPersonalizzato, setOggettoPersonalizzato] = useState('')

  useEffect(() => {
    setTestoPersonalizzato(letteraGenerata.testoHtml)
    setOggettoPersonalizzato(letteraGenerata.oggetto)
  }, [letteraGenerata])

  // Download PDF immediato
  const handleScaricaPdf = () => {
    setDownloadingPdf(true)
    try {
      const morositaRicalcolata = {
        ...morositaUnita,
        rateScaduteList: rateCalcolate.filter(r => r.isScaduta),
        totaleCapitaleInsoluto: totaleCapitale,
        totaleInteressiMaturati: totaleInteressi,
        speseApplicate: parseFloat(speseOverride || 0),
        tassoApplicato: tassoOverride,
        giorniTermine
      }

      exportLetteraSollecitoPdf({
        condominio: { ...condominio, iban: ibanUsato },
        esercizio,
        unita: morositaUnita.unita,
        destinatario: morositaUnita.debitore,
        morositaUnita: morositaRicalcolata,
        livello,
        studioProfile,
        opzioniOverride: {
          tassoPercentuale: tassoOverride,
          speseApplicate: parseFloat(speseOverride || 0),
          giorniTermine,
          iban: ibanUsato
        }
      })
      toast.success('Lettera PDF scaricata con successo!')
    } catch (err) {
      console.error('Errore download PDF sollecito:', err)
      toast.error('Errore durante la generazione del PDF: ' + err.message)
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Invio 1-Click
  const handleInvia1Click = async () => {
    const destEmail = canale === 'pec' ? pecDestinatario : emailDestinatario
    const destNome = `${morositaUnita?.debitore?.nome || ''} ${morositaUnita?.debitore?.cognome || ''}`.trim() || 'Condòmino'

    if (canale !== 'cartaceo' && !destEmail) {
      toast.error(`Indirizzo ${canale === 'pec' ? 'PEC' : 'Email'} del destinatario mancante o non configurato.`)
      return
    }

    setInviando(true)
    try {
      const morositaRicalcolata = {
        ...morositaUnita,
        rateScaduteList: rateCalcolate.filter(r => r.isScaduta),
        totaleCapitaleInsoluto: totaleCapitale,
        totaleInteressiMaturati: totaleInteressi,
        speseApplicate: parseFloat(speseOverride || 0),
        tassoApplicato: tassoOverride,
        giorniTermine
      }

      // 1. Genera allegato PDF in base64
      const pdfBase64 = await exportLetteraSollecitoPdfBytes({
        condominio: { ...condominio, iban: ibanUsato },
        esercizio,
        unita: morositaUnita.unita,
        destinatario: morositaUnita.debitore,
        morositaUnita: morositaRicalcolata,
        livello,
        studioProfile,
        opzioniOverride: {
          tassoPercentuale: tassoOverride,
          speseApplicate: parseFloat(speseOverride || 0),
          giorniTermine,
          iban: ibanUsato
        }
      })

      const prefissoNomeFile = livello === 3 ? 'Diffida_Legale' : (livello === 2 ? '2_Sollecito' : 'Sollecito_Bonario')
      const nomeAllegato = `${prefissoNomeFile}_Unita_${morositaUnita.unita.numero}.pdf`

      // 2. Invio comunicazione tramite Edge Function
      const tipoInvio = livello === 3 ? 'diffida' : 'sollecito'
      
      await inviaComunicazione({
        condominioId: condominio.id,
        destinatari: [{
          email: destEmail || 'cartaceo@condofast.local',
          nome: destNome,
          indirizzo: morositaUnita.debitore?.residenza_indirizzo || morositaUnita.debitore?.indirizzo || '',
          citta: morositaUnita.debitore?.residenza_comune || morositaUnita.debitore?.citta || '',
          cap: morositaUnita.debitore?.residenza_cap || morositaUnita.debitore?.cap || '',
          provincia: morositaUnita.debitore?.residenza_provincia || morositaUnita.debitore?.provincia || ''
        }],
        oggetto: oggettoPersonalizzato,
        messaggio: testoPersonalizzato,
        tipo: canale === 'cartaceo' ? 'sollecito_cartaceo' : tipoInvio,
        allegati: [{
          filename: nomeAllegato,
          content: pdfBase64,
          type: 'application/pdf'
        }]
      })

      toast.success(
        canale === 'cartaceo'
          ? 'Pratica registrata per la spedizione cartacea / archivio!'
          : `Sollecito inviato con successo a ${destEmail} con PDF allegato!`
      )

      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      console.error('Errore invio sollecito 1-click:', err)
      toast.error("Errore durante l'invio: " + err.message)
    } finally {
      setInviando(false)
    }
  }

  const u = morositaUnita.unita
  const debitore = morositaUnita.debitore

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        
        {/* HEADER MODALE */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: livello === 3 ? 'rgba(239, 68, 68, 0.15)' : (livello === 2 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(37, 99, 235, 0.15)'),
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {livello === 3 ? (
                <ShieldAlert size={24} color="#ef4444" />
              ) : livello === 2 ? (
                <Scale size={24} color="#f59e0b" />
              ) : (
                <FileText size={24} color="#3b82f6" />
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={styles.title}>
                  Recupero Crediti — Unità {u.numero} {u.scala ? `(Scala ${u.scala})` : ''}
                </h2>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: morositaUnita.isOltreSeiMesi ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.15)',
                  color: morositaUnita.isOltreSeiMesi ? '#ef4444' : '#3b82f6'
                }}>
                  {morositaUnita.maxGiorniRitardo} gg di ritardo max
                </span>
              </div>
              <p style={styles.subtitle}>
                {debitore ? `${debitore.cognome} ${debitore.nome}` : 'Soggetto non assegnato'} · {morositaUnita.paganteTipo === 'inquilino' ? 'Inquilino Pagante' : 'Proprietario'} · {condominio?.nome}
              </p>
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        {/* BODY MODALE A 2 COLONNE */}
        <div style={styles.body}>

          {/* COLONNA SINISTRA: SELETTORE LIVELLO & PARAMETRI */}
          <div style={styles.leftColumn}>
            
            {/* SELETTORE DEI 3 LIVELLI */}
            <div style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>1. Livello di Sollecito / Atto Legale</span>
              </div>
              <div style={styles.levelSelector}>
                
                {/* LIVELLO 1 */}
                <button
                  type="button"
                  onClick={() => handleCambiaLivello(1)}
                  style={{
                    ...styles.levelBtn,
                    border: livello === 1 ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                    background: livello === 1 ? 'rgba(59, 130, 246, 0.1)' : 'var(--app-bg)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: livello === 1 ? '#3b82f6' : 'var(--text-primary)' }}>
                      1° Sollecito Bonario
                    </span>
                    <span style={{ fontSize: 10, background: '#10b98122', color: '#10b981', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                      0 € Spese
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Promemoria cordiale delle rate scadute per favorire l'incasso amichevole.
                  </div>
                </button>

                {/* LIVELLO 2 */}
                <button
                  type="button"
                  onClick={() => handleCambiaLivello(2)}
                  style={{
                    ...styles.levelBtn,
                    border: livello === 2 ? '2px solid #f59e0b' : '1px solid var(--border-color)',
                    background: livello === 2 ? 'rgba(245, 158, 11, 0.1)' : 'var(--app-bg)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: livello === 2 ? '#f59e0b' : 'var(--text-primary)' }}>
                      2° Sollecito con Messa in Mora
                    </span>
                    <span style={{ fontSize: 10, background: '#f59e0b22', color: '#f59e0b', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                      +{formattaValuta(configMorosita?.livello2?.speseAmministrative ?? 15)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Costituzione in mora formale ex art. 1219 c.c., addebito spese e termine perentorio.
                  </div>
                </button>

                {/* LIVELLO 3 */}
                <button
                  type="button"
                  onClick={() => handleCambiaLivello(3)}
                  style={{
                    ...styles.levelBtn,
                    border: livello === 3 ? '2px solid #ef4444' : '1px solid var(--border-color)',
                    background: livello === 3 ? 'rgba(239, 68, 68, 0.1)' : 'var(--app-bg)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: livello === 3 ? '#ef4444' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ShieldAlert size={14} /> Diffida Legale (Art. 63 c.c.)
                    </span>
                    <span style={{ fontSize: 10, background: '#ef444422', color: '#ef4444', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                      +{formattaValuta(configMorosita?.livello3?.speseAmministrative ?? 35)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Intimazione formale con preavviso di Decreto Ingiuntivo e sospensione servizi comuni.
                  </div>
                </button>

              </div>
            </div>

            {/* PARAMETRI DI CALCOLO INTERESSI E SPESE */}
            <div style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>2. Parametri Economici & Scadenza</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={styles.label}>Tasso Interessi (% a.a.)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="30"
                    value={tassoOverride}
                    onChange={e => setTassoOverride(parseFloat(e.target.value) || 0)}
                    style={styles.input}
                  />
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                    Art. 1284 c.c. / Mora 231
                  </div>
                </div>

                <div>
                  <label style={styles.label}>Spese Gestione Pratica (€)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={speseOverride}
                    onChange={e => setSpeseOverride(parseFloat(e.target.value) || 0)}
                    style={styles.input}
                  />
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                    Addebito ex art. 1129 c.c.
                  </div>
                </div>

                <div>
                  <label style={styles.label}>Termine Saldo (Giorni)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={giorniTermine}
                    onChange={e => setGiorniTermine(parseInt(e.target.value, 10) || 7)}
                    style={styles.input}
                  />
                </div>

                <div>
                  <label style={styles.label}>IBAN per il Bonifico</label>
                  <input
                    type="text"
                    value={ibanUsato}
                    onChange={e => setIbanUsato(e.target.value)}
                    placeholder="IT00..."
                    style={styles.input}
                  />
                </div>
              </div>
            </div>

            {/* CANALE DI TRASMISSIONE */}
            <div style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>3. Canale di Invio 1-Click</span>
              </div>
              
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => setCanale('email')}
                  style={{
                    ...styles.canaleBtn,
                    borderColor: canale === 'email' ? '#3b82f6' : 'var(--border-color)',
                    background: canale === 'email' ? 'rgba(59, 130, 246, 0.12)' : 'var(--app-bg)',
                    color: canale === 'email' ? '#3b82f6' : 'var(--text-secondary)'
                  }}
                >
                  <Mail size={16} /> Email Ordinaria
                </button>

                <button
                  type="button"
                  onClick={() => setCanale('pec')}
                  style={{
                    ...styles.canaleBtn,
                    borderColor: canale === 'pec' ? '#8b5cf6' : 'var(--border-color)',
                    background: canale === 'pec' ? 'rgba(139, 92, 246, 0.12)' : 'var(--app-bg)',
                    color: canale === 'pec' ? '#8b5cf6' : 'var(--text-secondary)'
                  }}
                >
                  <ShieldAlert size={16} /> PEC Certificata
                </button>

                <button
                  type="button"
                  onClick={() => setCanale('cartaceo')}
                  style={{
                    ...styles.canaleBtn,
                    borderColor: canale === 'cartaceo' ? '#10b981' : 'var(--border-color)',
                    background: canale === 'cartaceo' ? 'rgba(16, 185, 129, 0.12)' : 'var(--app-bg)',
                    color: canale === 'cartaceo' ? '#10b981' : 'var(--text-secondary)'
                  }}
                >
                  <Printer size={16} /> Stampa / Postale
                </button>
              </div>

              {canale === 'email' && (
                <div>
                  <label style={styles.label}>Indirizzo Email Destinatario</label>
                  <input
                    type="email"
                    value={emailDestinatario}
                    onChange={e => setEmailDestinatario(e.target.value)}
                    placeholder="email@condomino.it"
                    style={styles.input}
                  />
                  {!emailDestinatario && (
                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                      ⚠️ Email non presente in anagrafica: inseriscila per inviare via mail.
                    </div>
                  )}
                </div>
              )}

              {canale === 'pec' && (
                <div>
                  <label style={styles.label}>Indirizzo PEC Destinatario</label>
                  <input
                    type="email"
                    value={pecDestinatario}
                    onChange={e => setPecDestinatario(e.target.value)}
                    placeholder="condomino@pec.it"
                    style={styles.input}
                  />
                  {!pecDestinatario && (
                    <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
                      ℹ️ PEC non censita: inserisci la casella PEC del destinatario.
                    </div>
                  )}
                </div>
              )}

              {canale === 'cartaceo' && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Verrà registrato il sollecito nel registro comunicazioni e potrai scaricare o stampare il PDF formale con bollettino/IBAN per l'invio via Raccomandata A/R.
                </div>
              )}
            </div>

            {/* BOX QUADRATURA TOTALE */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.08) 0%, rgba(30, 41, 59, 0.04) 100%)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Quote Capitale Insolute:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formattaValuta(totaleCapitale)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Interessi Maturati ({tassoOverride}%):</span>
                <span style={{ fontWeight: 600, color: '#3b82f6' }}>+{formattaValuta(totaleInteressi)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Spese di Gestione / Sollecito:</span>
                <span style={{ fontWeight: 600, color: '#f59e0b' }}>+{formattaValuta(speseOverride)}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>TOTALE RICHIESTO:</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: livello === 3 ? '#ef4444' : (livello === 2 ? '#f59e0b' : '#3b82f6') }}>
                  {formattaValuta(totaleComplessivo)}
                </span>
              </div>
            </div>

          </div>

          {/* COLONNA DESTRA: ANTEPRIMA TESTO / DETTAGLIO RATE */}
          <div style={styles.rightColumn}>
            
            {/* SUB-TABS */}
            <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border-color)', paddingBottom: 8, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setActiveSubTab('anteprima')}
                style={{
                  ...styles.subTabBtn,
                  background: activeSubTab === 'anteprima' ? 'var(--accent)' : 'transparent',
                  color: activeSubTab === 'anteprima' ? '#fff' : 'var(--text-secondary)',
                }}
              >
                <Eye size={14} /> Anteprima Lettera
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('rate')}
                style={{
                  ...styles.subTabBtn,
                  background: activeSubTab === 'rate' ? 'var(--accent)' : 'transparent',
                  color: activeSubTab === 'rate' ? '#fff' : 'var(--text-secondary)',
                }}
              >
                <CreditCard size={14} /> Prospetto Rate ({rateCalcolate.filter(r => r.isScaduta).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('modifica')}
                style={{
                  ...styles.subTabBtn,
                  background: activeSubTab === 'modifica' ? 'var(--accent)' : 'transparent',
                  color: activeSubTab === 'modifica' ? '#fff' : 'var(--text-secondary)',
                }}
              >
                <Edit3 size={14} /> Modifica Testo
              </button>
            </div>

            {/* TAB 1: ANTEPRIMA RENDERIZZATA */}
            {activeSubTab === 'anteprima' && (
              <div style={styles.previewContainer}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, borderBottom: '1px solid var(--border-color)', paddingBottom: 6 }}>
                  {oggettoPersonalizzato}
                </div>
                <div
                  style={styles.renderedHtml}
                  dangerouslySetInnerHTML={{ __html: testoPersonalizzato }}
                />
              </div>
            )}

            {/* TAB 2: DETTAGLIO RATE */}
            {activeSubTab === 'rate' && (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Rata / Descrizione</th>
                      <th style={styles.thCenter}>Scadenza</th>
                      <th style={styles.thRight}>Quota Capitale</th>
                      <th style={styles.thCenter}>Ritardo</th>
                      <th style={styles.thRight}>Interessi</th>
                      <th style={styles.thRight}>Totale Rata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rateCalcolate.map(r => (
                      <tr key={r.cellId || r.rataId} style={{ opacity: r.isScaduta ? 1 : 0.45 }}>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.descrizione}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {r.stato === 'pagata' ? 'Saldata' : (r.isScaduta ? 'Insoluta Scaduta' : 'In Scadenza Futura')}
                          </div>
                        </td>
                        <td style={styles.tdCenter}>{formattaData(r.dataScadenza)}</td>
                        <td style={styles.tdRight}>
                          <span style={{ fontWeight: 700, color: r.isScaduta ? '#ef4444' : 'var(--text-primary)' }}>
                            {formattaValuta(r.capitaleInsoluto)}
                          </span>
                        </td>
                        <td style={styles.tdCenter}>
                          {r.giorniRitardo > 0 ? (
                            <span style={{ color: '#ef4444', fontWeight: 600 }}>{r.giorniRitardo} gg</span>
                          ) : '—'}
                        </td>
                        <td style={styles.tdRight}>
                          <span style={{ color: '#3b82f6', fontWeight: 600 }}>
                            {formattaValuta(r.interesseMaturato)}
                          </span>
                        </td>
                        <td style={styles.tdRight}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {formattaValuta(r.totaleRataConInteressi)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 3: MODIFICA TESTO */}
            {activeSubTab === 'modifica' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
                <div>
                  <label style={styles.label}>Oggetto Email / Lettera</label>
                  <input
                    type="text"
                    value={oggettoPersonalizzato}
                    onChange={e => setOggettoPersonalizzato(e.target.value)}
                    style={styles.input}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={styles.label}>Corpo del Messaggio (HTML / Testo)</label>
                  <textarea
                    value={testoPersonalizzato}
                    onChange={e => setTestoPersonalizzato(e.target.value)}
                    style={{ ...styles.input, minHeight: 280, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                  />
                </div>
              </div>
            )}

          </div>

        </div>

        {/* FOOTER ACTIONS */}
        <div style={styles.footer}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={handleScaricaPdf}
              disabled={downloadingPdf}
              style={styles.secondaryBtn}
            >
              {downloadingPdf ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
              Scarica Lettera PDF
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={styles.cancelBtn}
            >
              Annulla
            </button>

            <button
              type="button"
              onClick={handleInvia1Click}
              disabled={inviando}
              style={{
                ...styles.primaryBtn,
                background: livello === 3 ? '#dc2626' : (livello === 2 ? '#d97706' : '#2563eb')
              }}
            >
              {inviando ? (
                <>
                  <Loader2 size={18} className="spin" style={{ marginRight: 6 }} /> Invio in corso...
                </>
              ) : (
                <>
                  <Send size={18} style={{ marginRight: 6 }} />
                  {canale === 'cartaceo' ? 'Registra & Salva Pratica' : `Invia ${livello === 3 ? 'Diffida' : 'Sollecito'} in 1-Click`}
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 20,
    fontFamily: 'Sora, sans-serif'
  },
  modal: {
    backgroundColor: 'var(--card-bg)',
    borderRadius: 16,
    width: '100%',
    maxWidth: 1040,
    maxHeight: '92vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
    border: '1px solid var(--border-color)',
    overflow: 'hidden'
  },
  header: {
    padding: '18px 24px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--app-bg)'
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text-primary)'
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: 12,
    color: 'var(--text-muted)'
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  body: {
    padding: '20px 24px',
    overflowY: 'auto',
    display: 'grid',
    gridTemplateColumns: '420px 1fr',
    gap: 20,
    flex: 1
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 16,
    minHeight: 460
  },
  sectionCard: {
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: 14
  },
  sectionHeader: {
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--text-muted)'
  },
  levelSelector: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  levelBtn: {
    padding: '10px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'Sora, sans-serif',
    transition: 'all 0.15s ease'
  },
  canaleBtn: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'Sora, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'all 0.15s'
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 4
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid var(--border-color)',
    background: 'var(--card-bg)',
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: 'Sora, sans-serif',
    boxSizing: 'border-box'
  },
  subTabBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'Sora, sans-serif'
  },
  previewContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: 10,
    background: '#ffffff',
    color: '#0f172a',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: 13,
    lineHeight: 1.6
  },
  renderedHtml: {
    color: '#1e293b'
  },
  tableWrapper: {
    flex: 1,
    overflowY: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12
  },
  th: {
    padding: '8px 10px',
    borderBottom: '1px solid var(--border-color)',
    textAlign: 'left',
    color: 'var(--text-muted)',
    fontWeight: 600
  },
  thCenter: {
    padding: '8px 10px',
    borderBottom: '1px solid var(--border-color)',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontWeight: 600
  },
  thRight: {
    padding: '8px 10px',
    borderBottom: '1px solid var(--border-color)',
    textAlign: 'right',
    color: 'var(--text-muted)',
    fontWeight: 600
  },
  td: {
    padding: '10px',
    borderBottom: '1px solid var(--border-color)'
  },
  tdCenter: {
    padding: '10px',
    borderBottom: '1px solid var(--border-color)',
    textAlign: 'center'
  },
  tdRight: {
    padding: '10px',
    borderBottom: '1px solid var(--border-color)',
    textAlign: 'right'
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid var(--border-color)',
    background: 'var(--app-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12
  },
  secondaryBtn: {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    padding: '9px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'Sora, sans-serif'
  },
  cancelBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: '9px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif'
  },
  primaryBtn: {
    color: '#ffffff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    fontFamily: 'Sora, sans-serif'
  }
}
