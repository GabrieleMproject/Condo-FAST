import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, CreditCard, FileText, Users, LogOut, Sparkles } from 'lucide-react';
import { supabase } from './lib/supabase';
import AuthForm from './components/AuthForm';
import PagamentiPage from './components/PagamentiPage';
import HomePage from './components/HomePage';
import DocumentiPage from './components/DocumentiPage';
import AssembleePage from './components/AssembleePage';

function Layout({ children, session, onLogout }) {
  const location = useLocation();
  const isDemo = session?.user?.email === 'demo@condofast.it';
  
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Top Demo Banner / Logout bar */}
      {isDemo && (
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-[11px] font-extrabold flex items-center justify-between shadow-sm z-50">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} />
            <span>MODALITÀ DEMO CONDÒMINO ATTIVA</span>
          </div>
          <button
            onClick={onLogout}
            className="bg-slate-950 text-white px-2.5 py-0.5 rounded-md text-[10px] font-bold hover:bg-slate-800 transition-colors"
          >
            Esci da Demo
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-16">
        {children}
      </main>
      
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 flex justify-around p-2.5 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.04)] z-40">
        <Link
          to="/"
          className={`flex flex-col items-center p-1.5 transition-colors ${location.pathname === '/' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Home className={`w-5 h-5 ${location.pathname === '/' ? 'fill-indigo-50 text-indigo-600' : ''}`} />
          <span className="text-[10px] mt-1">Home</span>
        </Link>
        <Link
          to="/pagamenti"
          className={`flex flex-col items-center p-1.5 transition-colors ${location.pathname === '/pagamenti' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <CreditCard className={`w-5 h-5 ${location.pathname === '/pagamenti' ? 'fill-indigo-50 text-indigo-600' : ''}`} />
          <span className="text-[10px] mt-1">Pagamenti</span>
        </Link>
        <Link
          to="/assemblee"
          className={`flex flex-col items-center p-1.5 transition-colors ${location.pathname === '/assemblee' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Users className={`w-5 h-5 ${location.pathname === '/assemblee' ? 'fill-indigo-50 text-indigo-600' : ''}`} />
          <span className="text-[10px] mt-1">Assemblee</span>
        </Link>
        <Link
          to="/documenti"
          className={`flex flex-col items-center p-1.5 transition-colors ${location.pathname === '/documenti' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <FileText className={`w-5 h-5 ${location.pathname === '/documenti' ? 'fill-indigo-50 text-indigo-600' : ''}`} />
          <span className="text-[10px] mt-1">Documenti</span>
        </Link>
      </nav>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Intercetta eventuale parametro ?delega= nell'URL di invito WhatsApp
    const params = new URLSearchParams(window.location.search);
    const delegaCode = params.get('delega');
    if (delegaCode) {
      sessionStorage.setItem('pending_delega', delegaCode.toUpperCase().trim());
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (session?.user?.email === 'demo@condofast.it') {
      setSession(null);
    } else {
      await supabase.auth.signOut();
      setSession(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-indigo-400 font-bold text-sm">
        Caricamento Portale Condòmino...
      </div>
    );
  }

  if (!session) {
    return (
      <AuthForm onLoginDemo={() => setSession({ user: { email: 'demo@condofast.it' } })} />
    );
  }
  
  return (
    <Router>
      <Layout session={session} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/pagamenti" element={<PagamentiPage />} />
          <Route path="/assemblee" element={<AssembleePage />} />
          <Route path="/documenti" element={<DocumentiPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
