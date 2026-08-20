import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import toast from 'react-hot-toast'
import { Lock, Eye, EyeOff, ArrowRight, Check, AlertTriangle, ArrowLeft } from 'lucide-react'
import BrandLogo from '../components/BrandLogo'

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isValidToken, setIsValidToken] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    // Verifica se l'utente è arrivato con una sessione di recupero valida
    const checkRecoverySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        // Verifica se l'URL contiene parametri di errore da Supabase
        const hash = window.location.hash
        if (hash.includes('error=') || hash.includes('error_code=')) {
          setIsValidToken(false)
        } else if (!session) {
          // Se non c'è sessione e non c'è hash di auth, il token potrebbe non essere valido
          // Attendiamo brevemente l'evento onAuthStateChange in caso di parsing asincrono
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
            if (event === 'PASSWORD_RECOVERY' || s) {
              setIsValidToken(true)
            }
          })
          setTimeout(() => {
            subscription.unsubscribe()
            setCheckingAuth(false)
          }, 1000)
          return
        }
      } catch (err) {
        console.error('Errore verifica sessione recupero:', err)
      } finally {
        setCheckingAuth(false)
      }
    }

    checkRecoverySession()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (password.length < 8) {
      toast.error('La password deve contenere almeno 8 caratteri')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Le password non coincidono')
      return
    }

    setLoading(true)
    try {
      const { error } = await updatePassword(password)
      if (error) throw error

      setSuccess(true)
      toast.success('Password aggiornata con successo!')
    } catch (err) {
      console.error('Errore aggiornamento password:', err)
      toast.error(err.message || 'Errore durante l\'aggiornamento della password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout auth-layout--centered">
      <div className="auth-form-panel auth-form-panel--full">
        <div className="auth-form-wrapper">
          <div className="brand-logo brand-logo--dark">
            <BrandLogo size={36} variant="login" interactive={true} />
          </div>

          {checkingAuth ? (
            <div className="text-center py-12">
              <div className="btn-spinner" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Verifica del link di sicurezza in corso...</p>
            </div>
          ) : !isValidToken ? (
            <div className="success-state" style={{ textAlign: 'center' }}>
              <div 
                className="success-icon" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444'
                }}
              >
                <AlertTriangle size={32} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: '16px 0 8px' }}>Link scaduto o non valido</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
                Il link per reimpostare la password è scaduto o è già stato utilizzato. Richiedine uno nuovo per procedere.
              </p>
              <Link to="/forgot-password" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                Richiedi nuovo link <ArrowRight size={16} />
              </Link>
            </div>
          ) : success ? (
            <div className="success-state" style={{ textAlign: 'center' }}>
              <div 
                className="success-icon" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981'
                }}
              >
                <Check size={32} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: '16px 0 8px' }}>Password aggiornata!</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
                La tua password è stata modificata correttamente. Ora puoi accedere con le nuove credenziali.
              </p>
              <Link to="/dashboard" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                Vai alla Dashboard <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <>
              <div className="form-header">
                <h2>Crea Nuova Password</h2>
                <p>Inserisci una nuova password sicura per il tuo account.</p>
              </div>

              <form onSubmit={handleSubmit} className="auth-form">
                <div className="field-group">
                  <label htmlFor="password">Nuova Password</label>
                  <div className="input-wrapper">
                    <Lock size={16} className="input-icon" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimo 8 caratteri"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="pwd-toggle"
                      onClick={() => setShowPassword(prev => !prev)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="field-group">
                  <label htmlFor="confirmPassword">Conferma Nuova Password</label>
                  <div className="input-wrapper">
                    <Lock size={16} className="input-icon" />
                    <input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Ripeti la nuova password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="pwd-toggle"
                      onClick={() => setShowConfirm(prev => !prev)}
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
                  {loading ? (
                    <span className="btn-spinner" />
                  ) : (
                    <>
                      Aggiorna Password <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              <p className="auth-switch" style={{ marginTop: 24, textAlign: 'center' }}>
                <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                  <ArrowLeft size={14} /> Torna al login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
