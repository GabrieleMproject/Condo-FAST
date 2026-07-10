import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Building2, Mail, ArrowLeft, ArrowRight, Check } from 'lucide-react'
import BrandLogo from '../components/BrandLogo'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="auth-layout auth-layout--centered">
      <div className="auth-form-panel auth-form-panel--full">
        <div className="auth-form-wrapper">
          <div className="brand-logo brand-logo--dark">
            <BrandLogo size={36} variant="login" interactive={true} />
          </div>

          {sent ? (
            <div className="success-state">
              <div className="success-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={32} /></div>
              <h2>Email inviata</h2>
              <p>Controlla la tua casella <strong>{email}</strong> e segui le istruzioni per reimpostare la password.</p>
              <Link to="/login" className="btn-primary" style={{ display: 'inline-flex', marginTop: '1.5rem' }}>
                <ArrowLeft size={16} /> Torna al login
              </Link>
            </div>
          ) : (
            <>
              <div className="form-header">
                <h2>Password dimenticata?</h2>
                <p>Inserisci la tua email e ti mandiamo il link per reimpostarla.</p>
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
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? <span className="btn-spinner" /> : <>Invia link <ArrowRight size={16} /></>}
                </button>
              </form>

              <p className="auth-switch">
                <Link to="/login"><ArrowLeft size={14} /> Torna al login</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
