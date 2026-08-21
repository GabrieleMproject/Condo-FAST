// src/components/RateGridTab.jsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useUnita } from '../hooks/useUnita'
import { useComunicazioni } from '../hooks/useComunicazioni'
import { exportSingolaUnitaRatePdfBytes, exportSollecitiMassiviPdf } from '../lib/exportPdf'
import { toast } from 'react-hot-toast'
import { CreditCard, X, CheckCircle2, Coins, Mail, Megaphone, Building2, Calendar, ChevronRight, ChevronDown, Sparkles, Loader2, Plus, Edit3, ShieldAlert } from 'lucide-react'

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const eur = (n) => `€${(Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function formattaDataMese(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}

function deriveStato(importo, pagato) {
  if (importo <= 0.001) return pagato > 0.01 ? 'sovra_pagata' : 'pagata'
  if (pagato <= 0.001) return 'non_pagata'
  if (pagato < importo - 0.01) return 'parziale'
  if (pagato > importo + 0.01) return 'sovra_pagata'
  return 'pagata'
}

function cellInfo(cell, rata) {
  if (!cell) return { color: 'var(--text-muted)', bg: 'transparent', label: '—', importo: 0, pagato: 0, credito: 0, missing: true }
  const importo = parseFloat(cell.importo || 0)
  const pagato = parseFloat(cell.importo_pagato || 0)
  const credito = round2(pagato - importo)
  const overdue = cell.stato !== 'pagata' && cell.stato !== 'sovra_pagata' && rata?.data_scadenza && new Date(rata.data_scadenza) < new Date()
  let color = '#64748b', label = 'Non pagata'
  if (cell.stato === 'pagata') { color = '#10b981'; label = 'Pagata' }
  else if (cell.stato === 'sovra_pagata') { color = '#38bdf8'; label = 'Sovra-versata' }
  else if (cell.stato === 'parziale') { color = '#f59e0b'; label = 'Parziale' }
  else if (overdue) { color = '#ef4444'; label = 'Scaduta' }
  return { color, bg: color + '22', importo, pagato, credito, label, overdue, missing: false }
}

export default function RateGridTab({ condominioId, esercizioId: esercizioIdProp, esercizioAttivo: esercizioAttivoProp, onSelectEsercizio }) {
  const navigate = useNavigate()
  const { inviaComunicazione, fetchComunicazioni } = useComunicazioni()
  const [inviandoSollecito, setInviandoSollecito] = useState(false)
  const [showProposteModal, setShowProposteModal] = useState(false)
  const [condominio, setCondominio] = useState(null)
  const [invioMassivoStato, setInvioMassivoStato] = useState({ inCorso: false, totale: 0, corrente: 0, falliti: 0 })

  const [esercizi, setEsercizi] = useState([])
  const [esercizio, setEsercizio] = useState(esercizioAttivoProp || null)
  const [rate, setRate] = useState([])           // colonne
  const [cells, setCells] = useState([])          // rate_unita
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)    // { cell, rata, unita }
  const [creandoEsercizio, setCreandoEsercizio] = useState(false)
  const [generandoRate, setGenerandoRate] = useState(false)

  const { unita, getProprietario, getInquilino, fetchUnita } = useUnita(condominioId)
  const [configPagante, setConfigPagante] = useState({})
  const [ultimaRiconciliazioneInfo, setUltimaRiconciliazioneInfo] = useState(null)
  const [dismissedBannerProposte, setDismissedBannerProposte] = useState(false)

  const handleCreaEsercizioRapido = async () => {
    if (!condominioId) return
    setCreandoEsercizio(true)
    try {
      const annoCorrente = new Date().getFullYear()
      const { data: newEs, error: esErr } = await supabase
        .from('esercizi')
        .insert([{
          condominio_id: condominioId,
          anno: annoCorrente,
          data_inizio: `${annoCorrente}-01-01`,
          data_fine: `${annoCorrente}-12-31`,
          stato: 'aperto',
          tipo: 'ordinario'
        }])
        .select()
        .single()

      if (esErr) throw esErr
      setEsercizi(prev => [newEs, ...prev])
      setEsercizio(newEs)
      if (onSelectEsercizio) onSelectEsercizio(newEs.id)
      toast.success(`Esercizio Ordinario ${annoCorrente} creato con successo!`)
    } catch (err) {
      console.error('Errore creazione esercizio:', err)
      toast.error('Errore durante la creazione dell\'esercizio: ' + err.message)
    } finally {
      setCreandoEsercizio(false)
    }
  }

  const handleGeneraRateRapide = async (numRate = 4) => {
    if (!esercizio || !condominioId) return
    setGenerandoRate(true)
    try {
      const anno = esercizio.anno || new Date().getFullYear()
      const ratePayload = []
      
      if (numRate === 12) {
        const nomiMesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
        for (let i = 0; i < 12; i++) {
          const m = String(i + 1).padStart(2, '0')
          ratePayload.push({
            condominio_id: condominioId,
            esercizio_id: esercizio.id,
            numero_rata: i + 1,
            descrizione: `Rata ${i + 1} (${nomiMesi[i]})`,
            data_scadenza: `${anno}-${m}-15`,
            importo_totale: 0
          })
        }
      } else if (numRate === 1) {
        ratePayload.push({
          condominio_id: condominioId,
          esercizio_id: esercizio.id,
          numero_rata: 1,
          descrizione: 'Rata Unica Annuale',
          data_scadenza: `${anno}-03-31`,
          importo_totale: 0
        })
      } else {
        // Default 4 bimestrali
        const scadenze = [
          { n: 1, desc: '1ª Rata (Gen-Feb)', data: `${anno}-02-15` },
          { n: 2, desc: '2ª Rata (Mar-Apr)', data: `${anno}-04-15` },
          { n: 3, desc: '3ª Rata (Mag-Giu)', data: `${anno}-07-15` },
          { n: 4, desc: '4ª Rata (Lug-Dic)', data: `${anno}-10-15` },
        ]
        scadenze.forEach(s => {
          ratePayload.push({
            condominio_id: condominioId,
            esercizio_id: esercizio.id,
            numero_rata: s.n,
            descrizione: s.desc,
            data_scadenza: s.data,
            importo_totale: 0
          })
        })
      }

      const { data: createRate, error: rateErr } = await supabase
        .from('rate')
        .insert(ratePayload)
        .select()

      if (rateErr) throw rateErr

      // Crea le celle per ciascuna unità
      if (unita && unita.length > 0 && createRate && createRate.length > 0) {
        const cellPayload = []
        for (const u of unita) {
          for (const r of createRate) {
            cellPayload.push({
              rata_id: r.id,
              unita_id: u.id,
              importo: 0,
              importo_pagato: 0,
              stato: 'non_pagata'
            })
          }
        }
        const { error: cellErr } = await supabase.from('rate_unita').insert(cellPayload)
        if (cellErr) console.warn('Creazione celle rate_unita parziale:', cellErr)
      }

      await loadGriglia()
      toast.success(`Piano di ${numRate} rate generato con successo!`)
    } catch (err) {
      console.error('Errore generazione piano rate:', err)
      toast.error('Errore durante la generazione delle rate: ' + err.message)
    } finally {
      setGenerandoRate(false)
    }
  }

  useEffect(() => {
    if (!condominioId) return
    const fetchUltimaRiconciliazione = async () => {
      try {
        // 1. Prova da estratto_conto riconciliato
        const { data: movData } = await supabase
          .from('estratto_conto')
          .select('data_movimento, updated_at')
          .eq('condominio_id', condominioId)
          .eq('riconciliato', true)
          .order('data_movimento', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (movData) {
          setUltimaRiconciliazioneInfo(movData)
          return
        }

        // 2. Prova da riconciliazioni_incassi confermate
        const { data: ricData } = await supabase
          .from('riconciliazioni_incassi')
          .select('confermata_at, created_at')
          .eq('condominio_id', condominioId)
          .eq('stato', 'confermata')
          .order('confermata_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (ricData) {
          setUltimaRiconciliazioneInfo({
            data_movimento: ricData.confermata_at || ricData.created_at,
            updated_at: ricData.confermata_at || ricData.created_at
          })
          return
        }

        // 3. Prova da documenti estratto conto
        const { data: docData } = await supabase
          .from('documenti_condominio')
          .select('data_documento, created_at')
          .eq('condominio_id', condominioId)
          .in('tipo', ['estratto_conto', 'estratto_conto_archivio'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (docData) {
          setUltimaRiconciliazioneInfo({
            data_movimento: docData.data_documento || docData.created_at,
            updated_at: docData.created_at
          })
        }
      } catch (e) {
        console.error('[RateGridTab] Errore fetch ultima riconciliazione:', e)
      }
    }
    fetchUltimaRiconciliazione()
  }, [condominioId])

  // Funzione per formattare e mostrare la transizione proprietari con date nella cella Unità
  function renderProprietariTransizione(u) {
    const proprietari = (u.occupanti_unita || [])
      .filter(o => o.ruolo === 'proprietario')
      .sort((a, b) => {
        const da = a.data_inizio ? new Date(a.data_inizio) : new Date(0);
        const db = b.data_inizio ? new Date(b.data_inizio) : new Date(0);
        return da - db;
      });

    if (proprietari.length === 0) {
      return <div style={{ color: 'var(--text-muted)', fontSize: 11, fontStyle: 'italic' }}>— Nessuno —</div>;
    }

    if (proprietari.length === 1) {
      const p = proprietari[0].persone;
      if (!p) return <div style={{ color: 'var(--text-muted)', fontSize: 11, fontStyle: 'italic' }}>— Nessuno —</div>;
      return <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{p.cognome} {p.nome}</div>;
    }

    // Se ci sono più proprietari (subentro avvenuto nell'esercizio)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
        {proprietari.map((o, idx) => {
          const p = o.persone;
          if (!p) return null;

          const dataInizioStr = o.data_inizio ? formattaDataMese(o.data_inizio) : '';
          const dataFineStr = o.data_fine ? formattaDataMese(o.data_fine) : '';

          let labelDate = '';
          if (o.attivo) {
            labelDate = dataInizioStr ? `(dal ${dataInizioStr})` : '(corrente)';
          } else {
            labelDate = dataFineStr ? `(fino al ${dataFineStr})` : '';
          }

          return (
            <div 
              key={o.id} 
              style={{ 
                color: o.attivo ? 'var(--text-secondary)' : '#64748b', 
                fontSize: 10,
                fontWeight: o.attivo ? 600 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              {idx > 0 && <ChevronRight size={10} style={{ color: 'var(--text-muted)' }} />}
              <span>{p.cognome} {p.nome} <span style={{ color: 'var(--text-muted)', fontSize: 9, fontStyle: 'italic' }}>{labelDate}</span></span>
            </div>
          );
        })}
      </div>
    );
  }

  // Rileva le rate scadute da oltre 10 giorni
  const rateScaduteDa10Giorni = useMemo(() => {
    if (!esercizio || rate.length === 0 || cells.length === 0) return [];
    
    const rateScaduteIds = rate
      .filter(r => {
        if (!r.data_scadenza) return false;
        const diffMs = new Date() - new Date(r.data_scadenza);
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays >= 10;
      })
      .map(r => r.id);

    if (rateScaduteIds.length === 0) return [];

    const proposte = [];
    unita.forEach(u => {
      const isOrdinario = esercizio?.tipo === 'ordinario'
      const paganteTipo = isOrdinario ? (configPagante[u.id] || 'proprietario') : 'proprietario'
      const inq = getInquilino(u)
      const dest = (paganteTipo === 'inquilino' && inq) ? inq : getProprietario(u)

      if (!dest || !dest.email) return;

      const rateUnitaInsolute = cells.filter(c => 
        c.unita_id === u.id && 
        rateScaduteIds.includes(c.rata_id) && 
        c.stato !== 'pagata' && 
        c.stato !== 'sovra_pagata' &&
        parseFloat(c.importo || 0) > 0.001
      );

      if (rateUnitaInsolute.length > 0) {
        const importoInsoluto = rateUnitaInsolute.reduce((s, c) => s + (parseFloat(c.importo || 0) - parseFloat(c.importo_pagato || 0)), 0);
        proposte.push({
          unita: u,
          proprietario: getProprietario(u),
          destinatario: dest,
          paganteTipo,
          rateCoinvolte: rateUnitaInsolute.map(c => {
            const r = rate.find(x => x.id === c.rata_id);
            return r ? (r.descrizione || `Rata ${r.numero_rata}`) : 'Rata';
          }).join(', '),
          importoInsoluto,
        });
      }
    });

    return proposte;
  }, [esercizio, rate, cells, unita, getProprietario, getInquilino, configPagante]);

  async function handleSollecitaRata(u, prop, silenzioso = false) {
    const isOrdinario = esercizio?.tipo === 'ordinario'
    const paganteTipo = isOrdinario ? (configPagante[u.id] || 'proprietario') : 'proprietario'
    const inq = getInquilino(u)
    const dest = (paganteTipo === 'inquilino' && inq) ? inq : prop

    if (!dest || !dest.email) {
      const errMsg = `Impossibile inviare il sollecito: il destinatario (${dest ? `${dest.nome} ${dest.cognome}` : 'sconosciuto'}) non ha un indirizzo email configurato.`
      if (!silenzioso) {
        toast.error(errMsg);
      }
      throw new Error(errMsg);
    }
    setInviandoSollecito(true);
    try {
      if (!esercizio) throw new Error("Nessun esercizio selezionato o aperto.");

      // Carica rate dell'esercizio
      const { data: rateData } = await supabase
        .from('rate')
        .select('id, data_scadenza, descrizione')
        .eq('esercizio_id', esercizio.id);
      
      const rateIds = (rateData || []).map(r => r.id);

      // Carica rate_unita
      const { data: rateUnitaData } = await supabase
        .from('rate_unita')
        .select('*')
        .eq('unita_id', u.id)
        .in('rata_id', rateIds);

      const rateUnitaList = rateUnitaData || [];
      const dovuto = rateUnitaList.reduce((s, r) => s + parseFloat(r.importo || 0), 0);
      const pagato = rateUnitaList.reduce((s, r) => s + parseFloat(r.importo_pagato || 0), 0);
      const insoluto = dovuto - pagato;

      const rateScadute = rateUnitaList.filter(ru => {
        const rata = (rateData || []).find(r => r.id === ru.rata_id);
        const scaduta = rata?.data_scadenza && new Date(rata.data_scadenza) < new Date();
        return scaduta && ru.stato !== 'pagata' && ru.stato !== 'sovra_pagata';
      });

      const importoScaduto = rateScadute.reduce((s, r) => s + (parseFloat(r.importo || 0) - parseFloat(r.importo_pagato || 0)), 0);

      const nomeDest = `${dest.nome} ${dest.cognome}`;
      const alignmentText = u.scala ? `scala ${u.scala}` : '';
      const ruoloLabel = paganteTipo === 'inquilino' ? 'inquilino pagante' : 'proprietario';
      const gestioneLabel = esercizio.tipo === 'straordinario' ? 'Gestione Straordinaria' : 'Gestione Ordinaria';
      const testo = `Gentile <strong>${nomeDest}</strong>,<br/><br/>
Le inviamo la presente comunicazione in merito all'esercizio condominiale <strong>${esercizio.anno}</strong> (${gestioneLabel}, Unità: ${u.numero} ${alignmentText}) in qualità di ${ruoloLabel}.<br/><br/>
Dalle nostre scritture contabili risulta la seguente <strong>quadratura finanziaria aggiornata</strong> per le sue quote:<br/>
<ul>
  <li>Totale dovuto per l'esercizio: <strong>€ ${dovuto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong></li>
  <li>Totale da lei versato ad oggi: <strong>€ ${pagato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong></li>
  <li>Saldo insoluto residuo: <strong>€ ${insoluto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong></li>
</ul>
Di questo saldo insoluto, l'importo attualmente <span style="color:#ef4444; font-weight:bold;">in ritardo / già scaduto</span> è pari a: <strong>€ ${importoScaduto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong>.<br/><br/>
La invitiamo a provvedere al saldo delle quote insolute a mezzo bonifico bancario.<br/><br/>
Cordiali saluti,<br/>
L'Amministratore`;

      await inviaComunicazione({
        condominioId,
        destinatari: [{ email: dest.email, nome: nomeDest }],
        oggetto: `Sollecito pagamento rate Esercizio ${esercizio.anno} - Unità ${u.numero}`,
        messaggio: testo,
        tipo: 'sollecito',
      });

      if (!silenzioso) {
        toast.success(`Sollecito inviato con successo a ${dest.email}`);
      }
    } catch (err) {
      if (!silenzioso) {
        toast.error("Errore durante l'invio del sollecito: " + err.message);
      } else {
        console.error("Errore invio sollecito:", err.message);
      }
      throw err;
    } finally {
      setInviandoSollecito(false);
    }
  }

  useEffect(() => {
    supabase.from('esercizi').select('*').eq('condominio_id', condominioId)
      .order('anno', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("[RateGridTab] Errore caricamento esercizi:", error.message)
          return
        }
        const lista = data || []
        setEsercizi(lista)
        if (esercizioIdProp) {
          const match = lista.find(e => e.id === esercizioIdProp)
          if (match) { setEsercizio(match); return }
        }
        setEsercizio(lista.find((e) => e.stato === 'aperto') || lista[0] || null)
      })
      .catch(err => console.error("[RateGridTab] Errore di rete esercizi:", err))

    // Carica dati condominio (con IBAN)
    supabase.from('condomini').select('*').eq('id', condominioId).maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("[RateGridTab] Errore caricamento condominio:", error.message)
          return
        }
        setCondominio(data)
      })
  }, [condominioId, esercizioIdProp])

  useEffect(() => {
    if (esercizioIdProp && esercizi.length > 0) {
      const match = esercizi.find(e => e.id === esercizioIdProp)
      if (match && match.id !== esercizio?.id) {
        setEsercizio(match)
      }
    }
  }, [esercizioIdProp, esercizi])

  async function loadGriglia() {
    if (!esercizio) { setLoading(false); return }
    setLoading(true)
    try {
      const { data: rateData, error: rateErr } = await supabase
        .from('rate').select('*').eq('esercizio_id', esercizio.id)
        .order('numero_rata', { ascending: true })
      if (rateErr) throw rateErr

      const rateList = rateData || []
      setRate(rateList)

      if (rateList.length) {
        const { data: cellData, error: cellErr } = await supabase
          .from('rate_unita').select('*')
          .in('rata_id', rateList.map((r) => r.id))
        if (cellErr) throw cellErr
        setCells(cellData || [])
      } else {
        setCells([])
      }

      // Carica configurazione pagante per l'esercizio corrente
      const { data: configData, error: configErr } = await supabase
        .from('config_pagante_unita').select('unita_id, pagante')
        .eq('esercizio_id', esercizio.id)
      if (configErr) {
        console.error("[RateGridTab] Errore config_pagante_unita:", configErr.message)
      } else {
        const map = {}
        ;(configData || []).forEach(c => { map[c.unita_id] = c.pagante })
        setConfigPagante(map)
      }
    } catch (e) {
      console.error("[RateGridTab] Errore nel caricamento della griglia rate:", e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadGriglia() /* eslint-disable-next-line */ }, [esercizio?.id])

  // mappa { `${unitaId}_${rataId}` : cell }
  const cellMap = useMemo(() => {
    const m = {}
    cells.forEach((c) => { m[`${c.unita_id}_${c.rata_id}`] = c })
    return m
  }, [cells])

  // ── salva modifiche cella ──────────────────────────────────
  async function salvaCella(cell, patch) {
    const importo = patch.importo !== undefined ? parseFloat(patch.importo) || 0 : parseFloat(cell.importo || 0)
    const pagato = patch.importo_pagato !== undefined ? parseFloat(patch.importo_pagato) || 0 : parseFloat(cell.importo_pagato || 0)
    const upd = {
      importo,
      importo_pagato: pagato,
      data_pagamento: patch.data_pagamento !== undefined ? (patch.data_pagamento || null) : cell.data_pagamento,
      stato: deriveStato(importo, pagato),
      modificato_manualmente: patch.importo !== undefined ? true : cell.modificato_manualmente,
    }
    const { data, error } = await supabase.from('rate_unita').update(upd).eq('id', cell.id).select().single()
    if (error) { toast.error('Errore aggiornamento rata: ' + error.message); return }
    setCells((prev) => prev.map((c) => (c.id === cell.id ? data : c)))
    setEditing(null)
  }

  async function handleInviaSollecitiMassivi({ proposteSelezionate, oggettoTemplate, testoTemplate, ibanDaUsare, allegaPdf, canaleCartaceoConfig }) {
    setInviandoSollecito(true)
    setInvioMassivoStato({ inCorso: true, totale: proposteSelezionate.length, corrente: 0, falliti: 0 })

    let falliti = 0
    let corrente = 0
    const sollecitiDaStampare = []

    for (const p of proposteSelezionate) {
      corrente++
      setInvioMassivoStato(prev => ({ ...prev, corrente }))
      try {
        const u = p.unita
        const dest = p.destinatario
        const canaleScelto = p.canale || 'email'
        
        // 1. Carica rate_unita dell'unità specifica per calcoli precisi
        const { data: rateUnitaData, error: ruErr } = await supabase
          .from('rate_unita')
          .select('*')
          .eq('unita_id', u.id)
          .in('rata_id', rate.map(r => r.id));

        if (ruErr) throw ruErr;

        // 2. Risoluzione dei tag dinamici nel testo dell'email
        const nomeDest = `${dest.nome} ${dest.cognome}`;
        const unitLabel = `Interno ${u.numero}${u.scala ? ` (Scala ${u.scala})` : ''}`;
        
        let oggettoRisolto = oggettoTemplate
          .replace(/{NOME}/g, nomeDest)
          .replace(/{UNITA}/g, unitLabel)
          .replace(/{CONDOMINIO}/g, condominio?.nome || '')
          .replace(/{IMPORTO_SCADUTO}/g, `€ ${p.importoInsoluto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`);

        let testoRisolto = testoTemplate
          .replace(/{NOME}/g, nomeDest)
          .replace(/{UNITA}/g, unitLabel)
          .replace(/{CONDOMINIO}/g, condominio?.nome || '')
          .replace(/{IMPORTO_SCADUTO}/g, `€ ${p.importoInsoluto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`)
          .replace(/{IBAN}/g, ibanDaUsare || '');

        if (canaleScelto === 'email') {
          // ── GESTIONE EMAIL ──
          const allegati = []
          if (allegaPdf) {
            const condoConIbanTemp = { ...condominio, iban: ibanDaUsare }
            const pdfBase64 = await exportSingolaUnitaRatePdfBytes({
              condominio: condoConIbanTemp,
              esercizio,
              rate,
              cells: rateUnitaData || [],
              unita: u,
              proprietario: dest
            })
            allegati.push({
              content: pdfBase64,
              filename: `Dettaglio_Rate_Unita_${u.numero}.pdf`,
              type: 'application/pdf'
            })
          }

          await inviaComunicazione({
            condominioId,
            destinatari: [{ email: dest.email, nome: nomeDest }],
            oggetto: oggettoRisolto,
            messaggio: testoRisolto,
            tipo: 'sollecito',
            allegati,
            skipFetch: true
          })
        } else {
          // ── GESTIONE CARTACEO ──
          if (canaleCartaceoConfig?.tipoCartaceo === 'partner') {
            const condoConIbanTemp = { ...condominio, iban: ibanDaUsare }
            const pdfBase64 = await exportSingolaUnitaRatePdfBytes({
              condominio: condoConIbanTemp,
              esercizio,
              rate,
              cells: rateUnitaData || [],
              unita: u,
              proprietario: dest
            })

            // Invia al partner postale passando i dati di spedizione della persona
            await inviaComunicazione({
              condominioId,
              destinatari: [{ 
                email: dest.email || 'cartaceo@condofast.local',
                nome: nomeDest,
                indirizzo: dest.indirizzo || '',
                citta: dest.citta || '',
                cap: dest.cap || '',
                provincia: dest.provincia || ''
              }],
              oggetto: oggettoRisolto,
              messaggio: testoRisolto,
              tipo: 'sollecito_cartaceo',
              allegati: [{
                content: pdfBase64,
                filename: `Sollecito_Cartaceo_Unita_${u.numero}.pdf`,
                type: 'application/pdf'
              }],
              skipFetch: true
            })
          } else {
            // Stampa manuale (generazione PDF cumulativo alla fine)
            sollecitiDaStampare.push({
              unita: u,
              destinatario: dest,
              cells: rateUnitaData || []
            })

            // Salva log sul DB in stato 'inviata' (da stampare)
            const { data: userData } = await supabase.auth.getUser()
            await supabase.from('comunicazioni').insert({
              condominio_id: condominioId,
              amministratore_id: userData?.user?.id,
              destinatario_email: dest.email || 'cartaceo@condofast.local',
              destinatario_nome: nomeDest,
              oggetto: oggettoRisolto,
              messaggio: testoRisolto,
              tipo: 'sollecito',
              stato: 'inviata',
            })
          }
        }

      } catch (err) {
        console.error(`Errore invio sollecito per unità ${p.unita.numero}:`, err.message)
        falliti++
        setInvioMassivoStato(prev => ({ ...prev, falliti }))
      }
    }

    // Se ci sono solleciti cartacei da stampare manualmente, genera il PDF cumulativo
    if (sollecitiDaStampare.length > 0) {
      try {
        const condoConIbanTemp = { ...condominio, iban: ibanDaUsare }
        await exportSollecitiMassiviPdf({
          condominio: condoConIbanTemp,
          esercizio,
          rate,
          proposte: sollecitiDaStampare
        })
      } catch (pdfErr) {
        console.error("Errore generazione PDF cumulativo:", pdfErr.message)
        toast.error("Errore durante la generazione del PDF cumulativo delle stampe.")
      }
    }

    // Ricarica lo storico delle comunicazioni una sola volta alla fine del loop
    try {
      await fetchComunicazioni(condominioId)
    } catch (fErr) {
      console.error("Errore ricaricamento registro comunicazioni:", fErr.message)
    }

    setInviandoSollecito(false)
    setInvioMassivoStato(prev => ({ ...prev, inCorso: false }))
    
    if (falliti > 0) {
      toast.error(`Invio massivo completato con anomalie. Riusciti: ${proposteSelezionate.length - falliti}, Falliti: ${falliti}`);
    } else {
      toast.success('Tutti i solleciti sono stati elaborati e inviati con successo!');
    }
    setShowProposteModal(false)
  }

  const totRata = (rataId) => {
    const cs = cells.filter((c) => c.rata_id === rataId)
    return {
      dovuto: round2(cs.reduce((s, c) => s + parseFloat(c.importo || 0), 0)),
      pagato: round2(cs.reduce((s, c) => s + parseFloat(c.importo_pagato || 0), 0)),
    }
  }
  const totUnita = (unitaId) => {
    const cs = cells.filter((c) => c.unita_id === unitaId)
    return {
      dovuto: round2(cs.reduce((s, c) => s + parseFloat(c.importo || 0), 0)),
      pagato: round2(cs.reduce((s, c) => s + parseFloat(c.importo_pagato || 0), 0)),
    }
  }
  const totaleDovuto = round2(cells.reduce((s, c) => s + parseFloat(c.importo || 0), 0))
  const totalePagato = round2(cells.reduce((s, c) => s + parseFloat(c.importo_pagato || 0), 0))

  // ── render ─────────────────────────────────────────────────
  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>Caricamento griglia...</div>

  if (!esercizio) return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(124, 58, 237, 0.08) 100%)',
      border: '1px solid rgba(37, 99, 235, 0.3)',
      borderRadius: 14,
      padding: '36px 24px',
      textAlign: 'center',
      maxWidth: 580,
      margin: '40px auto'
    }}>
      <Calendar size={40} style={{ margin: '0 auto 12px', color: '#3b82f6' }} />
      <h3 style={{ margin: '0 0 6px', fontSize: 18, color: 'var(--text-primary)', fontWeight: 700 }}>
        Nessun esercizio contabile attivo
      </h3>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Per visualizzare e gestire la griglia delle rate è necessario un esercizio contabile per questo condominio.
      </p>
      <button
        onClick={handleCreaEsercizioRapido}
        disabled={creandoEsercizio}
        style={{
          background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '11px 22px',
          fontSize: 14,
          fontWeight: 600,
          cursor: creandoEsercizio ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
          fontFamily: 'Sora, sans-serif'
        }}
      >
        {creandoEsercizio ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={16} />}
        <span>Crea Esercizio Ordinario {new Date().getFullYear()} in 1-Click</span>
      </button>
    </div>
  )

  const formattaDataEstesa = (d) => (d ? new Date(d).toLocaleDateString('it-IT') : '—')

  return (
    <div>
      {/* Badge Data Ultimo Aggiornamento da Estratto Conto / Riconciliazione */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
        border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 16px', marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(37, 99, 235, 0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#60a5fa' }}>
              Stato Riconciliazione Bancaria Rate
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 1 }}>
              {ultimaRiconciliazioneInfo ? (
                <>
                  Situazione rate aggiornata all'estratto conto del <strong>{formattaDataEstesa(ultimaRiconciliazioneInfo.data_movimento)}</strong> (riconciliata il {formattaDataEstesa(ultimaRiconciliazioneInfo.updated_at)})
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>
                  Nessuna riconciliazione bancaria recente registrata per le rate di questo condominio
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate(`/condomini/${condominioId}/riconciliazioni-incassi`)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #16a34a, #2563eb)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}
        >
          <Coins size={14} /> Riconcilia incassi
        </button>
      </div>

      {/* Selettore esercizio */}
      {esercizi.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {esercizi.map((es) => {
            const isActive = esercizio?.id === es.id
            const isStraord = es.tipo === 'straordinario'
            const activeColor = isStraord ? '#8b5cf6' : '#2563eb'
            return (
              <button
                key={es.id}
                onClick={() => {
                  setEsercizio(es)
                  if (onSelectEsercizio) onSelectEsercizio(es.id)
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: 'pointer',
                  border: `1px solid ${isActive ? activeColor : 'var(--border-color)'}`,
                  background: isActive ? (isStraord ? 'rgba(139, 92, 246, 0.15)' : 'rgba(37, 99, 235, 0.15)') : 'transparent',
                  color: isActive ? (isStraord ? '#a78bfa' : '#60a5fa') : '#64748b',
                  fontFamily: 'Sora, sans-serif',
                  fontWeight: isActive ? 600 : 400
                }}
              >
                {es.anno} {isStraord ? 'straordinaria' : 'ordinaria'}
                <span style={st.esTag(es.stato === 'aperto')}>{es.stato}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Totale dovuto', value: eur(totaleDovuto), color: '#60a5fa' },
          { label: 'Totale incassato', value: eur(totalePagato), color: '#10b981' },
       { label: 'Residuo', value: eur(Math.max(0, totaleDovuto - totalePagato)), color: (totaleDovuto - totalePagato) > 0.01 ? '#f59e0b' : '#10b981' },
        ].map((k) => (
          <div key={k.label} style={{ background: 'var(--card-bg)', borderRadius: 10, padding: '14px 18px', border: `1px solid ${k.color}33` }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>{k.label}</div>
            <div style={{ color: k.color, fontSize: 20, fontWeight: 700 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {rateScaduteDa10Giorni.length > 0 && !dismissedBannerProposte && (
        <div style={st.bannerProposte}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <Megaphone size={20} style={{ color: '#fbbf24', flexShrink: 0 }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: 14 }}>Solleciti & Morosità Rilevati</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
                Rilevate {rateScaduteDa10Giorni.length} unità con rate scadute. Calcola interessi legali e genera solleciti o diffide legali in 1-Click.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate(`/condomini/${condominioId}?tab=morosita`)}
              style={{
                ...st.btnProposte,
                background: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <ShieldAlert size={14} /> Modulo Morosità & Diffide Legali
            </button>
            <button onClick={() => setShowProposteModal(true)} style={st.btnProposte}>
              Solleciti Rapidi ({rateScaduteDa10Giorni.length})
            </button>
            <button 
              onClick={() => setDismissedBannerProposte(true)}
              title="Chiudi avviso solleciti"
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {rate.length === 0 ? (
        <div style={{
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(124, 58, 237, 0.08) 100%)',
          border: '1px solid rgba(37, 99, 235, 0.25)',
          borderRadius: 14,
          padding: '32px 24px',
          textAlign: 'center',
          maxWidth: 620,
          margin: '24px auto'
        }}>
          <Coins size={38} style={{ margin: '0 auto 12px', color: '#60a5fa' }} />
          <h3 style={{ margin: '0 0 6px', fontSize: 17, color: 'var(--text-primary)', fontWeight: 700 }}>
            Nessun piano rate configurato per l'Esercizio {esercizio.anno}
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Genera istantaneamente la struttura delle rate e distribuisci le quote senza dover passare dal Preventivo:
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleGeneraRateRapide(4)}
              disabled={generandoRate}
              style={{
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: generandoRate ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'Sora, sans-serif',
                boxShadow: '0 3px 10px rgba(37, 99, 235, 0.25)'
              }}
            >
              {generandoRate ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
              <span>✨ 4 Rate Bimestrali</span>
            </button>
            <button
              onClick={() => handleGeneraRateRapide(12)}
              disabled={generandoRate}
              style={{
                background: 'var(--card-bg)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: generandoRate ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'Sora, sans-serif'
              }}
            >
              <Calendar size={14} style={{ color: '#38bdf8' }} />
              <span>12 Rate Mensili</span>
            </button>
            <button
              onClick={() => handleGeneraRateRapide(1)}
              disabled={generandoRate}
              style={{
                background: 'var(--card-bg)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: generandoRate ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'Sora, sans-serif'
              }}
            >
              <CreditCard size={14} style={{ color: '#a78bfa' }} />
              <span>Rata Unica Annuale</span>
            </button>
          </div>
        </div>
      ) : (
        <div style={st.scrollWrap}>
          <table style={st.table}>
            <thead>
              <tr>
                <th style={{ ...st.th, ...st.stickyCol, textAlign: 'left' }}>Unità</th>
                {rate.map((r) => (
                  <th key={r.id} style={st.th}>
                    <div style={{ color: 'var(--text-primary)' }}>{r.descrizione || `Rata ${r.numero_rata}`}</div>
                    <div style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11 }}>
                      {r.data_scadenza ? new Date(r.data_scadenza).toLocaleDateString('it-IT') : ''}
                    </div>
                  </th>
                ))}
                <th style={{ ...st.th, color: '#60a5fa' }}>Totale</th>
              </tr>
            </thead>
            <tbody>
              {unita.map((u) => {
                const p = getProprietario(u)
                const tu = totUnita(u.id)
                return (
                  <tr key={u.id}>
                    <td style={{ ...st.tdLabel, ...st.stickyCol }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Unità {u.numero}</div>
                      {renderProprietariTransizione(u)}
                      {esercizio?.tipo === 'ordinario' && configPagante[u.id] === 'inquilino' && getInquilino(u) && (
                        <div style={{
                          color: '#a78bfa',
                          fontSize: 10,
                          marginTop: 4,
                          fontWeight: 600,
                          background: 'rgba(139, 92, 246, 0.12)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          display: 'inline-block'
                        }}>
                          Pagante: {getInquilino(u).cognome} {getInquilino(u).nome}
                        </div>
                      )}
                    </td>
                    {rate.map((r) => {
                      const cell = cellMap[`${u.id}_${r.id}`]
                      const info = cellInfo(cell, r)
                      return (
                        <td key={r.id} style={st.td}>
                          <button
                            disabled={info.missing}
                            onClick={() => setEditing({ cell, rata: r, unita: u })}
                            style={{ ...st.cellBtn, background: info.bg, borderColor: info.color + '55', cursor: info.missing ? 'default' : 'pointer' }}
                            title={info.missing ? 'Cella assente: rigenera le rate' : info.label}
                          >
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{info.missing ? '—' : eur(info.importo)}</span>
                            {!info.missing && (
                              <span style={{ color: info.color, fontSize: 10, marginTop: 2 }}>
                                {info.label}
                                {info.label === 'Sovra-versata'
                                  ? ` · credito ${eur(info.credito)}`
                                  : (info.pagato > 0 && info.label !== 'Pagata' ? ` · ${eur(info.pagato)}` : '')}
                              </span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                    <td style={{ ...st.td, textAlign: 'right' }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{eur(tu.dovuto)}</div>
                      <div style={{ color: '#10b981', fontSize: 11 }}>{eur(tu.pagato)}</div>
                    </td>
                  </tr>
                )
              })}
              {/* riga totali per rata */}
              <tr>
                <td style={{ ...st.tdLabel, ...st.stickyCol, color: '#60a5fa', fontWeight: 700 }}>Totale rata</td>
                {rate.map((r) => {
                  const t = totRata(r.id)
                  return (
                    <td key={r.id} style={{ ...st.td, textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{eur(t.dovuto)}</div>
                      <div style={{ color: '#10b981', fontSize: 11 }}>{eur(t.pagato)}</div>
                    </td>
                  )
                })}
                <td style={{ ...st.td, textAlign: 'right' }}>
                  <div style={{ color: '#60a5fa', fontWeight: 700 }}>{eur(totaleDovuto)}</div>
                  <div style={{ color: '#10b981', fontSize: 11 }}>{eur(totalePagato)}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <CellEditor
          {...editing}
          getProprietario={getProprietario}
          getInquilino={getInquilino}
          configPagante={configPagante}
          esercizio={esercizio}
          onClose={() => setEditing(null)}
          onSave={(patch) => salvaCella(editing.cell, patch)}
          onSollecita={handleSollecitaRata}
          inviandoSollecito={inviandoSollecito}
          fetchUnita={fetchUnita}
        />
      )}
      {showProposteModal && (
        <ProposteSollecitoModal
          proposte={rateScaduteDa10Giorni}
          condominio={condominio}
          invioMassivoStato={invioMassivoStato}
          onClose={() => setShowProposteModal(false)}
          onSollecita={handleSollecitaRata}
          onInviaMassivo={handleInviaSollecitiMassivi}
          inviando={inviandoSollecito}
        />
      )}
    </div>
  )
}

// ── Editor cella (modale) ────────────────────────────────────
function CellEditor({ cell, rata, unita, getProprietario, getInquilino, configPagante, esercizio, onClose, onSave, onSollecita, inviandoSollecito, fetchUnita }) {
  const isOrdinario = esercizio?.tipo === 'ordinario'
  const paganteTipo = isOrdinario ? (configPagante[unita.id] || 'proprietario') : 'proprietario'
  const inq = getInquilino(unita)
  const activePayer = (paganteTipo === 'inquilino' && inq) ? inq : getProprietario(unita)

  const [importo, setImporto] = useState(cell?.importo ?? 0)
  const [pagato, setPagato] = useState(cell?.importo_pagato ?? 0)
  const [data, setData] = useState(cell?.data_pagamento || '')
  const pProp = getProprietario(unita)

  // Stati per la modifica anagrafica del pagante attivo
  const [showAnagrafica, setShowAnagrafica] = useState(false)
  const [nome, setNome] = useState(activePayer?.nome || '')
  const [cognome, setCognome] = useState(activePayer?.cognome || '')
  const [email, setEmail] = useState(activePayer?.email || '')
  const [telefono, setTelefono] = useState(activePayer?.telefono || '')
  const [salvandoAnagrafica, setSalvandoAnagrafica] = useState(false)

  const handleSalvaAnagrafica = async () => {
    if (!activePayer) return;
    setSalvandoAnagrafica(true);
    try {
      const { error } = await supabase
        .from('persone')
        .update({ nome, cognome, email, telefono })
        .eq('id', activePayer.id);
      if (error) throw error;
      toast.success('Anagrafica salvata con successo!');
      if (fetchUnita) await fetchUnita();
    } catch (err) {
      toast.error("Errore durante il salvataggio dell'anagrafica: " + err.message);
    } finally {
      setSalvandoAnagrafica(false);
    }
  };

  const segnaPagata = () => onSave({
    importo_pagato: parseFloat(importo) || 0,
    data_pagamento: data || new Date().toISOString().split('T')[0],
  })

  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={st.modal} onClick={(e) => e.stopPropagation()}>
        <div style={st.modalHead}>
          <div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Unità {unita.numero}{activePayer ? ` · ${activePayer.cognome} ${activePayer.nome}` : ''}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              {rata.descrizione || `Rata ${rata.numero_rata}`} · scad. {rata.data_scadenza ? new Date(rata.data_scadenza).toLocaleDateString('it-IT') : '—'}
            </div>
          </div>
          <button style={st.btnIcon} onClick={onClose}><X size={16} /></button>
        </div>

        <label style={st.fieldLabel}>Importo dovuto (piano)</label>
        <input style={st.input} type="number" value={importo} onChange={(e) => setImporto(e.target.value)} />
        <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '4px 0 12px' }}>Modificarlo segna la cella come "modificata manualmente".</p>

        <label style={st.fieldLabel}>Importo incassato</label>
        <input style={st.input} type="number" value={pagato} onChange={(e) => setPagato(e.target.value)} />

        <label style={{ ...st.fieldLabel, marginTop: 12 }}>Data pagamento</label>
        <input style={st.input} type="date" value={data || ''} onChange={(e) => setData(e.target.value)} />

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button style={st.btnGhost} onClick={segnaPagata}><CheckCircle2 size={15} style={{ marginRight: 6 }} />Segna pagata</button>
          <button style={st.btnPrimary} onClick={() => onSave({ importo, importo_pagato: pagato, data_pagamento: data })}>Salva</button>
        </div>

        {((parseFloat(importo) || 0) > (parseFloat(pagato) || 0)) && activePayer?.email && (
          <button 
            type="button" 
            disabled={inviandoSollecito}
            style={{ ...st.btnPrimary, background: '#ef4444', marginTop: 10, width: '100%' }} 
            onClick={() => onSollecita(unita, pProp).then(() => onClose())}
          >
            {inviandoSollecito ? 'Invio sollecito...' : `Invia Sollecito Rata a ${activePayer.nome}`}
          </button>
        )}

        <div style={{ marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
          <button 
            type="button" 
            onClick={() => setShowAnagrafica(!showAnagrafica)} 
            style={{ ...st.btnGhost, color: '#60a5fa', borderColor: 'transparent', padding: '4px 0', fontSize: 12, justifyContent: 'flex-start', width: '100%', display: 'flex', alignItems: 'center' }}
          >
            {showAnagrafica ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ChevronDown size={14} /> Nascondi Anagrafica
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ChevronRight size={14} /> Modifica Anagrafica {paganteTipo === 'inquilino' ? 'Inquilino' : 'Proprietario'}
              </span>
            )}
          </button>

          {showAnagrafica && activePayer && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, textAlign: 'left' }}>
              <div>
                <label style={st.fieldLabel}>Nome</label>
                <input style={st.input} type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div>
                <label style={st.fieldLabel}>Cognome</label>
                <input style={st.input} type="text" value={cognome} onChange={(e) => setCognome(e.target.value)} />
              </div>
              <div>
                <label style={st.fieldLabel}>Email</label>
                <input style={st.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label style={st.fieldLabel}>Telefono</label>
                <input style={st.input} type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </div>
              <button 
                type="button"
                disabled={salvandoAnagrafica}
                onClick={handleSalvaAnagrafica} 
                style={{ ...st.btnPrimary, background: '#10b981', marginTop: 6 }}
              >
                {salvandoAnagrafica ? 'Salvataggio...' : 'Salva Anagrafica'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modale Proposte Solleciti (Scaduti da > 10 giorni) ─────────
function ProposteSollecitoModal({ proposte, condominio, invioMassivoStato, onClose, onSollecita, onInviaMassivo, inviando }) {
  const [selezionati, setSelezionati] = useState(proposte.map(p => p.unita.id));
  const [iban, setIban] = useState(condominio?.iban || '');
  const [oggetto, setOggetto] = useState('Sollecito pagamento rate condominiali - {CONDOMINIO}');
  const [testo, setTesto] = useState(`Gentile <strong>{NOME}</strong>,<br/><br/>Le inviamo la presente comunicazione in merito alle scadenze condominiali dell'esercizio in corso del condominio <strong>{CONDOMINIO}</strong> per l'unità <strong>{UNITA}</strong>.<br/><br/>Dalle nostre scritture contabili risulta un importo insoluto attualmente scaduto pari a: <strong>{IMPORTO_SCADUTO}</strong>.<br/><br/>La invitiamo a regolarizzare la sua posizione il prima possibile a mezzo bonifico bancario sulle seguenti coordinate:<br/>IBAN: <strong>{IBAN}</strong><br/><br/>In allegato alla presente email troverà il PDF contenente il dettaglio completo delle rate e dei pagamenti registrati.<br/><br/>Restiamo a disposition per qualsiasi chiarimento.<br/><br/>Cordiali saluti,<br/>L'Amministratore`);
  const [allegaPdf, setAllegaPdf] = useState(true);

  // Mappa dei canali scelti per ciascuna unità (default email se ha l'email, cartaceo altrimenti)
  const [canali, setCanali] = useState(() => {
    const init = {};
    proposte.forEach(p => {
      init[p.unita.id] = p.destinatario?.email ? 'email' : 'cartaceo';
    });
    return init;
  });

  const [partnerPostale, setPartnerPostale] = useState('nessuno');
  const [tipoCartaceo, setTipoCartaceo] = useState('stampa'); // 'stampa' | 'partner'

  useEffect(() => {
    async function loadPartner() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('partner_postale_nome')
          .eq('id', user.id)
          .maybeSingle();
        if (data?.partner_postale_nome) {
          setPartnerPostale(data.partner_postale_nome);
          if (data.partner_postale_nome !== 'nessuno') {
            setTipoCartaceo('partner');
          }
        }
      }
    }
    loadPartner();
  }, []);

  // Sincronizza l'IBAN se il condominio viene caricato asincronicamente
  useEffect(() => {
    if (condominio?.iban) {
      setIban(condominio.iban);
    }
  }, [condominio]);

  const handleToggle = (id) => {
    if (selezionati.includes(id)) {
      setSelezionati(prev => prev.filter(x => x !== id));
    } else {
      setSelezionati(prev => [...prev, id]);
    }
  };

  const handleSelectAll = () => {
    if (selezionati.length === proposte.length) {
      setSelezionati([]);
    } else {
      setSelezionati(proposte.map(p => p.unita.id));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selezionati.length === 0) {
      toast.error("Seleziona almeno un condomino da sollecitare.");
      return;
    }
    const proposteSelezionate = proposte
      .filter(p => selezionati.includes(p.unita.id))
      .map(p => ({
        ...p,
        canale: canali[p.unita.id]
      }));

    onInviaMassivo({
      proposteSelezionate,
      oggettoTemplate: oggetto,
      testoTemplate: testo,
      ibanDaUsare: iban,
      allegaPdf,
      canaleCartaceoConfig: { tipoCartaceo }
    });
  };

  const haCartaceiSelezionati = proposte
    .filter(p => selezionati.includes(p.unita.id))
    .some(p => canali[p.unita.id] === 'cartaceo');

  return (
    <div style={st.overlay}>
      <div style={{ ...st.modal, width: 750, maxWidth: '95vw' }}>
        <div style={st.modalHead}>
          <div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>Gestione Solleciti di Pagamento Massivi</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
              Seleziona i condòmini morosi, imposta il canale (E-mail o Cartaceo) e personalizza il template.
            </div>
          </div>
          <button style={st.btnIcon} onClick={onClose} disabled={invioMassivoStato.inCorso}><X size={16} /></button>
        </div>

        {invioMassivoStato.inCorso ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600 }}>
              Elaborazione ed invio dei solleciti in corso...
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Elaborato {invioMassivoStato.corrente} di {invioMassivoStato.totale} solleciti {invioMassivoStato.falliti > 0 && `(${invioMassivoStato.falliti} falliti)`}
            </div>
            <div style={{ height: 8, background: 'var(--card-bg)', borderRadius: 4, overflow: 'hidden', width: '100%', maxWidth: 400, margin: '0 auto' }}>
              <div style={{
                height: '100%',
                background: '#2563eb',
                width: `${Math.round((invioMassivoStato.corrente / invioMassivoStato.totale) * 100)}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 10 }}>
            
            {/* Grid principale */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20 }}>
              
              {/* Colonna Destinatari */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={st.fieldLabel}>Seleziona Condòmini ({selezionati.length})</label>
                  <button type="button" onClick={handleSelectAll} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: 0 }}>
                    {selezionati.length === proposte.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                  </button>
                </div>

                <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--app-bg)', display: 'flex', flexDirection: 'column' }}>
                  {proposte.map(p => {
                    const isSelected = selezionati.includes(p.unita.id);
                    const haEmail = !!p.destinatario?.email;
                    const canaleCorrente = canali[p.unita.id];

                    return (
                      <label key={p.unita.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border-color-2)', cursor: 'pointer', background: isSelected ? 'rgba(37,99,235,0.06)' : 'transparent', transition: 'background-color 0.15s' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggle(p.unita.id)}
                          style={{ marginRight: 12, cursor: 'pointer' }}
                        />
                        <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                              U. {p.unita.numero} - {p.destinatario.cognome} {p.destinatario.nome}
                            </span>
                            
                            {/* Selettore Canale */}
                            {haEmail ? (
                              <select
                                value={canaleCorrente}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setCanali(prev => ({ ...prev, [p.unita.id]: e.target.value }));
                                }}
                                style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 11, padding: '2px 4px', cursor: 'pointer' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="email">E-mail</option>
                                <option value="cartaceo">Cartaceo</option>
                              </select>
                            ) : (
                              <span style={{ fontSize: 10, color: '#f59e0b', background: '#f59e0b15', border: '1px solid #f59e0b30', borderRadius: 4, padding: '2px 6px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Mail size={10} /> Cartaceo
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Rate: {p.rateCoinvolte}</span>
                            <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 700 }}>€ {p.importoInsoluto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Colonna Template Email */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={st.fieldLabel}>IBAN Condominio per Pagamento</label>
                  <input
                    type="text"
                    style={st.input}
                    value={iban}
                    onChange={e => setIban(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                    placeholder="Codice IBAN del condominio..."
                    required
                  />
                </div>

                <div>
                  <label style={st.fieldLabel}>Oggetto Sollecito</label>
                  <input
                    type="text"
                    style={st.input}
                    value={oggetto}
                    onChange={e => setOggetto(e.target.value)}
                    placeholder="Oggetto..."
                    required
                  />
                </div>

                <div>
                  <label style={st.fieldLabel}>Testo Lettera (HTML)</label>
                  <textarea
                    style={{ ...st.input, minHeight: 100, resize: 'vertical', fontSize: 12, lineHeight: 1.5 }}
                    value={testo}
                    onChange={e => setTesto(e.target.value)}
                    placeholder="Testo del sollecito..."
                    required
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {['{NOME}', '{UNITA}', '{CONDOMINIO}', '{IMPORTO_SCADUTO}', '{IBAN}'].map(tag => (
                      <span key={tag} style={{ color: 'var(--text-muted)', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontFamily: 'monospace' }}>{tag}</span>
                    ))}
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
                  <input
                    type="checkbox"
                    checked={allegaPdf}
                    onChange={e => setAllegaPdf(e.target.checked)}
                    style={{ marginRight: 8, cursor: 'pointer' }}
                  />
                  Allega lettera sollecito in formato PDF (dettaglio rate)
                </label>

                {/* Opzioni Spedizione Cartacea */}
                {haCartaceiSelezionati && (
                  <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    <label style={st.fieldLabel}>Opzione Spedizione Cartacea</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="tipoCartaceo"
                          checked={tipoCartaceo === 'stampa'}
                          onChange={() => setTipoCartaceo('stampa')}
                          style={{ marginRight: 8 }}
                        />
                        Stampa Manuale (Genera PDF unico)
                      </label>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        color: partnerPostale === 'nessuno' ? '#64748b' : 'var(--text-secondary)',
                        fontSize: 12,
                        cursor: partnerPostale === 'nessuno' ? 'not-allowed' : 'pointer'
                      }}>
                        <input
                          type="radio"
                          name="tipoCartaceo"
                          checked={tipoCartaceo === 'partner'}
                          disabled={partnerPostale === 'nessuno'}
                          onChange={() => setTipoCartaceo('partner')}
                          style={{ marginRight: 8 }}
                        />
                        Invia tramite Partner ({partnerPostale === 'nessuno' ? 'Non config.' : partnerPostale === 'multidialogo_simulato' ? 'Multidialogo Sim.' : 'Multidialogo'})
                      </label>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border-color)', paddingTop: 14, marginTop: 6 }}>
              <button type="button" style={st.btnCancel} onClick={onClose} disabled={inviando}>Annulla</button>
              <button
                type="submit"
                disabled={inviando || selezionati.length === 0}
                style={{ ...st.btnPrimary, background: '#ef4444', width: 'auto', padding: '10px 24px' }}
              >
                Elabora {selezionati.length} Solleciti
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const st = {
  empty: { textAlign: 'center', padding: 40, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border-color)' },
  scrollWrap: { overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 12 },
  table: { borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontFamily: 'Sora, sans-serif' },
  th: { background: 'var(--app-bg)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, padding: '12px 10px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--border-color-2)', verticalAlign: 'middle' },
  tdLabel: { padding: '8px 12px', borderBottom: '1px solid var(--border-color-2)', whiteSpace: 'nowrap' },
  stickyCol: { position: 'sticky', left: 0, background: 'var(--card-bg)', zIndex: 1 },
  cellBtn: { width: '100%', minWidth: 92, border: '1px solid', borderRadius: 8, padding: '8px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'Sora, sans-serif' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  modal: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 22, width: 360, maxWidth: '90vw', fontFamily: 'Sora, sans-serif' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 10 },
  fieldLabel: { display: 'block', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
  input: { width: '100%', boxSizing: 'border-box', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '9px 10px', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none' },
  btnPrimary: { flex: 1, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
  btnGhost: { flex: 1, background: 'transparent', color: '#10b981', border: '1px solid #10b98155', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  btnIcon: { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  esBtn: (active) => ({ padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: `1px solid ${active ? '#2563eb' : 'var(--border-color)'}`, background: active ? 'rgba(37,99,235,0.15)' : 'transparent', color: active ? '#60a5fa' : '#64748b', fontFamily: 'Sora, sans-serif', fontWeight: active ? 600 : 400 }),
  esTag: (aperto) => ({ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 4, background: aperto ? '#10b98122' : '#64748b22', color: aperto ? '#10b981' : '#64748b' }),
  bannerProposte: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f59e0b15', border: '1px solid #f59e0b40', borderRadius: 12, padding: '14px 20px', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  btnProposte: { background: '#f59e0b', color: 'var(--app-bg)', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
  btnCancel: { background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 20px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontSize: 13 },
}