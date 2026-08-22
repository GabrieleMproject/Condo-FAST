import React, { useState } from 'react';
import { useCondominoDati } from '../hooks/useCondominoDati';
import { supabase } from '../lib/supabase';
import {
  FileText, Download, FileSpreadsheet, FileSignature, ShieldAlert,
  Award, Landmark, FolderOpen, ExternalLink, X, Loader2, CheckCircle2
} from 'lucide-react';

export default function DocumentiPage() {
  const { documenti, condominio, loading, error, isDemo } = useCondominoDati();
  const [categoriaAttiva, setCategoriaAttiva] = useState('Tutti');
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [loadingPdf, setLoadingPdf] = useState(false);

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50 flex items-center justify-center p-8 text-indigo-600 font-bold">
        Caricamento documenti...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-slate-50 flex items-center justify-center p-8 text-red-600">
        Errore: {error}
      </div>
    );
  }

  const typeMapping = {
    'regolamento': 'Regolamento',
    'tabella_millesimale_doc': 'Millesimi',
    'verbale': 'Verbali',
    'consuntivo': 'Bilanci',
    'preventivo': 'Bilanci',
    'sinistro': 'Assicurazione',
    'contratto': 'Contratti',
    'certificazione': 'Certificazioni',
    'estratto_conto_archivio': 'Bilanci',
    'altro': 'Altro'
  };

  const documentiMappati = (documenti || []).map(d => ({
    ...d,
    categoria: typeMapping[d.tipo] || 'Altro'
  }));

  const categorie = ['Tutti', 'Verbali', 'Bilanci', 'Regolamento', 'Millesimi', 'Assicurazione', 'Contratti', 'Altro'];

  const docFiltrati = categoriaAttiva === 'Tutti'
    ? documentiMappati
    : documentiMappati.filter(d => d.categoria === categoriaAttiva);

  const renderIcon = (tipo) => {
    switch (tipo) {
      case 'regolamento':
        return <FileText className="text-blue-500" size={22} />;
      case 'tabella_millesimale_doc':
        return <FileSpreadsheet className="text-purple-500" size={22} />;
      case 'verbale':
        return <FileSignature className="text-emerald-500" size={22} />;
      case 'sinistro':
        return <ShieldAlert className="text-red-500" size={22} />;
      case 'certificazione':
        return <Award className="text-cyan-500" size={22} />;
      default:
        return <FileText className="text-indigo-500" size={22} />;
    }
  };

  const handleOpenDoc = async (doc) => {
    if (isDemo || !doc.url_storage) {
      setPdfUrl('demo');
      setPdfTitle(doc.nome);
      return;
    }

    setLoadingPdf(true);
    try {
      const { data, error } = await supabase.storage.from('documenti-condominio').createSignedUrl(doc.url_storage, 60 * 60);
      if (error) throw error;
      if (data?.signedUrl) {
        setPdfUrl(data.signedUrl);
        setPdfTitle(doc.nome);
      }
    } catch (err) {
      console.error('Errore apertura file:', err);
      alert('Non è stato possibile caricare l\'anteprima. Riprova.');
    } finally {
      setLoadingPdf(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 pb-24 relative font-sans">
      {/* Header Esteso */}
      <div className="bg-indigo-600 rounded-b-[2.5rem] pt-12 pb-20 px-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={18} className="text-indigo-200" />
            <span className="text-xs uppercase font-bold tracking-wider text-indigo-200">{condominio?.nome || 'Condominio'}</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Bacheca Documenti</h1>
          <p className="text-indigo-100 text-sm mt-1">Verbali, regolamento, polizza e bilanci pubblicati dallo studio</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="-mt-10 px-4 relative z-20 max-w-lg mx-auto space-y-4">
        {/* Filtri Categoria a Scorrimento */}
        <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-200/80 overflow-x-auto no-scrollbar flex space-x-1.5">
          {categorie.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoriaAttiva(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${categoriaAttiva === cat ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Lista Documenti */}
        <div className="space-y-3">
          {docFiltrati.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-slate-100">
              <FolderOpen size={40} className="text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">Nessun documento trovato</h3>
              <p className="text-xs text-slate-500 mt-1">
                Non sono presenti documenti per la categoria selezionata.
              </p>
            </div>
          ) : (
            docFiltrati.map(doc => (
              <div
                key={doc.id}
                onClick={() => handleOpenDoc(doc)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between gap-3 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all active:scale-99"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    {renderIcon(doc.tipo)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md inline-block mb-1">
                      {doc.categoria}
                    </span>
                    <h4 className="font-bold text-sm text-slate-900 truncate" title={doc.nome}>
                      {doc.nome}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString('it-IT') : ''}
                      {doc.note ? ` • ${doc.note}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDoc(doc);
                    }}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 transition-colors"
                    title="Visualizza documento"
                  >
                    <ExternalLink size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Anteprima PDF / Visualizzatore */}
      {pdfUrl && (
        <div
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setPdfUrl(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">{pdfTitle}</h3>
                  <p className="text-xs text-slate-500">Documento Ufficiale Condominiale</p>
                </div>
              </div>
              <button
                onClick={() => setPdfUrl(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 text-center mb-5">
              <CheckCircle2 size={44} className="text-emerald-500 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800">Documento Convalidato dallo Studio</h4>
              <p className="text-xs text-slate-500 mt-1">
                Questo documento è certificato e archiviato in modo sicuro per il tuo condominio.
              </p>
            </div>

            {pdfUrl !== 'demo' ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all mb-2"
              >
                <Download size={15} />
                <span>Apri e Scarica Documento PDF</span>
              </a>
            ) : (
              <button
                onClick={() => {
                  alert(`Apertura documento demo: "${pdfTitle}". In produzione, scarica il PDF originale da Supabase Storage.`);
                  setPdfUrl(null);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all mb-2"
              >
                <Download size={15} />
                <span>Scarica Documento (Demo)</span>
              </button>
            )}

            <button
              onClick={() => setPdfUrl(null)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-all"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
