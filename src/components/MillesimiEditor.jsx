import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { estraiTabelleMillesimali } from '../lib/fileExtractor';
import { 
  Layers, Plus, Trash2, Save, Upload, Download, Search, 
  AlertCircle, X, Check, Edit2, RotateCcw, Scale, Filter, Clock, Calculator
} from 'lucide-react';
import StoricoOccupantiModal from './StoricoOccupantiModal';
import DiagnosticaAllineamento from './DiagnosticaAllineamento';


const parsePiano = (val) => {
  if (val === undefined || val === null || val === '') return null;
  const str = String(val).trim().toLowerCase();
  if (/\b(?:terra|t|pt|rialzato)\b/.test(str) || str === 't' || str === 'pt') return 0;
  if (/\b(?:seminterrato|s\.?\s*1|s1|interrato)\b/.test(str) || str === '-1' || str === 's1') return -1;
  if (/\b(?:primo|i)\b/.test(str) || str === '1' || str === '1°' || str === '1^') return 1;
  if (/\b(?:secondo|ii)\b/.test(str) || str === '2' || str === '2°' || str === '2^') return 2;
  if (/\b(?:terzo|iii)\b/.test(str) || str === '3' || str === '3°' || str === '3^') return 3;
  if (/\b(?:quarto|iv)\b/.test(str) || str === '4' || str === '4°' || str === '4^') return 4;
  if (/\b(?:quinto|v)\b/.test(str) || str === '5' || str === '5°' || str === '5^') return 5;
  if (/\b(?:sesto|vi)\b/.test(str) || str === '6' || str === '6°' || str === '6^') return 6;
  if (/\b(?:settimo|vii)\b/.test(str) || str === '7' || str === '7°' || str === '7^') return 7;
  if (/\b(?:ottavo|viii)\b/.test(str) || str === '8' || str === '8°' || str === '8^') return 8;
  if (/\b(?:nono|ix)\b/.test(str) || str === '9' || str === '9°' || str === '9^') return 9;
  if (/\b(?:attico|mansarda)\b/.test(str)) return 9;
  const p = Number(str.replace(/,/g, '.').replace(/[^0-9.-]/g, ''));
  return isNaN(p) ? null : p;
};

const parseTipo = (dest, strU) => {
  const str = `${String(dest || '')} ${String(strU || '')}`.trim().toLowerCase();
  if (str.includes('box') || str.includes('garage') || str.includes('autorimessa')) return 'box';
  if (str.includes('posto') || str.includes('parcheggio') || str.includes('stallo')) return 'posto_auto';
  if (str.includes('cantina')) return 'cantina';
  if (str.includes('soffitta') || str.includes('solaio') || str.includes('sottotetto') || str.includes('mansarda')) return 'soffitta';
  if (str.includes('magazzino') || str.includes('deposito') || str.includes('locale tecnico')) return 'magazzino';
  if (str.includes('negozio') || str.includes('commerciale') || str.includes('bottega')) return 'negozio';
  if (str.includes('ufficio') || str.includes('studio')) return 'ufficio';
  return 'appartamento';
};

/**
 * MillesimiEditor
 * Redesigned to edit one table at a time, hide structural unit fields, 
 * filter units by search/scale, and add units from a quick modal.
 */
export default function MillesimiEditor({ condominioId: propId }) {
  const { condominioId: paramId } = useParams();
  const condominioId = propId || paramId;

  // Data states
  const [tabelle, setTabelle] = useState([]);
  const [unita, setUnita] = useState([]);
  const [valori, setValori] = useState({});       // { `${unitaId}_${tabellaId}`: numeric }
  const [originali, setOriginali] = useState({});  // snapshot for dirty checking
  const [originalUnita, setOriginalUnita] = useState([]);  // snapshot unita for dirty checking
  const [personeCondominio, setPersoneCondominio] = useState([]); // for reference/read-only owner display

  // Selection & UI states
  const [selectedTabellaId, setSelectedTabellaId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Sidebar / New table states
  const [nuovaTabella, setNuovaTabella] = useState('');
  const [showNuovaTabella, setShowNuovaTabella] = useState(false);
  
  // Inline table rename states
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroScala, setFiltroScala] = useState('Tutte');
  const [soloPartecipanti, setSoloPartecipanti] = useState(false);

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [extractedTabelle, setExtractedTabelle] = useState(null);
  const [importError, setImportError] = useState(null);
  
  // Add unit modal states
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [newUnitNumero, setNewUnitNumero] = useState('');
  const [newUnitScala, setNewUnitScala] = useState('');
  const [newUnitPiano, setNewUnitPiano] = useState('');
  const [newUnitMq, setNewUnitMq] = useState('');
  const [newUnitTipo, setNewUnitTipo] = useState('appartamento');

  // Storico / subentro modal state
  const [storicoModal, setStoricoModal] = useState(null); // { unita, ruolo }

  // Load all data
  useEffect(() => {
    if (!condominioId) return;
    loadAll();
  }, [condominioId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [{ data: tab, error: tabErr }, { data: uni, error: uniErr }] = await Promise.all([
        supabase.from('tabelle_millesimali').select('*').eq('condominio_id', condominioId).order('nome'),
        supabase.from('unita').select('*, occupanti_unita(id, ruolo, attivo, data_inizio, data_fine, persone:persone(id, nome, cognome, email, telefono, codice_fiscale))').eq('condominio_id', condominioId).order('numero'),
      ]);

      if (tabErr) throw tabErr;

      let unitaList = uni || [];
      if (uniErr) {
        console.warn('[MillesimiEditor] Embed occupanti_unita fallito, riprovo senza embed:', uniErr.message);
        const { data: uniFallback, error: uniFallbackErr } = await supabase
          .from('unita')
          .select('*')
          .eq('condominio_id', condominioId)
          .order('numero');
        if (uniFallbackErr) throw uniFallbackErr;
        unitaList = uniFallback || [];
      }

      const tabelleList = tab || [];
      setTabelle(tabelleList);
      setUnita(unitaList);
      setOriginalUnita(JSON.parse(JSON.stringify(unitaList)));

      // Auto-select first table if none selected
      if (tabelleList.length > 0 && !selectedTabellaId) {
        setSelectedTabellaId(tabelleList[0].id);
      }

      let milList = [];
      if (tabelleList.length > 0) {
        const tabIds = tabelleList.map(t => t.id);
        const { data: milData, error: errMil } = await supabase
          .from('millesimi_unita')
          .select('*')
          .in('tabella_id', tabIds);
        if (!errMil && milData) milList = milData;
      }

      const map = {};
      milList.forEach(m => {
        map[`${m.unita_id}_${m.tabella_id}`] = m.valore;
      });
      setValori(map);
      setOriginali(map);

      // Load people for reference display
      const { data: persData } = await supabase
        .from('persone')
        .select('id, nome, cognome, occupanti_unita!inner(unita!inner(condominio_id))')
        .eq('occupanti_unita.unita.condominio_id', condominioId)
        .eq('occupanti_unita.attivo', true);
      if (persData) {
        const uniqPersone = [];
        const seen = new Set();
        persData.forEach(p => {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            uniqPersone.push({ id: p.id, nominativo: `${p.cognome || ''} ${p.nome || ''}`.trim() || p.nome });
          }
        });
        setPersoneCondominio(uniqPersone);
      }
    } catch (e) {
      console.error('[MillesimiEditor] loadAll error:', e);
      showToast('Errore caricamento dati: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // Helper: show toast
  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // Active / Selected Tabella
  const selectedTabella = useMemo(() => {
    return tabelle.find(t => t.id === selectedTabellaId) || null;
  }, [tabelle, selectedTabellaId]);

  // Setup inline rename input value
  useEffect(() => {
    if (selectedTabella) {
      setRenameValue(selectedTabella.nome || '');
    }
    setIsRenaming(false);
  }, [selectedTabellaId, selectedTabella]);

  // Calculate real-time sum for any table
  const getSommaTabella = useCallback((tabId) => {
    return unita.reduce((acc, u) => {
      const v = parseFloat(valori[`${u.id}_${tabId}`] || 0);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
  }, [unita, valori]);

  // Check if selected table or units have unsaved changes
  const isSelectedTableDirty = useMemo(() => {
    if (!selectedTabellaId || selectedTabellaId === 'diagnostica') return false;
    
    // Check millesimi changes
    for (const u of unita) {
      const key = `${u.id}_${selectedTabellaId}`;
      const v = parseFloat(String(valori[key] ?? 0).replace(/,/g, '.')) || 0;
      const o = parseFloat(String(originali[key] ?? 0).replace(/,/g, '.')) || 0;
      if (Math.abs(v - o) > 0.0001) return true;
    }

    // Check unit field changes
    for (const u of unita) {
      const orig = originalUnita.find(o => o.id === u.id);
      if (!orig) continue;
      if (
        (orig.numero || '') !== (u.numero || '') ||
        (orig.scala || '') !== (u.scala || '') ||
        (orig.piano ?? '') !== (u.piano ?? '') ||
        (orig.mq ?? '') !== (u.mq ?? '')
      ) {
        return true;
      }
    }
    return false;
  }, [valori, originali, unita, selectedTabellaId, originalUnita]);

  // Dynamic Scale list for filter dropdown
  const listScale = useMemo(() => {
    const scale = new Set();
    unita.forEach(u => {
      if (u.scala) scale.add(u.scala.trim().toUpperCase());
    });
    return ['Tutte', ...Array.from(scale).sort()];
  }, [unita]);

  // Filtered units based on search, scale, and participation
  const unitaFiltrate = useMemo(() => {
    return unita.filter(u => {
      // 1. Search Query (Interno or Owner)
      const labelUnita = `int. ${u.numero || ''} ${u.scala ? `sc. ${u.scala}` : ''}`.toLowerCase();
      const name = getProprietarioLabel(u).toLowerCase();
      const matchesSearch = labelUnita.includes(searchQuery.toLowerCase()) || name.includes(searchQuery.toLowerCase());

      // 2. Scale filter
      const matchesScale = filtroScala === 'Tutte' || (u.scala && u.scala.trim().toUpperCase() === filtroScala.toUpperCase());

      // 3. Only participants (value > 0)
      const val = parseFloat(valori[`${u.id}_${selectedTabellaId}`] || 0);
      const matchesParticipation = !soloPartecipanti || val > 0;

      return matchesSearch && matchesScale && matchesParticipation;
    });
  }, [unita, valori, selectedTabellaId, searchQuery, filtroScala, soloPartecipanti]);

  // Owner label fallback helper
  function getProprietarioLabel(u) {
    const occ = u?.occupanti_unita?.find(o => o.ruolo === 'proprietario' && o.attivo)?.persone;
    if (occ) return `${occ.cognome || ''} ${occ.nome || ''}`.trim();
    return '—';
  }

  // Handle value change for a unit in the current selected table
  function handleMillesimiChange(unitaId, rawVal) {
    if (!selectedTabellaId) return;
    const key = `${unitaId}_${selectedTabellaId}`;
    const normalized = String(rawVal).replace(/,/g, '.');
    setValori(prev => ({ ...prev, [key]: normalized }));
  }

  // Handle inline changes for unit physical metadata
  const handleUnitFieldChange = (unitaId, field, value) => {
    setUnita(prev => prev.map(u => {
      if (u.id === unitaId) {
        return { ...u, [field]: value };
      }
      return u;
    }));
  };

  // Action: Recalculate millesimi based on SQM (mq)
  const calcolaDaMq = () => {
    if (!selectedTabellaId || unitaFiltrate.length === 0) return;
    
    let totaleMq = 0;
    unitaFiltrate.forEach(u => {
      totaleMq += parseFloat(u.mq || 0);
    });

    if (totaleMq === 0) {
      alert('Impossibile calcolare: inserisci la superficie (mq) per almeno un\'unità visibile.');
      return;
    }

    if (!window.confirm(`Vuoi calcolare i millesimi proporzionalmente alla superficie (mq) delle ${unitaFiltrate.length} unità visibili? Questo imposterà tutte le altre unità (non filtrate) a 0.`)) return;

    const nuoviValori = { ...valori };
    
    // Azzera tutte le unità del condominio per questa tabella prima
    unita.forEach(u => {
      nuoviValori[`${u.id}_${selectedTabellaId}`] = 0;
    });

    // Ripartisci in base ai mq per quelle visibili
    unitaFiltrate.forEach(u => {
      const mq = parseFloat(u.mq || 0);
      const quota = (mq / totaleMq) * 1000;
      nuoviValori[`${u.id}_${selectedTabellaId}`] = parseFloat(quota.toFixed(4));
    });

    setValori(nuoviValori);
    showToast('Millesimi calcolati proporzionalmente ai MQ!', 'success');
  };

  // Action: Distribute millesimi equally among visible/filtered units
  function distribuisciEquamente() {
    if (!selectedTabellaId || unitaFiltrate.length === 0) return;
    const confirmText = `Vuoi distribuire equamente 1000 millesimi tra le ${unitaFiltrate.length} unità visibili? Questo imposterà tutte le altre unità (non filtrate) a 0.`;
    if (!window.confirm(confirmText)) return;

    const quotaArrotondata = parseFloat((1000 / unitaFiltrate.length).toFixed(2));
    const nuoviValori = { ...valori };

    // Reset ALL units of the condominio for this table to 0 first
    unita.forEach(u => {
      nuoviValori[`${u.id}_${selectedTabellaId}`] = 0;
    });

    // Distribute among visible units
    unitaFiltrate.forEach((u, i) => {
      const val = i === unitaFiltrate.length - 1
        ? parseFloat((1000 - (quotaArrotondata * (unitaFiltrate.length - 1))).toFixed(2))
        : quotaArrotondata;
      nuoviValori[`${u.id}_${selectedTabellaId}`] = val;
    });

    setValori(nuoviValori);
    showToast('Millesimi ripartiti equamente!', 'success');
  }

  // Action: Reset millesimi values of visible/filtered units to 0
  function azzeraValori() {
    if (!selectedTabellaId || unitaFiltrate.length === 0) return;
    if (!window.confirm('Sei sicuro di voler azzerare i millesimi delle unità visibili?')) return;

    const nuoviValori = { ...valori };
    unitaFiltrate.forEach(u => {
      nuoviValori[`${u.id}_${selectedTabellaId}`] = 0;
    });
    setValori(nuoviValori);
  }

  // CRUD: Rename Table
  async function renameTabella() {
    if (!selectedTabellaId || !renameValue.trim()) {
      setIsRenaming(false);
      return;
    }
    if (renameValue.trim() === selectedTabella.nome) {
      setIsRenaming(false);
      return;
    }
    try {
      const { error } = await supabase
        .from('tabelle_millesimali')
        .update({ nome: renameValue.trim() })
        .eq('id', selectedTabellaId);
      if (error) throw error;
      setTabelle(prev => prev.map(t => t.id === selectedTabellaId ? { ...t, nome: renameValue.trim() } : t));
      showToast('Tabella rinominata', 'success');
    } catch (e) {
      showToast('Errore rinomina: ' + e.message, 'error');
    } finally {
      setIsRenaming(false);
    }
  }

  // CRUD: Save Millesimi values for the active table
  async function salvaMillesimi() {
    if (!selectedTabellaId) return;

    const somma = getSommaTabella(selectedTabellaId);
    if (Math.abs(somma - 1000) > 0.01) {
      const prosegui = window.confirm(
        `Attenzione: la somma millesimale per questa tabella è ${somma.toFixed(2)} ‰ (deve essere 1000.00 ‰).\n\nVuoi salvare comunque questo valore parziale?`
      );
      if (!prosegui) return;
    }

    setSaving(true);
    try {
      // 1. Save Millesimi values
      const upserts = [];
      unita.forEach(u => {
        const key = `${u.id}_${selectedTabellaId}`;
        const valore = parseFloat(String(valori[key] ?? 0).replace(/,/g, '.')) || 0;
        upserts.push({
          unita_id: u.id,
          tabella_id: selectedTabellaId,
          valore,
        });
      });

      if (upserts.length > 0) {
        const { error } = await supabase
          .from('millesimi_unita')
          .upsert(upserts, { onConflict: 'tabella_id,unita_id' });
        if (error) throw error;
      }

      // 2. Save physical unit fields (scala, piano, mq, numero) only if changed
      for (const u of unita) {
        const orig = originalUnita.find(o => o.id === u.id);
        const hasChanged = !orig || 
          orig.numero !== u.numero || 
          orig.scala !== u.scala || 
          orig.piano !== u.piano || 
          orig.mq !== u.mq;

        if (hasChanged) {
          const { error: uniErr } = await supabase
            .from('unita')
            .update({
              numero: u.numero,
              scala: u.scala || null,
              piano: u.piano !== '' && u.piano !== null && u.piano !== undefined ? Number(u.piano) : null,
              mq: u.mq !== '' && u.mq !== null && u.mq !== undefined ? Number(u.mq) : null,
            })
            .eq('id', u.id);
          if (uniErr) throw uniErr;
        }
      }

      // Update original snapshot to clear dirty check
      setOriginali(prev => {
        const next = { ...prev };
        unita.forEach(u => {
          const key = `${u.id}_${selectedTabellaId}`;
          next[key] = parseFloat(String(valori[key] ?? 0).replace(/,/g, '.')) || 0;
        });
        return next;
      });

      await loadAll();
      showToast('Millesimi e dati unità salvati con successo!', 'success');
    } catch (e) {
      showToast('Errore durante il salvataggio: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // CRUD: Create new empty table
  async function handleCreaTabella() {
    if (!nuovaTabella.trim()) return;
    try {
      const { data, error } = await supabase
        .from('tabelle_millesimali')
        .insert({ condominio_id: condominioId, nome: nuovaTabella.trim() })
        .select()
        .single();
      if (error) throw error;

      setTabelle(prev => [...prev, data]);
      setNuovaTabella('');
      setShowNuovaTabella(false);
      setSelectedTabellaId(data.id);
      showToast('Tabella creata con successo!', 'success');
    } catch (e) {
      showToast('Errore: ' + e.message, 'error');
    }
  }

  // CRUD: Delete table
  async function handleEliminaTabella(t, event) {
    event.stopPropagation(); // Avoid selecting the deleted table
    if (!window.confirm(`Sei sicuro di voler eliminare la tabella "${t.nome}"?\nQuesta operazione eliminerà definitivamente anche tutti i millesimi associati ad essa.`)) {
      return;
    }
    try {
      const { error } = await supabase.from('tabelle_millesimali').delete().eq('id', t.id);
      if (error) throw error;

      setTabelle(prev => prev.filter(x => x.id !== t.id));
      if (selectedTabellaId === t.id) {
        setSelectedTabellaId(tabelle.find(x => x.id !== t.id)?.id || null);
      }
      showToast('Tabella eliminata', 'success');
    } catch (e) {
      showToast('Errore eliminazione: ' + e.message, 'error');
    }
  }

  // CRUD: Add a single unit manually
  async function handleCreaUnita() {
    if (!newUnitNumero.trim()) {
      alert('Il numero/interno unità è obbligatorio.');
      return;
    }
    setSaving(true);
    try {
      const { data: newU, error } = await supabase
        .from('unita')
        .insert([{
          condominio_id: condominioId,
          numero: newUnitNumero.trim(),
          scala: newUnitScala.trim() || null,
          piano: newUnitPiano.trim() !== '' ? parsePiano(newUnitPiano) : null,
          mq: newUnitMq.trim() !== '' ? (parseFloat(newUnitMq.replace(',', '.')) || 0) : 0,
          tipo: newUnitTipo
        }])
        .select()
        .single();

      if (error) throw error;

      setUnita(prev => [...prev, newU].sort((a, b) => (a.numero || '').localeCompare(b.numero || '')));
      setShowAddUnitModal(false);
      
      // Reset fields
      setNewUnitNumero('');
      setNewUnitScala('');
      setNewUnitPiano('');
      setNewUnitMq('');
      setNewUnitTipo('appartamento');

      showToast('Unità creata con successo!', 'success');
    } catch (e) {
      showToast('Errore creazione unità: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // File Upload (AI)
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError(null);
    setExtractedTabelle(null);
    try {
      const tabs = await estraiTabelleMillesimali(file);
      if (!tabs || tabs.length === 0) {
        throw new Error('Nessuna tabella millesimale rilevata nel documento.');
      }
      setExtractedTabelle(tabs);
    } catch (err) {
      setImportError(err.message || 'Errore durante l\'estrazione del file.');
    } finally {
      setImporting(false);
    }
  }

  async function confermaImport() {
    if (!extractedTabelle || extractedTabelle.length === 0) return;
    setSaving(true);
    try {
      // Recuperiamo l'utente corrente per associare le nuove persone
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non autenticato');

      // Carichiamo tutte le persone esistenti dell'amministratore per evitare duplicati
      const { data: allPersoneData } = await supabase
        .from('persone')
        .select('*')
        .eq('user_id', user.id);
      let currentPersone = allPersoneData ? [...allPersoneData] : [];

      let currentTabelle = [...tabelle];
      let currentUnita = [...unita];
      const upserts = [];

      for (const tab of extractedTabelle) {
        let tabObj = currentTabelle.find(t => (t.nome || '').trim().toLowerCase() === (tab.nome || '').trim().toLowerCase());
        if (!tabObj) {
          const { data: newTab, error: errTab } = await supabase
            .from('tabelle_millesimali')
            .insert({ condominio_id: condominioId, nome: (tab.nome || 'Tabella').trim() })
            .select()
            .single();
          if (errTab) throw errTab;
          tabObj = newTab;
          currentTabelle.push(newTab);
        }

        for (const r of (tab.righe || [])) {
          if (!r) continue;
          const rawUnita = r.unita ?? r.subalterno ?? r.sub ?? r.interno ?? r.numero ?? r.id ?? '';
          if (!rawUnita) continue;
          const strUnita = String(rawUnita).trim();
          const strUnitaLower = strUnita.toLowerCase();

          let unitaObj = currentUnita.find(u => {
            const num = String(u.numero || '').trim().toLowerCase();
            const cleanNum = num.replace(/^0+/, '') || '0';
            const cleanStr = strUnitaLower.replace(/^0+/, '') || '0';
            const scalaNum = `${String(u.scala || '').trim().toLowerCase()} ${num}`.trim();
            const isNumEqual = !isNaN(cleanNum) && !isNaN(cleanStr) && Number(cleanNum) === Number(cleanStr);
            return num === strUnitaLower || cleanNum === cleanStr || isNumEqual || scalaNum === strUnitaLower;
          });

          if (!unitaObj && condominioId) {
            let cleanNumero = strUnita.replace(/^(unita|unità|app\.|appartamento|int\.|interno|n\.|num\.)\s*/i, '').trim() || strUnita;
            if (cleanNumero.length > 20) cleanNumero = cleanNumero.substring(0, 20);

            const tipoUnita = parseTipo(r.destinazione, strUnita);
            const pianoNum = parsePiano(r.piano);
            const mqNum = r.superficie_mq ? (parseFloat(String(r.superficie_mq).replace(',', '.')) || null) : null;

            const { data: newU, error: errU } = await supabase
              .from('unita')
              .insert([{
                condominio_id: condominioId,
                numero: cleanNumero,
                tipo: tipoUnita,
                piano: pianoNum,
                mq: mqNum
              }])
              .select()
              .single();

            if (errU) {
              const { data: fallbackU, error: errFb } = await supabase
                .from('unita')
                .insert([{ condominio_id: condominioId, numero: cleanNumero, tipo: 'appartamento' }])
                .select()
                .single();
              if (!errFb && fallbackU) {
                unitaObj = fallbackU;
                currentUnita.push(fallbackU);
              }
            } else if (newU) {
              unitaObj = newU;
              currentUnita.push(newU);
            }
          }

          // Rileviamo ed associamo il proprietario
          let propNome = String(r.proprietario_nome || '').trim();
          let propCognome = String(r.proprietario_cognome || '').trim();
          if (!propCognome && r.nominativo_completo) {
            const parti = String(r.nominativo_completo).trim().split(/\s+/);
            if (parti.length > 1) {
              propCognome = parti[0];
              propNome = parti.slice(1).join(' ');
            } else {
              propCognome = parti[0];
            }
          }

          if (unitaObj && (propCognome || propNome)) {
            const haProprietarioAttivo = unitaObj.occupanti_unita?.some(o => o.ruolo === 'proprietario' && o.attivo);

            if (!haProprietarioAttivo) {
              const nomeLower = propNome.toLowerCase();
              const cognomeLower = propCognome.toLowerCase();

              let personaTrovata = currentPersone.find(p => {
                const pNome = (p.nome || '').trim().toLowerCase();
                const pCognome = (p.cognome || '').trim().toLowerCase();
                return pNome === nomeLower && pCognome === cognomeLower;
              });

              if (!personaTrovata) {
                const { data: newP, error: pErr } = await supabase
                  .from('persone')
                  .insert([{
                    user_id: user.id,
                    nome: propNome,
                    cognome: propCognome
                  }])
                  .select()
                  .single();

                if (!pErr && newP) {
                  personaTrovata = newP;
                  currentPersone.push(newP);
                } else {
                  console.error('Errore creazione persona durante import millesimi:', pErr);
                }
              }

              if (personaTrovata) {
                const oggi = new Date().toISOString().split('T')[0];
                const { error: oErr } = await supabase
                  .from('occupanti_unita')
                  .insert([{
                    unita_id: unitaObj.id,
                    persona_id: personaTrovata.id,
                    ruolo: 'proprietario',
                    attivo: true,
                    data_inizio: oggi
                  }]);
                
                if (oErr) {
                  console.error('Errore associazione occupante durante import millesimi:', oErr);
                } else {
                  if (!unitaObj.occupanti_unita) {
                    unitaObj.occupanti_unita = [];
                  }
                  unitaObj.occupanti_unita.push({
                    ruolo: 'proprietario',
                    attivo: true,
                    persona_id: personaTrovata.id,
                    persone: personaTrovata,
                    data_inizio: oggi
                  });
                }
              }
            }
          }

          if (unitaObj) {
            const rawVal = r.valore ?? r.millesimi ?? 0;
            const valNum = parseFloat(String(rawVal).replace(',', '.')) || 0;
            if (!isNaN(valNum) && valNum >= 0) {
              upserts.push({
                unita_id: unitaObj.id,
                tabella_id: tabObj.id,
                valore: valNum
              });
            }
          }
        }
      }

      if (upserts.length > 0) {
        const { error: errUpsert } = await supabase
          .from('millesimi_unita')
          .upsert(upserts, { onConflict: 'tabella_id,unita_id' });
        if (errUpsert) throw errUpsert;
      }

      setShowImportModal(false);
      setExtractedTabelle(null);
      await loadAll();
      showToast('Tabelle importate con successo!', 'success');
    } catch (err) {
      showToast('Errore durante l\'importazione: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const downloadModelloStandard = () => {
    const bom = '\uFEFF';
    const headers = "Interno / Subalterno;Piano;Destinazione d'uso;Superficie mq;Proprietario;Millesimi Proprietà Generale;Millesimi Scale & Ascensore\n";
    const rows = [
      "Sub. 1;Terra;appartamento;85.0;Mario Rossi;120.50;110.00",
      "Box Sub. 11;-1;box;15.0;Mario Rossi;15.20;0.00",
      "Sub. 2;1°;appartamento;90.5;Laura Bianchi;135.00;140.50",
      "Box Sub. 12;-1;box;16.0;Laura Bianchi;16.00;0.00"
    ].join("\n");
    const csvContent = bom + headers + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Modello_Standard_Millesimi_CondoSmart.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.spinner} />
        <span style={{ color: 'var(--text-secondary)', marginTop: 12 }}>Caricamento millesimi...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: "'Sora', sans-serif" }}>
      {/* Top Banner/Header general */}
      <div style={styles.generalHeader}>
        <div>
          <h2 style={styles.title}>Tabelle Millesimali</h2>
          <p style={styles.subtitle}>Gestisci le quote di ripartizione spese per ciascuna unità.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="millesimi-btn-secondary" style={styles.btnSecondary} onClick={downloadModelloStandard} title="Scarica tracciato modello CSV">
            <Download size={15} style={{ marginRight: 6 }} /> Modello (.csv)
          </button>
          <button className="millesimi-btn-secondary" style={styles.btnSecondary} onClick={() => { setShowImportModal(true); setExtractedTabelle(null); setImportError(null); }}>
            <Upload size={15} style={{ marginRight: 6 }} /> Importa File
          </button>
          <button style={styles.btnPrimary} onClick={() => setShowAddUnitModal(true)}>
            <Plus size={15} style={{ marginRight: 6 }} /> Aggiungi Unità
          </button>
        </div>
      </div>

      <div style={styles.mainLayout}>
        {/* Sidebar Left: Tables List */}
        <div style={styles.sidebar}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Tabelle</h3>
            <button 
              className="millesimi-sidebar-add-btn"
              style={styles.sidebarAddBtn} 
              onClick={() => setShowNuovaTabella(!showNuovaTabella)}
              title="Aggiungi nuova tabella"
            >
              <Plus size={14} />
            </button>
          </div>

          {showNuovaTabella && (
            <div style={styles.sidebarNewTabForm}>
              <input
                style={styles.sidebarInput}
                placeholder="Nome tabella..."
                value={nuovaTabella}
                onChange={e => setNuovaTabella(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreaTabella()}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button style={{ ...styles.btnPrimary, padding: '4px 8px', fontSize: 11, flex: 1 }} onClick={handleCreaTabella}>Crea</button>
                <button className="millesimi-btn-secondary" style={{ ...styles.btnSecondary, padding: '4px 8px', fontSize: 11 }} onClick={() => setShowNuovaTabella(false)}>Annulla</button>
              </div>
            </div>
          )}

          <div style={styles.sidebarList}>
            {tabelle.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Nessuna tabella</p>
            ) : (
              tabelle.map(t => {
                const active = t.id === selectedTabellaId;
                const somma = getSommaTabella(t.id);
                const isOk = Math.abs(somma - 1000) <= 0.01;
                
                return (
                  <div 
                    key={t.id} 
                    className="millesimi-sidebar-item"
                    style={{
                      ...styles.sidebarItem,
                      borderLeft: active ? '4px solid #2563eb' : '4px solid transparent',
                      background: active ? '#1e293b' : 'transparent',
                    }}
                    onClick={() => {
                      if (isSelectedTableDirty) {
                        if (!window.confirm('Ci sono modifiche non salvate nella tabella corrente. Cambiando tabella andranno perse. Vuoi continuare?')) return;
                      }
                      setSelectedTabellaId(t.id);
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.nome}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <span style={{ 
                          fontSize: 10, 
                          fontWeight: 700, 
                          color: isOk ? '#4ade80' : '#f87171',
                          background: isOk ? '#4ade8015' : '#f8717115',
                          padding: '1px 5px',
                          borderRadius: 4
                        }}>
                          {somma.toFixed(2)} ‰
                        </span>
                      </div>
                    </div>
                    <button 
                      className="millesimi-delete-btn"
                      style={styles.sidebarItemDeleteBtn} 
                      onClick={(e) => handleEliminaTabella(t, e)}
                      title="Elimina tabella"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Diagnostica & Allineamento Link */}
          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 12, paddingTop: 12 }}>
            <div 
              className="millesimi-sidebar-item"
              style={{
                ...styles.sidebarItem,
                borderLeft: selectedTabellaId === 'diagnostica' ? '4px solid #38bdf8' : '4px solid transparent',
                background: selectedTabellaId === 'diagnostica' ? '#1e293b' : 'transparent',
              }}
              onClick={() => {
                if (isSelectedTableDirty) {
                  if (!window.confirm('Ci sono modifiche non salvate nella tabella corrente. Cambiando pagina andranno perse. Vuoi continuare?')) return;
                }
                setSelectedTabellaId('diagnostica');
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <Search size={14} color={selectedTabellaId === 'diagnostica' ? '#38bdf8' : 'var(--text-secondary)'} />
                <span style={{ fontSize: 13, fontWeight: selectedTabellaId === 'diagnostica' ? 600 : 400, color: selectedTabellaId === 'diagnostica' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  Diagnostica & Allineamento
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Panel Right: Selected Table Details */}
        <div style={styles.detailContainer}>
          {selectedTabellaId === 'diagnostica' ? (
            <DiagnosticaAllineamento
              condominioId={condominioId}
              unita={unita}
              tabelle={tabelle}
              onReload={loadAll}
              showToast={showToast}
            />
          ) : selectedTabella ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
              
              {/* Header details with inline rename */}
              <div style={styles.detailHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <Layers size={18} color="#60a5fa" />
                  {isRenaming ? (
                    <input
                      style={styles.renameInput}
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={renameTabella}
                      onKeyDown={e => {
                        if (e.key === 'Enter') renameTabella();
                        if (e.key === 'Escape') { setIsRenaming(false); setRenameValue(selectedTabella.nome); }
                      }}
                      autoFocus
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedTabella.nome}
                      </h3>
                      <button style={styles.iconBtn} onClick={() => setIsRenaming(true)} title="Rinomina tabella">
                        <Edit2 size={13} color="#94a3b8" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Real-time sum and status */}
                <div>
                  {(() => {
                    const somma = getSommaTabella(selectedTabellaId);
                    const ok = Math.abs(somma - 1000) <= 0.01;
                    return (
                      <div style={{
                        ...styles.statusBadge,
                        background: ok ? '#10b98115' : '#ef444415',
                        border: ok ? '1px solid #10b98130' : '1px solid #ef444430',
                        color: ok ? '#34d399' : '#f87171',
                      }}>
                        {ok ? <Check size={13} style={{ marginRight: 5 }} /> : <AlertCircle size={13} style={{ marginRight: 5 }} />}
                        Somma: {somma.toFixed(2)} ‰ {ok ? '(Bilanciata)' : '(Dev\'essere 1000)'}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Filters bar */}
              <div style={styles.filterBar}>
                <div style={styles.searchWrap}>
                  <Search size={14} color="#64748b" style={{ marginLeft: 8 }} />
                  <input
                    style={styles.searchInput}
                    placeholder="Cerca per interno o condomino..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button style={styles.clearSearchBtn} onClick={() => setSearchQuery('')}><X size={14} /></button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Filter size={13} color="#94a3b8" />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Scala:</span>
                    <select
                      style={styles.filterSelect}
                      value={filtroScala}
                      onChange={e => setFiltroScala(e.target.value)}
                    >
                      {listScale.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={soloPartecipanti}
                      onChange={e => setSoloPartecipanti(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    Solo partecipanti (&gt;0)
                  </label>
                </div>
              </div>

              {/* Simplified Grid */}
              <div style={styles.gridContainer}>
                {unitaFiltrate.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    Nessuna unità corrispondente ai filtri impostati.
                  </div>
                ) : (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, textAlign: 'left', width: 120 }}>Interno *</th>
                        <th style={{ ...styles.th, textAlign: 'left', width: 90 }}>Scala</th>
                        <th style={{ ...styles.th, textAlign: 'left', width: 90 }}>Piano</th>
                        <th style={{ ...styles.th, textAlign: 'left', width: 110 }}>Superficie (mq)</th>
                        <th style={{ ...styles.th, textAlign: 'left' }}>Proprietario</th>
                        <th style={{ ...styles.th, textAlign: 'right', width: 140 }}>Quota (‰)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unitaFiltrate.map((u, idx) => {
                        const key = `${u.id}_${selectedTabellaId}`;
                        const val = valori[key] ?? '';
                        return (
                          <tr key={u.id} style={{ background: idx % 2 === 0 ? 'var(--border-color-2)' : 'transparent' }}>
                            {/* Interno */}
                            <td style={styles.td}>
                              <input
                                type="text"
                                style={styles.inlineInput}
                                value={u.numero || ''}
                                onChange={e => handleUnitFieldChange(u.id, 'numero', e.target.value)}
                                placeholder="es. 3"
                              />
                            </td>
                            {/* Scala */}
                            <td style={styles.td}>
                              <input
                                type="text"
                                style={styles.inlineInput}
                                value={u.scala || ''}
                                onChange={e => handleUnitFieldChange(u.id, 'scala', e.target.value)}
                                placeholder="es. A"
                              />
                            </td>
                            {/* Piano */}
                            <td style={styles.td}>
                              <input
                                type="text"
                                style={styles.inlineInput}
                                value={u.piano ?? ''}
                                onChange={e => handleUnitFieldChange(u.id, 'piano', e.target.value)}
                                placeholder="es. 1"
                              />
                            </td>
                            {/* Superficie MQ */}
                            <td style={styles.td}>
                              <input
                                type="text"
                                style={styles.inlineInput}
                                value={u.mq ?? ''}
                                onChange={e => handleUnitFieldChange(u.id, 'mq', e.target.value)}
                                placeholder="es. 85"
                              />
                            </td>
                            {/* Proprietario */}
                            <td style={{ ...styles.td, textAlign: 'left', color: 'var(--text-secondary)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 150 }}>
                                  {getProprietarioLabel(u)}
                                </span>
                                <button
                                  onClick={() => setStoricoModal({ unita: u, ruolo: 'proprietario' })}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '2px 4px',
                                    borderRadius: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'color 0.2s',
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.color = '#38bdf8'}
                                  onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
                                  title="Visualizza storico e registra subentro"
                                >
                                  <Clock size={12} />
                                </button>
                              </div>
                            </td>
                            {/* Quota millesimale */}
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="millesimi-cell-input"
                                style={styles.cellInput}
                                value={val}
                                onChange={e => handleMillesimiChange(u.id, e.target.value)}
                                placeholder="0.00"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Detail Footer actions */}
              <div style={styles.detailFooter}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button 
                    className="millesimi-btn-secondary"
                    style={styles.btnSecondary} 
                    onClick={distribuisciEquamente}
                    title="Distribuisci 1000 millesimi equamente tra le unità attualmente visibili"
                  >
                    <Scale size={14} style={{ marginRight: 6 }} /> Distribuisci Equamente
                  </button>
                  <button 
                    className="millesimi-btn-secondary"
                    style={styles.btnSecondary} 
                    onClick={azzeraValori}
                    title="Azzera tutti i millesimi delle unità visibili"
                  >
                    <RotateCcw size={14} style={{ marginRight: 6 }} /> Azzera Valori
                  </button>
                  <button 
                    className="millesimi-btn-secondary"
                    style={styles.btnSecondary} 
                    onClick={calcolaDaMq}
                    title="Calcola i millesimi proporzionalmente alla superficie (mq) delle unità visibili"
                  >
                    <Calculator size={14} style={{ marginRight: 6 }} /> Calcola da MQ
                  </button>
                </div>
                
                <button
                  style={{ ...styles.btnPrimary, opacity: (!isSelectedTableDirty || saving) ? 0.5 : 1 }}
                  disabled={!isSelectedTableDirty || saving}
                  onClick={salvaMillesimi}
                >
                  <Save size={14} style={{ marginRight: 6 }} /> {saving ? 'Salvataggio...' : 'Salva Millesimi'}
                </button>
              </div>

            </div>
          ) : (
            <div style={styles.emptyState}>
              <Layers size={36} color="#475569" style={{ marginBottom: 12 }} />
              <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 16 }}>Nessuna Tabella Selezionata</h4>
              <p style={{ margin: '6px 0 16px', color: 'var(--text-secondary)', fontSize: 13, maxWidth: 350, lineHeight: 1.5 }}>
                Crea una nuova tabella millesimale nella barra laterale o importa le tabelle da file per iniziare la compilazione delle quote.
              </p>
              <button style={styles.btnPrimary} onClick={() => setShowNuovaTabella(true)}>
                <Plus size={14} style={{ marginRight: 6 }} /> Crea Nuova Tabella
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODALE IMPORTAZIONE DA FILE */}
      {showImportModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><Download size={18} /> Importa Tabelle Millesimali da File</h3>
              <button style={styles.closeBtn} onClick={() => setShowImportModal(false)} type="button"><X size={18} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 12, lineHeight: 1.4 }}>
              Carica un file PDF, Excel (.xlsx, .csv), Word o Immagine. L'AI estrarrà le colonne e i valori associandoli alle unità (o creando le unità mancanti).
            </p>

            {!extractedTabelle ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={styles.uploadArea}>
                  <label htmlFor="file-upload" style={styles.uploadLabel}>
                    <Upload size={32} color="#60a5fa" style={{ marginBottom: 8 }} />
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>Trascina o clicca per caricare un file</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>PDF, XLSX, CSV, PNG, JPG, DOCX</div>
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                    accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.docx,.txt"
                    disabled={importing}
                  />
                </div>

                {importing && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 }}>
                    <div style={styles.spinnerSmall} />
                    <span style={{ fontSize: 13, color: '#38bdf8' }}>L'AI sta analizzando ed estraendo le tabelle millesimali...</span>
                  </div>
                )}

                {importError && (
                  <div style={{ background: '#ef444415', border: '1px solid #ef444430', borderRadius: 8, padding: 10, color: '#f87171', fontSize: 12 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertCircle size={14} /> {importError}</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={styles.previewBox}>
                <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#38bdf8' }}>
                  Tabelle Rilevate dall'AI ({extractedTabelle.length}):
                </h4>
                <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {extractedTabelle.map((tab, i) => {
                    const totale = tab.righe?.reduce((s, r) => s + (parseFloat(String(r.valore).replace(',', '.')) || 0), 0) || 0;
                    const ok = Math.abs(totale - 1000) <= 0.5;
                    return (
                      <div key={i} style={{ background: 'var(--app-bg)', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <strong style={{ color: 'var(--text-primary)', fontSize: 12 }}>{tab.nome}</strong>
                          <span style={{ fontSize: 11, fontWeight: 700, color: ok ? '#4ade80' : '#facc15' }}>
                            Somma: {totale.toFixed(2)} {ok ? <Check size={12} style={{ display: 'inline' }} /> : '(≠ 1000)'}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {(tab.righe || []).length} unità estratte (es. {(tab.righe || []).slice(0, 3).map(r => `Unità ${r.unita}: ${r.valore}`).join(', ')}{(tab.righe || []).length > 3 ? '...' : ''})
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                  <button className="millesimi-btn-secondary" style={styles.btnSecondary} onClick={() => setExtractedTabelle(null)}>
                    Carica altro file
                  </button>
                  <button style={styles.btnPrimary} onClick={confermaImport} disabled={saving}>
                    {saving ? 'Salvataggio...' : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Check size={16} /> Conferma e Applica in Griglia
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALE NUOVA UNITÀ MANUALE */}
      {showAddUnitModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><Plus size={18} /> Aggiungi Nuova Unità Immobiliare</h3>
              <button style={styles.closeBtn} onClick={() => setShowAddUnitModal(false)} type="button"><X size={18} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Numero / Interno *</label>
                <input
                  style={styles.sidebarInput}
                  placeholder="es. 10, Int. 3, A/2"
                  value={newUnitNumero}
                  onChange={e => setNewUnitNumero(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Scala</label>
                  <input
                    style={styles.sidebarInput}
                    placeholder="es. A, B, Ovest"
                    value={newUnitScala}
                    onChange={e => setNewUnitScala(e.target.value)}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Piano</label>
                  <input
                    style={styles.sidebarInput}
                    placeholder="es. T, 1, -1"
                    value={newUnitPiano}
                    onChange={e => setNewUnitPiano(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Superficie (m²)</label>
                  <input
                    style={styles.sidebarInput}
                    placeholder="es. 85.0"
                    value={newUnitMq}
                    onChange={e => setNewUnitMq(e.target.value)}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Destinazione d'uso</label>
                  <select
                    style={styles.filterSelect}
                    value={newUnitTipo}
                    onChange={e => setNewUnitTipo(e.target.value)}
                  >
                    <option value="appartamento">Appartamento</option>
                    <option value="box">Box / Garage</option>
                    <option value="cantina">Cantina</option>
                    <option value="negozio">Negozio / Commerciale</option>
                    <option value="ufficio">Ufficio / Studio</option>
                    <option value="posto_auto">Posto Auto</option>
                    <option value="soffitta">Soffitta / Solaio</option>
                    <option value="magazzino">Magazzino / Deposito</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="millesimi-btn-secondary" style={styles.btnSecondary} onClick={() => setShowAddUnitModal(false)}>
                  Annulla
                </button>
                <button style={styles.btnPrimary} onClick={handleCreaUnita} disabled={saving}>
                  {saving ? 'Creazione...' : 'Crea Unità'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE STORICO OCCUPANTI E SUBENTRI */}
      {storicoModal && (
        <StoricoOccupantiModal
          unita={storicoModal.unita}
          ruolo={storicoModal.ruolo}
          onClose={() => setStoricoModal(null)}
          onSaved={loadAll}
        />
      )}

      {/* Toast notifications */}
      {toast && (
        <div style={{
          ...styles.toast,
          background: toast.type === 'error' ? '#ef4444' : '#10b981',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── STILI ──────────────────────────────────────────────────────────────────
const styles = {
  loadingWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: 60,
  },
  spinner: {
    width: 36, height: 36,
    border: '3px solid #1e293b',
    borderTop: '3px solid #2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  generalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 16, flexWrap: 'wrap',
  },
  title: { margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' },
  
  mainLayout: {
    display: 'flex',
    gap: 16,
    alignItems: 'stretch',
    minHeight: '500px',
  },
  
  // Sidebar styles
  sidebar: {
    width: 260,
    background: '#111827b0',
    backdropFilter: 'blur(8px)',
    borderRadius: 12,
    border: '1px solid var(--border-color)',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarAddBtn: {
    background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)',
    borderRadius: 6, width: 24, height: 24, display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer'
  },
  sidebarNewTabForm: {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  sidebarInput: {
    width: '100%', background: 'var(--app-bg)', border: '1px solid var(--border-color)',
    borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)',
    fontFamily: "'Sora', sans-serif", fontSize: 12, outline: 'none',
    boxSizing: 'border-box'
  },
  sidebarList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    overflowY: 'auto',
    flex: 1,
  },
  sidebarItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px 8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background 0.2s, border-left 0.2s',
    gap: 10,
  },
  sidebarItemDeleteBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
    padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'color 0.2s, background 0.2s',
  },

  // Detail panel styles
  detailContainer: {
    flex: 1,
    background: '#11182760',
    backdropFilter: 'blur(8px)',
    borderRadius: 12,
    border: '1px solid var(--border-color)',
    padding: 20,
    minWidth: 0,
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-color-2)',
    paddingBottom: 12,
    gap: 16,
  },
  renameInput: {
    background: 'var(--app-bg)', border: '1px solid #2563eb',
    borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)',
    fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 700,
    outline: 'none', width: '220px',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 6,
  },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center'
  },

  // Filters Bar
  filterBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    width: '280px',
    position: 'relative',
  },
  searchInput: {
    background: 'none', border: 'none', color: 'var(--text-primary)', padding: '6px 28px 6px 8px',
    fontFamily: "'Sora', sans-serif", fontSize: 12, outline: 'none', flex: 1
  },
  clearSearchBtn: {
    position: 'absolute', right: 8, background: 'none', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', fontSize: 10
  },
  filterSelect: {
    background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8,
    padding: '6px 8px', color: 'var(--text-primary)', fontFamily: "'Sora', sans-serif", fontSize: 12,
    outline: 'none', cursor: 'pointer'
  },

  // Simplified Grid table
  gridContainer: {
    overflowY: 'auto',
    maxHeight: '400px',
    border: '1px solid var(--border-color-2)',
    borderRadius: 8,
    background: 'var(--app-bg)'
  },
  table: {
    width: '100%', borderCollapse: 'collapse', fontSize: 13,
  },
  th: {
    background: 'var(--border-color)', color: 'var(--text-secondary)',
    padding: '8px 12px', fontWeight: 600, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border-color)',
  },
  td: {
    padding: '6px 12px', borderBottom: '1px solid #1e293b30',
    color: 'var(--text-secondary)', verticalAlign: 'middle'
  },
  badgeUnita: {
    fontSize: 10, color: 'var(--text-muted)', background: 'var(--card-bg)',
    padding: '2px 6px', borderRadius: 6, marginLeft: 6, fontWeight: 500
  },
  inlineInput: {
    width: '100%', background: 'var(--app-bg)',
    border: '1px solid var(--border-color)', borderRadius: 6,
    padding: '5px 8px', color: 'var(--text-secondary)',
    fontFamily: "'Sora', sans-serif", fontSize: 13,
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  cellInput: {
    width: 100, background: 'var(--app-bg)',
    border: '1px solid var(--border-color)', borderRadius: 6,
    padding: '5px 8px', color: '#38bdf8',
    fontFamily: "'Sora', sans-serif", fontSize: 13, fontWeight: 600,
    textAlign: 'right', outline: 'none',
    transition: 'border-color 0.2s',
  },

  // Detail Footer actions
  detailFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid var(--border-color-2)',
    paddingTop: 12,
    marginTop: 'auto',
  },

  // Button styles
  btnPrimary: {
    background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: 8, padding: '8px 16px', fontFamily: "'Sora', sans-serif",
    fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  btnSecondary: {
    background: 'var(--card-bg)', color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)', borderRadius: 8,
    padding: '8px 14px', fontFamily: "'Sora', sans-serif",
    fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.2s',
  },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', padding: '60px 20px', minHeight: 300,
  },

  // Modal styles
  modalOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 20,
  },
  modalContent: {
    background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16,
    padding: 20, width: '100%', maxWidth: 500, boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
    maxHeight: '90vh', overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 16, cursor: 'pointer',
  },
  uploadArea: {
    border: '2px dashed var(--border-color)', borderRadius: 12, padding: 20, textAlign: 'center',
    background: 'var(--app-bg)', cursor: 'pointer', transition: 'border-color 0.2s',
  },
  uploadLabel: {
    cursor: 'pointer', display: 'block', width: '100%',
  },
  spinnerSmall: {
    width: 16, height: 16, border: '2px solid #1e293b', borderTop: '2px solid #38bdf8',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  previewBox: {
    marginTop: 12, background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12,
  },
  formGroup: {
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  formLabel: {
    fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em'
  },
  toast: {
    position: 'fixed', bottom: 32, right: 32,
    padding: '10px 20px', borderRadius: 8,
    color: '#fff', fontWeight: 600, fontSize: 13,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    zIndex: 9999, animation: 'slideUp 0.3s ease',
  },
};
