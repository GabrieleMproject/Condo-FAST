/**
 * fileExtractor.js
 * Estrae dati strutturati da file di vari tipi usando Claude AI.
 * Supporta: PDF digitale, PDF scansionato, XLSX/XLS, JPG/PNG, DOCX, CSV, TXT
 *
 * Usa claudeClient.js per tutte le chiamate AI (mai fetch diretta)
 * Dipendenze: exceljs, mammoth
 */
import ExcelJS  from 'exceljs';
import mammoth  from 'mammoth';
import { callClaude, callClaudeVision } from './claudeClient';

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
      return { contenuto: await fileToBase64(file), isVisual: true, mediaType: 'application/pdf' };

    case 'xlsx':
      return { contenuto: await xlsxToText(file), isVisual: false };

    case 'docx':
      return { contenuto: await docxToText(file), isVisual: false };  // ✅ nuovo

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

  const { contenuto, isVisual, mediaType } = await preparaContenuto(file);

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
      "fornitore_rilevato": "nome fornitore se identificabile dalla causale" | null,
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
- Identifica il fornitore dalla causale quando possibile
- Se non riesci a interpretare un movimento, includilo comunque con i dati disponibili`;

  const userPrompt = isVisual
    ? 'Analizza questo estratto conto bancario ed estrai tutti i movimenti nel formato JSON richiesto.'
    : `Analizza questo estratto conto bancario ed estrai tutti i movimenti nel formato JSON richiesto.\n\nContenuto del file:\n${contenuto}`;

  // ✅ firma corretta: testo → system in opts; vision → system accorpato al prompt (il client vision non inoltra system)
  const risposta = isVisual
    ? await callClaudeVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'estrai_movimenti', maxTokens: 4000 })
    : await callClaude(userPrompt, { system: systemPrompt, funzione: 'estrai_movimenti', maxTokens: 4000 });

  const clean = risposta.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(clean);
}

// ─── FATTURA FORNITORE: Estrai dati da fattura ────────────────────────────────
export async function estraiFattura(file) {
  if (!validaMimeType(file)) {
    throw new Error(`Tipo file non consentito: ${file.name}. Usa PDF, DOCX, JPG, PNG o XLSX.`);
  }

  const { contenuto, isVisual, mediaType } = await preparaContenuto(file);

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

  const userPrompt = isVisual
    ? 'Analizza questa fattura ed estrai i dati nel formato JSON richiesto.'
    : `Analizza questa fattura ed estrai i dati nel formato JSON richiesto.\n\n${contenuto}`;

  // ✅ firma corretta
  const risposta = isVisual
    ? await callClaudeVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'estrai_fattura', maxTokens: 2000 })
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

  // ✅ firma corretta
  const risposta = await callClaude(userPrompt, { system: systemPrompt, funzione: 'criterio_ripartizione', maxTokens: 1500 });
  const clean    = risposta.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(clean);
}