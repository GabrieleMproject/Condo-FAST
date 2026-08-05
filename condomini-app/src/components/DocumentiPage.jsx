import React, { useState } from 'react';
import { FileText, Download, File, FolderOpen, ShieldCheck, PieChart, Info, X } from 'lucide-react';
import { useCondominoDati } from '../hooks/useCondominoDati';
import { supabase } from '../lib/supabase';

export default function DocumentiPage() {
  const { documenti, loading, error } = useCondominoDati();
  const [categoriaAttiva, setCategoriaAttiva] = useState('Tutti');
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  if (loading) {
    return <div className="min-h-full bg-gray-50 flex items-center justify-center p-8 text-indigo-600 font-bold">Caricamento documenti...</div>;
  }
  
  if (error) {
    return <div className="min-h-full bg-gray-50 flex items-center justify-center p-8 text-red-600">Errore: {error}</div>;
  }

  // Categorie dinamiche
  const typeMapping = {
    'bilancio': 'Bilanci',
    'preventivo': 'Bilanci',
    'fattura': 'Fatture',
    'verbale': 'Verbali',
    'assicurazione': 'Assicurazione',
    'regolamento': 'Regolamento',
    'altro': 'Altro'
  };

  const documentiMappati = (documenti || []).map(d => ({
    ...d,
    categoria: typeMapping[d.tipo] || 'Altro'
  }));

  const categorie = ['Tutti', 'Verbali', 'Bilanci', 'Regolamento', 'Assicurazione', 'Altro'];

  const docFiltrati = categoriaAttiva === 'Tutti' 
    ? documentiMappati 
    : documentiMappati.filter(d => d.categoria === categoriaAttiva);

  const handleOpenPdf = async (doc) => {
    if (!doc.pdf_url) return;
    setLoadingPdf(true);
    try {
      const { data, error } = await supabase.storage.from('documenti').createSignedUrl(doc.pdf_url, 60 * 60); // 1 ora
      if (error) throw error;
      if (data?.signedUrl) {
        setPdfUrl(data.signedUrl);
      }
    } catch (err) {
      console.error('Errore durante l\'apertura del PDF', err);
      alert('Non è stato possibile aprire il documento. Riprova più tardi.');
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleDownload = async (e, doc) => {
    e.stopPropagation(); // Prevenire apertura visualizzatore
    if (!doc.pdf_url) return;
    setLoadingPdf(true);
    try {
      const { data, error } = await supabase.storage.from('documenti').download(doc.pdf_url);
      if (error) throw error;
      
      const blobUrl = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = doc.nome || 'documento.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Errore durante il download del PDF', err);
      alert('Errore durante il download del documento. Riprova.');
    } finally {
      setLoadingPdf(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50 pb-20 relative">
      {/* Header */}
      <div className="bg-indigo-600 pt-12 pb-8 px-6 text-white relative">
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight">Bacheca Documenti</h1>
          <p className="text-indigo-100 mt-1 font-medium text-sm">Tutta la documentazione a portata di mano</p>
        </div>
      </div>

      {/* Tabs Orizzontali Scorrevole */}
      <div className="px-4 -mt-4 relative z-20 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 overflow-x-auto no-scrollbar flex space-x-2">
          {categorie.map(cat => (
            <button 
              key={cat}
              onClick={() => setCategoriaAttiva(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors
                ${categoriaAttiva === cat ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Lista Documenti */}
      <div className="px-4 space-y-3">
        {docFiltrati.map(doc => (
          <div 
            key={doc.id} 
            onClick={() => handleOpenPdf(doc)}
            className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-50 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center flex-1 mr-4 overflow-hidden">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 mr-4">
                {doc.categoria === 'Verbali' ? <FileText size={20} /> : 
                 doc.categoria === 'Bilanci' ? <PieChart size={20} /> :
                 doc.categoria === 'Assicurazione' ? <ShieldCheck size={20} /> :
                 <File size={20} />}
              </div>
              <div className="overflow-hidden">
                <h3 className="font-bold text-gray-900 text-sm truncate">{doc.nome}</h3>
                <div className="flex items-center text-xs text-gray-500 mt-1">
                  <span>{doc.categoria}</span>
                  {doc.data_documento && (
                    <>
                      <span className="mx-2">•</span>
                      <span>{new Date(doc.data_documento).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <button 
              onClick={(e) => handleDownload(e, doc)}
              className="w-10 h-10 bg-gray-50 text-gray-600 rounded-full flex items-center justify-center shrink-0 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            >
              <Download size={18} />
            </button>
          </div>
        ))}
      </div>

      {docFiltrati.length === 0 && (
        <div className="text-center py-16 px-4">
          <FolderOpen size={48} className="mx-auto text-gray-300 mb-4" strokeWidth={1} />
          <p className="text-gray-500 font-medium">Nessun documento in questa categoria.</p>
        </div>
      )}

      {loadingPdf && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex justify-center items-center">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p className="font-bold text-gray-900">Caricamento documento...</p>
          </div>
        </div>
      )}

      {/* PDF Viewer Full Screen Modal */}
      {pdfUrl && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in duration-200">
          <div className="flex justify-between items-center p-4 bg-gray-900 text-white">
            <h2 className="font-bold text-sm truncate pr-4">Visualizzatore Documento</h2>
            <button 
              onClick={() => setPdfUrl(null)}
              className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors shrink-0"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 w-full bg-gray-100">
            <iframe 
              src={`${pdfUrl}#toolbar=0`} 
              title="PDF Viewer"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
