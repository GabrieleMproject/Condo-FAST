import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, Building, LogIn, UserPlus } from 'lucide-react';

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codiceFiscale, setCodiceFiscale] = useState('');
  const [codiceApp, setCodiceApp] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [accettaAI, setAccettaAI] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        // Logica di Login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        // Logica di Registrazione (Auto-Matching)
        // 1. Registrazione in auth.users
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (signUpError) throw signUpError;

        // 2. Chiamata alla RPC di Auto-matching
        // Avviene in automatico chiamando match_condomino_cf 
        // per aggiornare la tabella persone associandola al nuovo auth.uid()
        const { data: matchSuccess, error: matchError } = await supabase.rpc('match_condomino_cf', {
          p_codice_fiscale: codiceFiscale,
          p_codice_app: codiceApp
        });

        if (matchError) throw matchError;

        if (!matchSuccess) {
          setError("Registrazione parziale: Non abbiamo trovato nessuna corrispondenza tra il tuo Codice Fiscale e il Codice Condominio fornito. Contatta l'amministratore.");
        } else {
          setSuccess(true);
        }
      }
    } catch (error) {
      setError(error.message || 'Errore durante l\'autenticazione');
    } finally {
      setLoading(false);
    }
  };

  if (success && !isLogin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
          <UserPlus className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Registrazione Completata!</h2>
        <p className="text-gray-600 mb-6">Abbiamo collegato correttamente il tuo profilo al tuo Condominio. Ora puoi accedere.</p>
        <button 
          onClick={() => { setIsLogin(true); setSuccess(false); }}
          className="w-full bg-indigo-600 text-white p-3 rounded-xl font-semibold"
        >
          Vai al Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center h-full p-6 max-w-md mx-auto w-full">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-indigo-600 mb-2">CondoFAST</h1>
        <p className="text-gray-500">Il Portale del Condòmino</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="email"
              required
              className="pl-10 w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="password"
              required
              className="pl-10 w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        {!isLogin && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fiscale</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  className="pl-10 w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none uppercase"
                  placeholder="RSSMRA80A01H501Z"
                  value={codiceFiscale}
                  onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())}
                  maxLength={16}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Codice Condominio</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  className="pl-10 w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none uppercase"
                  placeholder="Es. A4B9F2"
                  value={codiceApp}
                  onChange={(e) => setCodiceApp(e.target.value.toUpperCase())}
                  maxLength={6}
                />
              </div>
            </div>

            <div className="flex items-start space-x-3 mt-4">
              <input
                type="checkbox"
                required
                id="accettaAI"
                checked={accettaAI}
                onChange={(e) => setAccettaAI(e.target.checked)}
                className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="accettaAI" className="text-sm text-gray-600 leading-tight">
                Ho compreso che l'amministratore potrebbe utilizzare sistemi di <strong>Intelligenza Artificiale</strong> (conformi all'AI Act UE 2024/1689) per elaborare i documenti e le richieste in modo automatizzato.
              </label>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold mt-6 flex items-center justify-center space-x-2 active:bg-indigo-700 transition-colors"
        >
          {isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
          <span>{loading ? 'Caricamento...' : (isLogin ? 'Accedi' : 'Registrati')}</span>
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={() => { setIsLogin(!isLogin); setError(null); }}
          className="text-indigo-600 font-medium hover:underline text-sm"
        >
          {isLogin ? 'Non hai un account? Registrati con Codice Condominio' : 'Hai già un account? Accedi'}
        </button>
      </div>
    </div>
  );
}
