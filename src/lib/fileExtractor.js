/**
 * fileExtractor.js
 * Estrae dati strutturati da file di vari tipi usando Gemini AI.
 * Supporta: PDF (blocco document), XLSX/XLS, JPG/PNG (vision), DOCX, CSV, TXT
 *
 * Usa geminiClient.js per tutte le chiamate AI (mai fetch diretta)
 * Dipendenze: exceljs, mammoth
 */
import ExcelJS  from 'exceljs';
import mammoth  from 'mammoth';
import { callGemini, callGeminiVision, callGeminiDocument } from './geminiClient';

function pulisciEdEstraiJson(risposta, isArray = false) {
  const rawStr = String(risposta || '').trim();
  const regex = isArray ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const match = rawStr.match(regex);
  const clean = match ? match[0] : rawStr.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ─── Leggi file come base64 ───────────────────────────────────────────────────
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Leggi file come testo ────────────────────────────────────────────────────
export function fileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

// ─── Leggi file come ArrayBuffer ──────────────────────────────────────────────
function fileToArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ─── Estrai testo da XLSX/XLS con ExcelJS ─────────────────────────────────────
export async function xlsxToText(file) {
  const buffer = await fileToArrayBuffer(file);
  const wb     = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (err) {
    if (file.name.toLowerCase().endsWith('.xls')) {
      console.warn('[fileExtractor] Lettura XLS con ExcelJS fallita, provo fallback su testo:', err.message);
      try {
        const text = await fileToText(file);
        return text;
      } catch (e) {
        throw new Error("Il file .xls (Excel legacy) non è supportato. Salva il file in formato .xlsx o .csv.");
      }
    }
    throw err;
  }

  const lines = [];
  wb.eachSheet(sheet => {
    lines.push(`=== FOGLIO: ${sheet.name} ===`);
    sheet.eachRow(row => {
      const vals = [];
      row.eachCell({ includeEmpty: true }, cell => vals.push(cell.text ?? ''));
      lines.push(vals.join(' | '));
    });
  });

  return lines.join('\n');
}

// ─── Estrai testo da DOCX via mammoth ────────────────────────────────────────
export async function docxToText(file) {
  const buffer         = await fileToArrayBuffer(file);
  const { value: text } = await mammoth.extractRawText({ arrayBuffer: buffer });
  return text;
}

// ─── Determina tipo file ──────────────────────────────────────────────────────
export function getTipoFile(file) {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();

  if (type === 'application/pdf' || name.endsWith('.pdf'))                                return 'pdf';
  if (type.includes('spreadsheetml') || name.endsWith('.xlsx') || name.endsWith('.xls')) return 'xlsx';
  if (type === 'text/csv'  || name.endsWith('.csv'))                                     return 'csv';
  if (type.startsWith('image/') || name.match(/\.(jpg|jpeg|png|webp|gif)$/))             return 'image';
  if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  )                                                                                       return 'docx';
  // .doc legacy NON supportato (decisione di progetto — solo .docx)
  if (type === 'text/plain' || name.endsWith('.txt'))                                    return 'txt';
  return 'unknown';
}

// ─── Validazione MIME type (sicurezza upload) ─────────────────────────────────
const MIME_CONSENTITI = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // ✅ .docx
  'text/csv',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export function validaMimeType(file) {
  const type = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();

  if (MIME_CONSENTITI.has(type)) return true;

  // Fallback su estensione (alcuni browser non rilevano correttamente il MIME)
  const estensioniOk = ['.pdf', '.xlsx', '.xls', '.docx', '.csv', '.txt', '.jpg', '.jpeg', '.png', '.webp'];
  return estensioniOk.some(ext => name.endsWith(ext));
}

// ─── Helper: prepara contenuto per chiamata AI ────────────────────────────────
async function preparaContenuto(file) {
  const tipo = getTipoFile(file);

  switch (tipo) {
    case 'pdf':
      // ✅ Path document attivo nel proxy: inviamo il PDF come base64 grezzo,
      // il proxy costruisce il blocco { type:'document', media_type:'application/pdf' }.
      return { contenuto: await fileToBase64(file), isPdf: true, mediaType: 'application/pdf' };

    case 'xlsx':
      return { contenuto: await xlsxToText(file), isVisual: false };

    case 'docx':
      return { contenuto: await docxToText(file), isVisual: false };

    case 'csv':
    case 'txt':
      return { contenuto: await fileToText(file), isVisual: false };

    case 'image':
      return { contenuto: await fileToBase64(file), isVisual: true, mediaType: file.type || 'image/jpeg' };

    default:
      throw new Error(`Formato file non supportato: ${file.name}`);
  }
}

// ─── ESTRATTO CONTO: Estrai movimenti bancari dal file ────────────────────────
export async function estraiMovimentiBancari(file) {
  if (!validaMimeType(file)) {
    throw new Error(`Tipo file non consentito: ${file.name}. Usa PDF, XLSX, DOCX, CSV, JPG o PNG.`);
  }

  const { contenuto, isVisual, isPdf, mediaType } = await preparaContenuto(file);

  const systemPrompt = `Sei un esperto contabile italiano specializzato nell'analisi di estratti conto bancari condominiali.
Estrai i movimenti bancari dal documento fornito e restituisci SOLO un JSON valido, senza testo aggiuntivo.

Formato JSON richiesto:
{
  "saldo_iniziale": number | null,
  "saldo_finale": number | null,
  "periodo_da": "YYYY-MM-DD" | null,
  "periodo_a": "YYYY-MM-DD" | null,
  "banca": "nome banca" | null,
  "conto": "numero conto / IBAN" | null,
  "movimenti": [
    {
      "data": "YYYY-MM-DD",
      "causale": "descrizione completa del movimento",
      "importo": number,
      "saldo": number | null,
      "tipo": "entrata" | "uscita" | "giroconto",
      "fornitore_rilevato": "nome fornitore se identificabile dalla causale (tipico delle USCITE)" | null,
      "pagante_rilevato": "nome del condòmino/pagante se identificabile dalla causale (tipico delle ENTRATE)" | null,
      "riferimento_esterno": "numero assegno/bonifico se presente" | null
    }
  ],
  "note": "eventuali osservazioni o anomalie rilevate" | null
}

Regole importanti:
- Gli importi in USCITA (addebiti, pagamenti) devono essere NEGATIVI
- Gli importi in ENTRATA (accrediti, versamenti) devono essere POSITIVI
- Le date devono essere in formato ISO YYYY-MM-DD
- Se la data ha solo giorno e mese, usa l'anno del periodo dell'estratto conto
- Per le USCITE: identifica il fornitore dalla causale quando possibile → "fornitore_rilevato"
- Per le ENTRATE (accrediti/bonifici dei condòmini): identifica il nominativo del PAGANTE dalla causale quando possibile → "pagante_rilevato". Esempio: "BONIFICO DA MARIO ROSSI - RATA CONDOMINIO" → pagante_rilevato: "Mario Rossi". Estrai solo nome e cognome della persona, senza la parte descrittiva.
- "fornitore_rilevato" e "pagante_rilevato" sono mutuamente alternativi: un movimento avrà valorizzato l'uno (uscite) o l'altro (entrate), non entrambi
- Se non riesci a interpretare un movimento, includilo comunque con i dati disponibili`;

  // PDF e immagini: il contenuto sta nel blocco file → userPrompt "corto".
  const userPrompt = (isVisual || isPdf)
    ? 'Analizza questo estratto conto bancario ed estrai tutti i movimenti nel formato JSON richiesto.'
    : `Analizza questo estratto conto bancario ed estrai tutti i movimenti nel formato JSON richiesto.\n\nContenuto del file:\n${contenuto}`;

  // vision → system accorpato al prompt (il client vision non inoltra system)
  // document/text → system in opts
  const risposta = isVisual
    ? await callGeminiVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'estrai_movimenti', maxTokens: 4000 })
    : isPdf
    ? await callGeminiDocument(userPrompt, contenuto, { system: systemPrompt, funzione: 'estrai_movimenti', maxTokens: 4000 })
    : await callGemini(userPrompt, { system: systemPrompt, funzione: 'estrai_movimenti', maxTokens: 4000 });

  return pulisciEdEstraiJson(risposta, true);
}

// ─── FATTURA FORNITORE: Estrai dati da fattura ────────────────────────────────
export async function estraiFattura(file) {
  if (!validaMimeType(file)) {
    throw new Error(`Tipo file non consentito: ${file.name}. Usa PDF, DOCX, JPG, PNG o XLSX.`);
  }

  const { contenuto, isVisual, isPdf, mediaType } = await preparaContenuto(file);

  const systemPrompt = `Sei un esperto contabile italiano specializzato nell'analisi di fatture di fornitori condominiali.
Estrai i dati della fattura e restituisci SOLO un JSON valido, senza testo aggiuntivo.

Formato JSON:
{
  "fornitore": "ragione sociale del fornitore",
  "partita_iva_fornitore": "P.IVA o CF del fornitore" | null,
  "numero_fattura": "numero documento" | null,
  "data_fattura": "YYYY-MM-DD",
  "data_scadenza": "YYYY-MM-DD" | null,
  "importo_totale": number,
  "importo_iva": number,
  "importo_netto": number,
  "aliquota_iva": number | null,
  "descrizione": "descrizione dei lavori/servizi",
  "categoria": "manutenzione" | "pulizie" | "utenze" | "assicurazione" | "amministrazione" | "altro",
  "note": "note aggiuntive" | null,
  "imponibile_ritenuta": number,
  "aliquota_ritenuta_percentuale": number,
  "importo_ritenuta": number,
  "codice_tributo_f24": "1019" | "1020" | "1040" | null,
  "condominio_destinatario_nome": "denominazione/ragione sociale del condominio destinatario della fattura (il cliente/ricevente)" | null,
  "condominio_destinatario_codice_fiscale": "codice fiscale o partita iva del condominio destinatario della fattura (il cliente/ricevente)" | null,
  "condominio_destinatario_indirizzo": "indirizzo del condominio destinatario della fattura" | null
}

Regole Ritenuta d'Acconto:
- Se la fattura appartiene alla categoria "utenze" (es. acqua, luce, gas, telefonia) o "assicurazione", o se si tratta di semplice acquisto di materiali/beni non soggetti, la ritenuta d'acconto NON si applica. In tal caso, imposta "imponibile_ritenuta" a 0.00, "aliquota_ritenuta_percentuale" a 0.00, "importo_ritenuta" a 0.00 e "codice_tributo_f24" a null.
- Se il fornitore specifica in fattura di far parte del "Regime Forfettario ai sensi della L. 190/2014" o regime dei minimi o simile, la ritenuta d'acconto NON si applica. In tal caso, imposta "imponibile_ritenuta" a 0.00, "aliquota_ritenuta_percentuale" a 0.00, "importo_ritenuta" a 0.00 e "codice_tributo_f24" a null.
- Negli altri casi soggetti (es. prestazioni di servizi, contratti d'appalto come pulizie, manutenzione ascensori, giardinaggio, edilizia, o parcelle di liberi professionisti), calcola la ritenuta:
  - "imponibile_ritenuta" è l'imponibile su cui si calcola la ritenuta (solitamente coincide con l'importo_netto o la quota imponibile esposta).
  - "aliquota_ritenuta_percentuale" è la percentuale di ritenuta applicata (es. 4.00 per contratti d'appalto/servizi di imprese, 20.00 per liberi professionisti/amministratori).
  - "importo_ritenuta" è l'importo della ritenuta (imponibile_ritenuta * aliquota_ritenuta_percentuale / 100).
- Determina "codice_tributo_f24" in base al tipo di prestazione:
  - "1019" per contratti d'appalto condominio (es: ditte di pulizie, imprese edili, manutenzione ascensori, giardinaggio - ritenuta tipica 4%).
  - "1020" per contratti d'opera (ritenuta 4%).
  - "1040" per compensi per prestazioni di lavoro autonomo/professionisti (es: amministratore, geometra, ingegnere, avvocato - ritenuta tipica 20%).
  - Se non si applica ritenuta, imposta a null.

Regole Generali:
- Se la fattura ha più righe, somma gli importi
- La categoria deve essere quella più appropriata tra quelle elencate
- Gli importi devono essere numeri senza simboli €
- Se un campo non è presente, usa null`;

  const userPrompt = (isVisual || isPdf)
    ? 'Analizza questa fattura ed estrai i dati nel formato JSON richiesto.'
    : `Analizza questa fattura ed estrai i dati nel formato JSON richiesto.\n\n${contenuto}`;

  const risposta = isVisual
    ? await callGeminiVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'estrai_fattura', maxTokens: 2000 })
    : isPdf
    ? await callGeminiDocument(userPrompt, contenuto, { system: systemPrompt, funzione: 'estrai_fattura', maxTokens: 2000 })
    : await callGemini(userPrompt, { system: systemPrompt, funzione: 'estrai_fattura', maxTokens: 2000 });

  return pulisciEdEstraiJson(risposta, false);
}

// ─── RIPARTIZIONE: Determina criterio da regolamento ─────────────────────────
export async function determinaCriterioRipartizione({ descrizioneSpesa, categoriaSpesa, testoRegolamento, tabelleMillesimali }) {
  const descSanitized = String(descrizioneSpesa || '').replace(/<[^>]*>/g, '').substring(0, 500);
  const catSanitized  = String(categoriaSpesa  || '').replace(/<[^>]*>/g, '').substring(0, 100);

  const systemPrompt = `Sei un esperto di diritto condominiale italiano. 
Analizza la spesa descritta e determina il corretto criterio di ripartizione basandoti sul regolamento condominiale fornito e, in mancanza, sul Codice Civile italiano (artt. 1117-1139).

Restituisci SOLO un JSON valido:
{
  "criterio": "millesimi_generali" | "millesimi_scala" | "millesimi_riscaldamento" | "millesimi_acqua" | "quote_uguali" | "piano" | "personalizzato",
  "tabella_millesimale": "nome della tabella da usare" | null,
  "motivazione": "breve spiegazione del criterio scelto con riferimento normativo",
  "fonte": "regolamento" | "codice_civile" | "accordo",
  "articolo_riferimento": "art. X c.c. o riferimento al regolamento" | null,
  "note": "eventuali avvertenze o casi particolari" | null
}`;

  const userPrompt = `Spesa: "${descSanitized}" (categoria: ${catSanitized || 'non specificata'})

Tabelle millesimali disponibili: ${tabelleMillesimali?.map(t => t.nome).join(', ') || 'nessuna'}

${testoRegolamento ? `Regolamento condominiale:\n${testoRegolamento.substring(0, 3000)}` : 'Nessun regolamento disponibile. Usa il Codice Civile.'}`;

  const risposta = await callGemini(userPrompt, { system: systemPrompt, funzione: 'criterio_ripartizione', maxTokens: 1500 });
  return pulisciEdEstraiJson(risposta, false);
}
// ─── CONSUNTIVO ANNO PRECEDENTE: estrai saldi di chiusura per riporto ─────────
export async function estraiSaldiConsuntivo(file) {
  if (!validaMimeType(file)) {
    throw new Error(`Tipo file non consentito: ${file.name}. Usa PDF, immagine, XLSX, DOCX, CSV o TXT.`);
  }

  const { contenuto, isVisual, isPdf, mediaType } = await preparaContenuto(file);

  const systemPrompt = `Sei un esperto contabile italiano. Analizzi un CONSUNTIVO/rendiconto condominiale annuale e ne estrai i SALDI DI CHIUSURA, da riportare come saldi iniziali dell'anno successivo.
Restituisci SOLO un JSON valido, senza testo prima o dopo.

Formato JSON:
{
  "anno": number | null,
  "saldo_cassa_finale": number | null,
  "saldi_unita": [
    {
      "numero": "numero/identificativo colonna dell'unità nel riparto, se presente" | null,
      "nominativo": "nome del condòmino come riportato nel prospetto di riparto",
      "saldo": number
    }
  ],
  "note": "eventuali osservazioni" | null
}

Regole sul SEGNO del saldo (CRUCIALE — rispetta i segni del prospetto):
- saldo POSITIVO (senza segno) = CREDITO del condòmino verso il condominio
- saldo NEGATIVO = DEBITO del condòmino verso il condominio (deve ancora versare)
- Tipicamente la riga "SALDO" del riparto per unità riporta esattamente questi segni: copiali fedelmente.
- "saldo_cassa_finale" = saldo del conto corrente bancario al 31/12 (sezione di verifica/controllo cassa).
- Estrai UNA riga per ciascun condòmino presente nel prospetto di riparto per unità.`;

  const userPrompt = (isVisual || isPdf)
    ? 'Analizza questo consuntivo condominiale ed estrai i saldi di chiusura nel formato JSON richiesto.'
    : `Analizza questo consuntivo condominiale ed estrai i saldi di chiusura nel formato JSON richiesto.\n\nContenuto del file:\n${contenuto}`;

  const risposta = isVisual
    ? await callGeminiVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'estrai_saldi_consuntivo', maxTokens: 3000 })
    : isPdf
    ? await callGeminiDocument(userPrompt, contenuto, { system: systemPrompt, funzione: 'estrai_saldi_consuntivo', maxTokens: 3000 })
    : await callGemini(userPrompt, { system: systemPrompt, funzione: 'estrai_saldi_consuntivo', maxTokens: 3000 });

  return pulisciEdEstraiJson(risposta, false);
}// ── Estrae il PROFILO/struttura del modello consuntivo dell'amministratore ──
// Ritorna { etichette_categorie, ordine_categorie, sezioni:{...flags}, note }.
// NB: estrae la PRESENTAZIONE (ordine/etichette/sezioni presenti), NON i numeri.
export async function estraiStrutturaConsuntivo(file) {
  if (!validaMimeType(file)) return null;
  const prep = await preparaContenuto(file) // { contenuto, isPdf?, mediaType?, isVisual? } oppure testo

  const system =
    `Sei un assistente che analizza la STRUTTURA di un rendiconto/consuntivo condominiale italiano (art. 1130-bis c.c.).
Devi restituire SOLO la presentazione, NON i numeri. Rispondi ESCLUSIVAMENTE con JSON valido, senza testo né backtick.
Schema richiesto:
{
  "ordine_categorie": ["assicurazione","amministrazione","utenze","manutenzione","straordinaria","altro"],
  "etichette_categorie": { "assicurazione":"ASSICURAZIONE", "amministrazione":"AMMINISTRAZIONE", "...":"..." },
  "sezioni": {
    "competenza":     { "attiva": true },
    "riparto":        { "attiva": true },
    "cassa":          { "attiva": true },
    "fatture":        { "attiva": true },
    "confronto_prev": { "attiva": true },
    "nota_sintetica": { "attiva": true }
  },
  "note": "eventuali peculiarità del modello"
}
Mappa le voci di spesa del documento alle categorie canoniche: assicurazione, amministrazione, utenze, manutenzione, straordinaria, altro.
Imposta "attiva": true per ogni sezione effettivamente presente nel modello, false se assente. La nota sintetica è obbligatoria: tienila true.`

  const userPrompt =
    `Analizza la struttura di questo consuntivo e restituisci il JSON del profilo (solo presentazione).`

  let raw
  if (prep.isPdf) {
    raw = await callGeminiDocument(userPrompt, prep.contenuto, {
      system, mediaType: prep.mediaType || 'application/pdf',
      funzione: 'estrai_struttura_consuntivo', maxTokens: 3000,
    })
  } else if (prep.isVisual) {
    raw = await callGeminiVision(`${system}\n\n${userPrompt}`, prep.contenuto, prep.mediaType, {
      funzione: 'estrai_struttura_consuntivo', maxTokens: 3000,
    })
  } else {
    raw = await callGemini(`${userPrompt}\n\n--- DOCUMENTO ---\n${prep.contenuto}`, {
      system, funzione: 'estrai_struttura_consuntivo', maxTokens: 3000,
    })
  }

  return pulisciEdEstraiJson(raw, false);
}

// ─── ANAGRAFICA: Estrai elenco persone e condòmini da qualsiasi file (PDF, DOCX, XLSX, JPG...) ───
export async function estraiAnagraficaDaFile(file) {
  if (!validaMimeType(file)) return null;
  const prep = await preparaContenuto(file)

  const systemPrompt = `Sei un esperto di amministrazione condominiale italiana ed estrazione dati con intelligenza artificiale.
Il tuo compito è scansionare in modo estremamente accurato il documento per estrarre tutti i dati anagrafici di persone o condòmini.

REGOLE CRITICHE PER I CONTATTI (EVITA ERRORI O OMISSIONI):
1. EMAIL/PEC: Cerca accuratamente in ogni sezione o colonna del documento qualsiasi stringa che contenga il carattere "@" (es. email, e-mail, pec, posta elettronica). Associala alla persona corretta e inseriscila nel campo "email" (se sono presenti sia email che PEC, preferisci l'email ordinaria o separale con una virgola).
2. TELEFONO/CELLULARE: Cerca in modo approfondito qualsiasi numero di telefono o cellulare associato alle persone. Solitamente si trovano sotto colonne o diciture come "Tel", "Tel.", "Cell", "Cell.", "Cellulare", "Telefono", "Recapito", "Contatto" o "Mobile". Estrai la sequenza numerica (di solito 9-11 cifre, es. 3331234567 o 02123456) pulendola da spazi o trattini intermedi, e inseriscila nel campo "telefono".
3. ASSOCIAZIONE DI RIGA: Presta attenzione a non saltare le colonne dei contatti. Spesso i contatti sono scritti in fondo alla riga o in una sezione separata ("Elenco contatti"): associali correttamente tramite il nome/cognome o l'interno dell'unità.
4. NOME E COGNOME: Dividi accuratamente il Nome e il Cognome. Se nel documento è presente un'unica colonna "Nominativo" o "Cognome Nome", separa la parte del cognome (spesso in maiuscolo) dal nome.

Per ogni persona restituisci un oggetto JSON con questi campi esattamente (lascia vuoto "" se non presente):
nome, cognome, email, telefono, indirizzo, citta, cap, provincia, codice_fiscale, ruolo ("proprietario"|"inquilino"|""), unita (numero unità/appartamento se presente).

Rispondi SOLO con un array JSON valido, senza testo aggiuntivo, senza backtick markdown.

Esempio: [{"nome":"Mario","cognome":"Rossi","email":"mario@example.com","telefono":"3331234567","indirizzo":"Via Roma 1","citta":"Milano","cap":"20100","provincia":"MI","codice_fiscale":"RSSMRA80A01F205X","ruolo":"proprietario","unita":"3"}]`

  const userPrompt = `Estrai l'elenco di tutte le persone e i loro dati anagrafici presenti in questo contenuto:`

  let raw
  if (prep.isPdf) {
    raw = await callGeminiDocument(userPrompt, prep.contenuto, {
      system: systemPrompt,
      mediaType: prep.mediaType || 'application/pdf',
      funzione: 'import_anagrafica',
      maxTokens: 8000,
    })
  } else if (prep.isVisual) {
    raw = await callGeminiVision(`${systemPrompt}\n\n${userPrompt}`, prep.contenuto, prep.mediaType, {
      funzione: 'import_anagrafica',
      maxTokens: 8000,
    })
  } else {
    raw = await callGemini(`${userPrompt}\n\n--- CONTENUTO ---\n${String(prep.contenuto).substring(0, 30000)}`, {
      system: systemPrompt,
      funzione: 'import_anagrafica',
      maxTokens: 8000,
    })
  }

  const rawStr = String(raw || '');
  const match = rawStr.match(/\[[\s\S]*\]/);
  const clean = match ? match[0] : rawStr.replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Errore parsing JSON anagrafica:', e, clean);
    throw new Error('L\'AI non ha restituito un formato JSON valido per l\'anagrafica.');
  }
}

// ── Estrae una o più tabelle millesimali da un file (PDF, XLSX, CSV, DOCX, Immagine) ──
export async function estraiTabelleMillesimali(file) {
  if (!validaMimeType(file)) {
    throw new Error(`Tipo file non consentito: ${file.name}. Usa PDF, immagine, XLSX, DOCX, CSV o TXT.`);
  }

  const prep = await preparaContenuto(file);

  const systemPrompt = `Sei un esperto di amministrazione condominiale e catasto italiano.
Il tuo compito è analizzare un documento o un foglio di calcolo contenente una o più TABELLE MILLESIMALI di un condominio (es. Tabella di Proprietà Generale, Scale, Ascensore, Riscaldamento, Box, ecc.).
Estrai tutte le tabelle millesimali trovate e per ciascuna di esse le righe che associano l'unità immobiliare (o condòmino) ai rispettivi millesimi.

Restituisci SOLO un oggetto JSON valido con questa esatta struttura, senza testo prima o dopo e senza markdown:
{
  "tabelle": [
    {
      "nome": "Nome della colonna millesimale o tabella (es. Proprietà generale, Scale & Ascensore, ecc.)",
      "righe": [
        {
          "unita": "OBBLIGATORIO: L'identificativo univoco dell'unità immobiliare nel documento. REGOLE CRITICHE:\n1) Se nel documento è presente la colonna Subalterno (Sub.), USA QUELLO o formatta come 'Sub. X' (es. 'Sub. 7', 'Sub. 2').\n2) Se non c'è Subalterno, usa il Numero interno/ordine (es. 'Int. 1', '1').\n3) Se una riga di pertinenza (es. box, cantina, garage, posto auto) ha la colonna numero d'ordine o identificativo vuota, NON LASCIARE MAI VUOTO: usa il Subalterno (es. 'Box Sub. 2') o crea un identificativo univoco abbinato al proprietario (es. 'Box - Micieli'). Ogni riga deve avere un valore unita univoco e non vuoto!",
          "piano": "Piano dell'unità se indicato (es. Terra, T, 1°, 2, -1, S. 1, Seminterrato, Attico... altrimenti stringa vuota)",
          "destinazione": "Destinazione d'uso se indicata o intuibile dal contesto o classamento (es. appartamento, box, cantina, negozio, ufficio, posto_auto, soffitta, magazzino)",
          "superficie_mq": numero (superficie in m² o mq se presente es. 85.5, oppure superficie lorda/virtuale se disponibile, altrimenti null),
          "proprietario_nome": "Nome del proprietario (es. Mario, Laura... altrimenti stringa vuota). Se ci sono più comproprietari, estrai il nome del primo.",
          "proprietario_cognome": "Cognome del proprietario o ragione sociale della ditta (es. Rossi, Bianchi...). Se per le righe di pertinenza (es. box/cantine) il nome non è ripetuto, RIPORTA IL COGNOME del proprietario dell'unità principale collegata (es. dell'appartamento sovrastante).",
          "nominativo_completo": "Il nominativo intero così come scritto nel file (es. ROSSI MARIO, COOP SOC. ed altri) per riscontro diretto o fallback.",
          "valore": numero (valore millesimale decimale, es. 166.57 o 150.55 o 0. Usa il punto decimale, non la virgola)"
        }
      ]
    }
  ]
}

Se nel documento è presente una tabella con più colonne millesimali (es. colonna 1 = Proprietà, colonna 2 = Scale & Ascensore), genera un elemento nell'array "tabelle" per ciascuna di queste colonne.`;

  const userPrompt = `Estrai le tabelle millesimali e i relativi valori presenti in questo contenuto:`;

  let raw;
  if (prep.isPdf) {
    raw = await callGeminiDocument(userPrompt, prep.contenuto, {
      system: systemPrompt,
      mediaType: prep.mediaType || 'application/pdf',
      funzione: 'estrai_tabelle_millesimali',
      maxTokens: 8000,
    });
  } else if (prep.isVisual) {
    raw = await callGeminiVision(`${systemPrompt}\n\n${userPrompt}`, prep.contenuto, prep.mediaType, {
      funzione: 'estrai_tabelle_millesimali',
      maxTokens: 8000,
    });
  } else {
    raw = await callGemini(`${userPrompt}\n\n--- CONTENUTO ---\n${String(prep.contenuto).substring(0, 30000)}`, {
      system: systemPrompt,
      funzione: 'estrai_tabelle_millesimali',
      maxTokens: 8000,
    });
  }

  const rawStr = String(raw || '');
  const match = rawStr.match(/\{[\s\S]*\}/);
  const clean = match ? match[0] : rawStr.replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(clean);
    return parsed?.tabelle && Array.isArray(parsed.tabelle) ? parsed.tabelle : [];
  } catch (e) {
    console.error('Errore parsing JSON tabelle millesimali:', e, clean);
    throw new Error('L\'AI non ha restituito un formato JSON valido per le tabelle millesimali.');
  }
}

// ─── MIGRAZIONE GESTIONALE: Classifica e struttura i dati da un file esportato ──
// da gestionali condominiali (Danea Domustudio, Gecosei, Metodo, ecc.).
// Riconosce automaticamente il tipo di dati (anagrafica, unità, millesimi, spese,
// rate, saldi) e restituisce un oggetto JSON strutturato pronto per la preview.
export async function classificaEStraiFileGestionale(file) {
  if (!validaMimeType(file)) {
    throw new Error(`Tipo file non consentito: ${file.name}. Usa PDF, XLSX, DOCX, CSV, JPG o PNG.`);
  }

  const { contenuto, isVisual, isPdf, mediaType } = await preparaContenuto(file);

  const systemPrompt = `Sei un esperto di migrazione dati per gestionali condominiali italiani.
Il tuo compito è analizzare un file esportato da un gestionale (es. Danea Domustudio, Gecosei, Metodo o altri) e classificare i dati che contiene, poi estrarli in un formato JSON strutturato.

IDENTIFICAZIONE DEL GESTIONALE:
- Danea Domustudio: tipiche colonne "Nominativo", "Scala", "Interno", "Millesimi proprietà", "Versato", "Da versare", "Quote spettanti"
- Gecosei: tipiche colonne "Cond.", "Piano", "Vani", "Quota", intestazioni con "GECOSEI"
- Metodo: tipiche colonne "Id", "Scala", "Unità", "Quote", "Saldo Precedente", intestazioni con "METODO"
- generico: qualsiasi altro formato non riconoscibile

CLASSIFICAZIONE DEL TIPO DI DATI (scegli il tipo predominante):
- anagrafica: contiene principalmente nomi, cognomi, codici fiscali, email, telefoni
- unita: contiene elenco unità immobiliari con scala, piano, superficie, proprietari
- millesimi: contiene tabelle con valori millesimali per unità e tabella
- spese: contiene spese/fatture/uscite con importi e categorie
- rate: contiene piani di rateizzazione o quietanze con importi pagati/da pagare
- saldo_cassa: contiene saldi di conto corrente o cassa condominiale
- misto: contiene dati di più tipi contemporaneamente
- sconosciuto: il contenuto non è riconducibile a nessuna categoria

REGOLE CRITICHE PER L'ESTRAZIONE:
1. Segni dei saldi: POSITIVO = credito del condòmino (ha pagato in eccesso), NEGATIVO = debito (deve ancora versare)
2. Date: usa SEMPRE il formato ISO YYYY-MM-DD
3. Importi: numeri decimali puri senza simboli € né separatori migliaia (usa punto decimale)
4. Se un campo non è rilevabile, usa null (non stringa vuota, non 0)
5. Estrai TUTTI i blocchi di dati presenti nel file (un file può contenere sia persone che unità)
6. Per le unità: usa il campo "numero" come identificativo breve dell'unità (scala+interno o subalterno)
7. Per i millesimi: ogni colonna millesimale distinta è una tabella separata
8. Per le rate: "stato" si determina da importo_pagato vs importo (pagata = uguali, parziale = parziale, non_pagata = 0 pagato)

Restituisci SOLO un oggetto JSON valido, senza testo aggiuntivo, senza markdown, senza backtick.

Schema esatto da rispettare:
{
  "tipo": "anagrafica" | "unita" | "millesimi" | "spese" | "rate" | "saldo_cassa" | "misto" | "sconosciuto",
  "gestionale": "Danea Domustudio" | "Gecosei" | "Metodo" | "generico",
  "condominio": { "nome": string | null, "indirizzo": string | null, "cf_condominio": string | null } | null,
  "persone": [
    { "nome": string, "cognome": string, "codice_fiscale": string | null, "email": string | null, "telefono": string | null, "ruolo": "proprietario" | "inquilino" | "", "unita_rif": string | null }
  ] | null,
  "unita": [
    { "numero": string, "tipo": string | null, "scala": string | null, "piano": string | null, "mq": number | null, "proprietario_nome": string | null, "proprietario_cognome": string | null }
  ] | null,
  "millesimi": [
    { "tabella": string, "righe": [ { "unita_rif": string, "valore": number, "proprietario_nome": string | null } ] }
  ] | null,
  "saldi_iniziali": [
    { "anno": number, "unita_rif": string, "proprietario_nome": string | null, "saldo": number }
  ] | null,
  "spese": [
    { "anno": number, "data": string | null, "descrizione": string, "categoria": string, "importo": number, "fornitore": string | null }
  ] | null,
  "rate": [
    { "anno": number, "numero_rata": number | null, "scadenza": string | null, "unita_rif": string, "importo": number, "importo_pagato": number, "stato": "pagata" | "parziale" | "non_pagata" }
  ] | null
}`;

  const userPrompt = (isVisual || isPdf)
    ? 'Analizza questo file esportato da un gestionale condominiale, classifica i dati che contiene ed estraili nel formato JSON richiesto.'
    : `Analizza questo file esportato da un gestionale condominiale, classifica i dati che contiene ed estraili nel formato JSON richiesto.\n\nContenuto del file:\n${String(contenuto).substring(0, 30000)}`;

  const risposta = isVisual
    ? await callGeminiVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'classifica_gestionale', maxTokens: 6000 })
    : isPdf
    ? await callGeminiDocument(userPrompt, contenuto, { system: systemPrompt, funzione: 'classifica_gestionale', maxTokens: 6000 })
    : await callGemini(userPrompt, { system: systemPrompt, funzione: 'classifica_gestionale', maxTokens: 6000 });

  return pulisciEdEstraiJson(risposta, false);
}

// ─── MIGRAZIONE GESTIONALE: Aggrega i risultati di più file in un unico oggetto ─
// Funzione sincrona pura (no AI). Unifica i blocchi di dati estratti da
// classificaEStraiFileGestionale con deduplicazione leggera sui soli campi chiave
// esplicitamente valorizzati — mai scartare dati in caso di dubbio.
export function aggregaDatiGestionale(risultatiPerFile) {
  if (!Array.isArray(risultatiPerFile) || risultatiPerFile.length === 0) {
    return { gestionale: 'generico', condominio: null, persone: [], unita: [], millesimi: [], saldi_iniziali: [], spese: [], rate: [] };
  }

  // ── gestionale: first non-generic value wins ──────────────────────────────────
  const gestionale = risultatiPerFile.map(r => r?.gestionale).find(g => g && g !== 'generico') || 'generico';

  // ── condominio: merge fields — first non-null per field wins ─────────────────
  let condominio = null;
  for (const r of risultatiPerFile) {
    if (!r?.condominio) continue;
    if (!condominio) {
      condominio = { nome: null, indirizzo: null, cf_condominio: null };
    }
    if (!condominio.nome        && r.condominio.nome)        condominio.nome        = r.condominio.nome;
    if (!condominio.indirizzo   && r.condominio.indirizzo)   condominio.indirizzo   = r.condominio.indirizzo;
    if (!condominio.cf_condominio && r.condominio.cf_condominio) condominio.cf_condominio = r.condominio.cf_condominio;
  }

  // ── persone: concat all; light dedup on exact codice_fiscale only ─────────────
  const tutteLePersone = risultatiPerFile.flatMap(r => Array.isArray(r?.persone) ? r.persone : []).filter(Boolean);
  const personeMap = new Map(); // key: codice_fiscale → merged record
  const personeNoCf = [];
  for (const p of tutteLePersone) {
    const cf = p?.codice_fiscale?.trim?.() || null;
    if (!cf) {
      // No fiscal code → always keep (cannot safely dedup)
      personeNoCf.push(p);
    } else if (personeMap.has(cf)) {
      // Merge non-null fields from duplicate into existing record
      const existing = personeMap.get(cf);
      for (const k of Object.keys(p)) {
        if (p[k] != null && p[k] !== '' && (existing[k] == null || existing[k] === '')) {
          existing[k] = p[k];
        }
      }
    } else {
      personeMap.set(cf, { ...p });
    }
  }
  const persone = [...personeMap.values(), ...personeNoCf];

  // ── unita: concat all; dedup on exact "numero" ────────────────────────────────
  const tutteLeUnita = risultatiPerFile.flatMap(r => Array.isArray(r?.unita) ? r.unita : []).filter(Boolean);
  const unitaMap = new Map();
  const unitaSenzaNumero = [];
  for (const u of tutteLeUnita) {
    const num = u?.numero?.trim?.() || null;
    if (!num) {
      unitaSenzaNumero.push(u);
    } else if (unitaMap.has(num)) {
      const existing = unitaMap.get(num);
      for (const k of Object.keys(u)) {
        if (u[k] != null && u[k] !== '' && (existing[k] == null || existing[k] === '')) {
          existing[k] = u[k];
        }
      }
    } else {
      unitaMap.set(num, { ...u });
    }
  }
  const unita = [...unitaMap.values(), ...unitaSenzaNumero];

  // ── millesimi: concat all; dedup on tabella name (merge rows) ─────────────────
  const tuttiIMillesimi = risultatiPerFile.flatMap(r => Array.isArray(r?.millesimi) ? r.millesimi : []).filter(Boolean);
  const millesimiMap = new Map();
  for (const m of tuttiIMillesimi) {
    const nome = m?.tabella?.trim?.() || null;
    if (!nome) continue; // skip malformed entries
    if (millesimiMap.has(nome)) {
      // Merge rows — append rows not already present (by unita_rif)
      const existing = millesimiMap.get(nome);
      const existingRefs = new Set(existing.righe.map(r => r?.unita_rif).filter(Boolean));
      for (const riga of (Array.isArray(m.righe) ? m.righe : [])) {
        if (!riga?.unita_rif || !existingRefs.has(riga.unita_rif)) {
          existing.righe.push(riga);
          if (riga?.unita_rif) existingRefs.add(riga.unita_rif);
        }
      }
    } else {
      millesimiMap.set(nome, { tabella: nome, righe: Array.isArray(m.righe) ? [...m.righe] : [] });
    }
  }
  const millesimi = [...millesimiMap.values()];

  // ── saldi_iniziali, spese, rate: concatenate as-is (no dedup) ─────────────────
  const saldi_iniziali = risultatiPerFile.flatMap(r => Array.isArray(r?.saldi_iniziali) ? r.saldi_iniziali : []).filter(Boolean);
  const spese          = risultatiPerFile.flatMap(r => Array.isArray(r?.spese)          ? r.spese          : []).filter(Boolean);
  const rate           = risultatiPerFile.flatMap(r => Array.isArray(r?.rate)           ? r.rate           : []).filter(Boolean);

  return { gestionale, condominio, persone, unita, millesimi, saldi_iniziali, spese, rate };
}

// ─── ANAGRAFE CONDOMINIALE: Estrae i dati catastali e anagrafici da una scheda di autocertificazione ──
export async function estraiDatiAnagrafeDaModulo(file, condominioId) {
  const tipo = getTipoFile(file);
  const isImage = tipo === 'image';
  const isPdf   = tipo === 'pdf';

  let contenuto = '';
  let mediaType = '';

  if (isImage || isPdf) {
    contenuto = await fileToBase64(file);
    mediaType = isImage ? (file.type || 'image/jpeg') : 'application/pdf';
  } else if (tipo === 'xlsx') {
    contenuto = await xlsxToText(file);
  } else if (tipo === 'docx') {
    contenuto = await docxToText(file);
  } else {
    contenuto = await fileToText(file);
  }

  const systemPrompt = `Sei un assistente AI specializzato nella gestione e lettura di moduli fiscali e schede di anagrafe condominiale per il mercato italiano.
Il tuo compito è analizzare la scansione, foto o testo del modulo di autocertificazione compilato dal condomino ed estrarre i dati anagrafici, i dati catastali dell'unità immobiliare e le informazioni di residenza.

Restituisci ESCLUSIVAMENTE un oggetto JSON valido con la seguente struttura, non aggiungere commenti o altri testi:
{
  "unita": {
    "catasto_foglio": string o null (il foglio catastale, es. "12"),
    "catasto_particella": string o null (la particella o mappale, es. "345"),
    "catasto_subalterno": string o null (il subalterno, es. "3"),
    "catasto_categoria": string o null (la categoria catastale, es. "A/3" o "C/6"),
    "catasto_rendita": numero o null (la rendita catastale come numero, es. 450.50)
  },
  "persona": {
    "nome": string o null (il nome dell'occupante/proprietario),
    "cognome": string o null (il cognome),
    "codice_fiscale": string o null (il codice fiscale normalizzato a 16 caratteri maiuscoli),
    "email": string o null (l'indirizzo email compilato),
    "telefono": string o null (il numero di telefono compilato),
    "residenza_indirizzo": string o null (via/piazza, civico della residenza del soggetto, es. "Via Garibaldi 12"),
    "residenza_comune": string o null (il comune di residenza),
    "residenza_cap": string o null (il CAP di residenza, es. "00100"),
    "residenza_provincia": string o null (la sigla della provincia di residenza a 2 caratteri, es. "RM")
  },
  "ruolo": string o null (deve essere rigorosamente uno tra: "proprietario", "inquilino", "comproprietario", "usufruttuario" se deducibile dal modulo)
}

Regole importanti:
1. Pulisci i dati catastali: rimuovi spazi superflui e normalizzali.
2. Codice Fiscale: controlla che sia valido a 16 cifre, convertilo in MAIUSCOLO.
3. Se un campo non è presente o non è leggibile, impostalo a null. Non inventare dati.`;

  const userPrompt = `Analizza questo modulo compilato dal condomino ed estrai i dati nel formato JSON specificato.`;

  const risposta = isImage
    ? await callGeminiVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'estrazione_anagrafe', condominio_id: condominioId, maxTokens: 4000 })
    : isPdf
    ? await callGeminiDocument(userPrompt, contenuto, { system: systemPrompt, funzione: 'estrazione_anagrafe', condominio_id: condominioId, maxTokens: 4000 })
    : await callGemini(userPrompt + `\n\nContenuto del modulo:\n${contenuto}`, { system: systemPrompt, funzione: 'estrazione_anagrafe', condominio_id: condominioId, maxTokens: 4000 });

  return pulisciEdEstraiJson(risposta, false);
}