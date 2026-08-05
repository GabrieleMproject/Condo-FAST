// src/pages/RegisterPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ nome: '', cognome: '', email: '', confermaEmail: '', password: '' });
  const [dpaAccepted, setDpaAccepted] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!tosAccepted || !dpaAccepted) {
      setError('Devi accettare i Termini, la Privacy e il DPA per continuare.');
      return;
    }
    if (form.email !== form.confermaEmail) {
      setError('Gli indirizzi email non corrispondono.');
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

            {/* Conferma Email */}
            <div className="field-group">
              <label htmlFor="confermaEmail">Conferma Email</label>
              <div className="input-wrapper">
                <Mail size={16} className="input-icon" />
                <input
                  id="confermaEmail"
                  name="confermaEmail"
                  type="email"
                  placeholder="Conferma la tua email"
                  value={form.confermaEmail}
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

            {/* DPA Checkbox Box */}
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
                  checked={dpaAccepted}
                  onChange={e => setDpaAccepted(e.target.checked)}
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
                  Accetto il{' '}
                  <a href="/dpa.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                    Contratto di Trattamento Dati (DPA)
                  </a>{' '}
                  ex art. 28 GDPR. Dichiaro di agire quale Titolare del trattamento per i dati gestiti.
                </span>
              </label>
            </div>

            {/* Termini & Privacy Checkbox Box */}
            <div style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '0.95rem 1.1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  onChange={e => setTosAccepted(e.target.checked)}
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
                  </a>
                  {' '}e la{' '}
                  <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                    Privacy Policy
                  </a>
                  {' '}di CondoFAST.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !dpaAccepted || !tosAccepted}
              className="btn-primary"
              style={{
                background: (dpaAccepted && tosAccepted) ? 'var(--accent)' : 'var(--border)',
                cursor: (dpaAccepted && tosAccepted && !loading) ? 'pointer' : 'not-allowed',
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