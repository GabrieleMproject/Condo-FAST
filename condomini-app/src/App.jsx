import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, CreditCard, FileText, Users } from 'lucide-react';
import { supabase } from './lib/supabase';
import AuthForm from './components/AuthForm';
import PagamentiPage from './components/PagamentiPage';
import HomePage from './components/HomePage';
import DocumentiPage from './components/DocumentiPage';
import AssembleePage from './components/AssembleePage';

function Layout({ children }) {
  const location = useLocation();
  
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <main className="flex-1 overflow-y-auto pb-16">
        {children}
      </main>
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-3 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40">
        <Link to="/" className={`flex flex-col items-center p-1 ${location.pathname === '/' ? 'text-indigo-600' : 'text-gray-400'}`}>
          <Home className={`w-6 h-6 ${location.pathname === '/' ? 'fill-indigo-100' : ''}`} />
          <span className="text-[10px] mt-1 font-medium">Home</span>
        </Link>
        <Link to="/pagamenti" className={`flex flex-col items-center p-1 ${location.pathname === '/pagamenti' ? 'text-indigo-600' : 'text-gray-400'}`}>
          <CreditCard className={`w-6 h-6 ${location.pathname === '/pagamenti' ? 'fill-indigo-100' : ''}`} />
          <span className="text-[10px] mt-1 font-medium">Pagamenti</span>
        </Link>
        <Link to="/assemblee" className={`flex flex-col items-center p-1 ${location.pathname === '/assemblee' ? 'text-indigo-600' : 'text-gray-400'}`}>
          <Users className={`w-6 h-6 ${location.pathname === '/assemblee' ? 'fill-indigo-100' : ''}`} />
          <span className="text-[10px] mt-1 font-medium">Assemblee</span>
        </Link>
        <Link to="/documenti" className={`flex flex-col items-center p-1 ${location.pathname === '/documenti' ? 'text-indigo-600' : 'text-gray-400'}`}>
          <FileText className={`w-6 h-6 ${location.pathname === '/documenti' ? 'fill-indigo-100' : ''}`} />
          <span className="text-[10px] mt-1 font-medium">Documenti</span>
        </Link>
      </nav>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50 text-indigo-600 font-bold">Caricamento...</div>;

  if (!session) {
    return (
      <div className="relative h-screen bg-white">
        <AuthForm />
        <div className="absolute bottom-10 w-full text-center">
          <button 
            onClick={() => setSession({ user: { email: 'demo@condofast.it' }})}
            className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-bold active:scale-95 transition-transform"
          >
            Entra in modalità Demo (Salta Login)
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <Router>
      <Layout>
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
