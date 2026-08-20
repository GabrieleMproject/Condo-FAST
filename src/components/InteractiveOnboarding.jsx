import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../hooks/usePlan'
import { toast } from 'react-hot-toast'
import OnboardingTourModal from './OnboardingTourModal'
import {
  Building2,
  UploadCloud,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  Trash2,
  Loader2,
  ArrowLeftRight,
  ShieldCheck,
  Briefcase,
  HelpCircle,
  Mail,
  Phone,
  MapPin,
  FileText
} from 'lucide-react'

function fileToResizedDataUrl(file, maxW = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.9))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function InteractiveOnboarding({ onComplete }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profile, updateBranding } = usePlan()

  const [step, setStep] = useState(1) // 1: Profilo Studio, 2: Scelta Gestione Stabili
  const [loading, setLoading] = useState(false)
  const [showTourModal, setShowTourModal] = useState(false)

  // Campi Form Studio
  const [studioNome, setStudioNome] = useState(profile?.studio_nome || '')
  const [ragioneSociale, setRagioneSociale] = useState(profile?.ragione_sociale || '')
  const [partitaIva, setPartitaIva] = useState(profile?.partita_iva || '')
  const [codiceFiscale, setCodiceFiscale] = useState(profile?.codice_fiscale || '')
  const [studioIndirizzo, setStudioIndirizzo] = useState(profile?.studio_indirizzo || '')
  const [studioTelefono, setStudioTelefono] = useState(profile?.studio_telefono || '')
  const [studioEmail, setStudioEmail] = useState(profile?.studio_email || user?.email || '')
  const [studioPec, setStudioPec] = useState(profile?.studio_pec || '')
  const [logoBase64, setLogoBase64] = useState(profile?.logo_base64 || '')
  const logoInputRef = useRef(null)

  useEffect(() => {
    if (profile) {
      if (!studioNome && profile.studio_nome) setStudioNome(profile.studio_nome)
      if (!ragioneSociale && profile.ragione_sociale) setRagioneSociale(profile.ragione_sociale)
      if (!partitaIva && profile.partita_iva) setPartitaIva(profile.partita_iva)
      if (!codiceFiscale && profile.codice_fiscale) setCodiceFiscale(profile.codice_fiscale)
      if (!studioIndirizzo && profile.studio_indirizzo) setStudioIndirizzo(profile.studio_indirizzo)
      if (!studioTelefono && profile.studio_telefono) setStudioTelefono(profile.studio_telefono)
      if (!studioEmail && (profile.studio_email || user?.email)) setStudioEmail(profile.studio_email || user?.email || '')
      if (!studioPec && profile.studio_pec) setStudioPec(profile.studio_pec)
      if (!logoBase64 && profile.logo_base64) setLogoBase64(profile.logo_base64)
    }
  }, [profile, user])

  const onLogoSelected = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Logo: usa formati PNG, JPG o WEBP.')
      return
    }
    try {
      const dataUrl = await fileToResizedDataUrl(file, 400)
      setLogoBase64(dataUrl)
      toast.success('Logo caricato con successo!')
    } catch {
      toast.error('Impossibile elaborare il file immagine.')
    }
  }

  const handleSaveStudio = async (e) => {
    e.preventDefault()
    if (!studioNome.trim()) {
      return toast.error('Inserisci il Nome dello Studio o dell\'Amministratore')
    }

    setLoading(true)
    try {
      const res = await updateBranding({
        studio_nome: studioNome.trim(),
        ragione_sociale: ragioneSociale.trim(),
        partita_iva: partitaIva.trim(),
        codice_fiscale: codiceFiscale.trim(),
        studio_indirizzo: studioIndirizzo.trim(),
        studio_telefono: studioTelefono.trim(),
        studio_email: studioEmail.trim(),
        studio_pec: studioPec.trim(),
        logo_base64: logoBase64 || null,
      })

      if (res?.error) throw res.error
      toast.success('Dati studio e branding salvati!')
      setStep(2)
    } catch (err) {
      console.error(err)
      toast.error('Errore durante il salvataggio: ' + (err.message || 'Riprova'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        
        {/* STEP 1: Profilo Studio & Branding */}
        {step === 1 && (
          <div style={styles.card}>
            {/* Header */}
            <div style={styles.headerBox}>
              <div style={styles.stepBadge}>
                <span>PASSO 1 DI 2</span> · <span>DATI STUDIO & INTESTAZIONE</span>
              </div>
              <h1 style={styles.title}>Personalizza il tuo Studio</h1>
              <p style={styles.subtitle}>
                Inserisci i dati identificativi e il logo del tuo studio. Verranno utilizzati automaticamente come intestazione ufficiale per tutti i rendiconti PDF, solleciti rate, convocazioni e comunicazioni.
              </p>
            </div>

            <form onSubmit={handleSaveStudio} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Sezione Logo */}
              <div style={styles.logoSection}>
                <div style={styles.logoPreviewBox}>
                  {logoBase64 ? (
                    <img src={logoBase64} alt="Logo Studio" style={styles.logoImg} />
                  ) : (
                    <div style={styles.logoPlaceholder}>
                      <ImageIcon size={32} color="var(--text-muted)" />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Nessun logo</span>
                    </div>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Logo Ufficiale dello Studio
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
                    Carica il logo per stampare automaticamente l'intestazione grafica nei consuntivi e bilanci (PNG, JPG, WEBP).
                  </div>
                  
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    onChange={onLogoSelected}
                  />

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      style={styles.btnSecondarySmall}
                    >
                      <UploadCloud size={15} />
                      {logoBase64 ? 'Cambia Logo' : 'Carica Logo'}
                    </button>
                    {logoBase64 && (
                      <button
                        type="button"
                        onClick={() => setLogoBase64('')}
                        style={{ ...styles.btnSecondarySmall, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      >
                        <Trash2 size={15} />
                        Rimuovi
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Griglia Campi Form */}
              <div style={styles.formGrid}>
                {/* Nome Studio */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={styles.label}>
                    Nome Studio o Amministratore <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={styles.inputWrapper}>
                    <Briefcase size={17} style={styles.inputIcon} />
                    <input
                      type="text"
                      required
                      placeholder="Es. Studio Amministrazioni Rossi / Dott. Mario Rossi"
                      value={studioNome}
                      onChange={e => setStudioNome(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>

                {/* Ragione Sociale */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Ragione Sociale Azienda (Opzionale se ditta individuale o SRL)</label>
                  <input
                    type="text"
                    placeholder="Es. Gestione Immobili SRL"
                    value={ragioneSociale}
                    onChange={e => setRagioneSociale(e.target.value)}
                    style={styles.inputSimple}
                  />
                </div>

                {/* Partita IVA */}
                <div>
                  <label style={styles.label}>Partita IVA</label>
                  <input
                    type="text"
                    placeholder="Es. 12345678901"
                    value={partitaIva}
                    onChange={e => setPartitaIva(e.target.value)}
                    style={styles.inputSimple}
                  />
                </div>

                {/* Codice Fiscale */}
                <div>
                  <label style={styles.label}>Codice Fiscale Amministratore</label>
                  <input
                    type="text"
                    placeholder="Es. RSSMRA80A01H501U"
                    value={codiceFiscale}
                    onChange={e => setCodiceFiscale(e.target.value)}
                    style={styles.inputSimple}
                  />
                </div>

                {/* Indirizzo Studio */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Indirizzo Sede Studio</label>
                  <div style={styles.inputWrapper}>
                    <MapPin size={17} style={styles.inputIcon} />
                    <input
                      type="text"
                      placeholder="Es. Via Roma 10, 20121 Milano (MI)"
                      value={studioIndirizzo}
                      onChange={e => setStudioIndirizzo(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>

                {/* Telefono */}
                <div>
                  <label style={styles.label}>Telefono Studio / Reperibilità</label>
                  <div style={styles.inputWrapper}>
                    <Phone size={17} style={styles.inputIcon} />
                    <input
                      type="tel"
                      placeholder="Es. 02 1234567 / 333 1234567"
                      value={studioTelefono}
                      onChange={e => setStudioTelefono(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>

                {/* Email / PEC */}
                <div>
                  <label style={styles.label}>Email Ufficiale / PEC</label>
                  <div style={styles.inputWrapper}>
                    <Mail size={17} style={styles.inputIcon} />
                    <input
                      type="email"
                      placeholder="Es. studio@pec.it"
                      value={studioEmail}
                      onChange={e => setStudioEmail(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>
              </div>

              {/* Footer Azioni Step 1 */}
              <div style={styles.actionRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                  <ShieldCheck size={18} color="#10b981" />
                  <span>Dati salvati in sicurezza sul tuo profilo protetto</span>
                </div>

                <button
                  type="submit"
                  disabled={loading || !studioNome.trim()}
                  style={styles.btnPrimary}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      Salva e Continua
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* STEP 2: Scelta Modalità Partenza Condomini */}
        {step === 2 && (
          <div style={styles.card}>
            {/* Header Step 2 */}
            <div style={styles.headerBox}>
              <div style={styles.stepBadge}>
                <span>PASSO 2 DI 2</span> · <span>GESTIONE CONDOMINI</span>
              </div>
              <h1 style={styles.title}>Come vuoi iniziare a gestire i tuoi condomini?</h1>
              <p style={styles.subtitle}>
                Configurazione completata per <strong style={{ color: 'var(--text-primary)' }}>{studioNome}</strong>. Scegli come preferisci procedere per configurare i tuoi stabili.
              </p>
            </div>

            {/* Grid 2 Card di Scelta */}
            <div style={styles.choiceGrid}>
              
              {/* Opzione A: Migrazione AI */}
              <div style={styles.choiceCard}>
                <div style={styles.cardHeader}>
                  <div style={{ ...styles.iconCircle, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                    <ArrowLeftRight size={28} />
                  </div>
                  <span style={styles.badgeMigrazione}>CONSIGLIATO SE GESTISCI GIÀ STABILI</span>
                </div>

                <h3 style={styles.cardTitle}>Sto migrando da un altro software</h3>
                <p style={styles.cardDesc}>
                  Hai già dei condomini su <strong>Danea Domustudio, PGC, Brainware o Excel/PDF</strong>? L'Intelligenza Artificiale di CondoFAST estrae anagrafiche, unità, millesimi e bilanci in 1 click.
                </p>

                <ul style={styles.featureList}>
                  <li>
                    <CheckCircle2 size={16} color="#3b82f6" style={{ flexShrink: 0 }} />
                    <span>Importazione automatica multi-formato (Excel, CSV, PDF)</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} color="#3b82f6" style={{ flexShrink: 0 }} />
                    <span>Estrazione intelligente con verifica anteprima prima del salvataggio</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} color="#3b82f6" style={{ flexShrink: 0 }} />
                    <span>Nessun dato duplicato, zero inserimenti manuali</span>
                  </li>
                </ul>

                <button
                  type="button"
                  onClick={() => navigate('/migrazione')}
                  style={styles.btnCardPrimary}
                >
                  <span>Avvia Wizard Migrazione AI</span>
                  <ArrowRight size={18} />
                </button>
              </div>

              {/* Opzione B: Partenza da zero / Nuovo Condominio Reale */}
              <div style={styles.choiceCard}>
                <div style={styles.cardHeader}>
                  <div style={{ ...styles.iconCircle, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                    <Building2 size={28} />
                  </div>
                  <span style={styles.badgeNuovo}>CONFIGURAZIONE PULITA</span>
                </div>

                <h3 style={styles.cardTitle}>Parto da zero / Nuovo Studio</h3>
                <p style={styles.cardDesc}>
                  Configura direttamente il tuo primo condominio reale, inserisci i dati catastali e scopri la potenza della gestione automatizzata delle spese e dei rendiconti.
                </p>

                <ul style={styles.featureList}>
                  <li>
                    <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
                    <span>Creazione del tuo primo stabile reale senza dati fittizi</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
                    <span>Modulo Spese con lettura automatica fatture tramite OCR AI</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
                    <span>Rendiconti e consuntivi PDF a norma art. 1130-bis c.c.</span>
                  </li>
                </ul>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => navigate('/condomini', { state: { openNew: true } })}
                    style={{ ...styles.btnCardPrimary, background: '#10b981' }}
                  >
                    <span>+ Crea Primo Condominio</span>
                    <ArrowRight size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowTourModal(true)}
                    style={styles.btnCardSecondary}
                  >
                    <HelpCircle size={16} />
                    <span>Guarda Tour Guidato</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Back button to Step 1 */}
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'Sora, sans-serif'
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                ← Torna indietro e modifica i dati dello studio
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Modale Tour Guidato Onboarding */}
      <OnboardingTourModal
        isOpen={showTourModal}
        onClose={() => setShowTourModal(false)}
      />
    </div>
  )
}

const styles = {
  overlay: {
    minHeight: '100vh',
    width: '100%',
    background: 'radial-gradient(ellipse at top, rgba(37,99,235,0.08) 0%, var(--app-bg) 70%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    boxSizing: 'border-box',
    fontFamily: 'Sora, sans-serif',
  },
  container: {
    width: '100%',
    maxWidth: 860,
  },
  card: {
    background: 'var(--card-bg)',
    borderRadius: 20,
    border: '1px solid var(--border-color)',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
    padding: '36px 32px',
    boxSizing: 'border-box',
  },
  headerBox: {
    textAlign: 'center',
    marginBottom: 28,
  },
  stepBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 12px',
    borderRadius: 99,
    background: 'rgba(37,99,235,0.1)',
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 10px 0',
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    lineHeight: 1.55,
    maxWidth: 620,
    margin: '0 auto',
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    padding: 16,
    borderRadius: 14,
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
  },
  logoPreviewBox: {
    width: 76,
    height: 76,
    borderRadius: 12,
    background: 'var(--card-bg)',
    border: '1px dashed var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  logoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  logoPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 6,
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '12px 14px 12px 40px',
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 14,
    fontFamily: 'Sora, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease',
  },
  inputSimple: {
    width: '100%',
    padding: '12px 14px',
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 14,
    fontFamily: 'Sora, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease',
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '13px 26px',
    fontSize: 15,
    fontWeight: 600,
    fontFamily: 'Sora, sans-serif',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  btnSecondarySmall: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--card-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'Sora, sans-serif',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTop: '1px solid var(--border-color)',
    flexWrap: 'wrap',
    gap: 16,
  },
  choiceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 20,
    marginTop: 12,
  },
  choiceCard: {
    background: 'var(--app-bg)',
    borderRadius: 16,
    border: '1px solid var(--border-color)',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    boxSizing: 'border-box',
    transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMigrazione: {
    background: 'rgba(59, 130, 246, 0.12)',
    color: '#3b82f6',
    fontSize: 10,
    fontWeight: 700,
    padding: '4px 8px',
    borderRadius: 6,
    letterSpacing: '0.03em',
  },
  badgeNuovo: {
    background: 'rgba(16, 185, 129, 0.12)',
    color: '#10b981',
    fontSize: 10,
    fontWeight: 700,
    padding: '4px 8px',
    borderRadius: 6,
    letterSpacing: '0.03em',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 8px 0',
  },
  cardDesc: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: '0 0 16px 0',
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 24px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    fontSize: 13,
    color: 'var(--text-primary)',
  },
  btnCardPrimary: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '13px 18px',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'Sora, sans-serif',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  btnCardSecondary: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'var(--card-bg)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    padding: '11px 18px',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'Sora, sans-serif',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
}
