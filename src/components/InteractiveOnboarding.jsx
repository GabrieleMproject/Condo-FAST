import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import { estraiFattura, fileToBase64, comprimiImmagine, getTipoFile } from '../lib/fileExtractor'
import { Building2, UploadCloud, Calculator, ArrowRight, Zap, CheckCircle2, ChevronRight, Loader2, Sparkles, Building, PlayCircle } from 'lucide-react'

export default function InteractiveOnboarding({ onComplete }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [flowState, setFlowState] = useState('CHOICE') // CHOICE, ONBOARDING, SUCCESS
  const [step, setStep] = useState(1) // 1, 2, 3
  const [loading, setLoading] = useState(false)

  // Dati
  const [condoName, setCondoName] = useState('')
  const [condoId, setCondoId] = useState(null)
  const [esercizioId, setEsercizioId] = useState(null)
  
  // Fattura
  const [fileFattura, setFileFattura] = useState(null)
  const [datiEstratti, setDatiEstratti] = useState(null)

  const handleChoice = (isMigrating) => {
    if (isMigrating) {
      navigate('/migrazione')
    } else {
      setFlowState('ONBOARDING')
      setStep(1)
    }
  }

  const creaCondominioBase = async (e) => {
    e.preventDefault()
    if (!condoName.trim()) return toast.error('Inserisci un nome per il condominio')
    
    setLoading(true)
    try {
      // 1. Crea Condominio
      const { data: condo, error: condoErr } = await supabase
        .from('condomini')
        .insert([{
          nome: condoName,
          indirizzo: 'Via di Prova 1',
          citta: 'Roma',
          amministratore_id: user.id
        }])
        .select()
        .single()
      if (condoErr) throw condoErr
      const newCondoId = condo.id
      setCondoId(newCondoId)

      // 2. Crea Tabella Millesimale e Unità base in background
      const { data: tabMill } = await supabase
        .from('tabelle_millesimali')
        .insert([{ condominio_id: newCondoId, nome: 'Proprietà Generale' }])
        .select().single()

      const unitaPayload = [
        { condominio_id: newCondoId, numero: '1', scala: 'A', piano: 1, mq: 80, tipo: 'appartamento' },
        { condominio_id: newCondoId, numero: '2', scala: 'A', piano: 1, mq: 90, tipo: 'appartamento' },
        { condominio_id: newCondoId, numero: '3', scala: 'B', piano: 2, mq: 100, tipo: 'appartamento' }
      ]
      const { data: unitaList } = await supabase.from('unita').insert(unitaPayload).select()

      if (tabMill && unitaList?.length === 3) {
        await supabase.from('millesimi_unita').insert([
          { tabella_id: tabMill.id, unita_id: unitaList[0].id, valore: 300 },
          { tabella_id: tabMill.id, unita_id: unitaList[1].id, valore: 350 },
          { tabella_id: tabMill.id, unita_id: unitaList[2].id, valore: 350 }
        ])
        
        // Crea Persone di prova
        const personePayload = [
          { nome: 'Mario', cognome: 'Rossi', email: 'mario@example.com', user_id: user.id },
          { nome: 'Luigi', cognome: 'Verdi', email: 'luigi@example.com', user_id: user.id },
          { nome: 'Giulia', cognome: 'Bianchi', email: 'giulia@example.com', user_id: user.id }
        ]
        const { data: personeList } = await supabase.from('persone').insert(personePayload).select()
        
        if (personeList?.length === 3) {
          await supabase.from('occupanti_unita').insert([
            { unita_id: unitaList[0].id, persona_id: personeList[0].id, ruolo: 'proprietario', attivo: true },
            { unita_id: unitaList[1].id, persona_id: personeList[1].id, ruolo: 'proprietario', attivo: true },
            { unita_id: unitaList[2].id, persona_id: personeList[2].id, ruolo: 'proprietario', attivo: true }
          ])
        }
      }

      // 3. Crea Esercizio Corrente
      const annoCorrente = new Date().getFullYear()
      const { data: esData } = await supabase.from('esercizi').insert([{
        condominio_id: newCondoId,
        anno: annoCorrente,
        data_inizio: `${annoCorrente}-01-01`,
        data_fine: `${annoCorrente}-12-31`,
        stato: 'aperto'
      }]).select().single()
      
      if (esData) setEsercizioId(esData.id)

      setStep(2)
    } catch (err) {
      console.error(err)
      toast.error('Errore durante la creazione del condominio')
    } finally {
      setLoading(false)
    }
  }

  const elaboraFattura = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      // Usa le funzioni reali di fileExtractor
      let fileToSend = file
      const info = getTipoFile(file)
      if (info.isImage) {
        fileToSend = await comprimiImmagine(file)
      }
      
      const estratto = await estraiFattura(fileToSend)
      if (estratto) {
        setDatiEstratti(estratto)
        setFileFattura(file)
      } else {
        toast.error('Dati non rilevati, inserisci i dati manualmente.')
      }
    } catch (err) {
      console.error(err)
      toast.error('Errore elaborazione fattura con AI')
    } finally {
      setLoading(false)
    }
  }
  
  const salvaFatturaEProcedi = async () => {
    if (!datiEstratti || !esercizioId) return
    setLoading(true)
    try {
      await supabase.from('spese').insert([{
        condominio_id: condoId,
        esercizio_id: esercizioId,
        descrizione: datiEstratti.descrizione || 'Fattura generica',
        fornitore: datiEstratti.fornitore || 'Fornitore di prova',
        importo_totale: datiEstratti.importo || 100,
        data_spesa: datiEstratti.data || new Date().toISOString().split('T')[0],
        categoria: 'Manutenzione Ordinaria',
        criterio: 'millesimi'
      }])
      setStep(3)
    } catch (err) {
      console.error(err)
      toast.error('Errore nel salvataggio della fattura')
    } finally {
      setLoading(false)
    }
  }

  const completaOnboarding = async () => {
    setLoading(true)
    try {
      // Crea un preventivo e qualche rata fittizia per completare l'effetto WOW
      const { data: prev } = await supabase.from('preventivo_voci').insert([{
        esercizio_id: esercizioId,
        descrizione: 'Spese Ordinarie di Gestione',
        importo: 3500.00,
        categoria: 'Gestione',
        criterio: 'millesimi'
      }]).select().single()

      if (prev) {
        await supabase.from('rate').insert([
          { esercizio_id: esercizioId, data_scadenza: `${new Date().getFullYear()}-03-31`, tipo: 'preventivo' },
          { esercizio_id: esercizioId, data_scadenza: `${new Date().getFullYear()}-06-30`, tipo: 'preventivo' }
        ])
      }

      setFlowState('SUCCESS')
      setTimeout(() => {
        if (onComplete) onComplete()
      }, 3000)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (flowState === 'SUCCESS') {
    return (
      <div style={styles.overlay}>
        <div style={{ ...styles.card, textAlign: 'center', maxWidth: 450 }}>
          <div style={styles.successIcon}>
            <CheckCircle2 size={64} style={{ color: '#10b981' }} />
          </div>
          <h2 style={{ fontSize: 28, margin: '0 0 12px' }}>Tutto Pronto!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
            Il tuo gestionale è ora configurato. Goditi la potenza di CondoFAST!
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Loader2 size={24} className="animate-spin" style={{ color: '#7c3aed' }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.overlay}>
      {flowState === 'CHOICE' && (
        <div style={{ ...styles.card, maxWidth: 500 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={styles.logoCircle}>
              <Zap size={32} style={{ color: '#7c3aed' }} />
            </div>
            <h2 style={{ fontSize: 26, margin: '0 0 8px' }}>Benvenuto in CondoFAST!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, margin: 0 }}>
              Prima di iniziare, dicci una cosa per aiutarti a configurare il gestionale al meglio.
            </p>
          </div>

          <div style={styles.choiceGrid}>
            <button style={styles.choiceCard} onClick={() => handleChoice(true)} className="onboarding-choice-btn">
              <div style={styles.choiceIcon}><Building size={28} style={{ color: '#3b82f6' }} /></div>
              <h3 style={{ fontSize: 17, margin: '0 0 4px', color: 'var(--text-primary)' }}>Ho già un software</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Voglio migrare i miei condomini (Excel, PDF) con il Wizard Zero Frizione.
              </p>
            </button>

            <button style={styles.choiceCard} onClick={() => handleChoice(false)} className="onboarding-choice-btn">
              <div style={styles.choiceIcon}><PlayCircle size={28} style={{ color: '#10b981' }} /></div>
              <h3 style={{ fontSize: 17, margin: '0 0 4px', color: 'var(--text-primary)' }}>Parto da zero</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Fammi configurare il mio primo condominio per vedere come funziona.
              </p>
            </button>
          </div>
          
          <style dangerouslySetInnerHTML={{__html: `
            .onboarding-choice-btn:hover {
              border-color: #7c3aed !important;
              transform: translateY(-2px);
              box-shadow: 0 10px 20px -5px rgba(124, 58, 237, 0.1);
            }
          `}} />
        </div>
      )}

      {flowState === 'ONBOARDING' && (
        <div style={{ ...styles.card, maxWidth: 600 }}>
          <div style={styles.progressContainer}>
            <div style={{ ...styles.progressBar, width: `${(step / 3) * 100}%` }}></div>
          </div>
          <div style={styles.stepHeader}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', letterSpacing: 1, textTransform: 'uppercase' }}>
              Passo {step} di 3
            </span>
          </div>

          {step === 1 && (
            <form onSubmit={creaCondominioBase}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Building2 size={28} style={{ color: 'var(--text-primary)' }} />
                <h2 style={{ fontSize: 24, margin: 0 }}>Il tuo primo Condominio</h2>
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                Dai un nome al condominio. Creeremo noi in automatico alcune unità immobiliari di prova per farti testare il sistema senza perdite di tempo.
              </p>

              <div style={{ marginBottom: 24 }}>
                <label style={styles.label}>Nome del Condominio</label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="Es. Condominio Roma Centrale"
                  value={condoName}
                  onChange={e => setCondoName(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={loading || !condoName} style={styles.btnPrimary}>
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'Continua'} <ArrowRight size={18} />
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Sparkles size={28} style={{ color: '#7c3aed' }} />
                <h2 style={{ fontSize: 24, margin: 0 }}>La Magia dell'Intelligenza Artificiale</h2>
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                Carica una qualsiasi fattura (PDF o immagine). La nostra AI estrarrà istantaneamente tutti i dati per te. Niente più inserimento manuale.
              </p>

              {!datiEstratti ? (
                <div style={styles.uploadArea}>
                  <UploadCloud size={48} style={{ color: '#a78bfa', marginBottom: 16 }} />
                  <h3 style={{ margin: '0 0 8px' }}>Carica una fattura di prova</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                    Formati supportati: PDF, JPG, PNG
                  </p>
                  
                  <input 
                    type="file" 
                    id="fattura-onboarding" 
                    accept=".pdf,image/*" 
                    onChange={elaboraFattura} 
                    style={{ display: 'none' }} 
                  />
                  
                  <label htmlFor="fattura-onboarding" style={styles.btnSecondary}>
                    {loading ? <><Loader2 size={16} className="animate-spin" style={{ marginRight: 8 }}/> Analisi AI in corso...</> : 'Sfoglia File'}
                  </label>
                  
                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <button type="button" onClick={() => setStep(3)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
                      Salta questo passaggio
                    </button>
                  </div>
                </div>
              ) : (
                <div style={styles.extractedDataCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={18} style={{ color: '#10b981' }} /> Dati estratti con successo
                    </h4>
                  </div>
                  
                  <div style={styles.dataGrid}>
                    <div style={styles.dataItem}>
                      <span style={styles.dataLabel}>Fornitore</span>
                      <span style={styles.dataValue}>{datiEstratti.fornitore || 'N/D'}</span>
                    </div>
                    <div style={styles.dataItem}>
                      <span style={styles.dataLabel}>Importo</span>
                      <span style={styles.dataValue}>€ {parseFloat(datiEstratti.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={styles.dataItem}>
                      <span style={styles.dataLabel}>Data</span>
                      <span style={styles.dataValue}>{datiEstratti.data || 'N/D'}</span>
                    </div>
                    <div style={styles.dataItem}>
                      <span style={styles.dataLabel}>Descrizione</span>
                      <span style={styles.dataValue}>{datiEstratti.descrizione || 'N/D'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                    <button onClick={salvaFatturaEProcedi} disabled={loading} style={styles.btnPrimary}>
                      {loading ? <Loader2 size={18} className="animate-spin" /> : 'Salva e Continua'} <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Calculator size={28} style={{ color: 'var(--text-primary)' }} />
                <h2 style={{ fontSize: 24, margin: 0 }}>Generazione Preventivo e Rate</h2>
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                Ora che hai registrato una spesa, CondoFAST la ripartisce automaticamente in base ai millesimi. Con un clic generiamo il piano rateale per i tuoi condòmini.
              </p>

              <div style={styles.ratePreviewCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: 10, background: 'rgba(124,58,237,0.1)', borderRadius: 8 }}>
                    <Zap size={24} style={{ color: '#7c3aed' }} />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--text-primary)' }}>Automa Rate</h4>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Il sistema calcolerà le quote per le 3 unità presenti.</p>
                  </div>
                </div>
                <div style={{ padding: 16, background: 'var(--app-bg)', borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Totale da ripartire</span>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>€ 3.500,00</div>
                  </div>
                  <ChevronRight size={20} style={{ color: 'var(--text-muted)' }} />
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rate calcolate</span>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>2 rate</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                <button onClick={completaOnboarding} disabled={loading} style={styles.btnPrimary}>
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'Genera Rate e Completa'} <CheckCircle2 size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'var(--app-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 24
  },
  card: {
    background: 'var(--card-bg)',
    borderRadius: 24,
    padding: 40,
    width: '100%',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    border: '1px solid var(--border-color)',
    position: 'relative',
    overflow: 'hidden'
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'rgba(124,58,237,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
    border: '1px solid rgba(124,58,237,0.2)'
  },
  choiceGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16
  },
  choiceCard: {
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 16,
    padding: 24,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start'
  },
  choiceIcon: {
    marginBottom: 16,
    padding: 12,
    background: 'var(--card-bg)',
    borderRadius: 12,
    border: '1px solid var(--border-color)'
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background: 'rgba(255,255,255,0.05)'
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
    transition: 'width 0.3s ease'
  },
  stepHeader: {
    marginBottom: 24
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 8
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    color: 'var(--text-primary)',
    fontSize: 16,
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: '#7c3aed',
    color: '#fff',
    border: 'none',
    padding: '14px 28px',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--app-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    padding: '12px 24px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  uploadArea: {
    border: '2px dashed var(--border-color)',
    borderRadius: 16,
    padding: '48px 24px',
    textAlign: 'center',
    background: 'rgba(255,255,255,0.02)',
    transition: 'border-color 0.2s, background 0.2s'
  },
  extractedDataCard: {
    background: 'var(--app-bg)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: 16,
    padding: 24
  },
  dataGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16
  },
  dataItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  dataLabel: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  dataValue: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-primary)'
  },
  ratePreviewCard: {
    border: '1px solid var(--border-color)',
    borderRadius: 16,
    padding: 24,
    background: 'rgba(255,255,255,0.02)'
  },
  successIcon: {
    animation: 'scaleIn 0.5s ease-out forwards'
  }
}
