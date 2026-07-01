import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { estraiTabelleMillesimali } from '../lib/fileExtractor';

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
  if (str.includes('appartamento') || str.includes('alloggio') || str.includes('abitazione') || str.includes('a/2') || str.includes('a/3')) return 'appartamento';
  return 'appartamento';
};

/**
 * MillesimiEditor
 * Griglia interattiva: righe = unità, colonne = tabelle millesimali
 * Validazione: somma per ogni tabella deve essere 1000
 */
export default function MillesimiEditor({ condominioId: propId }) {
  const { condominioId: paramId } = useParams();
  const condominioId = propId || paramId;
  const [tabelle, setTabelle] = useState([]);
  const [unita, setUnita] = useState([]);
  const [originaliUnita, setOriginaliUnita] = useState([]);
  const [valori, setValori] = useState({});       // { `${unitaId}_${tabellaId}`: numeric }
  const [originali, setOriginali] = useState({});  // snapshot per dirty check
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [nuovaTabella, setNuovaTabella] = useState('');
  const [showNuovaTabella, setShowNuovaTabella] = useState(false);

  // Stato per importazione da file (PDF/XLS/ecc)
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [extractedTabelle, setExtractedTabelle] = useState(null);
  const [importError, setImportError] = useState(null);

  // ─── Caricamento dati ───────────────────────────────────────
  useEffect(() => {
    if (!condominioId) return;
    loadAll();
  }, [condominioId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [{ data: tab, error: tabErr }, { data: uni, error: uniErr }] = await Promise.all([
        supabase.from('tabelle_millesimali').select('*').eq('condominio_id', condominioId).order('nome'),
        supabase.from('unita').select('*, persone:occupanti_unita(persona:persone(nominativo))').eq('condominio_id', condominioId).order('numero'),
      ]);

      if (tabErr) throw tabErr;

      // Se la query con embed occupanti fallisce, riprova senza embed (non bloccante)
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
      setOriginaliUnita(JSON.parse(JSON.stringify(unitaList)));

      let milList = [];
      if (tabelleList.length > 0) {
        const tabIds = tabelleList.map(t => t.id);
        const { data: milData, error: errMil } = await supabase
          .from('millesimi_unita')
          .select('*')
          .in('tabella_id', tabIds);
        if (!errMil && milData) milList = milData;
      }

      // Costruisci mappa valori
      const map = {};
      milList.forEach(m => {
        map[`${m.unita_id}_${m.tabella_id}`] = m.valore;
      });
      setValori(map);
      setOriginali(map);
    } catch (e) {
      console.error('[MillesimiEditor] loadAll error:', e);
      showToast('Errore caricamento dati: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }


  // ─── Calcolo somme per colonna (tabella) ────────────────────
  const sommaPer = useCallback((tabellaId) => {
    return unita.reduce((acc, u) => {
      const v = parseFloat(valori[`${u.id}_${tabellaId}`] || 0);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
  }, [unita, valori]);

  // ─── Modifica dati unità (numero, piano, tipo, mq) ────────────────
  function handleUnitaChange(unitaId, field, val) {
    setUnita(prev => prev.map(u => u.id === unitaId ? { ...u, [field]: val } : u));
  }

  // ─── Modifica cella ─────────────────────────────────────────
  function handleChange(unitaId, tabellaId, raw) {
    const key = `${unitaId}_${tabellaId}`;
    // Permetti stringa vuota e numeri con virgola
    const normalized = String(raw).replace(/,/g, '.');
    setValori(prev => ({ ...prev, [key]: normalized }));

    // Valida in tempo reale la somma
    const nuoviValori = { ...valori, [key]: normalized };
    const somma = unita.reduce((acc, u) => {
      const v = parseFloat(nuoviValori[`${u.id}_${tabellaId}`] || 0);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);

    setErrors(prev => ({
      ...prev,
      [tabellaId]: Math.abs(somma - 1000) > 0.01 ? `Somma: ${somma.toFixed(2)} (deve essere 1000)` : null,
    }));
  }

  // ─── Distribuzione automatica ───────────────────────────────
  function distribuisciEquamente(tabellaId) {
    if (unita.length === 0) return;
    const quotaArrondata = parseFloat((1000 / unita.length).toFixed(2));
    const nuovi = { ...valori };
    unita.forEach((u, i) => {
      // L'ultima unità prende il resto per garantire esattamente 1000
      const v = i === unita.length - 1
        ? parseFloat((1000 - (quotaArrondata * (unita.length - 1))).toFixed(2))
        : quotaArrondata;
      nuovi[`${u.id}_${tabellaId}`] = v;
    });
    setValori(nuovi);
    setErrors(prev => ({ ...prev, [tabellaId]: null }));
  }

  // ─── Salvataggio ────────────────────────────────────────────
  async function salva() {
    const tabelleSbilanciate = tabelle.filter(t => Math.abs(sommaPer(t.id) - 1000) > 0.01);
    if (tabelleSbilanciate.length > 0) {
      const nomi = tabelleSbilanciate.map(t => `"${t.nome}" (somma: ${sommaPer(t.id).toFixed(2)} ‰)`).join(', ');
      const prosegui = window.confirm(
        `Attenzione: le seguenti tabelle non sommano ancora a 1000:\n${nomi}\n\nVuoi salvare comunque i valori parziali?`
      );
      if (!prosegui) return;
    }

    setSaving(true);
    try {
      // Salva prima le modifiche ai dati delle unità (numero, piano, tipo, mq)
      if (unita.length > 0) {
        const unitaToSave = unita.map(u => ({
          id: u.id,
          condominio_id: condominioId,
          numero: u.numero || '1',
          scala: u.scala || null,
          piano: u.piano !== undefined && u.piano !== null && u.piano !== ''
            ? (isNaN(Number(u.piano)) ? parsePiano(u.piano) : Number(u.piano))
            : null,
          tipo: u.tipo || 'appartamento',
          mq: u.mq !== undefined && u.mq !== null && u.mq !== '' ? (parseFloat(String(u.mq).replace(/,/g, '.').replace(/[^0-9.-]/g, '')) || null) : null
        }));
        const { error: errUnita } = await supabase.from('unita').upsert(unitaToSave);
        if (errUnita) {
          console.error('Errore salvataggio dati unità:', errUnita);
          throw new Error('Impossibile salvare i dati delle unità: ' + errUnita.message);
        }
      }

      const upserts = [];

      unita.forEach(u => {
        tabelle.forEach(t => {
          const key = `${u.id}_${t.id}`;
          const valore = parseFloat(String(valori[key] ?? 0).replace(/,/g, '.')) || 0;
          if (!isNaN(valore)) {
            upserts.push({
              unita_id: u.id,
              tabella_id: t.id,
              valore,
            });
          }
        });
      });

      if (upserts.length > 0) {
        const { error } = await supabase
          .from('millesimi_unita')
          .upsert(upserts, { onConflict: 'tabella_id,unita_id' });
        if (error) throw error;
      }

      await loadAll();
      showToast('Millesimi salvati con successo', 'success');
    } catch (e) {
      showToast('Errore durante il salvataggio: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // ─── Nuova tabella millesimale ───────────────────────────────
  async function creaTabella() {
    if (!nuovaTabella.trim()) return;
    if (isDirty && !window.confirm('Ci sono modifiche non salvate nella griglia che andranno perse. Vuoi continuare?')) return;
    try {
      const { error } = await supabase.from('tabelle_millesimali').insert({
        condominio_id: condominioId,
        nome: nuovaTabella.trim(),
      });
      if (error) throw error;
      setNuovaTabella('');
      setShowNuovaTabella(false);
      await loadAll();
      showToast('Tabella creata', 'success');
    } catch (e) {
      showToast('Errore: ' + e.message, 'error');
    }
  }

  // ─── Elimina tabella millesimale ─────────────────────────────
  async function eliminaTabella(t) {
    if (isDirty && !window.confirm('Ci sono modifiche non salvate nella griglia che andranno perse. Vuoi continuare?')) return;
    if (!window.confirm(`Sei sicuro di voler eliminare la tabella "${t.nome}"? All'eliminazione verranno rimossi anche i relativi millesimi.`)) return;
    try {
      const { error } = await supabase.from('tabelle_millesimali').delete().eq('id', t.id);
      if (error) throw error;
      await loadAll();
    } catch (e) {
      showToast('Errore durante l\'eliminazione: ' + e.message, 'error');
    }
  }

  // ─── Modello Standard CSV per importazione ───────────────────
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
    link.setAttribute('download', 'Modello_Standard_Millesimi_CondoAI.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Aggiungi riga unità manualmente in griglia ──────────────
  async function aggiungiRigaUnita() {
    if (!condominioId) return;
    if (isDirty && !window.confirm('Ci sono modifiche non salvate nella griglia che andranno perse. Vuoi continuare?')) return;
    setSaving(true);
    try {
      if (tabelle.length === 0) {
        const { error: errTab } = await supabase.from('tabelle_millesimali').insert({
          condominio_id: condominioId,
          nome: 'Proprietà generale',
        });
        if (errTab) throw new Error('Impossibile creare la tabella default: ' + errTab.message);
      }
      const num = `Int. ${unita.length + 1}`;
      const { error } = await supabase
        .from('unita')
        .insert([{ condominio_id: condominioId, numero: num, tipo: 'appartamento', piano: 0, mq: 0 }]);
      if (error) throw error;
      showToast('Nuova riga unità aggiunta! Clicca sulle celle per modificarla.', 'success');
      await loadAll();
    } catch (e) {
      showToast('Errore aggiunta unità: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // ─── Elimina riga unità dalla griglia ────────────────────────
  async function eliminaUnita(u) {
    if (isDirty && !window.confirm('Ci sono modifiche non salvate nella griglia che andranno perse. Vuoi continuare?')) return;
    if (!window.confirm(`Sei sicuro di voler eliminare l'unità "${u.numero}"?`)) return;
    try {
      const { error } = await supabase.from('unita').delete().eq('id', u.id);
      if (error) throw error;
      showToast('Unità eliminata', 'success');
      await loadAll();
    } catch (e) {
      showToast('Impossibile eliminare l\'unità (potrebbe avere rate o documenti collegati): ' + e.message, 'error');
    }
  }

  // ─── Importazione tabelle millesimali da file con AI ─────────
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
    if (isDirty && !window.confirm('Ci sono modifiche non salvate nella griglia che andranno perse con l\'importazione. Vuoi continuare?')) return;
    setSaving(true);
    try {
      let currentTabelle = [...tabelle];
      let currentUnita = [...unita];
      const upserts = [];

      for (const tab of extractedTabelle) {
        // 1. Trova o crea la tabella in tabelle_millesimali
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

        // 2. Abbina o crea le unità e mappa i valori
        for (const r of (tab.righe || [])) {
          if (!r) continue;
          const rawUnita = r.unita ?? r.subalterno ?? r.sub ?? r.interno ?? r.numero ?? r.id ?? r['N. ord.'] ?? r.ordine ?? '';
          if (!rawUnita) continue;
          const strUnita = String(rawUnita).trim();
          const strUnitaLower = strUnita.toLowerCase();

          let unitaObj = currentUnita.find(u => {
            const num = String(u.numero || '').trim().toLowerCase();
            const cleanNum = num.replace(/^0+/, '') || '0';
            const cleanStr = strUnitaLower.replace(/^0+/, '') || '0';
            const scalaNum = `${String(u.scala || '').trim().toLowerCase()} ${num}`.trim();
            const isNumEqual = !isNaN(cleanNum) && !isNaN(cleanStr) && Number(cleanNum) === Number(cleanStr);
            const isSubEqual = num === `sub. ${cleanStr}` || num === `sub ${cleanStr}` || `sub. ${cleanNum}` === strUnitaLower || `sub ${cleanNum}` === strUnitaLower;
            return num === strUnitaLower || cleanNum === cleanStr || isNumEqual || scalaNum === strUnitaLower || strUnitaLower === `int. ${num}` || strUnitaLower === `int ${num}` || strUnitaLower === `interno ${num}` || strUnitaLower.endsWith(` ${num}`) || isSubEqual;
          });

          // Se l'unità non esiste, creiamola automaticamente con il tipo corretto e piano sanificato
          if (!unitaObj && condominioId) {
            let cleanNumero = strUnita.replace(/^(unita|unità|app\.|appartamento|int\.|interno|n\.|num\.)\s*/i, '').trim() || strUnita;
            if (cleanNumero.length > 20) cleanNumero = cleanNumero.substring(0, 20); // Sicurezza varchar

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
              console.error('Errore creazione unità su Supabase (riproviamo con payload minimo):', errU.message);
              // Fallback di sicurezza: inseriamo con il solo numero e tipo base in caso di vincoli rigidi
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

          if (unitaObj) {
            let updated = false;
            let pNum = unitaObj.piano;
            if ((unitaObj.piano === null || unitaObj.piano === undefined) && r.piano !== undefined && r.piano !== null && r.piano !== '') {
              const parsedP = parsePiano(r.piano);
              if (parsedP !== null) { pNum = parsedP; updated = true; }
            }
            let mNum = unitaObj.mq;
            if (!unitaObj.mq && r.superficie_mq) {
              const parsedM = parseFloat(String(r.superficie_mq).replace(',', '.')) || null;
              if (parsedM) { mNum = parsedM; updated = true; }
            }
            let tTipo = unitaObj.tipo;
            if ((!unitaObj.tipo || unitaObj.tipo === 'appartamento') && r.destinazione && r.destinazione !== 'appartamento') {
              tTipo = parseTipo(r.destinazione, strUnita);
              updated = true;
            }
            if (updated) {
              const { error: errUp } = await supabase.from('unita').update({ piano: pNum, mq: mNum, tipo: tTipo }).eq('id', unitaObj.id);
              if (errUp) console.error('Err update unita:', errUp);
              unitaObj.piano = pNum; unitaObj.mq = mNum; unitaObj.tipo = tTipo;
            }

            const rawVal = r.valore ?? r.millesimi ?? r.val ?? r.quota ?? 0;
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
        if (errUpsert) {
          console.error('Errore salvataggio millesimi:', errUpsert);
          throw errUpsert;
        }
      } else {
        console.warn('Nessun valore millesimale valido trovato da salvare nei dati estratti:', extractedTabelle);
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

  // ─── Helpers ────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const isDirty = useMemo(() => {
    const allKeys = new Set([...Object.keys(valori), ...Object.keys(originali)]);
    for (const key of allKeys) {
      const v = parseFloat(String(valori[key] ?? 0).replace(/,/g, '.')) || 0;
      const o = parseFloat(String(originali[key] ?? 0).replace(/,/g, '.')) || 0;
      if (Math.abs(v - o) > 0.0001) return true;
    }
    if (unita.length !== originaliUnita.length) return true;
    for (let i = 0; i < unita.length; i++) {
      const u = unita[i];
      const ou = originaliUnita[i] || {};
      if (String(u.numero || '') !== String(ou.numero || '')) return true;
      if (String(u.piano ?? '') !== String(ou.piano ?? '')) return true;
      if (String(u.tipo || '') !== String(ou.tipo || '')) return true;
      const mqV = parseFloat(String(u.mq || 0).replace(/,/g, '.')) || 0;
      const mqO = parseFloat(String(ou.mq || 0).replace(/,/g, '.')) || 0;
      if (Math.abs(mqV - mqO) > 0.001) return true;
    }
    return false;
  }, [valori, originali, unita, originaliUnita]);

  function getNominativo(u) {
    const occ = u?.persone?.[0];
    return occ?.persona?.nominativo || '—';
  }

  // ─── Render ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.spinner} />
        <span style={{ color: '#94a3b8', marginTop: 12 }}>Caricamento millesimi...</span>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Editor Millesimi</h2>
          <p style={styles.subtitle}>
            Inserisci i valori per ogni unità. La somma di ogni colonna deve essere <strong style={{ color: '#2563eb' }}>1000</strong>.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button
            style={styles.btnSecondary}
            onClick={downloadModelloStandard}
            title="Scarica il modello CSV standard per un'importazione sicura"
          >
            📋 Modello Standard (.csv)
          </button>
          <button
            style={styles.btnSecondary}
            onClick={() => { setShowImportModal(true); setExtractedTabelle(null); setImportError(null); }}
          >
            📥 Importa da File
          </button>
          <button
            style={styles.btnSecondary}
            onClick={aggiungiRigaUnita}
            disabled={saving}
            title="Aggiungi manualmente una nuova riga/unità al condominio"
          >
            ➕ Aggiungi Riga
          </button>
          <button
            style={styles.btnSecondary}
            onClick={() => setShowNuovaTabella(!showNuovaTabella)}
          >
            + Tabella
          </button>
          <button
            style={{ ...styles.btnPrimary, opacity: (!isDirty || saving) ? 0.5 : 1 }}
            onClick={salva}
            disabled={!isDirty || saving}
          >
            {saving ? 'Salvataggio...' : '💾 Salva Millesimi'}
          </button>
        </div>
      </div>

      {/* Modale Importazione da File */}
      {showImportModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#f1f5f9' }}>📥 Importa Tabelle Millesimali da File</h3>
              <button style={styles.closeBtn} onClick={() => setShowImportModal(false)}>✕</button>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
              Carica un file PDF, Excel (.xlsx, .csv), Word o Immagine. L'AI estrarrà le colonne e i valori associandoli alle unità (o creando le unità mancanti).
            </p>

            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <strong style={{ color: '#38bdf8' }}>💡 Formato Standard Consigliato (CondoAI)</strong>
                <button style={{ ...styles.btnSecondary, padding: '4px 10px', fontSize: 12 }} onClick={downloadModelloStandard}>
                  📋 Scarica Modello (.csv)
                </button>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: '#94a3b8' }}>
                Visto che ogni condominio usa tabelle diverse, per lavorare senza intoppi operativi consigliamo di usare o convertire i dati in questo formato standard universale:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11 }}>
                <span style={{ background: '#1e293b', padding: '3px 6px', borderRadius: 4, color: '#e2e8f0', fontWeight: 600 }}>1. Interno / Subalterno*</span>
                <span style={{ background: '#1e293b', padding: '3px 6px', borderRadius: 4, color: '#e2e8f0' }}>2. Piano</span>
                <span style={{ background: '#1e293b', padding: '3px 6px', borderRadius: 4, color: '#e2e8f0' }}>3. Destinazione d'uso</span>
                <span style={{ background: '#1e293b', padding: '3px 6px', borderRadius: 4, color: '#e2e8f0' }}>4. Superficie m²</span>
                <span style={{ background: '#1e293b', padding: '3px 6px', borderRadius: 4, color: '#e2e8f0' }}>5. Proprietario</span>
                <span style={{ background: '#0369a1', padding: '3px 6px', borderRadius: 4, color: '#f8fafc', fontWeight: 600 }}>6. Colonne Millesimali (es. Proprietà, Scale...)</span>
              </div>
            </div>

            <div style={styles.uploadArea}>
              <input
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="file-import-millesimi"
                disabled={importing}
              />
              <label htmlFor="file-import-millesimi" style={styles.uploadLabel}>
                {importing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: 10 }}>
                    <div style={styles.spinnerSmall} />
                    <span style={{ color: '#38bdf8' }}>🤖 Analisi AI in corso... estrazione tabelle...</span>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>Clicca per scegliere un file</span>
                    <span style={{ color: '#64748b', display: 'block', fontSize: 12, marginTop: 4 }}>
                      Supporta PDF, Excel, CSV, Word o scansioni
                    </span>
                  </div>
                )}
              </label>
            </div>

            {importError && (
              <div style={{ background: '#ef444420', border: '1px solid #ef4444', color: '#f87171', padding: 12, borderRadius: 8, marginTop: 16, fontSize: 13 }}>
                ⚠️ {importError}
              </div>
            )}

            {extractedTabelle && (
              <div style={styles.previewBox}>
                <h4 style={{ margin: '0 0 10px', color: '#38bdf8', fontSize: 14 }}>
                  ✨ Trovate {extractedTabelle.length} tabelle nel documento:
                </h4>
                <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {extractedTabelle.map((tab, i) => {
                    const totale = tab.righe?.reduce((s, r) => s + (parseFloat(String(r.valore).replace(',', '.')) || 0), 0) || 0;
                    const ok = Math.abs(totale - 1000) <= 0.5;
                    return (
                      <div key={i} style={{ background: '#0f172a', padding: 10, borderRadius: 8, border: '1px solid #334155' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <strong style={{ color: '#f1f5f9' }}>{tab.nome}</strong>
                          <span style={{ fontSize: 12, fontWeight: 700, color: ok ? '#4ade80' : '#facc15' }}>
                            Somma: {totale.toFixed(2)} {ok ? '✓' : '(≠ 1000)'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                          {tab.righe?.length || 0} unità estratte (es. {tab.righe?.slice(0, 3).map(r => `Unità ${r.unita}: ${r.valore}`).join(', ')}{tab.righe?.length > 3 ? '...' : ''})
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                  <button style={styles.btnSecondary} onClick={() => setExtractedTabelle(null)}>
                    Carica altro file
                  </button>
                  <button style={styles.btnPrimary} onClick={confermaImport} disabled={saving}>
                    {saving ? 'Salvataggio...' : '✓ Conferma e Applica in Griglia'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form nuova tabella */}
      {showNuovaTabella && (
        <div style={styles.nuovaTabellaBar}>
          <input
            style={styles.input}
            placeholder="Nome tabella (es. Generale, Scale, Ascensore...)"
            value={nuovaTabella}
            onChange={e => setNuovaTabella(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && creaTabella()}
            autoFocus
          />
          <button style={styles.btnPrimary} onClick={creaTabella}>Crea</button>
          <button style={styles.btnSecondary} onClick={() => setShowNuovaTabella(false)}>Annulla</button>
        </div>
      )}

      {/* Griglia */}
      {tabelle.length === 0 && unita.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <p style={{ color: '#94a3b8' }}>Nessuna unità o tabella millesimale presente. Clicca su "➕ Aggiungi Riga" o "+ Tabella" per iniziare l'inserimento manuale.</p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.thFixed, minWidth: 120 }}>Interno / Subalterno</th>
                <th style={{ ...styles.th, minWidth: 70 }}>Piano</th>
                <th style={{ ...styles.th, minWidth: 150, color: '#94a3b8', fontWeight: 400 }}>Proprietario</th>
                <th style={{ ...styles.th, minWidth: 140 }}>Destinazione d'uso</th>
                <th style={{ ...styles.th, minWidth: 130 }}>Superficie Virtuale Complessiva (m²)</th>
                {tabelle.map(t => (
                  <th key={t.id} style={{ ...styles.th, minWidth: 160 }}>
                    <div style={styles.thTabella}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#f8fafc' }}>{t.nome}</div>
                        <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 400, marginTop: 2 }}>Valore Espresso in Millesimi (‰)</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          style={styles.btnDistribuisci}
                          title="Distribuisci equamente"
                          onClick={() => distribuisciEquamente(t.id)}
                        >
                          ⚖️
                        </button>
                        <button
                          style={styles.btnDistribuisci}
                          title="Elimina tabella"
                          onClick={() => eliminaTabella(t)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    {/* Somma colonna */}
                    <div style={{
                      ...styles.sommaBadge,
                      background: errors[t.id] ? '#ef444420' : '#16a34a20',
                      color: errors[t.id] ? '#ef4444' : '#16a34a',
                    }}>
                      {sommaPer(t.id).toFixed(2)} ‰
                    </div>
                    {errors[t.id] && (
                      <div style={styles.errorMsg}>{errors[t.id]}</div>
                    )}
                  </th>
                ))}
                <th style={{ ...styles.th, minWidth: 60 }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {unita.map((u, idx) => (
                <tr key={u.id} style={{ background: idx % 2 === 0 ? '#0f172a' : '#1e293b08' }}>
                  <td style={{ ...styles.td, ...styles.tdUnit }}>
                    <input
                      type="text"
                      style={styles.cellInputText}
                      value={u.numero ?? ''}
                      onChange={e => handleUnitaChange(u.id, 'numero', e.target.value)}
                      placeholder="es. Int. 1"
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      type="text"
                      style={{ ...styles.cellInputText, width: 65, textAlign: 'center' }}
                      value={u.piano ?? ''}
                      onChange={e => handleUnitaChange(u.id, 'piano', e.target.value)}
                      placeholder="es. T / 1°"
                    />
                  </td>
                  <td style={{ ...styles.td, color: '#cbd5e1', fontSize: 13 }}>
                    {getNominativo(u)}
                  </td>
                  <td style={styles.td}>
                    <select
                      style={styles.cellSelect}
                      value={u.tipo || 'appartamento'}
                      onChange={e => handleUnitaChange(u.id, 'tipo', e.target.value)}
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
                  </td>
                  <td style={styles.td}>
                    <input
                      type="text"
                      inputMode="decimal"
                      style={{ ...styles.cellInputText, width: 80, textAlign: 'right', color: '#38bdf8', fontWeight: 600 }}
                      value={u.mq ?? ''}
                      onChange={e => handleUnitaChange(u.id, 'mq', e.target.value)}
                      placeholder="0.00"
                    />
                  </td>
                  {tabelle.map(t => {
                    const key = `${u.id}_${t.id}`;
                    const val = valori[key] ?? '';
                    return (
                      <td key={t.id} style={styles.td}>
                        <input
                          type="text"
                          inputMode="decimal"
                          style={{ ...styles.cellInput, borderColor: errors[t.id] ? '#ef4444' : '#334155' }}
                          value={val}
                          onChange={e => handleChange(u.id, t.id, e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                    );
                  })}
                  <td style={styles.td}>
                    <button
                      style={styles.btnDistribuisci}
                      onClick={() => eliminaUnita(u)}
                      title="Elimina unità"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Footer somme */}
            <tfoot>
              <tr style={{ background: '#1e293b' }}>
                <td style={{ ...styles.td, fontWeight: 700, color: '#94a3b8', textAlign: 'right' }} colSpan={4}>
                  TOTALE COMPLESSIVO:
                </td>
                <td style={{ ...styles.td, fontWeight: 700, color: '#38bdf8', textAlign: 'right' }}>
                  {unita.reduce((s, u) => s + (parseFloat(String(u.mq || 0).replace(',', '.')) || 0), 0).toFixed(2)} m²
                </td>
                {tabelle.map(t => {
                  const s = sommaPer(t.id);
                  const ok = Math.abs(s - 1000) <= 0.01;
                  return (
                    <td key={t.id} style={{ ...styles.td, fontWeight: 700, color: ok ? '#16a34a' : '#ef4444', textAlign: 'center' }}>
                      {s.toFixed(2)}
                      {ok && <span style={{ marginLeft: 4 }}>✓</span>}
                    </td>
                  );
                })}
                <td style={styles.td}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Legend */}
      <div style={styles.legend}>
        <span style={styles.legendItem}>⚖️ = Distribuisci equamente tra le unità</span>
        <span style={styles.legendItem}>· La somma per ogni tabella deve essere esattamente 1000</span>
        <span style={styles.legendItem}>· I valori vengono usati per calcolare la ripartizione delle spese</span>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          ...styles.toast,
          background: toast.type === 'error' ? '#ef4444' : '#16a34a',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── Stili ──────────────────────────────────────────────────────────────────
const styles = {
  wrap: {
    fontFamily: "'Sora', sans-serif",
    color: '#e2e8f0',
    position: 'relative',
  },
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
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 20, gap: 16, flexWrap: 'wrap',
  },
  title: { margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#94a3b8' },
  headerActions: { display: 'flex', gap: 10, alignItems: 'center' },
  nuovaTabellaBar: {
    display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center',
    background: '#1e293b', padding: '12px 16px', borderRadius: 10,
    border: '1px solid #334155',
  },
  input: {
    flex: 1, background: '#0f172a', border: '1px solid #334155',
    borderRadius: 8, padding: '8px 12px', color: '#e2e8f0',
    fontFamily: "'Sora', sans-serif", fontSize: 14,
    outline: 'none',
  },
  btnPrimary: {
    background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: 8, padding: '8px 18px', fontFamily: "'Sora', sans-serif",
    fontWeight: 600, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'background 0.2s',
  },
  btnSecondary: {
    background: '#1e293b', color: '#94a3b8',
    border: '1px solid #334155', borderRadius: 8,
    padding: '8px 16px', fontFamily: "'Sora', sans-serif",
    fontWeight: 600, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  emptyState: {
    textAlign: 'center', padding: '60px 20px',
    background: '#1e293b', borderRadius: 12, border: '1px dashed #334155',
  },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: 12,
    border: '1px solid #1e293b',
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    background: '#1e293b', color: '#94a3b8',
    padding: '10px 12px', textAlign: 'center',
    fontWeight: 600, fontSize: 12, textTransform: 'uppercase',
    letterSpacing: '0.05em', borderBottom: '1px solid #334155',
    minWidth: 110,
  },
  thFixed: { textAlign: 'left', minWidth: 120 },
  thTabella: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 6,
  },
  btnDistribuisci: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, padding: 2, opacity: 0.7,
    transition: 'opacity 0.2s',
  },
  sommaBadge: {
    display: 'inline-block', marginTop: 4,
    padding: '2px 8px', borderRadius: 20,
    fontSize: 11, fontWeight: 700,
  },
  errorMsg: {
    color: '#ef4444', fontSize: 10, marginTop: 2,
  },
  td: {
    padding: '8px 12px', borderBottom: '1px solid #1e293b10',
    textAlign: 'center', color: '#cbd5e1',
    borderRight: '1px solid #1e293b30',
  },
  tdUnit: { textAlign: 'left' },
  unitNum: {
    fontWeight: 700, color: '#f1f5f9', marginRight: 6,
  },
  unitTipo: {
    color: '#64748b', fontSize: 11,
    background: '#334155', padding: '2px 6px', borderRadius: 10,
  },
  cellInput: {
    width: 80, background: '#0f172a',
    border: '1px solid #334155', borderRadius: 6,
    padding: '5px 8px', color: '#e2e8f0',
    fontFamily: "'Sora', sans-serif", fontSize: 14,
    textAlign: 'right', outline: 'none',
    transition: 'border-color 0.2s',
  },
  cellInputText: {
    background: '#0f172a',
    border: '1px solid #334155', borderRadius: 6,
    padding: '5px 8px', color: '#e2e8f0',
    fontFamily: "'Sora', sans-serif", fontSize: 13,
    outline: 'none', transition: 'border-color 0.2s',
  },
  cellSelect: {
    background: '#0f172a',
    border: '1px solid #334155', borderRadius: 6,
    padding: '5px 6px', color: '#e2e8f0',
    fontFamily: "'Sora', sans-serif", fontSize: 12,
    outline: 'none', cursor: 'pointer',
  },
  legend: {
    display: 'flex', flexWrap: 'wrap', gap: 16,
    marginTop: 12, fontSize: 12, color: '#475569',
  },
  legendItem: {},
  toast: {
    position: 'fixed', bottom: 32, right: 32,
    padding: '12px 24px', borderRadius: 10,
    color: '#fff', fontWeight: 600, fontSize: 14,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    zIndex: 9999, animation: 'slideUp 0.3s ease',
  },
  modalOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 20,
  },
  modalContent: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 16,
    padding: 24, width: '100%', maxWidth: 600, boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
    maxHeight: '90vh', overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer',
  },
  uploadArea: {
    border: '2px dashed #334155', borderRadius: 12, padding: 24, textAlign: 'center',
    background: '#0f172a', cursor: 'pointer', transition: 'border-color 0.2s',
  },
  uploadLabel: {
    cursor: 'pointer', display: 'block', width: '100%',
  },
  spinnerSmall: {
    width: 20, height: 20, border: '2px solid #1e293b', borderTop: '2px solid #38bdf8',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  previewBox: {
    marginTop: 16, background: '#0f172a50', border: '1px solid #334155', borderRadius: 10, padding: 16,
  },
};
