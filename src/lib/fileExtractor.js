/**
 * fileExtractor.js
 * Estrae dati strutturati da file di vari tipi usando Claude AI.
 * Supporta: PDF digitale, PDF scansionato, XLSX/XLS, JPG/PNG, DOCX/TXT
 *
 * Usa claudeClient.js per tutte le chiamate AI (mai fetch diretta)
 */
import * as XLSX from 'xlsx';
import { callClaude, callClaudeVision } from './claudeClient';

// ─── Leggi file come base64 ───────────────────────────────────────────────────
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Leggi file come testo ────────────────────────────────────────────────────
export function fileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

// ─── Estrai testo da XLSX/XLS ─────────────────────────────────────────────────
export function xlsxToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const lines = [];
        wb.SheetNames.forEach(sheetName => {
          lines.push(`=== FOGLIO: ${sheetName} ===`);
          const ws = wb.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(ws);
          lines.push(csv);
        });
        resolve(lines.join('\n'));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ─── Determina tipo file ──────────────────────────────────────────────────────
export function getTipoFile(file) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (type.includes('spreadsheetml') || name.endsWith('.xlsx') || name.endsWith('.xls')) return 'xlsx';
  if (type === 'text/csv' || name.endsWith('.csv')) return 'csv';
  if (type.startsWith('image/') || name.match(/\.(jpg|jpeg|png|webp|gif)$/)) return 'image';
  if (name.endsWith('.docx') || name.endsWith('.doc')) return 'docx';
  if (type === 'text/plain' || name.endsWith('.txt')) return 'txt';
  return 'unknown';
}

// ─── ESTRATTO CONTO: Estrai movimenti bancari dal file ────────────────────────
export async function estraiMovimentiBancari(file) {
  const tipo = getTipoFile(file);
  let contenuto = null;
  let isVisual = false;
  let mediaType = null;

  switch (tipo) {
    case 'pdf':
      // PDF → base64, Claude vision (gestisce sia digitale che scansionato)
      contenuto = await fileToBase64(file);
      isVisual = true;
      mediaType = 'application/pdf';
      break;

    case 'xlsx':
    case 'xls':
      contenuto = await xlsxToText(file);
      break;

    case 'csv':
    case 'txt':
      contenuto = await fileToText(file);
      break;

    case 'image':
      contenuto = await fileToBase64(file);
      isVisual = true;
      mediaType = file.type || 'image/jpeg';
      break;

    default:
      throw new Error(`Formato file non supportato: ${file.name}`);
  }

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
      "importo": number,  // positivo = entrata (accredito), negativo = uscita (addebito)
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
- Identifica il fornitore dalla causale quando possibile (es. "BONIFICO A MARIO ROSSI IDRAULICA" → "Mario Rossi Idraulica")
- Se non riesci a interpretare un movimento, includilo comunque con i dati disponibili`;

  const userPrompt = isVisual
    ? 'Analizza questo estratto conto bancario ed estrai tutti i movimenti nel formato JSON richiesto.'
    : `Analizza questo estratto conto bancario ed estrai tutti i movimenti nel formato JSON richiesto.\n\nContenuto del file:\n${contenuto}`;

  let risposta;
  if (isVisual) {
    risposta = await callClaudeVision(systemPrompt, userPrompt, contenuto, mediaType);
  } else {
    risposta = await callClaude(systemPrompt, userPrompt);
  }

  // Parse JSON
  const clean = risposta.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(clean);
}

// ─── FATTURA FORNITORE: Estrai dati da fattura ────────────────────────────────
export async function estraiFattura(file) {
  const tipo = getTipoFile(file);
  let contenuto = null;
  let isVisual = false;
  let mediaType = null;

  switch (tipo) {
    case 'pdf':
      contenuto = await fileToBase64(file);
      isVisual = true;
      mediaType = 'application/pdf';
      break;
    case 'image':
      contenuto = await fileToBase64(file);
      isVisual = true;
      mediaType = file.type || 'image/jpeg';
      break;
    case 'xlsx':
      contenuto = await xlsxToText(file);
      break;
    case 'csv':
    case 'txt':
    case 'docx':
      contenuto = await fileToText(file);
      break;
    default:
      throw new Error(`Formato non supportato: ${file.name}`);
  }

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
- Gli importi devono essere numeri (senza simboli €)
- Se un campo non è presente, usa null`;

  const userPrompt = isVisual
    ? 'Analizza questa fattura ed estrai i dati nel formato JSON richiesto.'
    : `Analizza questa fattura ed estrai i dati nel formato JSON richiesto.\n\n${contenuto}`;

  let risposta;
  if (isVisual) {
    risposta = await callClaudeVision(systemPrompt, userPrompt, contenuto, mediaType);
  } else {
    risposta = await callClaude(systemPrompt, userPrompt);
  }

  const clean = risposta.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(clean);
}

// ─── RIPARTIZIONE: Determina criterio da regolamento ─────────────────────────
export async function determinaCriterioRipartizione({ descrizioneSpesa, categoriaSpesa, testoRegolamento, tabelleMillesimali }) {
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

  const userPrompt = `Spesa: "${descrizioneSpesa}" (categoria: ${categoriaSpesa || 'non specificata'})

Tabelle millesimali disponibili: ${tabelleMillesimali?.map(t => t.nome).join(', ') || 'nessuna'}

${testoRegolamento ? `Regolamento condominiale:\n${testoRegolamento.substring(0, 3000)}` : 'Nessun regolamento disponibile. Usa il Codice Civile.'}`;

  const risposta = await callClaude(systemPrompt, userPrompt);
  const clean = risposta.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(clean);
}
