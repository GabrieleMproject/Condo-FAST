
// src/pages/RegisterPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import BrandLogo from '../components/BrandLogo';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ nome: '', cognome: '', email: '', password: '' });
  const [dpaAccepted, setDpaAccepted] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--app-bg)' }}>
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <BrandLogo size={40} variant="login" interactive={true} />
          <p className="text-slate-400 mt-2 text-sm">30 giorni gratuiti — nessuna carta richiesta</p>
        </div>

        <div className="rounded-xl p-8" style={{ background: 'var(--card-bg)' }}>
          <h2 className="text-white font-semibold text-lg mb-6">Crea account</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm"
              style={{ background: '#7f1d1d', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-sm mb-1">Nome</label>
                <input
                  name="nome" value={form.nome} onChange={handleChange} required
                  className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                  style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Cognome</label>
                <input
                  name="cognome" value={form.cognome} onChange={handleChange} required
                  className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                  style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-sm mb-1">Email</label>
              <input
                name="email" type="email" value={form.email} onChange={handleChange} required
                className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)' }}
              />
            </div>

            <div>
              <label className="block text-slate-400 text-sm mb-1">Password</label>
              <input
                name="password" type="password" value={form.password} onChange={handleChange}
                required minLength={8}
                className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)' }}
              />
              <p className="text-slate-500 text-xs mt-1">Minimo 8 caratteri</p>
            </div>

            {/* ── DPA Checkbox ── */}
            <div className="rounded-lg p-4" style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)' }}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dpaAccepted}
                  onChange={e => setDpaAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-blue-600 flex-shrink-0"
                />
                <span className="text-slate-300 text-sm leading-relaxed">
                  Ho letto e accetto il{' '}
                  <a href="/dpa.html" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                    Contratto di Trattamento Dati (DPA)
                  </a>{' '}
                  ai sensi dell'art. 28 GDPR. Confermo di essere l'amministratore condominiale
                  responsabile del trattamento dei dati dei condomini gestiti tramite CondoSmart.
                </span>
              </label>
              {!dpaAccepted && (
                <p className="text-slate-500 text-xs mt-2 ml-7">
                  Obbligatorio per utilizzare il servizio
                </p>
              )}
            </div>

            {/* ── Termini & Privacy Checkbox ── */}
            <div className="rounded-lg p-4" style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)' }}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  onChange={e => setTosAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-blue-600 flex-shrink-0"
                />
                <span className="text-slate-300 text-sm leading-relaxed">
                  Ho letto e accetto i{' '}
                  <a href="/termini.html" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                    Termini di Servizio
                  </a>
                  {' '}e la{' '}
                  <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                    Privacy Policy
                  </a>.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !dpaAccepted || !tosAccepted}
              className="w-full py-2.5 rounded-lg text-white font-medium text-sm transition-opacity"
              style={{
                background: (dpaAccepted && tosAccepted) ? '#2563eb' : 'var(--border-color)',
                cursor: (dpaAccepted && tosAccepted) ? 'pointer' : 'not-allowed',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Registrazione in corso...' : 'Crea account gratuito'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-6">
            Hai già un account?{' '}
            <Link to="/login" style={{ color: '#2563eb' }} className="hover:underline">
              Accedi
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}