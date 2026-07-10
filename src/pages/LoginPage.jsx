import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Building2, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import BrandLogo from '../components/BrandLogo'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Inserisci email e password')
      return
    }
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      if (error.message.includes('Invalid login')) {
        toast.error('Email o password non corretti')
      } else {
        toast.error(error.message)
      }
      return
    }
    toast.success('Accesso effettuato')
    navigate('/dashboard')
  }

  return (
    <div className="auth-layout">
      {/* Left panel — branding */}
      <div className="auth-brand">
        <div className="brand-content">
          <div className="brand-logo">
            <BrandLogo size={48} variant="login" interactive={true} />
          </div>
          <h1 className="brand-headline">
            Gestisci i tuoi condomini.<br />
            L'automazione fa il resto.
          </h1>
          <p className="brand-sub">
            La piattaforma moderna per amministratori condominiali professionisti.
            Automatizza le comunicazioni, gestisci la contabilità, risolvi le pratiche più veloce.
          </p>
          <div className="brand-features">
            {['Comunicazioni e solleciti automatizzati', 'Contabilità condominiale integrata', 'Gestione fornitori e interventi', 'App per i condòmini inclusa'].map(f => (
              <div key={f} className="feature-item">
                <span className="feature-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>
        <div className="brand-bg-shape" />
      </div>

      {/* Right panel — form */}
      <div className="auth-form-panel">
        <div className="auth-form-wrapper">
          <div className="form-header">
            <h2>Bentornato</h2>
            <p>Accedi al tuo pannello di amministrazione</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field-group">
              <label htmlFor="email">Email</label>
              <div className="input-wrapper">
                <Mail size={16} className="input-icon" />
                <input
                  id="email"
                  type="email"
                  placeholder="nome@studio.it"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="password">
                Password
                <Link to="/forgot-password" className="forgot-link">Dimenticata?</Link>
              </label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button type="button" className="pwd-toggle" onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="btn-spinner" /> : <>Accedi <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="auth-switch">
            Non hai ancora un account?{' '}
            <Link to="/register">Registrati</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
