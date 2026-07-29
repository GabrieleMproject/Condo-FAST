// src/pages/RicercaPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
  Search,
  Clock,
  Trash2,
  Building2,
  Users,
  Receipt,
  FileText,
  Send,
  ArrowRight,
  X,
  Filter,
  CheckCircle2,
  Sparkles,
  Home,
  Tag
} from 'lucide-react';

const STORAGE_KEY = 'condosmart_search_history';
const MAX_HISTORY = 15;

export default function RicercaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState('tutti');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const [results, setResults] = useState({
    condomini: [],
    persone: [],
    unita: [],
    spese: [],
    documenti: [],
    comunicazioni: [],
  });

  const inputRef = useRef(null);
  const navigate = useNavigate();

  // ── Carica Cronologia ──────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Errore lettura cronologia ricerche:', e);
    }
  }, []);

  // ── Salva in Cronologia ────────────────────────────────────────────────────
  const salvaInCronologia = useCallback((term) => {
    const trimmed = term.trim();
    if (!trimmed || trimmed.length < 2) return;

    setHistory((prev) => {
      const filtered = prev.filter((item) => item.term.toLowerCase() !== trimmed.toLowerCase());
      const updated = [{ id: Date.now(), term: trimmed, timestamp: new Date().toISOString() }, ...filtered].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Errore salvataggio cronologia:', e);
      }
      return updated;
    });
  }, []);

  // ── Rimuovi Singolo Elemento Cronologia ────────────────────────────────────
  const rimuoviDaCronologia = (id, e) => {
    e.stopPropagation();
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Errore rimozione cronologia:', err);
      }
      return updated;
    });
  };

  // ── Svuota Intera Cronologia ───────────────────────────────────────────────
  const svuotaCronologia = () => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Errore pulizia cronologia:', e);
    }
  };

  // ── Esegui Ricerca Su Supabase ─────────────────────────────────────────────
  const eseguiRicerca = useCallback(async (searchTerm) => {
    const term = searchTerm.trim();
    if (!term || term.length < 2) {
      setResults({
        condomini: [],
        persone: [],
        unita: [],
        spese: [],
        documenti: [],
        comunicazioni: [],
      });
      return;
    }

    setLoading(true);
    const pattern = `%${term}%`;

    try {
      // Query in parallelo su Supabase
      const [
        resCondomini,
        resPersone,
        resUnita,
        resSpese,
        resDoc,
        resCom
      ] = await Promise.all([
        // 1. Condomini
        supabase
          .from('condomini')
          .select('id, nome, indirizzo, codice_fiscale, comune')
          .or(`nome.ilike.${pattern},indirizzo.ilike.${pattern},codice_fiscale.ilike.${pattern},comune.ilike.${pattern}`)
          .limit(10),

        // 2. Persone (Anagrafica)
        supabase
          .from('persone')
          .select(`
            id, nome, cognome, codice_fiscale, email, telefono,
            occupanti_unita (
              id, ruolo, attivo,
              unita (id, numero, tipo, scala, piano, condominio_id, condomini (id, nome))
            )
          `)
          .or(`nome.ilike.${pattern},cognome.ilike.${pattern},codice_fiscale.ilike.${pattern},email.ilike.${pattern},telefono.ilike.${pattern}`)
          .limit(10),

        // 3. Unità immobiliari
        supabase
          .from('unita')
          .select('id, numero, scala, piano, mq, tipo, catasto_foglio, catasto_particella, catasto_subalterno, condominio_id, condomini(id, nome)')
          .or(`numero.ilike.${pattern},scala.ilike.${pattern},catasto_particella.ilike.${pattern},catasto_subalterno.ilike.${pattern}`)
          .limit(10),

        // 4. Spese & Fatture
        supabase
          .from('spese')
          .select('id, descrizione, fornitore, note, importo, data_spesa, criterio, condominio_id, condomini(id, nome)')
          .or(`descrizione.ilike.${pattern},fornitore.ilike.${pattern},note.ilike.${pattern},criterio.ilike.${pattern}`)
          .order('data_spesa', { ascending: false })
          .limit(10),

        // 5. Documenti & Verbali
        supabase
          .from('documenti_condominio')
          .select('id, nome, note, tipo, data_documento, condominio_id, condomini(id, nome)')
          .or(`nome.ilike.${pattern},note.ilike.${pattern},tipo.ilike.${pattern}`)
          .order('created_at', { ascending: false })
          .limit(10),

        // 6. Comunicazioni
        supabase
          .from('comunicazioni')
          .select('id, oggetto, testo, destinatario_email, destinatario_nome, stato, created_at, condominio_id, condomini(id, nome)')
          .or(`oggetto.ilike.${pattern},testo.ilike.${pattern},destinatario_email.ilike.${pattern},destinatario_nome.ilike.${pattern}`)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      setResults({
        condomini: resCondomini.data || [],
        persone: resPersone.data || [],
        unita: resUnita.data || [],
        spese: resSpese.data || [],
        documenti: resDoc.data || [],
        comunicazioni: resCom.data || [],
      });

      salvaInCronologia(term);
    } catch (err) {
      console.error('Errore durante la ricerca:', err);
    } finally {
      setLoading(false);
    }
  }, [salvaInCronologia]);

  // Sync URL e ricerca al caricamento o cambio query
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      eseguiRicerca(initialQuery);
    }
  }, [initialQuery, eseguiRicerca]);

  // Debounced search per digitazione continua
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        setSearchParams({ q: query }, { replace: true });
        eseguiRicerca(query);
      } else if (query.trim().length === 0) {
        setSearchParams({}, { replace: true });
        setResults({
          condomini: [],
          persone: [],
          unita: [],
          spese: [],
          documenti: [],
          comunicazioni: [],
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, setSearchParams, eseguiRicerca]);

  const handleSelectHistory = (term) => {
    setQuery(term);
    setSearchParams({ q: term });
    eseguiRicerca(term);
    setIsInputFocused(false);
  };

  const totalResults =
    results.condomini.length +
    results.persone.length +
    results.unita.length +
    results.spese.length +
    results.documenti.length +
    results.comunicazioni.length;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* ── Testata ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
          <Search size={26} style={{ color: 'var(--accent, #2563eb)' }} />
          Ricerca Rapida Globale
        </h1>
        <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
          Cerca istantaneamente condomini, persone, unità, spese, documenti e comunicazioni nell'intero gestionale.
        </p>
      </div>

      {/* ── Barra di Ricerca Principale ────────────────────────────────────── */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--card-bg)',
            border: '2px solid var(--border-color)',
            borderRadius: 12,
            padding: '12px 16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
            borderColor: isInputFocused ? 'var(--accent, #2563eb)' : 'var(--border-color)',
            transition: 'border-color 0.2s ease',
          }}
        >
          <Search size={22} style={{ color: 'var(--text-secondary)', marginRight: 12, flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
            placeholder="Cerca condomino, via, codice fiscale, fornitore, spesa, verbale, email..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 16,
              color: 'var(--text-primary)',
            }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setSearchParams({});
                if (inputRef.current) inputRef.current.focus();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8,
              }}
              title="Cancella testo"
            >
              <X size={18} />
            </button>
          )}
          {loading && (
            <div
              style={{
                width: 18,
                height: 18,
                border: '2px solid var(--border-color)',
                borderTopColor: 'var(--accent, #2563eb)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}
        </div>

        {/* ── Suggerimenti / Cronologia Dropdown quando vuoto o focused ──── */}
        {isInputFocused && history.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 8,
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              zIndex: 50,
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <Clock size={14} /> Cronologia ricerche recenti
              </span>
              <button
                onClick={svuotaCronologia}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Trash2 size={12} /> Svuota storico
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectHistory(item.term)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 20,
                    background: 'var(--app-bg)',
                    border: '1px solid var(--border-color)',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{item.term}</span>
                  <span
                    onClick={(e) => rimuoviDaCronologia(item.id, e)}
                    style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', borderRadius: '50%', padding: 2 }}
                    title="Rimuovi da cronologia"
                  >
                    <X size={12} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Tabs per Categoria ───────────────────────────────────────────── */}
      {query.trim().length >= 2 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 20, borderBottom: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('tutti')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'tutti' ? 'var(--accent, #2563eb)' : 'var(--card-bg)',
              color: activeTab === 'tutti' ? '#ffffff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Tutti i risultati ({totalResults})
          </button>
          <button
            onClick={() => setActiveTab('condomini')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'condomini' ? 'var(--accent, #2563eb)' : 'var(--card-bg)',
              color: activeTab === 'condomini' ? '#ffffff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Building2 size={15} /> Condomini ({results.condomini.length})
          </button>
          <button
            onClick={() => setActiveTab('anagrafica')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'anagrafica' ? 'var(--accent, #2563eb)' : 'var(--card-bg)',
              color: activeTab === 'anagrafica' ? '#ffffff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Users size={15} /> Persone & Unità ({results.persone.length + results.unita.length})
          </button>
          <button
            onClick={() => setActiveTab('spese')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'spese' ? 'var(--accent, #2563eb)' : 'var(--card-bg)',
              color: activeTab === 'spese' ? '#ffffff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Receipt size={15} /> Spese & Fatture ({results.spese.length})
          </button>
          <button
            onClick={() => setActiveTab('documenti')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'documenti' ? 'var(--accent, #2563eb)' : 'var(--card-bg)',
              color: activeTab === 'documenti' ? '#ffffff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FileText size={15} /> Documenti ({results.documenti.length})
          </button>
          <button
            onClick={() => setActiveTab('comunicazioni')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'comunicazioni' ? 'var(--accent, #2563eb)' : 'var(--card-bg)',
              color: activeTab === 'comunicazioni' ? '#ffffff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Send size={15} /> Comunicazioni ({results.comunicazioni.length})
          </button>
        </div>
      )}

      {/* ── Risultati della Ricerca ────────────────────────────────────────── */}
      {query.trim().length >= 2 && (
        <div>
          {totalResults === 0 && !loading && (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                background: 'var(--card-bg)',
                borderRadius: 12,
                border: '1px dashed var(--border-color)',
              }}
            >
              <Search size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                Nessun risultato trovato per "{query}"
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
                Verifica che l'ortografia sia corretta o prova con un termine più generico (es. nome condomino, via o codice fiscale).
              </p>
            </div>
          )}

          {/* 1. SEZIONE CONDOMINI */}
          {(activeTab === 'tutti' || activeTab === 'condomini') && results.condomini.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Building2 size={18} style={{ color: 'var(--accent, #2563eb)' }} /> Condomini ({results.condomini.length})
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {results.condomini.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 10,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{c.nome}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {c.indirizzo} {c.comune ? `- ${c.comune}` : ''}
                      </div>
                      {c.codice_fiscale && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          CF: {c.codice_fiscale}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/condomini/${c.id}`)}
                      style={{
                        alignSelf: 'flex-start',
                        background: 'rgba(37, 99, 235, 0.1)',
                        color: 'var(--accent, #2563eb)',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      Vai al Condominio <ArrowRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. SEZIONE PERSONE & ANAGRAFICA */}
          {(activeTab === 'tutti' || activeTab === 'anagrafica') && (results.persone.length > 0 || results.unita.length > 0) && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Users size={18} style={{ color: 'var(--accent, #2563eb)' }} /> Persone & Unità ({results.persone.length + results.unita.length})
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {/* Schede Persone */}
                {results.persone.map((p) => {
                  const firstOccupante = p.occupanti_unita?.[0];
                  const condoName = firstOccupante?.unita?.condomini?.nome;
                  const condoId = firstOccupante?.unita?.condominio_id;

                  return (
                    <div
                      key={`p-${p.id}`}
                      style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 10,
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {p.cognome} {p.nome}
                          </span>
                          <span style={{ fontSize: 11, background: 'rgba(37, 99, 235, 0.1)', color: 'var(--accent, #2563eb)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                            PERSONA
                          </span>
                        </div>
                        {condoName && (
                          <div style={{ fontSize: 12, color: 'var(--accent, #2563eb)', marginTop: 4, fontWeight: 600 }}>
                            {condoName}
                          </div>
                        )}
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                          {p.email && <div>Email: {p.email}</div>}
                          {p.telefono && <div>Tel: {p.telefono}</div>}
                          {p.codice_fiscale && <div>CF: {p.codice_fiscale}</div>}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (condoId) navigate(`/condomini/${condoId}/anagrafica`);
                          else navigate('/anagrafica');
                        }}
                        style={{
                          alignSelf: 'flex-start',
                          background: 'rgba(37, 99, 235, 0.1)',
                          color: 'var(--accent, #2563eb)',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        Vai all'Anagrafica <ArrowRight size={14} />
                      </button>
                    </div>
                  );
                })}

                {/* Schede Unità */}
                {results.unita.map((u) => (
                  <div
                    key={`u-${u.id}`}
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 10,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                          Unità {u.numero} {u.scala ? `(Scala ${u.scala})` : ''}
                        </span>
                        <span style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                          UNITÀ
                        </span>
                      </div>
                      {u.condomini?.nome && (
                        <div style={{ fontSize: 12, color: 'var(--accent, #2563eb)', marginTop: 4, fontWeight: 600 }}>
                          {u.condomini.nome}
                        </div>
                      )}
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                        {u.piano && <span>Piano: {u.piano} | </span>}
                        {u.mq && <span>Mq: {u.mq}</span>}
                        {(u.catasto_particella || u.catasto_subalterno) && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            Catasto: Part. {u.catasto_particella || '-'} Sub. {u.catasto_subalterno || '-'}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/condomini/${u.condominio_id}/anagrafica`)}
                      style={{
                        alignSelf: 'flex-start',
                        background: 'rgba(37, 99, 235, 0.1)',
                        color: 'var(--accent, #2563eb)',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      Vai all'Unità <ArrowRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. SEZIONE SPESE & FATTURE */}
          {(activeTab === 'tutti' || activeTab === 'spese') && results.spese.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Receipt size={18} style={{ color: 'var(--accent, #2563eb)' }} /> Spese & Fatture ({results.spese.length})
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {results.spese.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 10,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {s.descrizione}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent, #2563eb)' }}>
                          € {Number(s.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {s.condomini?.nome && (
                        <div style={{ fontSize: 12, color: 'var(--accent, #2563eb)', marginTop: 4, fontWeight: 600 }}>
                          {s.condomini.nome}
                        </div>
                      )}
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                        {s.fornitore && <div>Fornitore: {s.fornitore}</div>}
                        {s.data_spesa && <div>Data: {new Date(s.data_spesa).toLocaleDateString('it-IT')}</div>}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/condomini/${s.condominio_id}/spese`)}
                      style={{
                        alignSelf: 'flex-start',
                        background: 'rgba(37, 99, 235, 0.1)',
                        color: 'var(--accent, #2563eb)',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      Vai alla Spesa <ArrowRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. SEZIONE DOCUMENTI & VERBALI */}
          {(activeTab === 'tutti' || activeTab === 'documenti') && results.documenti.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <FileText size={18} style={{ color: 'var(--accent, #2563eb)' }} /> Documenti ({results.documenti.length})
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {results.documenti.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 10,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{d.nome}</div>
                      {d.condomini?.nome && (
                        <div style={{ fontSize: 12, color: 'var(--accent, #2563eb)', marginTop: 4, fontWeight: 600 }}>
                          {d.condomini.nome}
                        </div>
                      )}
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                        {d.tipo && <div>Tipo: {d.tipo}</div>}
                        {d.note && <div>Note: {d.note}</div>}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/condomini/${d.condominio_id}`)}
                      style={{
                        alignSelf: 'flex-start',
                        background: 'rgba(37, 99, 235, 0.1)',
                        color: 'var(--accent, #2563eb)',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      Vai al Documento <ArrowRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. SEZIONE COMUNICAZIONI */}
          {(activeTab === 'tutti' || activeTab === 'comunicazioni') && results.comunicazioni.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Send size={18} style={{ color: 'var(--accent, #2563eb)' }} /> Comunicazioni ({results.comunicazioni.length})
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {results.comunicazioni.map((com) => (
                  <div
                    key={com.id}
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 10,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {com.oggetto || 'Comunicazione senza oggetto'}
                      </div>
                      {com.condomini?.nome && (
                        <div style={{ fontSize: 12, color: 'var(--accent, #2563eb)', marginTop: 4, fontWeight: 600 }}>
                          {com.condomini.nome}
                        </div>
                      )}
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                        {com.destinatario_nome && <div>Destinatario: {com.destinatario_nome}</div>}
                        {com.destinatario_email && <div>Email: {com.destinatario_email}</div>}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/comunicazioni')}
                      style={{
                        alignSelf: 'flex-start',
                        background: 'rgba(37, 99, 235, 0.1)',
                        color: 'var(--accent, #2563eb)',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      Vai a Comunicazioni <ArrowRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
