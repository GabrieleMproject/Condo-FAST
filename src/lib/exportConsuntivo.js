/**
 * fileExtractor.js
 * Estrae dati strutturati da file di vari tipi usando Claude AI.
 * Supporta: PDF (blocco document), XLSX/XLS, JPG/PNG (vision), DOCX, CSV, TXT
 *
 * Usa claudeClient.js per tutte le chiamate AI (mai fetch diretta)
 * Dipendenze: exceljs, mammoth
 */
import ExcelJS  from 'exceljs';
import mammoth  from 'mammoth';
import { callClaude, callClaudeVision, callClaudeDocument } from './claudeClient';

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
  await wb.xlsx.load(buffer);

  const lines = [];
  wb.eachSheet(sheet => {
    lines.push(`=== FOGLIO: ${sheet.name} ===`);
    sheet.eachRow(row => {
      const vals = [];
      row.eachCell({ includeEmpty: true }, cell => vals.push(cell.text ?? ''));
      lines.push(vals.join(','));
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
  const type = file.type.toLowerCase();

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
  const type = file.type.toLowerCase();
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
    ? await callClaudeVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'estrai_movimenti', maxTokens: 4000 })
    : isPdf
    ? await callClaudeDocument(userPrompt, contenuto, { system: systemPrompt, funzione: 'estrai_movimenti', maxTokens: 4000 })
    : await callClaude(userPrompt, { system: systemPrompt, funzione: 'estrai_movimenti', maxTokens: 4000 });

  const clean = risposta.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(clean);
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
  "note": "note aggiuntive" | null
}

Regole:
- Se la fattura ha più righe, somma gli importi
- La categoria deve essere quella più appropriata tra quelle elencate
- Gli importi devono essere numeri senza simboli €
- Se un campo non è presente, usa null`;

  const userPrompt = (isVisual || isPdf)
    ? 'Analizza questa fattura ed estrai i dati nel formato JSON richiesto.'
    : `Analizza questa fattura ed estrai i dati nel formato JSON richiesto.\n\n${contenuto}`;

  const risposta = isVisual
    ? await callClaudeVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'estrai_fattura', maxTokens: 2000 })
    : isPdf
    ? await callClaudeDocument(userPrompt, contenuto, { system: systemPrompt, funzione: 'estrai_fattura', maxTokens: 2000 })
    : await callClaude(userPrompt, { system: systemPrompt, funzione: 'estrai_fattura', maxTokens: 2000 });

  const clean = risposta.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(clean);
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

  const risposta = await callClaude(userPrompt, { system: systemPrompt, funzione: 'criterio_ripartizione', maxTokens: 1500 });
  const clean    = risposta.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(clean);
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
    ? await callClaudeVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'estrai_saldi_consuntivo', maxTokens: 3000 })
    : isPdf
    ? await callClaudeDocument(userPrompt, contenuto, { system: systemPrompt, funzione: 'estrai_saldi_consuntivo', maxTokens: 3000 })
    : await callClaude(userPrompt, { system: systemPrompt, funzione: 'estrai_saldi_consuntivo', maxTokens: 3000 });

  const clean = risposta.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(clean);
}// ── Estrae il PROFILO/struttura del modello consuntivo dell'amministratore ──
// Ritorna { etichette_categorie, ordine_categorie, sezioni:{...flags}, note }.
// NB: estrae la PRESENTAZIONE (ordine/etichette/sezioni presenti), NON i numeri.
export async function estraiStrutturaConsuntivo(file) {
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
    raw = await callClaudeDocument(userPrompt, prep.contenuto, {
      system, mediaType: prep.mediaType || 'application/pdf',
      funzione: 'estrai_struttura_consuntivo',
    })
  } else if (prep.isVisual) {
    raw = await callClaudeVision(`${system}\n\n${userPrompt}`, prep.contenuto, prep.mediaType, {
      funzione: 'estrai_struttura_consuntivo',
    })
  } else {
    raw = await callClaude(`${userPrompt}\n\n--- DOCUMENTO ---\n${prep.contenuto}`, {
      system, funzione: 'estrai_struttura_consuntivo',
    })
  }

  const clean = String(raw).replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    throw new Error('Struttura consuntivo non interpretabile dalla risposta AI')
  }
}