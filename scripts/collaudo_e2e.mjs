// scripts/collaudo_e2e.mjs
// Script completo per il collaudo E2E automatico del flusso contabile dell'esercizio 2025
// Uso:  node scripts/collaudo_e2e.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';

// ── Caricamento .env ──────────────────────────────────────────────────────────
try {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* .env opzionale */ }

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const EMAIL = process.env.SMOKE_EMAIL;
const PASS = process.env.SMOKE_PASSWORD;

if (!URL || !ANON || !EMAIL || !PASS) {
  console.error('❌ Mancano credenziali in .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SMOKE_EMAIL, SMOKE_PASSWORD).');
  process.exit(1);
}

// ── Inizializzazione Client Supabase ──────────────────────────────────────────
const supabase = createClient(URL, ANON);
console.log('🔄 Autenticazione in corso su Supabase...');
const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASS });
if (authErr) {
  console.error('❌ Login fallito:', authErr.message);
  process.exit(1);
}
const token = auth.session.access_token;
const adminId = auth.user.id;
console.log(`✅ Autenticato come: ${EMAIL} (ID: ${adminId})`);

const client = createClient(URL, ANON, {
  global: {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  },
});

// ── Helper Chiamate AI tramite claude-proxy ──────────────────────────────────
function sanitizeInput(text, maxLength = 40000) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, maxLength)
    .trim();
}

async function callClaude(prompt, opts = {}) {
  const { funzione, maxTokens = 1000, system, jsonMode = true } = opts;
  const res = await fetch(`${URL}/functions/v1/claude-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      type: 'text',
      prompt: sanitizeInput(prompt),
      maxTokens,
      system: system ? sanitizeInput(system, 4000) : undefined,
      funzione,
      jsonMode,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI Call error ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const block = data.content?.find(b => b.type === 'text');
  return block?.text ?? '';
}

async function callClaudeDocument(prompt, base64Document, opts = {}) {
  const { funzione, maxTokens = 8000, system, mediaType = 'application/pdf', jsonMode = true } = opts;
  const res = await fetch(`${URL}/functions/v1/claude-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      type: 'document',
      prompt: sanitizeInput(prompt),
      document: base64Document,
      mediaType,
      maxTokens,
      system: system ? sanitizeInput(system, 4000) : undefined,
      funzione,
      jsonMode,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI Document Call error ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const block = data.content?.find(b => b.type === 'text');
  return block?.text ?? '';
}

function pulisciEdEstraiJson(risposta, isArray = false) {
  const rawStr = String(risposta || '').trim();
  const regex = isArray ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const match = rawStr.match(regex);
  const clean = match ? match[0] : rawStr.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// Helper per matching fuzzy dei nomi
function trovaPersonaFuzzy(nominativoCompleto, personeMap) {
  if (!nominativoCompleto) return null;
  const pulito = nominativoCompleto.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  const parole = pulito.split(/\s+/).filter(p => p.length > 2);

  for (const [key, id] of Object.entries(personeMap)) {
    const keyPulita = key.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    if (keyPulita.includes(pulito) || pulito.includes(keyPulita)) {
      return id;
    }
    const matchTutte = parole.every(p => keyPulita.includes(p));
    if (matchTutte && parole.length > 0) {
      return id;
    }
  }
  return null;
}

function parsePiano(pianoStr) {
  if (!pianoStr) return 1;
  const p = String(pianoStr).toLowerCase().trim();
  if (p === 'terra' || p === 't' || p === 't.' || p === '0' || p === 'p.t.' || p === 'pt') return 0;
  if (p.includes('seminterrato') || p.includes('-1') || p.includes('s1') || p.includes('s. 1')) return -1;
  const num = parseInt(p.replace(/[^0-9\-]/g, ''), 10);
  return isNaN(num) ? 1 : num;
}

const TEST_DIR = './test_data /testgestionale';
const STATE_FILE = './scripts/e2e_state.json';
let state = {
  condominioId: null,
  esercizioId: null,
  personeMap: {},
  unitaMap: {},
  tabelleMillesimali: {}, // nome_tabella -> tabella_id
  preventivoId: null,
  speseMappa: {},       // descrizione_spesa -> spesa_id
  fattureMappa: {},     // file_name -> fattura_id
  movimentiCaricati: false,
};

if (existsSync(STATE_FILE)) {
  try {
    const loaded = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    state = {
      ...state,
      ...loaded,
      personeMap: { ...state.personeMap, ...(loaded.personeMap || {}) },
      unitaMap: { ...state.unitaMap, ...(loaded.unitaMap || {}) },
      tabelleMillesimali: { ...state.tabelleMillesimali, ...(loaded.tabelleMillesimali || {}) },
      speseMappa: { ...state.speseMappa, ...(loaded.speseMappa || {}) },
      fattureMappa: { ...state.fattureMappa, ...(loaded.fattureMappa || {}) },
    };
  } catch (e) {}
}

function saveState() {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// =============================================================================
// FASE CONTROLLO E PULIZIA
// =============================================================================
async function resetCondominioSeEsistente(nomeCondominio) {
  console.log(`🔎 Controllo se il condominio "${nomeCondominio}" esiste già...`);
  const { data: condo, error } = await client
    .from('condomini')
    .select('id')
    .eq('nome', nomeCondominio)
    .eq('amministratore_id', adminId)
    .maybeSingle();

  if (error) {
    console.error('Errore durante il controllo del condominio:', error.message);
    return;
  }

  if (condo) {
    console.log(`🗑️ Condominio esistente trovato (ID: ${condo.id}). Procedo alla cancellazione ordinata per resettare il test...`);
    
    const tabelleFiglie = [
      'riconciliazioni_incassi',
      'rate_unita',
      'rate',
      'preventivi',
      'spese',
      'saldi_iniziali_unita',
      'estratto_conto',
      'documenti_condominio',
      'tabelle_millesimali',
      'unita',
      'esercizi'
    ];

    for (const tab of tabelleFiglie) {
      const { error: delErr } = await client.from(tab).delete().eq('condominio_id', condo.id);
      if (delErr) {
        console.warn(`   ⚠️ Errore pulizia tabella ${tab}:`, delErr.message);
      }
    }

    const { error: delCondoErr } = await client.from('condomini').delete().eq('id', condo.id);
    if (delCondoErr) {
      console.error('❌ Errore eliminazione condominio:', delCondoErr.message);
      process.exit(1);
    }
    console.log('✅ Pulizia e reset completati con successo.');
  }
}

// =============================================================================
// FLUSSO DI COLLAUDO E2E
// =============================================================================
async function main() {
  const CONDO_NOME = 'CONDOMINIO CANZIGHINA E2E';

  // Verifica se il condominio registrato nello stato esiste ancora nel DB
  if (state.condominioId) {
    const { data: condoEsistente } = await client
      .from('condomini')
      .select('id')
      .eq('id', state.condominioId)
      .maybeSingle();

    if (!condoEsistente) {
      console.log('⚠️ Il condominio registrato nello stato non esiste più nel DB. Resetto lo stato del test E2E.');
      state = {
        condominioId: null,
        esercizioId: null,
        personeMap: {},
        unitaMap: {},
        tabelleMillesimali: {},
        preventivoId: null,
        speseMappa: {},
        fattureMappa: {},
        movimentiCaricati: false,
      };
      saveState();
    }
  }

  // 1. Reset e creazione condominio
  if (!state.condominioId) {
    await resetCondominioSeEsistente(CONDO_NOME);

    console.log(`➕ Creazione condominio "${CONDO_NOME}"...`);
    const { data: condo, error: condoErr } = await client
      .from('condomini')
      .insert({
        nome: CONDO_NOME,
        indirizzo: 'Via Canzighina',
        civico: '1',
        citta: 'Milano',
        cap: '20100',
        provincia: 'MI',
        codice_fiscale: '90012345678',
        amministratore_id: adminId,
      })
      .select('id')
      .single();

    if (condoErr) {
      console.error('❌ Errore creazione condominio:', condoErr.message);
      process.exit(1);
    }
    state.condominioId = condo.id;
    console.log(`✅ Condominio creato. ID: ${state.condominioId}`);
    saveState();
  }

  let condominioId = state.condominioId;

  // 2. Creazione Esercizio 2025
  if (!state.esercizioId) {
    console.log('➕ Creazione Esercizio contabile 2025...');
    const { data: es, error: esErr } = await client
      .from('esercizi')
      .insert({
        condominio_id: condominioId,
        anno: 2025,
        data_inizio: '2025-01-01',
        data_fine: '2025-12-31',
        stato: 'aperto',
        saldo_iniziale_cassa: 0.00
      })
      .select('id')
      .single();

    if (esErr) {
      console.error('❌ Errore creazione esercizio:', esErr.message);
      process.exit(1);
    }
    state.esercizioId = es.id;
    console.log(`✅ Esercizio 2025 creato. ID: ${state.esercizioId}`);
    saveState();
  }

  let esercizioId = state.esercizioId;

  // 3. Estrazione e inserimento Anagrafica da DOCX
  if (Object.keys(state.personeMap).length === 0) {
    console.log('🔍 Lettura ed estrazione anagrafica da "Elenco condomini.docx"...');
    const docxPath = path.join(TEST_DIR, 'Elenco condomini.docx');
    const docxBuffer = readFileSync(docxPath);
    const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });

    console.log('🤖 Invio testo DOCX a Claude Proxy per estrarre le anagrafiche...');
    const systemPrompt = `Sei un esperto di amministrazione condominiale italiana ed estrazione dati.
Estrai l'elenco di tutte le persone e i loro dati anagrafici (inclusi i contatti di email/telefono se presenti) e l'associazione alle unità immobiliari.
Per ogni persona restituisci un oggetto JSON con questi campi esattamente:
nome, cognome, email, telefono, indirizzo, citta, cap, provincia, codice_fiscale, ruolo ("proprietario"|"inquilino"|""), unita (identificativo/numero dell'unità).
Rispondi SOLO con un array JSON valido, senza testo aggiuntivo e senza markdown.`;

    const rawResponse = await callClaude(
      `Estrai le anagrafiche dal seguente testo:\n\n${docxText}`,
      { system: systemPrompt, funzione: 'import_anagrafica', maxTokens: 8000 }
    );

    const personeEstratte = pulisciEdEstraiJson(rawResponse, true);
    console.log(`📊 AI ha estratto ${personeEstratte.length} soggetti anagrafici.`);

    for (const p of personeEstratte) {
      const numUnita = p.unita ? String(p.unita).trim() : null;
      let unitaId = null;

      if (numUnita) {
        if (state.unitaMap[numUnita]) {
          unitaId = state.unitaMap[numUnita];
        } else {
          const { data: newUnita, error: uErr } = await client
            .from('unita')
            .insert({
              condominio_id: condominioId,
              numero: numUnita,
              tipo: numUnita.toLowerCase().includes('box') || numUnita.toLowerCase().includes('gar') ? 'box' : 'appartamento',
              scala: 'A',
              piano: 1,
              mq: 80,
            })
            .select('id')
            .single();

          if (uErr) {
            console.error(`❌ Errore creazione unità ${numUnita}:`, uErr.message);
            process.exit(1);
          }
          unitaId = newUnita.id;
          state.unitaMap[numUnita] = unitaId;
          saveState();
        }
      }

      const cognomeNomeKey = `${p.cognome || ''} ${p.nome || ''}`.trim();
      let personaId = state.personeMap[cognomeNomeKey];

      if (!personaId) {
        const { data: newPersona, error: pErr } = await client
          .from('persone')
          .insert({
            nome: p.nome || 'N/D',
            cognome: p.cognome || 'N/D',
            codice_fiscale: p.codice_fiscale || null,
            email: p.email || null,
            telefono: p.telefono || null,
            user_id: adminId,
          })
          .select('id')
          .single();

        if (pErr) {
          console.error(`❌ Errore creazione persona ${cognomeNomeKey}:`, pErr.message);
          process.exit(1);
        }
        personaId = newPersona.id;
        state.personeMap[cognomeNomeKey] = personaId;
        saveState();
      }

      if (unitaId && personaId) {
        const { error: occErr } = await client
          .from('occupanti_unita')
          .insert({
            unita_id: unitaId,
            persona_id: personaId,
            ruolo: p.ruolo || 'proprietario',
            attivo: true,
          });

        if (occErr) {
          console.warn(`   ⚠️ Errore associazione occupante ${cognomeNomeKey} a unità ${numUnita}:`, occErr.message);
        }
      }
    }
    console.log('✅ Importazione anagrafica e unità completata.');
  }

  // 4. Estrazione millesimi da PDF
  if (Object.keys(state.tabelleMillesimali).length === 0) {
    console.log('🔍 Estrazione millesimi da "Millesimi Via Canzighina - rettificati.pdf"...');
    const pdfPath = path.join(TEST_DIR, 'Millesimi Via Canzighina - rettificati.pdf');
    const pdfBase64 = readFileSync(pdfPath).toString('base64');

    const systemPromptMillesimi = `Sei un esperto catastale italiano ed estrazione dati.
Analizza il documento ed estrai le tabelle millesimali.
Restituisci SOLO un oggetto JSON valido con questa struttura:
{
  "tabelle": [
    {
      "nome": "Nome della tabella millesimale (es. Proprietà generale, Scale)",
      "righe": [
        {
          "unita": "Numero unità/interno/subalterno (es. Sub. 3, Int. 1, 1)",
          "piano": "Piano dell'unità",
          "destinazione": "appartamento" | "box" | "negozio" | "posto_auto",
          "proprietario_nome": "Nome proprietario",
          "proprietario_cognome": "Cognome proprietario",
          "nominativo_completo": "Nominativo intero (es. ROSSI MARIO)",
          "valore": number (valore millesimale decimale, es. 120.45)
        }
      ]
    }
  ]
}`;

    const rawResponse = await callClaudeDocument(
      'Estrai le tabelle millesimali presenti in questo documento.',
      pdfBase64,
      { system: systemPromptMillesimi, funzione: 'estrai_tabelle_millesimali', maxTokens: 8000 }
    );

    const millesimiDati = pulisciEdEstraiJson(rawResponse, false);
    const tabelle = millesimiDati.tabelle || [];
    console.log(`📊 AI ha estratto ${tabelle.length} tabelle millesimali.`);

    for (const tab of tabelle) {
      console.log(`   ➕ Inserimento tabella millesimale "${tab.nome}"...`);
      const { data: newTab, error: tabErr } = await client
        .from('tabelle_millesimali')
        .insert({
          condominio_id: condominioId,
          nome: tab.nome,
        })
        .select('id')
        .single();

      if (tabErr) {
        console.error(`❌ Errore creazione tabella millesimale ${tab.nome}:`, tabErr.message);
        process.exit(1);
      }

      state.tabelleMillesimali[tab.nome] = newTab.id;
      saveState();

      for (const riga of (tab.righe || [])) {
        let unitaId = null;
        const unitaNum = riga.unita ? String(riga.unita).trim() : null;

        if (!unitaNum) continue;

        if (state.unitaMap[unitaNum]) {
          unitaId = state.unitaMap[unitaNum];
        } else {
          const { data: newU, error: uErr } = await client
            .from('unita')
            .insert({
              condominio_id: condominioId,
              numero: unitaNum,
              tipo: riga.destinazione || 'appartamento',
              scala: 'A',
              piano: parsePiano(riga.piano),
              mq: 80,
            })
            .select('id')
            .single();

          if (uErr) {
            console.error(`❌ Errore creazione unità ${unitaNum}:`, uErr.message);
            process.exit(1);
          }
          unitaId = newU.id;
          state.unitaMap[unitaNum] = unitaId;
          saveState();
        }

        let personaId = trovaPersonaFuzzy(riga.nominativo_completo, state.personeMap);
        if (!personaId && riga.nominativo_completo) {
          const cognome = riga.proprietario_cognome || riga.nominativo_completo.split(' ')[0] || 'N/D';
          const nome = riga.proprietario_nome || riga.nominativo_completo.split(' ').slice(1).join(' ') || 'N/D';
          const cognomeNomeKey = `${cognome} ${nome}`.trim();

          const { data: newP, error: pErr } = await client
            .from('persone')
            .insert({
              nome,
              cognome,
              user_id: adminId,
            })
            .select('id')
            .single();

          if (!pErr) {
            personaId = newP.id;
            state.personeMap[cognomeNomeKey] = personaId;
            saveState();
          }
        }

        if (unitaId && personaId) {
          const { data: occExists } = await client
            .from('occupanti_unita')
            .select('id')
            .eq('unita_id', unitaId)
            .eq('persona_id', personaId)
            .maybeSingle();

          if (!occExists) {
            await client.from('occupanti_unita').insert({
              unita_id: unitaId,
              persona_id: personaId,
              ruolo: 'proprietario',
              attivo: true,
            });
          }
        }

        const { error: millErr } = await client
          .from('millesimi_unita')
          .insert({
            tabella_id: newTab.id,
            unita_id: unitaId,
            valore: parseFloat(riga.valore) || 0,
          });

        if (millErr) {
          console.error(`❌ Errore salvataggio millesimo per unità ${unitaNum} in tabella ${tab.nome}:`, millErr.message);
          process.exit(1);
        }
      }
    }
    console.log('✅ Caricamento millesimi completato.');
  }

  // 5. Saldi Iniziali da CONSUNTIVO 2024
  const { data: saldiCaricati } = await client
    .from('saldi_iniziali_unita')
    .select('id')
    .eq('esercizio_id', esercizioId);

  if (!saldiCaricati || saldiCaricati.length === 0) {
    console.log('🔍 Estrazione saldi di chiusura 2024 da "CONSUNTIVO 2024.pdf"...');
    const pdfPath = path.join(TEST_DIR, 'CONSUNTIVO 2024.pdf');
    const pdfBase64 = readFileSync(pdfPath).toString('base64');

    const systemPromptSaldi = `Sei un esperto contabile. Estrai i saldi di chiusura dal rendiconto condominiale.
Restituisci SOLO un JSON valido con questa struttura:
{
  "saldo_cassa_finale": number | null (il saldo della cassa/conto corrente bancario al 31/12),
  "saldi_unita": [
    {
      "unita": "Numero o interno unità (es. Sub. 3, Int. 1)",
      "nominativo": "Nome condomino come scritto nel riparto",
      "saldo": number (positivo = credito condòmino, negativo = debito condòmino)
    }
  ]
}`;

    const rawResponse = await callClaudeDocument(
      'Estrai i saldi di chiusura dal consuntivo.',
      pdfBase64,
      { system: systemPromptSaldi, funzione: 'estrai_saldi_consuntivo', maxTokens: 8000 }
    );

    const saldiDati = pulisciEdEstraiJson(rawResponse, false);
    console.log(`📊 AI ha estratto il saldo cassa finale: €${saldiDati.saldo_cassa_finale} e ${saldiDati.saldi_unita?.length} saldi unità.`);

    if (saldiDati.saldo_cassa_finale != null) {
      await client
        .from('esercizi')
        .update({ saldo_iniziale_cassa: parseFloat(saldiDati.saldo_cassa_finale) })
        .eq('id', esercizioId);
      console.log(`   🏛️ Saldo cassa iniziale impostato a: €${saldiDati.saldo_cassa_finale}`);
    }

    for (const su of (saldiDati.saldi_unita || [])) {
      let unitaId = null;
      const unitaNum = su.unita ? String(su.unita).trim() : null;

      if (unitaNum && state.unitaMap[unitaNum]) {
        unitaId = state.unitaMap[unitaNum];
      } else {
        const personaId = trovaPersonaFuzzy(su.nominativo, state.personeMap);
        if (personaId) {
          const { data: occ } = await client
            .from('occupanti_unita')
            .select('unita_id')
            .eq('persona_id', personaId)
            .eq('attivo', true)
            .limit(1)
            .maybeSingle();
          if (occ) unitaId = occ.unita_id;
        }
      }

      if (unitaId) {
        const { error: sErr } = await client
          .from('saldi_iniziali_unita')
          .insert({
            esercizio_id: esercizioId,
            unita_id: unitaId,
            condominio_id: condominioId,
            saldo: parseFloat(su.saldo) || 0,
            note: 'Riporto da Esercizio 2024',
          });

        if (sErr) {
          console.error(`❌ Errore salvataggio saldo iniziale per unità ${unitaNum}:`, sErr.message);
          process.exit(1);
        }
      }
    }
    console.log('✅ Caricamento saldi iniziali completato.');
  }

  // 6. Preventivo 2025 e Rate
  if (!state.preventivoId) {
    console.log('🔍 Estrazione preventivo da "2025 PREVENTIVO.pdf"...');
    const pdfPath = path.join(TEST_DIR, '2025 PREVENTIVO.pdf');
    const pdfBase64 = readFileSync(pdfPath).toString('base64');

    const systemPromptPrev = `Sei un esperto contabile italiano. Estrai le voci di spesa previste dal preventivo condominiale.
Restituisci SOLO un JSON valido con questa struttura:
{
  "totale": number,
  "voci": [
    {
      "descrizione": "Descrizione della voce di spesa (es. Assicurazione stabile)",
      "categoria": "assicurazione" | "utenze" | "manutenzione" | "amministrazione" | "straordinaria" | "altro",
      "importo": number,
      "criterio": "millesimi" | "parti_uguali"
    }
  ]
}`;

    const rawResponse = await callClaudeDocument(
      'Estrai le voci di spesa previste dal preventivo.',
      pdfBase64,
      { system: systemPromptPrev, funzione: 'estrai_preventivo', maxTokens: 8000 }
    );

    const prevDati = pulisciEdEstraiJson(rawResponse, false);
    console.log(`📊 AI ha estratto preventivo di totale €${prevDati.totale} con ${prevDati.voci?.length} voci.`);

    const { data: newPrev, error: prevErr } = await client
      .from('preventivi')
      .insert({
        condominio_id: condominioId,
        esercizio_id: esercizioId,
        totale: parseFloat(prevDati.totale) || 0,
        stato: 'approvato',
      })
      .select('id')
      .single();

    if (prevErr) {
      console.error('❌ Errore creazione preventivo:', prevErr.message);
      process.exit(1);
    }
    state.preventivoId = newPrev.id;
    saveState();

    const tabellaProprietaId = Object.values(state.tabelleMillesimali)[0] || null;

    const vociRows = (prevDati.voci || []).map((v, idx) => ({
      preventivo_id: state.preventivoId,
      descrizione: v.descrizione,
      categoria: v.categoria || 'altro',
      importo: parseFloat(v.importo) || 0,
      criterio: v.criterio || 'millesimi',
      tabella_millesimale_id: v.criterio === 'parti_uguali' ? null : tabellaProprietaId,
      ordine: idx,
    }));

    const { error: vErr } = await client.from('preventivo_voci').insert(vociRows);
    if (vErr) {
      console.error('❌ Errore salvataggio voci preventivo:', vErr.message);
      process.exit(1);
    }

    console.log('➕ Generazione rate trimestrali per il 2025...');
    const { data: unitaList } = await client.from('unita').select('id, numero');
    const { data: millList } = await client.from('millesimi_unita').select('unita_id, valore').eq('tabella_id', tabellaProprietaId);

    const millesimiMap = {};
    millList.forEach(m => { millesimiMap[m.unita_id] = parseFloat(m.valore) || 0; });
    const totaleMillesimi = Object.values(millesimiMap).reduce((a, b) => a + b, 0) || 1000;

    const dueByUnit = {};
    unitaList.forEach(u => { dueByUnit[u.id] = 0; });

    vociRows.forEach(v => {
      const imp = v.importo;
      if (imp <= 0) return;
      if (v.criterio === 'parti_uguali') {
        const quotaFissa = imp / unitaList.length;
        unitaList.forEach(u => { dueByUnit[u.id] += quotaFissa; });
      } else {
        unitaList.forEach(u => {
          const milVal = millesimiMap[u.id] || 0;
          dueByUnit[u.id] += imp * (milVal / totaleMillesimi);
        });
      }
    });

    const scadenze = [
      { numero: 1, scadenza: '2025-03-31', descrizione: 'Rata I 2025', percentuale: 25 },
      { numero: 2, scadenza: '2025-06-30', descrizione: 'Rata II 2025', percentuale: 25 },
      { numero: 3, scadenza: '2025-09-30', descrizione: 'Rata III 2025', percentuale: 25 },
      { numero: 4, scadenza: '2025-12-31', descrizione: 'Rata IV 2025', percentuale: 25 },
    ];

    const rateRows = scadenze.map(s => ({
      esercizio_id: esercizioId,
      preventivo_id: state.preventivoId,
      condominio_id: condominioId,
      numero_rata: s.numero,
      data_scadenza: s.scadenza,
      percentuale: s.percentuale,
      descrizione: s.descrizione,
    }));

    const { data: rateCreate, error: rateErr } = await client.from('rate').insert(rateRows).select();
    if (rateErr) {
      console.error('❌ Errore creazione rate:', rateErr.message);
      process.exit(1);
    }

    const rateCelle = [];
    rateCreate.forEach(rata => {
      unitaList.forEach(u => {
        const dovutoAnnuo = dueByUnit[u.id] || 0;
        const quotaRata = Math.round((dovutoAnnuo * (rata.percentuale / 100) + Number.EPSILON) * 100) / 100;
        rateCelle.push({
          rata_id: rata.id,
          unita_id: u.id,
          condominio_id: condominioId,
          importo: quotaRata,
          stato: 'non_pagata',
        });
      });
    });

    const { error: cellErr } = await client.from('rate_unita').insert(rateCelle);
    if (cellErr) {
      console.error('❌ Errore creazione celle rate:', cellErr.message);
      process.exit(1);
    }
    console.log('✅ Preventivo e rateizzazione completati con successo.');
  }

  // =============================================================================
  // FASE 7: CARICAMENTO FATTURE E SPESE
  // =============================================================================
  console.log('🔍 Analisi cartella fatture per il caricamento...');
  const files = readdirSync(TEST_DIR);
  const fattureFiles = files.filter(f => f.startsWith('Untitled_') && f.toLowerCase().endsWith('.pdf'));
  console.log(`📊 Trovate ${fattureFiles.length} fatture di test da importare.`);

  const tabellaProprietaId = Object.values(state.tabelleMillesimali)[0] || null;

  for (const fName of fattureFiles) {
    if (state.fattureMappa[fName]) {
      continue; // già caricata
    }

    console.log(`   📄 OCR Fattura: "${fName}"...`);
    const fPath = path.join(TEST_DIR, fName);
    const pdfBase64 = readFileSync(fPath).toString('base64');

    const systemPromptFattura = `Sei un esperto contabile. Estrai i dati dalla fattura del fornitore.
Restituisci SOLO un JSON valido, senza testo aggiuntivo:
{
  "fornitore": "ragione sociale fornitore",
  "partita_iva_fornitore": "P.IVA / CF fornitore",
  "numero_fattura": "numero documento",
  "data_fattura": "YYYY-MM-DD",
  "importo_totale": number,
  "importo_iva": number,
  "importo_netto": number,
  "descrizione": "descrizione lavori/servizi",
  "categoria": "manutenzione" | "pulizie" | "utenze" | "assicurazione" | "amministrazione" | "altro",
  "imponibile_ritenuta": number,
  "aliquota_ritenuta_percentuale": number,
  "importo_ritenuta": number,
  "codice_tributo_f24": "1019" | "1020" | "1040" | null
}`;

    try {
      const rawResponse = await callClaudeDocument(
        'Estrai i dati della fattura.',
        pdfBase64,
        { system: systemPromptFattura, funzione: 'estrai_fattura', maxTokens: 4000 }
      );

      const fDati = pulisciEdEstraiJson(rawResponse, false);

      // A. Creazione della Spesa
      const { data: newSpesa, error: spErr } = await client
        .from('spese')
        .insert({
          esercizio_id: esercizioId,
          condominio_id: condominioId,
          descrizione: `${fDati.fornitore} - Ft. N. ${fDati.numero_fattura || 'N/D'} - ${fDati.descrizione || ''}`,
          importo: parseFloat(fDati.importo_totale) || 0,
          data_spesa: fDati.data_fattura || '2025-06-15',
          categoria: fDati.categoria || 'altro',
          tipo_lavoro: fDati.categoria === 'straordinaria' ? 'straordinario' : 'ordinario',
          criterio: 'millesimi',
          tabella_millesimale_id: tabellaProprietaId,
          fornitore: fDati.fornitore,
        })
        .select('id')
        .single();

      if (spErr) {
        console.error(`      ❌ Errore inserimento spesa per fattura ${fName}:`, spErr.message);
        continue;
      }

      // B. Ripartizione automatica della spesa
      const { data: unitaList } = await client.from('unita').select('id');
      const { data: millList } = await client.from('millesimi_unita').select('unita_id, valore').eq('tabella_id', tabellaProprietaId);
      const millesimiMap = {};
      millList.forEach(m => { millesimiMap[m.unita_id] = parseFloat(m.valore) || 0; });
      const totaleMillesimi = Object.values(millesimiMap).reduce((a, b) => a + b, 0) || 1000;

      const ripRows = unitaList.map(u => {
        const milVal = millesimiMap[u.id] || 0;
        const quota = Math.round((fDati.importo_totale * (milVal / totaleMillesimi) + Number.EPSILON) * 100) / 100;
        return {
          spesa_id: newSpesa.id,
          unita_id: u.id,
          condominio_id: condominioId,
          importo: quota,
          millesimi_usati: milVal,
          override_manuale: false,
        };
      });

      const { error: ripErr } = await client.from('ripartizioni').insert(ripRows);
      if (ripErr) {
        console.warn(`      ⚠️ Errore ripartizione spesa ${newSpesa.id}:`, ripErr.message);
      }

      // C. Creazione record Fattura collegata (Modello A)
      const { data: newFatt, error: fatErr } = await client
        .from('fatture_fornitori')
        .insert({
          condominio_id: condominioId,
          spesa_id: newSpesa.id,
          fornitore: fDati.fornitore,
          numero_fattura: fDati.numero_fattura || 'N/D',
          data_fattura: fDati.data_fattura || '2025-06-15',
          importo_totale: parseFloat(fDati.importo_totale) || 0,
          stato: 'attesa', // inizialmente non pagata (verrà pagata con la riconciliazione bancaria!)
          ritenuta_acconto: parseFloat(fDati.importo_ritenuta) > 0 ? parseFloat(fDati.importo_ritenuta) : null,
        })
        .select('id')
        .single();

      if (fatErr) {
        console.warn(`      ⚠️ Errore inserimento dettaglio fattura ${fName}:`, fatErr.message);
      } else {
        state.fattureMappa[fName] = newFatt.id;
        saveState();
        console.log(`      ✅ Fattura registrata con successo (ID: ${newFatt.id}).`);
      }

      // Delay per non intasare le API
      await new Promise(r => setTimeout(r, 500));

    } catch (ocrErr) {
      console.error(`      ❌ Errore OCR fattura ${fName}:`, ocrErr.message);
    }
  }

  // =============================================================================
  // FASE 8: ESTRATTI CONTO E RICONCILIAZIONE
  // =============================================================================
  if (!state.movimentiCaricati) {
    const estrattiConto = [
      'Estratto conto al 31 03.pdf',
      'Estratto conto al 30 06.pdf',
      'Estratto conto al 30 09.pdf',
      'Estratto conto al 31 12.pdf',
    ];

    console.log('🏛️ Caricamento estratti conto e riconciliazione movimenti...');

    for (const ecName of estrattiConto) {
      console.log(`   🏦 Caricamento: "${ecName}"...`);
      const ecPath = path.join(TEST_DIR, ecName);
      if (!existsSync(ecPath)) {
        console.warn(`   ⚠️ File ${ecName} non trovato in test_data.`);
        continue;
      }

      const pdfBase64 = readFileSync(ecPath).toString('base64');
      const systemPromptEC = `Sei un esperto contabile. Estrai l'elenco dei movimenti bancari.
Restituisci SOLO un JSON valido, senza testo aggiuntivo:
{
  "movimenti": [
    {
      "data": "YYYY-MM-DD",
      "causale": "descrizione operazione",
      "importo": number (positivo = entrata, negativo = uscita),
      "tipo": "entrata" | "uscita"
    }
  ]
}`;

      try {
        const rawResponse = await callClaudeDocument(
          'Estrai i movimenti bancari.',
          pdfBase64,
          { system: systemPromptEC, funzione: 'estrai_movimenti', maxTokens: 8000 }
        );

        const ecDati = pulisciEdEstraiJson(rawResponse, false);
        const movimenti = ecDati.movimenti || [];
        console.log(`      📊 Estratti ${movimenti.length} movimenti.`);

        const ecRows = movimenti.map(m => ({
          condominio_id: condominioId,
          data_movimento: m.data,
          causale: m.causale,
          importo: parseFloat(m.importo) || 0,
          tipo: m.tipo,
        }));

        const { data: newMovs, error: ecErr } = await client
          .from('estratto_conto')
          .insert(ecRows)
          .select();

        if (ecErr) {
          console.error(`      ❌ Errore salvataggio movimenti di ${ecName}:`, ecErr.message);
        } else {
          console.log(`      ✅ ${newMovs.length} movimenti salvati.`);
        }
      } catch (ecErr) {
        console.error(`      ❌ Errore OCR estratto conto ${ecName}:`, ecErr.message);
      }
    }
    state.movimentiCaricati = true;
    saveState();
  }

  // RICONCILIAZIONE AUTOMATICA
  console.log('🔄 Avvio riconciliazione automatica delle uscite ed entrate...');
  
  // 1. Riconciliazione USCITE con FATTURE
  // Recuperiamo i movimenti in uscita non riconciliati
  const { data: uscite } = await client
    .from('estratto_conto')
    .select('id, data_movimento, causale, importo')
    .eq('condominio_id', condominioId)
    .eq('tipo', 'uscita');

  // Recuperiamo le fatture in attesa di pagamento
  const { data: fattureAttesa } = await client
    .from('fatture_fornitori')
    .select('id, spesa_id, importo_totale, fornitore')
    .eq('condominio_id', condominioId)
    .eq('stato', 'attesa');

  console.log(`   🔎 Rilevated ${uscite?.length || 0} uscite e ${fattureAttesa?.length || 0} fatture in attesa.`);

  for (const u of (uscite || [])) {
    const importoUscitaAssoluto = Math.abs(parseFloat(u.importo) || 0);

    // Cerchiamo una fattura avente lo stesso importo (con tolleranza centesimi)
    const match = (fattureAttesa || []).find(f => {
      const impFat = parseFloat(f.importo_totale) || 0;
      return Math.abs(impFat - importoUscitaAssoluto) < 0.05;
    });

    if (match) {
      console.log(`      🔗 Abbinamento: Uscita del ${u.data_movimento} (€${importoUscitaAssoluto}) ➔ Fattura ${match.fornitore} (ID: ${match.id})`);
      
      // A. Creiamo il record di riconciliazione spesa/uscita
      await client.from('riconciliazioni').insert({
        condominio_id: condominioId,
        spesa_id: match.spesa_id,
        movimento_id: u.id,
        importo_abbinato: importoUscitaAssoluto,
      });

      // B. Aggiorniamo lo stato della fattura a pagata
      await client
        .from('fatture_fornitori')
        .update({ stato: 'pagata' })
        .eq('id', match.id);

      // Rimuoviamo la fattura abbinata per non riutilizzarla
      const idx = fattureAttesa.indexOf(match);
      if (idx > -1) fattureAttesa.splice(idx, 1);
    }
  }

  // 2. Riconciliazione ENTRATE con RATE
  // Recuperiamo i movimenti in entrata non riconciliati
  const { data: entrate } = await client
    .from('estratto_conto')
    .select('id, data_movimento, causale, importo')
    .eq('condominio_id', condominioId)
    .eq('tipo', 'entrata');

  // Recuperiamo le rate insolute
  const { data: rateAperte } = await client
    .from('rate_unita')
    .select('id, rata_id, unita_id, importo, importo_pagato')
    .eq('condominio_id', condominioId)
    .neq('stato', 'pagata');

  console.log(`   🔎 Rilevate ${entrate?.length || 0} entrate e ${rateAperte?.length || 0} rate aperte.`);

  for (const e of (entrate || [])) {
    const importoEntrata = parseFloat(e.importo) || 0;

    // Chiediamo all'AI o eseguiamo fuzzy matching sulla causale per identificare a quale condomino appartiene
    const personaId = trovaPersonaFuzzy(e.causale, state.personeMap);
    if (personaId) {
      // Troviamo l'unità del condomino
      const { data: occ } = await client
        .from('occupanti_unita')
        .select('unita_id')
        .eq('persona_id', personaId)
        .eq('attivo', true)
        .limit(1)
        .maybeSingle();

      if (occ) {
        // Cerchiamo una rata aperta di quell'unità il cui importo residuo coincida con l'importo dell'entrata
        const matchRata = (rateAperte || []).find(r => {
          if (r.unita_id !== occ.unita_id) return false;
          const residuo = (parseFloat(r.importo) || 0) - (parseFloat(r.importo_pagato) || 0);
          return Math.abs(residuo - importoEntrata) < 0.05;
        });

        if (matchRata) {
          console.log(`      🔗 Abbinamento: Entrata del ${e.data_movimento} (€${importoEntrata}) ➔ Rata Unità (ID: ${matchRata.id}, Unità ID: ${occ.unita_id})`);
          
          // A. Creiamo il record di riconciliazione incasso
          await client.from('riconciliazioni_incassi').insert({
            condominio_id: condominioId,
            rata_unita_id: matchRata.id,
            movimento_id: e.id,
            unita_id: occ.unita_id,
            importo_pagato: importoEntrata,
            data_pagamento: e.data_movimento,
          });

          // B. Aggiorniamo la rata come pagata
          await client
            .from('rate_unita')
            .update({
              importo_pagato: parseFloat(matchRata.importo),
              stato: 'pagata',
              data_pagamento: e.data_movimento,
            })
            .eq('id', matchRata.id);

          const idx = rateAperte.indexOf(matchRata);
          if (idx > -1) rateAperte.splice(idx, 1);
        }
      }
    }
  }

  console.log('✅ Riconciliazione ed abbinamento completati con successo.');
  console.log('🎉 COLLAUDO E2E CONTABILE ESERCIZIO 2025 TERMINATO CON SUCCESSO!');
}

main().catch(err => {
  console.error('❌ Errore irreversibile nello script E2E:', err);
  process.exit(1);
});
