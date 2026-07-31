// src/components/WizardRiconciliazioneModal.jsx
import { useState, useEffect } from 'react'
import { 
  Building2, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw, 
  Settings, Bot, HelpCircle, ShieldCheck, DollarSign, FileText, 
  Check, X, Zap, Sliders, AlertCircle, Lock
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../hooks/usePlan'
import UpgradeTeaserModal from './UpgradeTeaserModal'
import { toast } from 'react-hot-toast'

export default function WizardRiconciliazioneModal({ isOpen, onClose, onSaveSuccess }) {
  const { user } = useAuth()
  const { profile, canUse, refresh } = usePlan()
  
  const [currentStep, setCurrentStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [showProPaywall, setShowProPaywall] = useState(false)

  // Opzioni di configurazione
  const [metodoIngestione, setMetodoIngestione] = useState('pdf') // 'open_banking' | 'pdf'
  const [tolleranzaImporto, setTolleranzaImporto] = useState(5) // in euro
  const [tolleranzaGiorni, setTolleranzaGiorni] = useState(45) // in giorni
  const [confidenceMinima, setConfidenceMinima] = useState(70) // in %
  const [autoCreazioneSpesaOrfana, setAutoCreazioneSpesaOrfana] = useState(false)
  const [notificaIncassoAutomatico, setNotificaIncassoAutomatico] = useState(false)

  useEffect(() => {
    if (profile?.reconciliation_settings) {
      const s = profile.reconciliation_settings
      if (s.metodo_preferito) setMetodoIngestione(s.metodo_preferito)
      if (s.tolleranza_importo !== undefined) setTolleranzaImporto(s.tolleranza_importo)
      if (s.tolleranza_giorni !== undefined) setTolleranzaGiorni(s.tolleranza_giorni)
      if (s.confidence_minima !== undefined) setConfidenceMinima(s.confidence_minima)
      if (s.auto_creazione_orfana !== undefined) setAutoCreazioneSpesaOrfana(s.auto_creazione_orfana)
      if (s.notifica_incasso !== undefined) setNotificaIncassoAutomatico(s.notifica_incasso)
    }
  }, [profile, isOpen])

  if (!isOpen) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      const newSettings = {
        metodo_preferito: metodoIngestione,
        tolleranza_importo: Number(tolleranzaImporto),
        tolleranza_giorni: Number(tolleranzaGiorni),
        confidence_minima: Number(confidenceMinima),
        auto_creazione_orfana: autoCreazioneSpesaOrfana,
        notifica_incasso: notificaIncassoAutomatico,
        updated_at: new Date().toISOString()
      }

      if (user?.id) {
        const { error } = await supabase
          .from('profiles')
          .update({ reconciliation_settings: newSettings })
          .eq('id', user.id)

        if (error && error.code !== '42703') { // ignora se la colonna non esiste e usa localStorage
          console.warn('Errore salvataggio profilazione DB, salvo in locale:', error)
        }
      }

      localStorage.setItem('condosmart_reconciliation_settings', JSON.stringify(newSettings))
      toast.success('Configurazione Riconciliazione salvata con successo!')
      if (refresh) refresh()
      if (onSaveSuccess) onSaveSuccess(newSettings)
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Errore durante il salvataggio delle impostazioni.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16,
        maxWidth: 780, width: '100%', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)', fontFamily: 'Sora, sans-serif'
      }}>
        {/* Header Modale */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--app-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Bot size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Configurazione Guidata: Riconciliazione Bancaria
              </h2>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Imposta le regole e i criteri per abbinare automaticamente incassi e uscite
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Indicatori di Step */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--card-bg)', padding: '14px 24px', gap: 8, overflowX: 'auto' }}>
          {[
            { num: 1, label: '1. Ingestione Dati' },
            { num: 2, label: '2. Regole & Tolleranze' },
            { num: 3, label: '3. Incassi & Rate' },
            { num: 4, label: '4. Spese & Uscite' },
          ].map((s) => (
            <button
              key={s.num}
              onClick={() => setCurrentStep(s.num)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid',
                borderColor: currentStep === s.num ? '#2563eb' : 'var(--border-color)',
                background: currentStep === s.num ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                color: currentStep === s.num ? '#60a5fa' : 'var(--text-secondary)',
                fontWeight: currentStep === s.num ? 700 : 500, fontSize: 12,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                whiteSpace: 'nowrap'
              }}
            >
              {currentStep > s.num ? (
                <CheckCircle2 size={14} style={{ color: '#34d399' }} />
              ) : (
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: currentStep === s.num ? '#2563eb' : 'var(--border-color)', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {s.num}
                </span>
              )}
              {s.label}
            </button>
          ))}
        </div>

        {/* Corpo dello Step */}
        <div style={{ padding: 28, flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* ── STEP 1: INGESTIONE DATI ────────────────────────────────────────── */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Passo 1: Come vuoi ricevere i movimenti bancari?
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  CondoFAST supporta sia il collegamento diretto in sola lettura via Open Banking (PSD2) sia il caricamento periodico dei file Estratto Conto.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {/* Opzione A: Open Banking */}
                <div 
                  onClick={() => {
                    if (canUse('open_banking')) {
                      setMetodoIngestione('open_banking')
                    } else {
                      setShowProPaywall(true)
                    }
                  }}
                  style={{
                    border: '2px solid', borderColor: metodoIngestione === 'open_banking' && canUse('open_banking') ? '#2563eb' : 'var(--border-color)',
                    background: metodoIngestione === 'open_banking' && canUse('open_banking') ? 'rgba(37, 99, 235, 0.05)' : 'var(--app-bg)',
                    borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: 12,
                    position: 'relative', opacity: canUse('open_banking') ? 1 : 0.95
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(37, 99, 235, 0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Building2 size={20} />
                    </div>
                    {canUse('open_banking') ? (
                      <span style={{ fontSize: 10, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>RACCOMANDATO (PRO)</span>
                    ) : (
                      <span style={{ fontSize: 10, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '2px 8px', borderRadius: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Lock size={10} /> ESCLUSIVO PROFESSIONAL
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      Sincronizzazione Automatica Open Banking (PSD2)
                    </h4>
                    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      Collega il conto corrente della banca del condominio (via GoCardless). I movimenti vengono scaricati automaticamente ogni notte senza interventi manuali.
                    </p>
                  </div>
                  {!canUse('open_banking') && (
                    <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>Clicca per informazioni sulla funzione</span>
                      <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700, textDecoration: 'underline' }}>Scopri di più →</span>
                    </div>
                  )}
                </div>

                {/* Opzione B: Upload PDF / CSV */}
                <div 
                  onClick={() => setMetodoIngestione('pdf')}
                  style={{
                    border: '2px solid', borderColor: metodoIngestione === 'pdf' ? '#2563eb' : 'var(--border-color)',
                    background: metodoIngestione === 'pdf' ? 'rgba(37, 99, 235, 0.05)' : 'var(--app-bg)',
                    borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: 12
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={20} />
                    </div>
                    <span style={{ fontSize: 10, background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>INCLUSO IN TUTTI I PIANI</span>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Upload Periodico PDF / CSV Estratto Conto</h4>
                    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      Trascina o carica il file PDF/CSV rilasciato dall'home banking. L'AI legge i movimenti, estrae causali ed importi ed esegue la verifica della quadratura di cassa.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: REGOLE & TOLLERANZE ────────────────────────────────────── */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Passo 2: Definisci i Criteri di Abbinamento Automatico
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Configura le soglie aritmetiche ed algoritmiche utilizzate per proporre gli abbinamenti tra la banca e la contabilità.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Tolleranza Importo */}
                <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Tolleranza Scarto Importo (per arrotondamenti o commissioni bancarie)
                    </label>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', background: 'rgba(37, 99, 235, 0.15)', padding: '2px 8px', borderRadius: 6 }}>
                      ±{tolleranzaImporto}.00 €
                    </span>
                  </div>
                  <input 
                    type="range" min="0" max="20" step="1"
                    value={tolleranzaImporto}
                    onChange={e => setTolleranzaImporto(e.target.value)}
                    style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {tolleranzaImporto == 0 ? 'Richiede un match esatto al centesimo.' : `Consente abbinamenti se la differenza tra fattura e bonifico non supera ±${tolleranzaImporto}€.`}
                  </div>
                </div>

                {/* Tolleranza Giorni */}
                <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Finestra Temporale di Riconciliazione (Giorni)
                    </label>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', background: 'rgba(124, 58, 237, 0.15)', padding: '2px 8px', borderRadius: 6 }}>
                      {tolleranzaGiorni} giorni
                    </span>
                  </div>
                  <input 
                    type="range" min="15" max="90" step="5"
                    value={tolleranzaGiorni}
                    onChange={e => setTolleranzaGiorni(e.target.value)}
                    style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Intervallo massimo ammesso tra la data dell'operazione/fattura e l'accredito/addebito bancario.
                  </div>
                </div>

                {/* Soglia di Affidabilità AI */}
                <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Soglia Minima di Confidenza AI (Confidence Score)
                    </label>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: 6 }}>
                      {confidenceMinima}%
                    </span>
                  </div>
                  <input 
                    type="range" min="50" max="95" step="5"
                    value={confidenceMinima}
                    onChange={e => setConfidenceMinima(e.target.value)}
                    style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Mostra le proposte di abbinamento automatico solo quando l'algoritmo raggiunge almeno il {confidenceMinima}% di certezza.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: INCASSI & RATE ─────────────────────────────────────────── */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Passo 3: Gestione Automatica degli Incassi (Bonifici Condòmini)
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Configura come il sistema riconosce ed accredita i bonifici in entrata ricevuti dai condòmini per il pagamento delle rate.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <input 
                    type="checkbox"
                    id="chkNotifica"
                    checked={notificaIncassoAutomatico}
                    onChange={e => setNotificaIncassoAutomatico(e.target.checked)}
                    style={{ marginTop: 3, accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <label htmlFor="chkNotifica" style={{ cursor: 'pointer' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Invia Ricevuta/Quietanza automatica al condomino dopo la riconciliazione
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                      Quando l'incasso viene confermato, invia un'email automatica al condomino notificando il corretto pagamento della quota rata.
                    </div>
                  </label>
                </div>

                <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 12, padding: 16, display: 'flex', gap: 12 }}>
                  <ShieldCheck size={20} style={{ color: '#60a5fa', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Riconoscimento Fuzzy dei Nomi:</strong> CondoFAST confronta i nomi presenti nell'anagrafica del condominio con il campo ordinante del bonifico bancario (es: <em>"MARIO ROSSI"</em> viene associato all'unità A/1 anche in caso di formattazioni diverse o codici IBAN corrispondenti).
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: SPESE & USCITE ─────────────────────────────────────────── */}
          {currentStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Passo 4: Gestione Uscite & Movimenti Bancari Orfani
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Imposta il comportamento del sistema quando viene rilevato un pagamento in banca senza una corrispettiva spesa o fattura registrata.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <input 
                    type="checkbox"
                    id="chkOrfani"
                    checked={autoCreazioneSpesaOrfana}
                    onChange={e => setAutoCreazioneSpesaOrfana(e.target.checked)}
                    style={{ marginTop: 3, accentColor: '#7c3aed', cursor: 'pointer' }}
                  />
                  <label htmlFor="chkOrfani" style={{ cursor: 'pointer' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Abilita pulsante "Crea Spesa da Movimento Orfano" in 1-Click
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                      Se un movimento bancario di uscita non trova alcuna spesa abbinata, mostra in evidenza il pulsante d'azione rapida per autocompilare la spesa partendo dai dati bancari.
                    </div>
                  </label>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 12, padding: 16, display: 'flex', gap: 12 }}>
                  <CheckCircle2 size={20} style={{ color: '#34d399', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Quadratura Cassa Garantita:</strong> Con questi parametri attivi, ogni movimento bancario trova la propria corrispondenza contabile, assicurando la perfetta quadratura del Rendiconto ai sensi dell'art. 1130-bis c.c.
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Modale con Controlli di Navigazione */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)' }}>
          <button 
            type="button" 
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            style={{
              padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-color)',
              color: currentStep === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <ArrowLeft size={14} /> Indietro
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            {currentStep < 4 ? (
              <button 
                type="button" 
                onClick={() => setCurrentStep(prev => Math.min(4, prev + 1))}
                style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                Avanti <ArrowRight size={14} />
              </button>
            ) : (
              <button 
                type="button" 
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '8px 24px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}
              >
                {saving ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />} Salva Configurazione
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pop-up Informativo Paywall Open Banking */}
      <UpgradeTeaserModal 
        isOpen={showProPaywall}
        onClose={() => setShowProPaywall(false)}
        title="Sincronizzazione Automatica Open Banking (PSD2)"
        description="Con la sincronizzazione automatica, CondoFAST si collega in sola lettura e in totale sicurezza alla banca del condominio (via GoCardless), scaricando ogni notte i movimenti. Zero file PDF da scaricare o caricare!"
        pianoRichiesto="professional"
        badgeText="ESCLUSIVO PROFESSIONAL"
        features={[
          "Sincronizzazione notturna automatica dei conti correnti",
          "Connessione diretta certificata da standard bancari PSD2",
          "Condomini ed estratti conto illimitati inclusi nel piano"
        ]}
        ctaText="Passa a Professional (299€/m)"
      />
    </div>
  )
}
