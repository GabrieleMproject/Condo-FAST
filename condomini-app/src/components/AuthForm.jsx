import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, Building, LogIn, KeyRound, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

export default function AuthForm({ onLoginDemo }) {
  const [tab, setTab] = useState('rapido'); // 'rapido' | 'email'
  const [isRegistrazione, setIsRegistrazione] = useState(false);

  // Form Rapido
  const [codiceCondominio, setCodiceCondominio] = useState('');
  const [codiceFiscale, setCodiceFiscale] = useState('');

  // Form Email
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleAccessoRapido = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!codiceCondominio.trim() || !codiceFiscale.trim()) {
        throw new Error('Inserisci sia il Codice Condominio che il tuo Codice Fiscale');
      }

      // 1. Prova chiamata RPC Supabase
      const { data, error: rpcErr } = await supabase.rpc('match_condomino_app', {
        p_codice_app: codiceCondominio.trim().toUpperCase(),
        p_codice_fiscale: codiceFiscale.trim().toUpperCase()
      });

      if (rpcErr) {
        // Se non trova corrispondenza sul DB remoto o se è demo
        if (codiceCondominio.toUpperCase().includes('DEMO') || codiceCondominio.toUpperCase().includes('ROSE')) {
          onLoginDemo?.();
          return;
        }
        throw new Error(rpcErr.message || 'Codice Condominio o Codice Fiscale non riconosciuto');
      }

      if (data && data.success) {
        setSuccess(`Benvenuto ${data.nome} ${data.cognome}!`);
        localStorage.setItem('condomino_session_profile', JSON.stringify({
          persona_id: data.persona_id,
          condominio_id: data.condominio_id,
          condominio_nome: data.condominio_nome,
          nome: data.nome,
          cognome: data.cognome,
          codice_fiscale: codiceFiscale.trim().toUpperCase(),
          codice_app: codiceCondominio.trim().toUpperCase()
        }));
        setTimeout(() => {
          onLoginDemo?.({
            user: {
              email: `${data.persona_id}@condofast.local`,
              profile: data
            }
          });
        }, 800);
      } else {
        throw new Error(data?.error || 'Nessuna anagrafica trovata per questo Codice Fiscale nel condominio specificato.');
      }
    } catch (err) {
      if (codiceCondominio.toUpperCase() === 'ROSE26' || codiceFiscale.toUpperCase().startsWith('RSS')) {
        localStorage.setItem('condomino_session_profile', JSON.stringify({
          persona_id: 'demo-persona-1',
          condominio_id: 'demo-condo-1',
          nome: 'Marco',
          cognome: 'Rossi',
          isDemo: true
        }));
        onLoginDemo?.();
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegistrazione) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setSuccess('Registrazione effettuata! Controlla la tua email per confermare l\'account.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err.message || 'Errore durante l\'autenticazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Glow Sfondi */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full mx-auto relative z-10">
        {/* Brand & Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 mb-3">
            <Building className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">CondoFAST</h1>
          <p className="text-slate-400 text-sm mt-1">Area Riservata Condòmini</p>
        </div>

        {/* Card Box */}
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 shadow-2xl">
          {/* Switch Tab */}
          <div className="flex bg-slate-900/60 p-1 rounded-2xl border border-slate-700/50 mb-6">
            <button
              onClick={() => { setTab('rapido'); setError(null); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${tab === 'rapido' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <KeyRound size={14} /> Accesso Rapido (PIN)
            </button>
            <button
              onClick={() => { setTab('email'); setError(null); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${tab === 'email' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Mail size={14} /> Email / Password
            </button>
          </div>

          {error && (
            <div className="bg-red-500/15 border border-red-500/30 text-red-300 p-3.5 rounded-xl text-xs font-medium mb-4 flex items-center gap-2">
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl text-xs font-medium mb-4 flex items-center gap-2">
              <ShieldCheck size={16} />
              <span>{success}</span>
            </div>
          )}

          {tab === 'rapido' ? (
            <form onSubmit={handleAccessoRapido} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Codice Condominio (PIN)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Building size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    value={codiceCondominio}
                    onChange={(e) => setCodiceCondominio(e.target.value.toUpperCase())}
                    placeholder="Es. ROSE26"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 tracking-wider font-mono uppercase"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Fornito dal tuo amministratore o sulla convocazione.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Il tuo Codice Fiscale
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={16}
                    value={codiceFiscale}
                    onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())}
                    placeholder="RSSMRC80A01F205Z"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 tracking-wider font-mono uppercase"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 text-sm mt-6"
              >
                {loading ? 'Verifica in corso...' : (
                  <>
                    <span>Entra nel Tuo Condominio</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 text-sm mt-6"
              >
                {loading ? 'Accesso in corso...' : (isRegistrazione ? 'Registrati' : 'Accedi')}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegistrazione(!isRegistrazione)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  {isRegistrazione ? 'Hai già un account? Accedi' : 'Prima volta? Crea credenziali'}
                </button>
              </div>
            </form>
          )}

          {/* Separatore */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-800 px-3 text-slate-400 font-bold tracking-wider">Oppure</span>
            </div>
          </div>

          {/* Modalità Demo 1-Click */}
          <button
            onClick={() => onLoginDemo?.()}
            className="w-full bg-slate-700/60 hover:bg-slate-700 text-slate-200 border border-slate-600/50 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs"
          >
            <Sparkles size={15} className="text-amber-400" />
            <span>Accedi in Modalità Demo (Test Immediato)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
