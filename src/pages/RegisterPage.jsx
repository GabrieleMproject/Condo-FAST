import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Building2, Mail, Lock, Eye, EyeOff, User, ArrowRight } from 'lucide-react'

export default function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ nome: '', cognome: '', email: '', password: '', confirm: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      toast.error('Le password non coincidono')
      return
    }
    if (form.password.length < 8) {
      toast.error('La password deve essere di almeno 8 caratteri')
      return
    }
    setLoading(true)
    const { error } = await signUp(form.email, form.password, {
      nome: form.nome,
      cognome: form.cognome,
      full_name: `${form.nome} ${form.cognome}`,
    })
    setLoading(false)
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('Questa email è già registrata')
      } else {
        toast.error(error.message)
      }
      return
    }
    toast.success('Registrazione completata! Controlla la tua email per confermare l\'account.')
    navigate('/login')
  }

  return (
    <div className="auth-layout">
      <div className="auth-brand">
        <div className="brand-content">
          <div className="brand-logo">
            <Building2 size={32} />
            <span>CondoAI</span>
          </div>
          <h1 className="brand-headline">
            Inizia oggi.<br />
            Gratis per 14 giorni.
          </h1>
          <p className="brand-sub">
            Setup in 5 minuti. Nessuna carta di credito richiesta per la prova gratuita.
            Poi solo 199€/mese tutto incluso.
          </p>
          <div className="brand-pricing">
            <div className="pricing-badge">
              <span className="pricing-amount">199€</span>
              <span className="pricing-period">/mese</span>
            </div>
            <p>Tutto incluso. Nessun costo nascosto.</p>
          </div>
        </div>
        <div className="brand-bg-shape" />
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-wrapper">
          <div className="form-header">
            <h2>Crea il tuo account</h2>
            <p>Inizia la prova gratuita di 14 giorni</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field-row">
              <div className="field-group">
                <label htmlFor="nome">Nome</label>
                <div className="input-wrapper">
                  <User size={16} className="input-icon" />
                  <input id="nome" type="text" placeholder="Mario" value={form.nome} onChange={set('nome')} required />
                </div>
              </div>
              <div className="field-group">
                <label htmlFor="cognome">Cognome</label>
                <div className="input-wrapper">
                  <User size={16} className="input-icon" />
                  <input id="cognome" type="text" placeholder="Rossi" value={form.cognome} onChange={set('cognome')} required />
                </div>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="email">Email professionale</label>
              <div className="input-wrapper">
                <Mail size={16} className="input-icon" />
                <input id="email" type="email" placeholder="mario@studiocondominiale.it" value={form.email} onChange={set('email')} required />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Minimo 8 caratteri"
                  value={form.password}
                  onChange={set('password')}
                  required
                />
                <button type="button" className="pwd-toggle" onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="confirm">Conferma password</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  id="confirm"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Ripeti la password"
                  value={form.confirm}
                  onChange={set('confirm')}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="btn-spinner" /> : <>Crea account <ArrowRight size={16} /></>}
            </button>

            <p className="terms-note">
              Registrandoti accetti i nostri <a href="#">Termini di servizio</a> e la <a href="#">Privacy Policy</a>.
            </p>
          </form>

          <p className="auth-switch">
            Hai già un account? <Link to="/login">Accedi</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
