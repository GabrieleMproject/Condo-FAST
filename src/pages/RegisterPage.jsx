// src/pages/RegisterPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';

export default function RegisterPage() {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ nome: '', cognome: '', email: '', password: '' });
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleChange = e =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleGoogleSignUp = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const { error: googleError } = await signInWithGoogle();
      if (googleError) throw googleError;
    } catch (err) {
      setError(err.message || 'Errore durante la registrazione con Google.');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!legalAccepted) {
      setError('Devi accettare i Termini di Servizio, la Privacy Policy e il DPA per continuare.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const referralCode = searchParams.get('ref');

      let clientIp = null;
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        clientIp = ipData.ip;
      } catch { /* non bloccante */ }

      const { error: signUpError } = await signUp(
        form.email,
        form.password,
        { 
          nome: form.nome, 
          cognome: form.cognome,
          ref: referralCode || undefined,
          dpa_accepted_at: new Date().toISOString(),
          dpa_ip: clientIp
        }
      );
      if (signUpError) throw signUpError;

      navigate('/login?registered=1');
    } catch (err) {
      setError(err.message || 'Errore durante la registrazione.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      {/* Left panel — branding (identico a LoginPage) */}
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
            La piattaforma intelligente per amministratori condominiali professionisti.
            Crea il tuo account oggi e prova tutte le funzionalità di CondoFAST gratuitamente.
          </p>
          <div className="brand-features">
            {[
              'Prova gratuita di 14 giorni senza impegno',
              'Lettura ed estrazione AI da fatture ed estratti conto',
              'Solleciti rate e rendiconti A→E (art. 1130-bis c.c.)',
              'DPA ed accordo trattamento dati GDPR inclusi'
            ].map(f => (
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
        <div className="auth-form-wrapper" style={{ maxWidth: 460 }}>
          <div className="form-header">
            <h2>Crea il tuo account</h2>
            <p>Prova CondoFAST gratis e semplifica il tuo studio</p>
          </div>

          {error && (
            <div className="error-banner" style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius)',
              color: '#f87171',
              padding: '0.85rem 1rem',
              fontSize: '0.85rem',
              marginBottom: '1.2rem',
              lineHeight: 1.5
            }}>
              {error}
            </div>
          )}

          {/* Google Sign-Up Button */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={googleLoading || loading}
            className="btn-google"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              width: '100%',
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius)',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: '0.92rem',
              fontWeight: 600,
              cursor: (googleLoading || loading) ? 'wait' : 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '1.2rem'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            {googleLoading ? 'Accesso con Google...' : 'Registrati con Google'}
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            margin: '1.2rem 0',
            color: 'var(--text-3)',
            fontSize: '0.8rem'
          }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span>oppure con email</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            
            {/* Nome e Cognome */}
            <div className="field-row">
              <div className="field-group">
                <label htmlFor="nome">Nome</label>
                <div className="input-wrapper">
                  <User size={16} className="input-icon" />
                  <input
                    id="nome"
                    name="nome"
                    type="text"
                    placeholder="Mario"
                    value={form.nome}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="cognome">Cognome</label>
                <div className="input-wrapper">
                  <User size={16} className="input-icon" />
                  <input
                    id="cognome"
                    name="cognome"
                    type="text"
                    placeholder="Rossi"
                    value={form.cognome}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="field-group">
              <label htmlFor="email">Email Studio</label>
              <div className="input-wrapper">
                <Mail size={16} className="input-icon" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="mario.rossi@studio.it"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="field-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  id="password"
                  name="password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={8}
                />
                <button type="button" className="pwd-toggle" onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p style={{ color: 'var(--text-3)', fontSize: '0.75rem', marginTop: 2 }}>Minimo 8 caratteri</p>
            </div>

            {/* Consenso Legale Unificato: Termini, Privacy e DPA */}
            <div style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '0.95rem 1.1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              marginTop: '0.5rem'
            }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={legalAccepted}
                  onChange={e => setLegalAccepted(e.target.checked)}
                  style={{
                    marginTop: '0.2rem',
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    accentColor: 'var(--accent)',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                />
                <span style={{ color: 'var(--text-2)', fontSize: '0.82rem', lineHeight: '1.45', fontWeight: 400 }}>
                  Accetto i{' '}
                  <a href="/termini.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                    Termini di Servizio
                  </a>, la{' '}
                  <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                    Privacy Policy
                  </a>{' '}
                  e il{' '}
                  <a href="/dpa.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                    Contratto DPA ex art. 28 GDPR
                  </a>.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !legalAccepted}
              className="btn-primary"
              style={{
                background: legalAccepted ? 'var(--accent)' : 'var(--border)',
                cursor: (legalAccepted && !loading) ? 'pointer' : 'not-allowed',
                marginTop: '0.8rem',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? <span className="btn-spinner" /> : <>Registrati gratis <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="auth-switch">
            Hai già un account?{' '}
            <Link to="/login">Accedi</Link>
          </p>
        </div>
      </div>
    </div>
  );
}