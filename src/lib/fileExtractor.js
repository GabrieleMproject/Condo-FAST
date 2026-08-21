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
import JSZip    from 'jszip';
import { callGemini, callGeminiVision, callGeminiDocument } from './geminiClient.js';
import { parseFatturaXmlP7m } from './xmlFatturaParser.js';

/**
 * Applica pre-processing grafico tramite Canvas JavaScript per migliorare nitidezza,
 * contrasto e binarizzazione di immagini/scontrini cartacei sbiaditi.
 */
export async function applicaMiglioramentoContrasto(file) {
  if (!file || !file.type.startsWith('image/')) return file
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        const contrast = 1.35 // Aumenta il contrasto del 35%
        const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255))

        for (let i = 0; i < data.length; i += 4) {
          data[i] = factor * (data[i] - 128) + 128
          data[i + 1] = factor * (data[i + 1] - 128) + 128
          data[i + 2] = factor * (data[i + 2] - 128) + 128
        }
        ctx.putImageData(imageData, 0, 0)
        canvas.toBlob((blob) => {
          if (!blob) resolve(file)
          else resolve(new File([blob], file.name, { type: file.type }))
        }, file.type, 0.92)
      }
      img.onerror = () => resolve(file)
      img.src = e.target.result
    }
    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
  })
}

/**
 * Genera la Nota Sintetica Esplicativa ex art. 1130-bis c.c. con AI Gemini Pro-Amministratore
 */
export async function generaNotaSinteticaAi({ condominio, esercizio, spese = [], rate = [], attivitaStudio = {} }) {
  const totSpese = (spese || []).reduce((s, x) => s + Number(x.importo || 0), 0)
  const userPrompt = `Sei un consulente legale e contabile esperto in diritto condominiale italiano (art. 1130-bis c.c.).
Redigi la "Nota Sintetica Esplicativa" ufficiale per l'esercizio contabile ${esercizio?.anno || ''} del Condominio ${condominio?.nome || ''}.

Dati di sintesi dell'esercizio:
- Anno di gestione: ${esercizio?.anno || ''} (dal ${esercizio?.data_inizio || ''} al ${esercizio?.data_fine || ''})
- Totale Spese dell'Esercizio: € ${totSpese.toFixed(2)}
- Fatture Lavorate: ${attivitaStudio?.fattureLavorate || spese.length}
- F24 e Ritenute Gestite: ${attivitaStudio?.ritenuteGestite || 0}
- Riconciliazioni Bancarie Eseguite: ${attivitaStudio?.movimentiRiconciliati || 0}

Linee guida di stesura:
1. Usa un tono formale, professionale e protettivo per l'amministratore (spiegando con rigore la correttezza della gestione, il rispetto dei criteri millesimali e la quadratura contabile).
2. Articola il testo nei seguenti paragrafi:
   - 1. CRITERI DI GESTIONE E QUADRATURA CONTABILE
   - 2. DETTAGLIO SPESE ED ADEMPIMENTI FISCALI (F24 / CU)
   - 3. MOROSITÀ E SOLLECITI DI PAGAMENTO
   - 4. CONSIDERAZIONI FINALI ED APPROVAZIONE DELL'ASSEMBLEA
3. Non inserire emoji visive. Restituisci il testo formale pronto da includere nel consuntivo PDF.`

  const risposta = await callGemini(userPrompt, {
    system: 'Sei un esperto legale in amministrazione condominiale ex art. 1130-bis c.c.',
    funzione: 'genera_nota_sintetica',
    condominio_id: condominio?.id
  })

  return risposta.trim()
}

/**
 * Wrapper intelligente che riprova automaticamente in caso di:
 * 1. Fallimento nel parsing JSON (es. il modello ha restituito testo o JSON rotto irrecuperabile)
 * 2. Errore "RateLimitError" (troppe richieste), con attesa graduale.
 */
async function withAutoRetry(fn, maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err.name === 'RateLimitError' || err.message?.toLowerCase().includes('429') || err.message?.toLowerCase().includes('troppe richieste');
      const isTransient = err instanceof SyntaxError || err.message?.includes('JSON') || err.message?.includes('token') || err.message?.includes('Edge Function error') || err.message?.includes('500') || err.message?.includes('503');
      
      if (!isRateLimit && !isTransient) {
        // Se non è un errore temporaneo, rilancia subito
        throw err;
      }
      
      if (attempt >= maxRetries) {
        console.error(`[withAutoRetry] Fallimento definitivo dopo ${maxRetries} ritentativi.`, err);
        throw err;
      }
      
      attempt++;
      // Backoff esponenziale: 1.5s, 3s
      const delay = isRateLimit ? (err.retryAfter ? err.retryAfter * 1000 : 2000 * attempt) : 1500 * attempt;
      console.warn(`[withAutoRetry] Tentativo ${attempt} fallito (RateLimit: ${isRateLimit}). Riposo per ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * Normalizza qualsiasi formato numerico (stringa o numero) in float JavaScript valido
 */
export function pulisciNumero(val) {
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (!val && val !== 0) return null;
  let s = String(val).trim();
  // Rimuovi simboli valuta, spazi, apici
  s = s.replace(/[€$£\s'"`]/g, '');
  // Formato italiano 1.234,56 o 1.234.567,89
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+,\d+$/.test(s)) {
    // Formato 123,45
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Normalizza stringhe data in formato standard ISO YYYY-MM-DD
 */
export function pulisciData(val) {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim();
  // GG/MM/AAAA o GG-MM-AAAA -> YYYY-MM-DD
  const itMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (itMatch) {
    return `${itMatch[3]}-${itMatch[2].padStart(2, '0')}-${itMatch[1].padStart(2, '0')}`;
  }
  // YYYY-MM-DD o YYYY-MM-DDT...
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  return s;
}

export function pulisciEdEstraiJson(risposta, isArray = false) {
  const rawStr = String(risposta || '').trim();
  
  // TENTATIVO 1: Parsing diretto (Gemini API jsonMode spesso restituisce un JSON perfetto)
  let cleanRawStr = rawStr.replace(/^```json\s*|^```\s*|\s*```$/gi, '').trim();
  try {
    const directParsed = JSON.parse(cleanRawStr);
    return arricchisciConAvvisi(directParsed);
  } catch {
    // Continua con euristiche avanzate di recupero
  }

  // TENTATIVO 2: Euristiche di recupero aggressivo
  const startIdx = isArray ? cleanRawStr.indexOf('[') : cleanRawStr.indexOf('{');
  let clean = startIdx !== -1 ? cleanRawStr.substring(startIdx) : cleanRawStr;
  
  // Forza chiavi senza virgolette ad avere virgolette doppie (es: { fornitore: ... } -> { "fornitore": ... })
  clean = clean.replace(/([{,]\s*)([a-zA-Z0-9_-]+)\s*:/g, '$1"$2":');
  
  // Converti valori con virgolette singole in virgolette doppie se non creano problemi
  clean = clean.replace(/:\s*'([^']*)'/g, ': "$1"');
  
  // Rimuovi virgolette orfane su righe separate prima della chiusura parentesi graffa
  clean = clean.replace(/\n\s*"\s*\n\s*\}/g, '\n}');
  
  // Rimuovi virgole pendenti (trailing commas)
  clean = clean.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']');

  // Auto-riparazione di parentesi non chiuse (per risposte AI troncate al limite token)
  const closingStack = [];
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (inString) {
      if (char === '\\' && !isEscaped) {
        isEscaped = true;
      } else {
        if (char === '"' && !isEscaped) {
          inString = false;
        }
        isEscaped = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        closingStack.push('}');
      } else if (char === '}') {
        const lastIdx = closingStack.lastIndexOf('}');
        if (lastIdx !== -1) closingStack.splice(lastIdx, 1);
      } else if (char === '[') {
        closingStack.push(']');
      } else if (char === ']') {
        const lastIdx = closingStack.lastIndexOf(']');
        if (lastIdx !== -1) closingStack.splice(lastIdx, 1);
      }
    }
  }

  // Se siamo rimasti dentro una stringa non chiusa, chiudiamola
  if (inString) {
    clean += '"';
  }

  // Rimuovi eventuali virgole o due punti pendenti prima di chiudere strutture
  clean = clean.trim().replace(/,\s*$/, '').replace(/:\s*$/, ': null');

  // Chiudiamo tutti i bracket e le graffe rimaste aperte in ordine LIFO inverso esatto
  while (closingStack.length > 0) {
    clean = clean.trim().replace(/,\s*$/, '');
    clean += closingStack.pop();
  }

  // Rimuovi eventuali virgole pendenti interne residue
  clean = clean.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']');

  // Bilancia per tagliare caratteri spuri extra alla fine (es: }})
  clean = clean.trim();
  if (!isArray && clean.startsWith('{') && clean.endsWith('}')) {
    let braceCount = 0;
    let cutoff = -1;
    for (let i = 0; i < clean.length; i++) {
      if (clean[i] === '{') braceCount++;
      else if (clean[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          cutoff = i;
          break;
        }
      }
    }
    if (cutoff !== -1 && cutoff < clean.length - 1) {
      clean = clean.substring(0, cutoff + 1);
    }
  }

  try {
    const parsed = JSON.parse(clean);
    return arricchisciConAvvisi(parsed);
  } catch (err) {
    console.error('[pulisciEdEstraiJson] Parsing fallito anche dopo euristiche.', err, '\nTesto grezzo:', rawStr);
    throw err;
  }
}

/**
 * Aggiunge i warning di pertinenza/congruenza e preserva is_valido
 */
function arricchisciConAvvisi(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed;
  if (Array.isArray(parsed)) return parsed;

  const isValidoSlot = parsed.is_valido !== false && parsed.is_valido_per_slot !== false;
  const pertine = parsed.congruenza_condominio;
  const ePertinente = !pertine || pertine.e_pertinente !== false;

  let warningPertinenza = null;
  if (!isValidoSlot || !ePertinente) {
    warningPertinenza = {
      slotErrato: !isValidoSlot ? {
        tipoRilevato: parsed.tipo_documento_rilevato || 'documento di altro tipo',
        motivo: parsed.motivo_errore || 'Il file non sembra congruo allo slot di destinazione.'
      } : null,
      condominioErrato: !ePertinente ? {
        intestatarioRilevato: pertine?.intestatario_rilevato || 'altro condominio',
        motivoDiscrepanza: pertine?.motivo_discrepanza || 'Il documento risulta intestato ad un altro condominio.'
      } : null
    };
  }

  let resData = parsed.dati !== undefined ? parsed.dati : parsed;
  
  if (resData && typeof resData === 'object' && !Array.isArray(resData)) {
    if ('is_valido' in parsed) resData.is_valido = parsed.is_valido;
    if (parsed.motivo_errore) resData.motivo_errore = parsed.motivo_errore;
    if (parsed.tipo_documento_rilevato) resData.tipo_documento_rilevato = parsed.tipo_documento_rilevato;
    if (warningPertinenza) resData._warningPertinenza = warningPertinenza;
  } else if (!resData) {
    resData = {
      is_valido: parsed.is_valido ?? false,
      motivo_errore: parsed.motivo_errore || 'Nessun dato estratto',
      tipo_documento_rilevato: parsed.tipo_documento_rilevato || 'sconosciuto',
      _warningPertinenza: warningPertinenza
    };
  }

  return resData;
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
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer });
  return html;
}

// ─── Estrazione di ripiego per .doc (legacy) ──────────────────────────────────
export async function docToTextFallback(file) {
  try {
    // Prova prima con mammoth nel caso sia un .docx rinominato
    const buffer = await fileToArrayBuffer(file);
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer });
    if (html && html.trim().length > 0) return html;
  } catch(e) {
    // Ignora e procedi al fallback
  }

  // Estrazione "grezza" delle stringhe dal file binario OLE
  const buffer = await fileToArrayBuffer(file);
  const data = new Uint8Array(buffer);
  
  let text = '';
  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    if ((c >= 32 && c <= 126) || (c >= 192 && c <= 255)) {
      text += String.fromCharCode(c);
    } else if (c === 9 || c === 10 || c === 13) {
      text += '\n';
    } else if (c === 0) {
      // ignora i byte nulli (molto comuni in UTF-16LE)
    } else {
      text += ' ';
    }
  }
  // Pulisci per dare in pasto all'AI solo le parti rilevanti (rimuovi gli spazi multipli)
  return text.replace(/ {2,}/g, ' ').replace(/\n+/g, '\n');
}

// ─── Estrazione file da archivio ZIP (pacchetti AdE o cartelle fatture) ──────
export async function estraiFileDaZip(zipFile) {
  if (!zipFile) return [];
  const zip = new JSZip();
  const zipLoaded = await zip.loadAsync(zipFile);
  const filesEstratti = [];

  const MIME_MAP = {
    xml:  'application/xml',
    p7m:  'application/pkcs7-mime',
    pdf:  'application/pdf',
    jpg:  'image/jpeg',
    jpeg: 'image/jpeg',
    png:  'image/png',
    webp: 'image/webp',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc:  'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls:  'application/vnd.ms-excel',
    csv:  'text/csv',
    txt:  'text/plain',
  };

  for (const [relativePath, zipEntry] of Object.entries(zipLoaded.files)) {
    // Ignora directory, file di sistema macOS e file nascosti
    if (
      zipEntry.dir ||
      relativePath.startsWith('__MACOSX') ||
      relativePath.includes('/.') ||
      zipEntry.name.startsWith('.')
    ) {
      continue;
    }

    const cleanName = zipEntry.name.split('/').pop() || zipEntry.name;
    const ext = (cleanName.split('.').pop() || '').toLowerCase();
    
    // Ignora file non pertinenti (es. file binari sconosciuti o DS_Store)
    if (!MIME_MAP[ext] && !cleanName.toLowerCase().endsWith('.p7m')) continue;

    const mimeType = MIME_MAP[ext] || (cleanName.toLowerCase().endsWith('.p7m') ? 'application/pkcs7-mime' : 'application/octet-stream');
    const blob = await zipEntry.async('blob');
    
    const file = new File([blob], cleanName, {
      type: mimeType,
      lastModified: zipEntry.date ? zipEntry.date.getTime() : Date.now(),
    });

    filesEstratti.push(file);
  }

  return filesEstratti;
}

// ─── Determina tipo file ──────────────────────────────────────────────────────
export function getTipoFile(file) {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();

  if (type === 'application/zip' || type === 'application/x-zip-compressed' || type === 'multipart/x-zip' || name.endsWith('.zip')) return 'zip';
  if (type === 'application/pdf' || name.endsWith('.pdf'))                                return 'pdf';
  if (type.includes('xml') || name.endsWith('.xml'))                                     return 'xml';
  if (name.endsWith('.p7m') || type.includes('pkcs7'))                                  return 'p7m';
  if (type.includes('spreadsheetml') || name.endsWith('.xlsx') || name.endsWith('.xls')) return 'xlsx';
  if (type === 'text/csv'  || name.endsWith('.csv'))                                     return 'csv';
  if (type.startsWith('image/') || name.match(/\.(jpg|jpeg|png|webp|gif)$/))             return 'image';
  if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  )                                                                                       return 'docx';
  
  if (type === 'application/msword' || name.endsWith('.doc'))                             return 'doc';

  if (type === 'text/plain' || name.endsWith('.txt'))                                    return 'txt';
  return 'unknown';
}

// ─── Validazione MIME type (sicurezza upload) ─────────────────────────────────
const MIME_CONSENTITI = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'multipart/x-zip',
  'application/pdf',
  'text/xml',
  'application/xml',
  'application/pkcs7-mime',
  'application/x-pkcs7-mime',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
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
  const estensioniOk = ['.zip', '.pdf', '.xml', '.p7m', '.xlsx', '.xls', '.docx', '.doc', '.csv', '.txt', '.jpg', '.jpeg', '.png', '.webp'];
  return estensioniOk.some(ext => name.endsWith(ext));
}

// ─── Helper: prepara contenuto per chiamata AI ────────────────────────────────
async function preparaContenuto(file) {
  const tipo = getTipoFile(file);

  switch (tipo) {
    case 'pdf':
      return { contenuto: await fileToBase64(file), isPdf: true, mediaType: 'application/pdf' };

    case 'xlsx':
      return { contenuto: await xlsxToText(file), isVisual: false };

    case 'docx':
      return { contenuto: await docxToText(file), isVisual: false };

    case 'doc':
      return { contenuto: await docToTextFallback(file), isVisual: false };

    case 'csv':
    case 'txt':
    case 'xml':
    case 'p7m':
      return { contenuto: await fileToText(file), isVisual: false };

    case 'image':
      return { contenuto: await fileToBase64(file), isVisual: true, mediaType: file.type || 'image/jpeg' };

    default:
      try {
        return { contenuto: await fileToText(file), isVisual: false };
      } catch {
        throw new Error(`Formato file non supportato: ${file.name}`);
      }
  }
}

// ─── Helper: controlli pre-volo veloci sul file ────────────────────────────────
export async function validaFilePreVolo(file, maxMb = 25) {
  if (!file) {
    throw new Error('Nessun file selezionato.');
  }
  if (file.size === 0) {
    throw new Error(`Il file "${file.name}" è vuoto (0 byte) o corrotto.`);
  }
  const MAX_FILE_SIZE = maxMb * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`Il file "${file.name}" (${sizeMb}MB) supera il limite massimo consentito di ${maxMb}MB per questo tipo di documento.`);
  }
  if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
    try {
      const slice = file.slice(0, 4096);
      const textHeader = await slice.text();
      if (textHeader.includes('/Encrypt') || textHeader.includes('/Password')) {
        throw new Error(`Il PDF "${file.name}" è protetto da password. Rimuovi la protezione prima di caricarlo.`);
      }
    } catch (e) {
      if (e.message?.includes('password')) throw e;
    }
  }
}

// ─── ESTRATTO CONTO: Estrai movimenti bancari dal file ────────────────────────
export async function estraiMovimentiBancari(file, condominioCorrente = null) {
  await validaFilePreVolo(file, 25); // max 25MB per estratti conto multi-pagina
  if (!validaMimeType(file)) {
    throw new Error(`Tipo file non consentito: ${file.name}. Usa PDF, XLSX, DOCX, CSV, JPG o PNG.`);
  }

  const { contenuto, isVisual, isPdf, mediaType } = await preparaContenuto(file);

  const condoInfoText = condominioCorrente
    ? `\n\nCONTESTO CONDOMINIO ATTIVO:\n- Nome: "${condominioCorrente.nome || ''}"\n- Codice Fiscale: "${condominioCorrente.codice_fiscale || ''}"\n- Indirizzo: "${condominioCorrente.indirizzo || ''}"\nVerifica se l'intestatario del conto o documento appartiene a questo condominio.`
    : '';

  const systemPrompt = `Sei un esperto contabile italiano specializzato nell'analisi universale di estratti conto bancari condominiali.
Il tuo compito è analizzare minuziosamente l'INTERO documento fornito (anche se composto da più pagine o con layout tabellari complessi/senza bordi) ed estrare TUTTI i movimenti contabili senza ometterne alcuno.${condoInfoText}

REGOLE CRITICHE PER L'ESTRAZIONE UNIVERSALE MULTI-LAYOUT:
1. SCANSIONE COMPLETA DI TUTTE LE PAGINE:
   - Analizza l'intero documento dall'inizio alla fine (anche se lungo 10+ pagine). Non fermarti alla prima pagina.
2. INDIVIDUAZIONE SEGNI ED IMPORTI:
   - Gli importi in USCITA (addebiti, pagamenti, addebiti SDD, commissioni, bonifici in uscita, F24, prelievi) devono essere SEMPRE NEGATIVI (es. -150.00).
   - Gli importi in ENTRATA (accrediti, versamenti condòmini, bonifici in entrata, storni a favore) devono essere SEMPRE POSITIVI (es. +200.00).
   - Cerca sinonimi di intestazione colonna: "Addebito/Accredito", "Dare/Avere", "Importo operazione", "Importo in Euro", "Segno +/-", "Entrate/Uscite".
3. RILEVAMENTO SOGGETTI (PAGANTI E FORNITORI):
   - Per le ENTRATE (accrediti/bonifici dei condòmini): individua il nominativo della persona dalla causale/descrizione (es. "Bonifico da Rossi Mario quota int. 4") → "pagante_rilevato": "Rossi Mario". Estrai SOLO nome e cognome della persona, eliminando causali contabili o codici CRO/TRN.
   - Per le USCITE: individua la ragione sociale della ditta o fornitore dalla causale/descrizione (es. "SDD Enel Energia", "Pagamento Fattura Ditta Bianchi") → "fornitore_rilevato": "Ditta Bianchi" o "Enel Energia".
   - "fornitore_rilevato" e "pagante_rilevato" sono mutuamente alternativi.
4. FORMATO DATE ISO (YYYY-MM-DD):
   - Estrai la data del movimento in formato YYYY-MM-DD. Se la data riporta solo giorno e mese (es. "15/03"), desumi l'anno corretto dal periodo generale dell'estratto conto.
5. RESILIENZA DI LAYOUT:
   - Ignora righe di intestazione ripetute su ciascuna pagina, saldi intermedi di pagina o pie' di pagina. Estrai solo i movimenti effettivi.
6. SALDO FINALE E RELATIVA DATA:
   - Cerca accuratamente se nel documento è riportato il "Saldo Finale" / "Saldo di Chiusura" / "Nuovo Saldo" (es. "Saldo al 30/06/2026: € 14.250,00").
   - Estrai "saldo_finale" (numero) e la relativa data in "data_saldo_finale" (YYYY-MM-DD).
   - Estrai anche "saldo_iniziale" e "data_saldo_iniziale" se presenti.`;

  const jsonSchema = {
    type: "OBJECT",
    properties: {
      is_valido: { type: "BOOLEAN", description: "True se il file è realmente un estratto conto bancario o lista movimenti pertinente. False se è palesemente un altro tipo di documento (es. fattura, verbale, f24, o estraneo come ricette di cucina)." },
      tipo_documento_rilevato: { type: "STRING", description: "Es: estratto_conto, fattura, f24, verbale, anagrafica, altro" },
      motivo_errore: { type: "STRING", description: "Spiega brevemente perché il file non è un estratto conto bancario, se is_valido è false." },
      congruenza_condominio: {
        type: "OBJECT",
        properties: {
          e_pertinente: { type: "BOOLEAN", description: "False se l'intestazione del conto differisce nettamente dal condominio attivo." },
          intestatario_rilevato: { type: "STRING", nullable: true, description: "Intestatario del conto corrente o documento" },
          motivo_discrepanza: { type: "STRING", nullable: true, description: "Spiega perché non appartiene a questo condominio" }
        }
      },
      dati: {
        type: "OBJECT",
        properties: {
          saldo_iniziale: { type: "NUMBER", nullable: true, description: "Saldo contabile all'inizio del periodo" },
          data_saldo_iniziale: { type: "STRING", nullable: true, description: "Data del saldo iniziale (YYYY-MM-DD)" },
          saldo_finale: { type: "NUMBER", nullable: true, description: "Saldo contabile finale al termine del periodo" },
          data_saldo_finale: { type: "STRING", nullable: true, description: "Data esatta a cui si riferisce il saldo finale (YYYY-MM-DD)" },
          periodo_da: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
          periodo_a: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
          banca: { type: "STRING", nullable: true },
          conto: { type: "STRING", nullable: true },
          note: { type: "STRING", nullable: true },
          movimenti: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                data: { type: "STRING", description: "YYYY-MM-DD" },
                causale: { type: "STRING" },
                importo: { type: "NUMBER", description: "NEGATIVI per uscite/addebiti, POSITIVI per entrate/accrediti" },
                saldo: { type: "NUMBER", nullable: true },
                tipo: { type: "STRING", description: "entrata, uscita o giroconto" },
                fornitore_rilevato: { type: "STRING", nullable: true },
                pagante_rilevato: { type: "STRING", nullable: true },
                riferimento_esterno: { type: "STRING", nullable: true }
              },
              required: ["data", "causale", "importo", "tipo"]
            }
          }
        },
        required: ["movimenti"]
      }
    },
    required: ["is_valido"]
  };

  const userPrompt = (isVisual || isPdf)
    ? 'Analizza questo estratto conto bancario ed estrai tutti i movimenti.'
    : `Analizza questo estratto conto bancario ed estrai tutti i movimenti.\n\nContenuto del file:\n${contenuto}`;

  return await withAutoRetry(async () => {
    const risposta = isVisual
      ? await callGeminiVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'estrai_movimenti', maxTokens: 8000, jsonMode: true, jsonSchema })
      : isPdf
      ? await callGeminiDocument(userPrompt, contenuto, { system: systemPrompt, funzione: 'estrai_movimenti', maxTokens: 8000, jsonMode: true, jsonSchema })
      : await callGemini(userPrompt, { system: systemPrompt, funzione: 'estrai_movimenti', maxTokens: 8000, jsonMode: true, jsonSchema });

    const parsed = pulisciEdEstraiJson(risposta, false);
    
    // Normalizzazione robusta dell'oggetto movimenti
    let result = parsed;
    if (Array.isArray(parsed)) {
      result = { movimenti: parsed, is_valido: true };
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.dati?.movimenti)) {
      result = parsed.dati;
      if ('is_valido' in parsed) result.is_valido = parsed.is_valido;
      if (parsed.motivo_errore) result.motivo_errore = parsed.motivo_errore;
      if (parsed._warningPertinenza) result._warningPertinenza = parsed._warningPertinenza;
    }

    if (result && typeof result === 'object') {
      if (result.saldo_iniziale != null) result.saldo_iniziale = pulisciNumero(result.saldo_iniziale);
      if (result.saldo_finale != null) result.saldo_finale = pulisciNumero(result.saldo_finale);
      if (result.data_saldo_iniziale) result.data_saldo_iniziale = pulisciData(result.data_saldo_iniziale);
      if (result.data_saldo_finale) result.data_saldo_finale = pulisciData(result.data_saldo_finale);
      if (result.periodo_da) result.periodo_da = pulisciData(result.periodo_da);
      if (result.periodo_a) result.periodo_a = pulisciData(result.periodo_a);

      if (Array.isArray(result.movimenti)) {
        result.movimenti = result.movimenti.map(m => {
          const numImp = pulisciNumero(m.importo) ?? 0;
          return {
            ...m,
            importo: numImp,
            saldo: pulisciNumero(m.saldo),
            data: pulisciData(m.data) || m.data,
            tipo: m.tipo || (numImp >= 0 ? 'entrata' : 'uscita')
          };
        });
      }
    }
    return result;
  });
}

// ─── FATTURA FORNITORE: Estrai dati da fattura ────────────────────────────────
export async function estraiFattura(file, condominioCorrente = null) {
  await validaFilePreVolo(file, 25); // max 25MB per fatture e scontrini
  if (!validaMimeType(file)) {
    throw new Error(`Tipo file non consentito: ${file.name}. Usa PDF, XML, P7M, DOCX, JPG, PNG o XLSX.`);
  }

  // Se è una fattura elettronica SDI (.xml o .p7m), usa direttamente il parser nativo senza chiamare l'AI
  const tipoDoc = getTipoFile(file);
  if (tipoDoc === 'xml' || tipoDoc === 'p7m') {
    const resXml = await parseFatturaXmlP7m(file);
    return resXml?.dati || resXml;
  }

  const { contenuto, isVisual, isPdf, mediaType } = await preparaContenuto(file);

  const condoInfoText = condominioCorrente
    ? `\n\nCONTESTO CONDOMINIO ATTIVO:\n- Nome: "${condominioCorrente.nome || ''}"\n- Codice Fiscale: "${condominioCorrente.codice_fiscale || ''}"\n- Indirizzo: "${condominioCorrente.indirizzo || ''}"\nVerifica se l'intestatario o destinatario della fattura corrisponde a questo condominio.`
    : '';

  const systemPrompt = `Sei un esperto contabile italiano specializzato nell'analisi universale di fatture, scontrini, ricevute e note di credito per la gestione condominiale.
Il tuo compito è estrarre con la massima precisione i dati fiscali e contabili dal documento, indipendentemente dal suo layout (fattura elettronica analogica, scontrino cartaceo, ricevuta d'opera, nota pro-forma) e anche se articolato su più pagine.${condoInfoText}

REGOLE CRITICHE PER L'ESTRAZIONE UNIVERSALE MULTI-LAYOUT:
1. FORNITORE E PARTITA IVA / CF:
   - Estrai la Ragione Sociale completa del fornitore o professionista emittente (solitamente presente nell'intestazione in alto o nel piè di pagina).
   - Estrai la Partita IVA (11 cifre) o il Codice Fiscale del fornitore.
   - Dedici la "categoria_fornitore" (es. idraulico, elettricista, edile, spurghi, ascensorista, giardiniere, pulizie, energia) basandoti sulla ragione sociale o sulla descrizione dei lavori.
   - Estrai la "provincia_fornitore" (sigla 2 lettere, es. MI, RM) dall'indirizzo della sede legale o operativa del fornitore.
2. IMPORTI E TOTALE DOCUMENTO (Tolleranza sinonimi):
   - "importo_totale": Cerca "Totale Documento", "Totale da Pagare", "Importo Complessivo", "Netto a Pagare", "Somma Dovuta", "Totale Euro". Se ci sono più righe o pagine, estrai il totale generale finale.
   - "importo_netto": Imponibile prima dell'IVA (pari all'importo totale se esente IVA o utenza).
   - "importo_iva": L'importo IVA in Euro (0.00 se esente o non indicata).
   - "aliquota_iva": Percentuale IVA applicata (es. 22.00, 10.00, 4.00 o 0.00).
3. DATE (YYYY-MM-DD):
   - "data_fattura": Data di emissione del documento (es. "Data documento", "Data fattura", "Del").
   - "data_scadenza": Data limite di pagamento (se indicata, altrimenti null).
4. CATEGORIE E DESCRIZIONE:
   - Sintetizza l'oggetto dei lavori o servizi in "descrizione".
   - Assegna una categoria coerente tra: "manutenzione", "pulizie", "utenze", "assicurazione", "amministrazione", "altro".
5. REGOLE RITENUTA D'ACCONTO E CODICE TRIBUTO F24:
   - Se la fattura riguarda "utenze" (acqua, luce, gas, telefonia), "assicurazione", o acquisto di soli beni/merci (senza posa in opera o manodopera), la ritenuta NON si applica: "imponibile_ritenuta": 0.00, "aliquota_ritenuta_percentuale": 0.00, "importo_ritenuta": 0.00, "codice_tributo_f24": null.
   - Se il fornitore è in Regime Forfettario o dei Minimi (dicitura "operazione senza applicazione della ritenuta d'acconto ai sensi dell'art. 1 comma 67 L. 190/2014"), la ritenuta NON si applica: "imponibile_ritenuta": 0.00, "aliquota_ritenuta_percentuale": 0.00, "importo_ritenuta": 0.00, "codice_tributo_f24": null.
   - Per contratti di appalto, manutenzioni, pulizie, giardinaggio, ascensori, edilizia (art. 25-ter DPR 600/73):
     - "imponibile_ritenuta": imponibile netto della prestazione.
     - "aliquota_ritenuta_percentuale": 4.00.
     - "importo_ritenuta": (imponibile_ritenuta * 0.04).
     - "codice_tributo_f24": "1019" (se ditta individuale/società di persone IRPEF) o "1020" (se società di capitali IRES srl/spa).
   - Per prestazioni di lavoro autonomo / liberi professionisti con parcella (avvocati, geometri, architetti, commercialisti, periti, amministratori) (art. 25 DPR 600/73):
     - "imponibile_ritenuta": compenso professionale netto (esclusa cassa previdenza se non soggetta).
     - "aliquota_ritenuta_percentuale": 20.00.
     - "importo_ritenuta": (imponibile_ritenuta * 0.20).
     - "codice_tributo_f24": "1040".
   - Altre casistiche (es. provvigioni agenti/mediatori): aliquota indicata espressamente in fattura (es. 23% o codice "1038").
   - Se la ritenuta non è presente sul documento o il fornitore non è soggetto, imposta sempre 0.00.
   - Estrai la ragione sociale completa del condominio committente ("condominio_destinatario_nome").
   - Estrai il Codice Fiscale del condominio ("condominio_destinatario_codice_fiscale").
   - Estrai l'indirizzo civico ("condominio_destinatario_indirizzo"), il Comune ("condominio_destinatario_citta"), il CAP ("condominio_destinatario_cap") e la Provincia ("condominio_destinatario_provincia").`;

  const jsonSchema = {
    type: "OBJECT",
    properties: {
      is_valido: { type: "BOOLEAN", description: "True se il file è realmente una fattura, scontrino o ricevuta pertinente. False se è palesemente un altro documento (es. estratto conto, f24, o estraneo come ricette di cucina)." },
      tipo_documento_rilevato: { type: "STRING", description: "Es: fattura, estratto_conto, f24, verbale, anagrafica, altro" },
      motivo_errore: { type: "STRING", description: "Spiega brevemente perché il file non è una fattura, se is_valido è false." },
      congruenza_condominio: {
        type: "OBJECT",
        properties: {
          e_pertinente: { type: "BOOLEAN", description: "False se l'intestazione/destinatario differisce palesemente dal condominio attivo." },
          intestatario_rilevato: { type: "STRING", nullable: true, description: "Ragione sociale e CF del condominio destinatario presente sul documento" },
          motivo_discrepanza: { type: "STRING", nullable: true, description: "Spiega perché non sembra essere intestato a questo condominio" }
        }
      },
      dati: {
        type: "OBJECT",
        properties: {
          fornitore: { type: "STRING", description: "Ragione sociale del fornitore" },
          partita_iva_fornitore: { type: "STRING", nullable: true },
          categoria_fornitore: { type: "STRING", nullable: true, description: "La categoria lavorativa dell'artigiano/ditta. Scegli tra: idraulico, elettricista, edile, spurghi, ascensorista, giardiniere, pulizie, energia, assicurazioni, professionista, altro" },
          provincia_fornitore: { type: "STRING", nullable: true, description: "La sigla della provincia di sede del fornitore (es. MI, RM, NA) estratta dall'indirizzo" },
          numero_fattura: { type: "STRING", nullable: true },
          data_fattura: { type: "STRING", description: "YYYY-MM-DD" },
          data_scadenza: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
          iban_fornitore: { type: "STRING", nullable: true, description: "IBAN bancario del fornitore per il bonifico indicato sul documento (es. IT...)" },
          importo_totale: { type: "NUMBER" },
          importo_iva: { type: "NUMBER" },
          importo_netto: { type: "NUMBER" },
          aliquota_iva: { type: "NUMBER", description: "Percentuale IVA" },
          descrizione: { type: "STRING", description: "Descrizione sintetica lavori o servizi" },
          categoria: { type: "STRING", description: "manutenzione, pulizie, utenze, assicurazione, amministrazione, altro" },
          note: { type: "STRING", nullable: true },
          imponibile_ritenuta: { type: "NUMBER" },
          aliquota_ritenuta_percentuale: { type: "NUMBER" },
          importo_ritenuta: { type: "NUMBER" },
          codice_tributo_f24: { type: "STRING", nullable: true, description: "1019, 1020 o 1040" },
          condominio_destinatario_nome: { type: "STRING", nullable: true, description: "Nome o ragione sociale del Condominio committente" },
          condominio_destinatario_codice_fiscale: { type: "STRING", nullable: true, description: "Codice Fiscale del Condominio" },
          condominio_destinatario_indirizzo: { type: "STRING", nullable: true, description: "Via/Piazza e numero civico del Condominio" },
          condominio_destinatario_citta: { type: "STRING", nullable: true, description: "Città/Comune del Condominio" },
          condominio_destinatario_cap: { type: "STRING", nullable: true, description: "CAP a 5 cifre del Condominio" },
          condominio_destinatario_provincia: { type: "STRING", nullable: true, description: "Sigla Provincia 2 lettere del Condominio (es. MI, RM)" }
        },
        required: [
          "fornitore", "data_fattura", "importo_totale", "descrizione", "categoria"
        ]
      }
    },
    required: ["is_valido"]
  };

  const userPrompt = (isVisual || isPdf)
    ? 'Analizza questa fattura ed estrai i dati.'
    : `Analizza questa fattura ed estrai i dati.\n\n${contenuto}`;

  return await withAutoRetry(async () => {
    const risposta = isVisual
      ? await callGeminiVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'estrai_fattura', maxTokens: 4000, jsonMode: true, jsonSchema })
      : isPdf
      ? await callGeminiDocument(userPrompt, contenuto, { system: systemPrompt, funzione: 'estrai_fattura', maxTokens: 4000, jsonMode: true, jsonSchema })
      : await callGemini(userPrompt, { system: systemPrompt, funzione: 'estrai_fattura', maxTokens: 4000, jsonMode: true, jsonSchema });

    const parsed = pulisciEdEstraiJson(risposta, false);
    if (parsed && typeof parsed === 'object') {
      if (parsed.importo_totale != null) parsed.importo_totale = pulisciNumero(parsed.importo_totale);
      if (parsed.importo_iva != null) parsed.importo_iva = pulisciNumero(parsed.importo_iva);
      if (parsed.importo_netto != null) parsed.importo_netto = pulisciNumero(parsed.importo_netto);
      if (parsed.aliquota_iva != null) parsed.aliquota_iva = pulisciNumero(parsed.aliquota_iva);
      if (parsed.imponibile_ritenuta != null) parsed.imponibile_ritenuta = pulisciNumero(parsed.imponibile_ritenuta);
      if (parsed.aliquota_ritenuta_percentuale != null) parsed.aliquota_ritenuta_percentuale = pulisciNumero(parsed.aliquota_ritenuta_percentuale);
      if (parsed.importo_ritenuta != null) parsed.importo_ritenuta = pulisciNumero(parsed.importo_ritenuta);
      if (parsed.data_fattura) parsed.data_fattura = pulisciData(parsed.data_fattura);
      if (parsed.data_scadenza) parsed.data_scadenza = pulisciData(parsed.data_scadenza);
    }
    return parsed;
  });
}

// ─── RIPARTIZIONE: Determina criterio da regolamento ─────────────────────────
export async function determinaCriterioRipartizione({ descrizioneSpesa, categoriaSpesa, testoRegolamento, tabelleMillesimali }) {
  const descSanitized = String(descrizioneSpesa || '').replace(/<[^>]*>/g, '').substring(0, 500);
  const catSanitized  = String(categoriaSpesa  || '').replace(/<[^>]*>/g, '').substring(0, 100);

  const systemPrompt = `Sei un esperto di diritto condominiale italiano. 
Analizza la spesa descritta e determina il corretto criterio di ripartizione basandoti sul regolamento condominiale fornito e, in mancanza, sul Codice Civile italiano (artt. 1117-1139).`;

  const jsonSchema = {
    type: "OBJECT",
    properties: {
      is_valido: { type: "BOOLEAN", description: "True se la spesa e il contesto sono comprensibili e pertinenti al condominio. False altrimenti (es. documenti estranei, ricette di cucina)." },
      motivo_errore: { type: "STRING", description: "Se is_valido è false, spiega perché." },
      dati: {
        type: "OBJECT",
        properties: {
          criterio: { type: "STRING", description: "millesimi_generali, millesimi_scala, millesimi_riscaldamento, millesimi_acqua, quote_uguali, piano o personalizzato" },
          tabella_millesimale: { type: "STRING", nullable: true },
          motivazione: { type: "STRING", description: "Breve spiegazione del criterio scelto con riferimento normativo" },
          fonte: { type: "STRING", description: "regolamento, codice_civile o accordo" },
          articolo_riferimento: { type: "STRING", nullable: true, description: "art. X c.c. o riferimento al regolamento" },
          note: { type: "STRING", nullable: true }
        },
        required: ["criterio", "motivazione", "fonte"]
      }
    },
    required: ["is_valido"]
  };

  const userPrompt = `Spesa: "${descSanitized}" (categoria: ${catSanitized || 'non specificata'})

Tabelle millesimali disponibili: ${tabelleMillesimali?.map(t => t.nome).join(', ') || 'nessuna'}

${testoRegolamento ? `Regolamento condominiale:\n${testoRegolamento.substring(0, 3000)}` : 'Nessun regolamento disponibile. Usa il Codice Civile.'}`;

  return await withAutoRetry(async () => {
    const risposta = await callGemini(userPrompt, { system: systemPrompt, funzione: 'criterio_ripartizione', maxTokens: 4000, jsonMode: true, jsonSchema });
    return pulisciEdEstraiJson(risposta, false);
  });
}
// ─── CONSUNTIVO ANNO PRECEDENTE: estrai saldi di chiusura per riporto ─────────
export async function estraiSaldiConsuntivo(file) {
  if (!validaMimeType(file)) {
    throw new Error(`Tipo file non consentito: ${file.name}. Usa PDF, immagine, XLSX, DOCX, CSV o TXT.`);
  }

  const { contenuto, isVisual, isPdf, mediaType } = await preparaContenuto(file);

  const systemPrompt = `Sei un esperto contabile italiano. Analizzi un CONSUNTIVO/rendiconto condominiale annuale e ne estrai i SALDI DI CHIUSURA, da riportare come saldi iniziali dell'anno successivo.

Regole sul SEGNO del saldo (CRUCIALE — rispetta i segni del prospetto):
- saldo POSITIVO (senza segno) = CREDITO del condòmino verso il condominio
- saldo NEGATIVO = DEBITO del condòmino verso il condominio (deve ancora versare)
- Tipicamente la riga "SALDO" del riparto per unità riporta esattamente questi segni: copiali fedelmente.
- "saldo_cassa_finale" = saldo del conto corrente bancario al 31/12 (sezione di verifica/controllo cassa).
- Estrai UNA riga per ciascun condòmino presente nel prospetto di riparto per unità.`;

  const jsonSchema = {
    type: "OBJECT",
    properties: {
      is_valido: { type: "BOOLEAN", description: "True se il file è un consuntivo/rendiconto condominiale pertinente. False altrimenti (es. documenti estranei, ricette di cucina)." },
      motivo_errore: { type: "STRING", description: "Se is_valido è false, spiega perché." },
      dati: {
        type: "OBJECT",
        properties: {
          anno: { type: "NUMBER", nullable: true },
          saldo_cassa_finale: { type: "NUMBER", nullable: true },
          saldi_unita: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                numero: { type: "STRING", nullable: true },
                nominativo: { type: "STRING" },
                saldo: { type: "NUMBER" }
              },
              required: ["nominativo", "saldo"]
            }
          },
          note: { type: "STRING", nullable: true }
        },
        required: ["saldi_unita"]
      }
    },
    required: ["is_valido"]
  };

  const userPrompt = (isVisual || isPdf)
    ? 'Analizza questo consuntivo condominiale ed estrai i saldi di chiusura.'
    : `Analizza questo consuntivo condominiale ed estrai i saldi di chiusura.\n\nContenuto del file:\n${contenuto}`;

  return await withAutoRetry(async () => {
    const risposta = isVisual
      ? await callGeminiVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'estrai_saldi_consuntivo', maxTokens: 3000, jsonMode: true, jsonSchema })
      : isPdf
      ? await callGeminiDocument(userPrompt, contenuto, { system: systemPrompt, funzione: 'estrai_saldi_consuntivo', maxTokens: 3000, jsonMode: true, jsonSchema })
      : await callGemini(userPrompt, { system: systemPrompt, funzione: 'estrai_saldi_consuntivo', maxTokens: 3000, jsonMode: true, jsonSchema });

    const parsed = pulisciEdEstraiJson(risposta, false);
    if (parsed && typeof parsed === 'object') {
      if (parsed.anno != null) parsed.anno = pulisciNumero(parsed.anno);
      if (parsed.saldo_cassa_finale != null) parsed.saldo_cassa_finale = pulisciNumero(parsed.saldo_cassa_finale);
      if (Array.isArray(parsed.saldi_unita)) {
        parsed.saldi_unita = parsed.saldi_unita.map(u => ({
          ...u,
          saldo: pulisciNumero(u.saldo) ?? 0
        }));
      }
    }
    return parsed;
  });
}// ── Estrae il PROFILO/struttura del modello consuntivo dell'amministratore ──
// Ritorna { etichette_categorie, ordine_categorie, sezioni:{...flags}, note, motivazione_condofast }.
// NB: estrae la PRESENTAZIONE (ordine/etichette/sezioni presenti), NON i numeri.
export async function estraiStrutturaConsuntivo(file) {
  if (!validaMimeType(file)) return null;
  const prep = await preparaContenuto(file) // { contenuto, isPdf?, mediaType?, isVisual? } oppure testo

  const system =
    `Sei un assistente che analizza la STRUTTURA di un rendiconto/consuntivo condominiale italiano (art. 1130-bis c.c.).
Devi estrarre SOLO la presentazione, NON i numeri.
Mappa le voci di spesa del documento alle categorie canoniche: assicurazione, amministrazione, utenze, manutenzione, straordinaria, altro.
Imposta "attiva": true per ogni sezione effettivamente presente nel modello, false se assente. La nota sintetica è obbligatoria: tienila true.
Fornisci anche una breve motivazione "motivazione_condofast" che spiega perché il modello standard CondoFAST (con 5 sezioni A->E ex art. 1130-bis) aggiunga o completi la struttura del documento caricato.`

  const jsonSchema = {
    type: "OBJECT",
    properties: {
      is_valido: { type: "BOOLEAN", description: "True se è un consuntivo o rendiconto condominiale pertinente. False altrimenti (es. documenti estranei o ricette di cucina)." },
      motivo_errore: { type: "STRING" },
      dati: {
        type: "OBJECT",
        properties: {
          ordine_categorie: { type: "ARRAY", items: { type: "STRING" } },
          etichette_categorie: { type: "OBJECT" },
          sezioni: {
            type: "OBJECT",
            properties: {
              competenza: { type: "OBJECT", properties: { attiva: { type: "BOOLEAN" } } },
              riparto: { type: "OBJECT", properties: { attiva: { type: "BOOLEAN" } } },
              cassa: { type: "OBJECT", properties: { attiva: { type: "BOOLEAN" } } },
              fatture: { type: "OBJECT", properties: { attiva: { type: "BOOLEAN" } } },
              confronto_prev: { type: "OBJECT", properties: { attiva: { type: "BOOLEAN" } } },
              nota_sintetica: { type: "OBJECT", properties: { attiva: { type: "BOOLEAN" } } }
            }
          },
          motivazione_condofast: { type: "STRING", description: "Breve frase sui vantaggi dello standard CondoFAST rispetto al file caricato." },
          note: { type: "STRING", nullable: true }
        }
      }
    },
    required: ["is_valido"]
  };

  const userPrompt =
    `Analizza la struttura di questo consuntivo e restituisci il JSON del profilo (solo presentazione).`

  return await withAutoRetry(async () => {
    let raw
    if (prep.isPdf) {
      raw = await callGeminiDocument(userPrompt, prep.contenuto, {
        system, mediaType: prep.mediaType || 'application/pdf',
        funzione: 'estrai_struttura_consuntivo', maxTokens: 3000, jsonMode: true, jsonSchema
      })
    } else if (prep.isVisual) {
      raw = await callGeminiVision(`${system}\n\n${userPrompt}`, prep.contenuto, prep.mediaType, {
        funzione: 'estrai_struttura_consuntivo', maxTokens: 3000, jsonMode: true, jsonSchema
      })
    } else {
      raw = await callGemini(`${userPrompt}\n\n--- DOCUMENTO ---\n${prep.contenuto}`, {
        system, funzione: 'estrai_struttura_consuntivo', maxTokens: 3000, jsonMode: true, jsonSchema
      })
    }

    return pulisciEdEstraiJson(raw, false);
  });
}

// ─── ANAGRAFICA: Estrai elenco persone e condòmini da qualsiasi file (PDF, DOCX, XLSX, JPG...) ───
export async function estraiAnagraficaDaFile(file) {
  if (!validaMimeType(file)) return null;
  const prep = await preparaContenuto(file)

  const systemPrompt = `Sei un esperto di amministrazione condominiale italiana ed estrazione dati con intelligenza artificiale.
Il tuo compito è scansionare in modo estremamente accurato il documento per estrarre tutti i dati anagrafici di persone o condòmini.

REGOLE CRITICHE PER I CONTATTI (EVITA ERRORI O OMISSIONI):
1. EMAIL/PEC: Cerca accuratamente in ogni sezione o colonna del documento qualsiasi stringa che contenga il carattere "@" (es. email, e-mail, pec, posta elettronica).
2. TELEFONO/CELLULARE: Cerca in modo approfondito qualsiasi numero di telefono o cellulare associato alle persone. Estrai la sequenza numerica pulendola da spazi o trattini.
3. ASSOCIAZIONE DI RIGA: Presta attenzione a non saltare le colonne dei contatti. Spesso i contatti sono scritti in fondo alla riga o in una sezione separata.
4. NOME E COGNOME: Dividi accuratamente il Nome e il Cognome.`;

  const jsonSchema = {
    type: "OBJECT",
    properties: {
      is_valido: { type: "BOOLEAN", description: "True se il file contiene liste di condomini, anagrafiche o contatti pertinenti. False se il file non contiene dati anagrafici o è estraneo (es. ricette di cucina)." },
      motivo_errore: { type: "STRING" },
      dati: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            nome: { type: "STRING", nullable: true },
            cognome: { type: "STRING", nullable: true },
            email: { type: "STRING", nullable: true },
            telefono: { type: "STRING", nullable: true },
            indirizzo: { type: "STRING", nullable: true },
            citta: { type: "STRING", nullable: true },
            cap: { type: "STRING", nullable: true },
            provincia: { type: "STRING", nullable: true },
            codice_fiscale: { type: "STRING", nullable: true },
            ruolo: { type: "STRING", nullable: true },
            unita: { type: "STRING", nullable: true }
          }
        }
      }
    },
    required: ["is_valido"]
  };

  const userPrompt = `Estrai l'elenco di tutte le persone e i loro dati anagrafici presenti in questo contenuto:`

  return await withAutoRetry(async () => {
    let raw
    if (prep.isPdf) {
      raw = await callGeminiDocument(userPrompt, prep.contenuto, {
        system: systemPrompt,
        mediaType: prep.mediaType || 'application/pdf',
        funzione: 'import_anagrafica',
        maxTokens: 8000,
        jsonMode: true, jsonSchema
      })
    } else if (prep.isVisual) {
      raw = await callGeminiVision(`${systemPrompt}\n\n${userPrompt}`, prep.contenuto, prep.mediaType, {
        funzione: 'import_anagrafica',
        maxTokens: 8000,
        jsonMode: true, jsonSchema
      })
    } else {
      raw = await callGemini(`${userPrompt}\n\n--- CONTENUTO ---\n${String(prep.contenuto).substring(0, 30000)}`, {
        system: systemPrompt,
        funzione: 'import_anagrafica',
        maxTokens: 8000,
        jsonMode: true, jsonSchema
      })
    }

    const parsed = pulisciEdEstraiJson(raw, false);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.dati)) return parsed.dati;
    return [];
  });
}

// ── Estrae una o più tabelle millesimali da un file (PDF, XLSX, CSV, DOCX, Immagine) ──
export async function estraiTabelleMillesimali(file) {
  if (!validaMimeType(file)) {
    throw new Error(`Tipo file non consentito: ${file.name}. Usa PDF, immagine, XLSX, DOCX, CSV o TXT.`);
  }

  const prep = await preparaContenuto(file);

  const systemPrompt = `Sei un esperto di amministrazione condominiale e catasto italiano.
Il tuo compito è analizzare un documento o un foglio di calcolo contenente una o più TABELLE MILLESIMALI di un condominio.
Estrai tutte le tabelle millesimali trovate e per ciascuna di esse le righe che associano l'unità immobiliare (o condòmino) ai rispettivi millesimi.

Se nel documento è presente una tabella con più colonne millesimali (es. colonna 1 = Proprietà, colonna 2 = Scale & Ascensore), genera un elemento nell'array "tabelle" per ciascuna di queste colonne.`;

  const jsonSchema = {
    type: "OBJECT",
    properties: {
      is_valido: { type: "BOOLEAN", description: "True se il file contiene tabelle millesimali pertinenti. False altrimenti (es. documenti estranei, ricette di cucina)." },
      motivo_errore: { type: "STRING" },
      dati: {
        type: "OBJECT",
        properties: {
          tabelle: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                nome: { type: "STRING", description: "Nome della colonna millesimale o tabella (es. Proprietà generale, Scale & Ascensore, ecc.)" },
                righe: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      unita: { type: "STRING", description: "Identificativo univoco dell'unità immobiliare nel documento. Usa Subalterno se presente, o Numero interno. NON lasciare vuoto." },
                      piano: { type: "STRING", nullable: true },
                      destinazione: { type: "STRING", nullable: true },
                      superficie_mq: { type: "NUMBER", nullable: true },
                      proprietario_nome: { type: "STRING", nullable: true },
                      proprietario_cognome: { type: "STRING", nullable: true },
                      nominativo_completo: { type: "STRING", nullable: true },
                      valore: { type: "NUMBER", description: "Valore millesimale decimale" }
                    },
                    required: ["unita", "valore"]
                  }
                }
              },
              required: ["nome", "righe"]
            }
          }
        },
        required: ["tabelle"]
      }
    },
    required: ["is_valido"]
  };

  const userPrompt = `Estrai le tabelle millesimali e i relativi valori presenti in questo contenuto:`;

  return await withAutoRetry(async () => {
    let raw;
    if (prep.isPdf) {
      raw = await callGeminiDocument(userPrompt, prep.contenuto, {
        system: systemPrompt,
        mediaType: prep.mediaType || 'application/pdf',
        funzione: 'estrai_tabelle_millesimali',
        maxTokens: 8000,
        jsonMode: true, jsonSchema
      });
    } else if (prep.isVisual) {
      raw = await callGeminiVision(`${systemPrompt}\n\n${userPrompt}`, prep.contenuto, prep.mediaType, {
        funzione: 'estrai_tabelle_millesimali',
        maxTokens: 8000,
        jsonMode: true, jsonSchema
      });
    } else {
      raw = await callGemini(`${userPrompt}\n\n--- CONTENUTO ---\n${String(prep.contenuto).substring(0, 30000)}`, {
        system: systemPrompt,
        funzione: 'estrai_tabelle_millesimali',
        maxTokens: 8000,
        jsonMode: true, jsonSchema
      });
    }

    const parsed = pulisciEdEstraiJson(raw, false);
    const tabelle = parsed?.tabelle || (Array.isArray(parsed) ? parsed : []);
    return (tabelle || []).map(tab => ({
      ...tab,
      righe: (tab.righe || []).map(r => ({
        ...r,
        valore: pulisciNumero(r.valore) ?? 0,
        superficie_mq: pulisciNumero(r.superficie_mq)
      }))
    }));
  });
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
Il tuo compito è analizzare un file esportato da un gestionale (es. Danea Domustudio, Gecosei, Metodo o altri) e classificare i dati che contiene, poi estrarli.

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
8. Per le rate: "stato" si determina da importo_pagato vs importo (pagata = uguali, parziale = parziale, non_pagata = 0 pagato)`;

  const jsonSchema = {
    type: "OBJECT",
    properties: {
      is_valido: { type: "BOOLEAN", description: "True se il file sembra provenire da un gestionale o contiene dati importabili. False se è inutile, vuoto, o palesemente estraneo (es. ricette di cucina)." },
      motivo_errore: { type: "STRING" },
      dati: {
        type: "OBJECT",
        properties: {
          tipo: { type: "STRING", description: "anagrafica, unita, millesimi, spese, rate, saldo_cassa, misto, sconosciuto" },
          gestionale: { type: "STRING", description: "Danea Domustudio, Gecosei, Metodo, generico" },
          condominio: { type: "OBJECT", nullable: true, properties: { nome: { type: "STRING", nullable: true }, indirizzo: { type: "STRING", nullable: true }, cf_condominio: { type: "STRING", nullable: true } } },
          persone: { type: "ARRAY", nullable: true, items: { type: "OBJECT", properties: { nome: { type: "STRING" }, cognome: { type: "STRING" }, codice_fiscale: { type: "STRING", nullable: true }, email: { type: "STRING", nullable: true }, telefono: { type: "STRING", nullable: true }, ruolo: { type: "STRING", nullable: true }, unita_rif: { type: "STRING", nullable: true } }, required: ["nome", "cognome"] } },
          unita: { type: "ARRAY", nullable: true, items: { type: "OBJECT", properties: { numero: { type: "STRING" }, tipo: { type: "STRING", nullable: true }, scala: { type: "STRING", nullable: true }, piano: { type: "STRING", nullable: true }, mq: { type: "NUMBER", nullable: true }, proprietario_nome: { type: "STRING", nullable: true }, proprietario_cognome: { type: "STRING", nullable: true } }, required: ["numero"] } },
          millesimi: { type: "ARRAY", nullable: true, items: { type: "OBJECT", properties: { tabella: { type: "STRING" }, righe: { type: "ARRAY", items: { type: "OBJECT", properties: { unita_rif: { type: "STRING" }, valore: { type: "NUMBER" }, proprietario_nome: { type: "STRING", nullable: true } }, required: ["unita_rif", "valore"] } } }, required: ["tabella", "righe"] } },
          saldi_iniziali: { type: "ARRAY", nullable: true, items: { type: "OBJECT", properties: { anno: { type: "NUMBER" }, unita_rif: { type: "STRING" }, proprietario_nome: { type: "STRING", nullable: true }, saldo: { type: "NUMBER" } }, required: ["anno", "unita_rif", "saldo"] } },
          spese: { type: "ARRAY", nullable: true, items: { type: "OBJECT", properties: { anno: { type: "NUMBER" }, data: { type: "STRING", nullable: true }, descrizione: { type: "STRING" }, categoria: { type: "STRING" }, importo: { type: "NUMBER" }, fornitore: { type: "STRING", nullable: true } }, required: ["anno", "descrizione", "categoria", "importo"] } },
          rate: { type: "ARRAY", nullable: true, items: { type: "OBJECT", properties: { anno: { type: "NUMBER" }, numero_rata: { type: "NUMBER", nullable: true }, scadenza: { type: "STRING", nullable: true }, unita_rif: { type: "STRING" }, importo: { type: "NUMBER" }, importo_pagato: { type: "NUMBER" }, stato: { type: "STRING", description: "pagata, parziale, non_pagata" } }, required: ["anno", "unita_rif", "importo", "importo_pagato", "stato"] } }
        },
        required: ["tipo", "gestionale"]
      }
    },
    required: ["is_valido"]
  };

  const userPrompt = (isVisual || isPdf)
    ? 'Analizza questo file esportato da un gestionale condominiale.'
    : `Analizza questo file esportato da un gestionale condominiale.\n\nContenuto del file:\n${String(contenuto).substring(0, 30000)}`;

  return await withAutoRetry(async () => {
    const risposta = isVisual
      ? await callGeminiVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'classifica_gestionale', maxTokens: 6000, jsonMode: true, jsonSchema })
      : isPdf
      ? await callGeminiDocument(userPrompt, contenuto, { system: systemPrompt, funzione: 'classifica_gestionale', maxTokens: 6000, jsonMode: true, jsonSchema })
      : await callGemini(userPrompt, { system: systemPrompt, funzione: 'classifica_gestionale', maxTokens: 6000, jsonMode: true, jsonSchema });

    return pulisciEdEstraiJson(risposta, false);
  });
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

Regole importanti:
1. Pulisci i dati catastali: rimuovi spazi superflui e normalizzali.
2. Codice Fiscale: controlla che sia valido a 16 cifre, convertilo in MAIUSCOLO.
3. Se un campo non è presente o non è leggibile, impostalo a null. Non inventare dati.`;

  const jsonSchema = {
    type: "OBJECT",
    properties: {
      is_valido: { type: "BOOLEAN", description: "True se il file è un modulo di anagrafe condominiale pertinente. False altrimenti (es. documenti estranei, ricette di cucina)." },
      motivo_errore: { type: "STRING" },
      dati: {
        type: "OBJECT",
        properties: {
          unita: {
            type: "OBJECT",
            properties: {
              catasto_foglio: { type: "STRING", nullable: true },
              catasto_particella: { type: "STRING", nullable: true },
              catasto_subalterno: { type: "STRING", nullable: true },
              catasto_categoria: { type: "STRING", nullable: true },
              catasto_rendita: { type: "NUMBER", nullable: true }
            }
          },
          persona: {
            type: "OBJECT",
            properties: {
              nome: { type: "STRING", nullable: true },
              cognome: { type: "STRING", nullable: true },
              codice_fiscale: { type: "STRING", nullable: true, description: "Normalizzato a 16 caratteri maiuscoli" },
              email: { type: "STRING", nullable: true },
              telefono: { type: "STRING", nullable: true },
              residenza_indirizzo: { type: "STRING", nullable: true, description: "Via/piazza, civico" },
              residenza_comune: { type: "STRING", nullable: true },
              residenza_cap: { type: "STRING", nullable: true },
              residenza_provincia: { type: "STRING", nullable: true, description: "Sigla a 2 caratteri" }
            }
          },
          ruolo: { type: "STRING", nullable: true, description: "proprietario, inquilino, comproprietario, usufruttuario" }
        }
      }
    },
    required: ["is_valido"]
  };

  const userPrompt = `Analizza questo modulo compilato dal condomino ed estrai i dati.`;

  const risposta = isImage
    ? await callGeminiVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'estrazione_anagrafe', condominio_id: condominioId, maxTokens: 4000, jsonMode: true, jsonSchema })
    : isPdf
    ? await callGeminiDocument(userPrompt, contenuto, { system: systemPrompt, funzione: 'estrazione_anagrafe', condominio_id: condominioId, maxTokens: 4000, jsonMode: true, jsonSchema })
    : await callGemini(userPrompt + `\n\nContenuto del modulo:\n${contenuto}`, { system: systemPrompt, funzione: 'estrazione_anagrafe', condominio_id: condominioId, maxTokens: 4000, jsonMode: true, jsonSchema });

  return pulisciEdEstraiJson(risposta, false);
}

// ─── Comprime e ridimensiona immagini client-side per salvaguardare lo storage ───
export function comprimiImmagine(file, maxW = 1600, qualita = 0.8) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return Promise.resolve(file)
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxW / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)

        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const compFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
            type: 'image/jpeg',
            lastModified: Date.now()
          })
          resolve(compFile)
        }, 'image/jpeg', qualita)
      }
      img.onerror = () => resolve(file)
      img.src = reader.result
    }
    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
  })
}

// ─── AUTO-TAGGING DOCUMENTI ──────────────────────────────────────────────────
export async function generaTagDocumento(file, tipo_hint = '', note = '', dataDocumento = null) {
  if (!validaMimeType(file)) return [];
  const { contenuto, isVisual, isPdf, mediaType } = await preparaContenuto(file);

  const systemPrompt = `Sei un assistente esperto in catalogazione documentale per amministratori di condominio.
Il tuo compito è analizzare il contenuto di un documento e generare un singolo #tag ultra-descrittivo e standardizzato.

REGOLE CRITICHE PER IL NOME DEL TAG:
1. Deve iniziare con '#' e contenere solo lettere minuscole, numeri e trattini (es. #fattura-pulizie).
2. Costruisci il tag in base al tipo e al contenuto: 
   - Se fattura/preventivo: #{tipo}-{fornitore} (es. #fattura-enel, #preventivo-ascensore).
   - Se verbale: #verbale-{argomento} (es. #verbale-straordinaria, #verbale-ordinaria).
   - Se altro: #{tipo}-{sunto}
3. Se viene fornita o trovi nel testo la data del documento, appendi alla fine "-MM-YYYY" o "-YYYY".
   Esempio completo: #fattura-idraulico-10-2026. Se non hai mese, usa solo l'anno (es. -2026).
4. Restituisci sempre e solo UN (1) singolo tag altamente rappresentativo nell'array.`;

  const jsonSchema = {
    type: "OBJECT",
    properties: {
      tags: {
        type: "ARRAY",
        items: { type: "STRING" }
      }
    },
    required: ["tags"]
  };

  const userPrompt = `Analizza questo documento (tipo utente: ${tipo_hint}). Note: ${note}. Data indicata: ${dataDocumento || 'non fornita'}.\nEstrai il tag standardizzato.`;

  return await withAutoRetry(async () => {
    const raw = isVisual
      ? await callGeminiVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'genera_tag', maxTokens: 100, jsonMode: true, jsonSchema })
      : isPdf
      ? await callGeminiDocument(userPrompt, contenuto, { system: systemPrompt, funzione: 'genera_tag', maxTokens: 100, jsonMode: true, jsonSchema })
      : await callGemini(userPrompt + `\n\nContenuto:\n${String(contenuto).substring(0, 10000)}`, { system: systemPrompt, funzione: 'genera_tag', maxTokens: 100, jsonMode: true, jsonSchema });

    const parsed = pulisciEdEstraiJson(raw, false);
    return Array.isArray(parsed?.tags) ? parsed.tags : [];
  });
}

/**
 * Motore Universale di Analisi, Classificazione e Routing Documentale (Universal AI Dropzone).
 * Analizza qualsiasi file (PDF, XML, P7M, immagini, Excel, Word) e determina l'azione esatta
 * nel gestionale, estraendo tutti i metadati pertinenti per l'esecuzione in 1 click.
 */
export async function analizzaEClassificaDocumentoUniversale(file, condominioCorrente = null) {
  if (!validaMimeType(file)) {
    throw new Error(`Tipo file non consentito: ${file.name}. Usa PDF, XML, P7M, XLSX, DOCX, CSV, JPG o PNG.`);
  }

  // 1. Controllo nativo per fatture elettroniche XML / P7M (0ms, 100% deterministico)
  const infoTipo = getTipoFile(file);
  if (infoTipo === 'xml' || infoTipo === 'p7m') {
    try {
      const resXml = await parseFatturaXmlP7m(file);
      const datiFatt = resXml?.dati || resXml;
      return {
        tipo_documento: 'fattura_spesa',
        titolo_rilevato: `Fattura ${datiFatt.numero_fattura || ''} - ${datiFatt.fornitore || 'Fornitore'}`,
        condominio_destinatario: datiFatt.condominio_destinatario_nome || null,
        condominio_destinatario_codice_fiscale: datiFatt.condominio_destinatario_codice_fiscale || null,
        condominio_destinatario_indirizzo: datiFatt.condominio_destinatario_indirizzo || null,
        condominio_destinatario_citta: datiFatt.condominio_destinatario_citta || null,
        condominio_destinatario_cap: datiFatt.condominio_destinatario_cap || null,
        condominio_destinatario_provincia: datiFatt.condominio_destinatario_provincia || null,
        dati_estratti: {
          fornitore: datiFatt.fornitore,
          partita_iva_fornitore: datiFatt.partita_iva_fornitore,
          importo_totale: datiFatt.importo_totale,
          importo_netto: datiFatt.importo_netto,
          importo_iva: datiFatt.importo_iva,
          importo_ritenuta: datiFatt.importo_ritenuta,
          aliquota_ritenuta: datiFatt.aliquota_ritenuta,
          data_fattura: datiFatt.data_fattura,
          data_scadenza: datiFatt.data_scadenza,
          numero_fattura: datiFatt.numero_fattura,
          descrizione: datiFatt.descrizione,
          categoria: datiFatt.categoria,
          tipo_lavoro: datiFatt.tipo_lavoro || 'ordinario',
          criterio_ripartizione: datiFatt.criterio_ripartizione || 'millesimi'
        },
        azione_suggerita: {
          label: '✨ Registra Spesa / Fattura',
          tipo: 'fattura_spesa',
          route: '/spese',
          icon: 'Receipt',
          descrizione: 'Inserimento automatico nei costi del condominio con calcolo ripartizioni'
        },
        raw_extraction: datiFatt
      };
    } catch (e) {
      console.warn('[analizzaEClassificaDocumentoUniversale] Fallback da XML parser:', e);
    }
  }

  // 2. Analisi multimodale universale tramite Gemini
  const { contenuto, isVisual, isPdf, mediaType } = await preparaContenuto(file);

  const systemPrompt = `Sei l'Intelligenza Artificiale centrale di classificazione e analisi documentale di CondoFast, gestionale per amministratori di condominio italiani.
Il tuo compito è esaminare il documento allegato, identificare CON CERTEZZA la sua tipologia operativa ed estrarre i dati essenziali.

CATEGORIE DI DOCUMENTI RICONOSCIUTE (assegna una di queste 7 categorie):
1. 'fattura_spesa': Fattura commerciale, nota di debito, parcella professionale, bolletta (energia elettrica, gas, acqua, telecomunicazioni), scontrino, ricevuta fiscale per lavori, beni o servizi resi al condominio o allo stabile.
2. 'estratto_conto': Estratto conto bancario o postale, lista movimenti di conto corrente, scalare trimestrale.
3. 'verbale_assemblea': Verbale di assemblea condominiale (ordinaria o straordinaria), delibere assembleari, regolamento di condominio approvato.
4. 'tabella_millesimale': Tabella dei millesimi di proprietà generale, ascensore, riscaldamento, scale o prospetto quote.
5. 'f24_quietanza': Modello F24 quietanzato, ricevuta telematica di versamento dell'Agenzia delle Entrate, delega bancaria F24 (es. codici tributo 1019, 1040, 1038, IMU).
6. 'anagrafica': Registro anagrafe condominiale, elenco condòmini, tabella residenti/occupanti/proprietari/inquilini.
7. 'documento_generale': Polizza assicurativa fabbricato, contratto di manutenzione/appalto, certificato di conformità/CPI, preventivo di spesa, perizia tecnica, lettera o comunicazione generica.

REGOLE CRITICHE:
- Se il documento contiene importi e fornitore/bolletta, classificalo SEMPRE come 'fattura_spesa'.
- Per le FATTURE/SPESE: estrai fornitore, importo totale con decimali, data fattura ISO YYYY-MM-DD, numero fattura, descrizione, e l'anagrafica del condominio committente/destinatario (nome, CF, indirizzo, città, CAP, PR).
- Per gli ESTRATTI CONTO: estrai nome banca, IBAN rilevato, periodo di riferimento e numero approssimativo di movimenti.
- Per i VERBALI: estrai data assemblea ISO, tipo assemblea (ordinaria/straordinaria), delibere approvate ed eventuali importi di spesa approvati.
- Per le TABELLE MILLESIMI: estrai nome tabella e numero di unità elencate.
- Per gli F24: estrai data pagamento ISO, codice tributo principale, importo versato, protocollo telematico se visibile.
- Normalizza tutti i numeri in formato decimale puro (es. 1250.50).`;

  const jsonSchema = {
    type: "OBJECT",
    properties: {
      tipo_documento: { 
        type: "STRING", 
        description: "Uno tra: 'fattura_spesa', 'estratto_conto', 'verbale_assemblea', 'tabella_millesimale', 'f24_quietanza', 'anagrafica', 'documento_generale'" 
      },
      titolo_rilevato: { type: "STRING", description: "Breve titolo parlante es. 'Fattura 45/2025 Enel Energia' o 'Estratto Conto Intesa Q2 2025'" },
      condominio_destinatario_nome: { type: "STRING", nullable: true },
      condominio_destinatario_codice_fiscale: { type: "STRING", nullable: true },
      condominio_destinatario_indirizzo: { type: "STRING", nullable: true },
      condominio_destinatario_citta: { type: "STRING", nullable: true },
      condominio_destinatario_cap: { type: "STRING", nullable: true },
      condominio_destinatario_provincia: { type: "STRING", nullable: true },
      
      // Metadati specifici
      fornitore: { type: "STRING", nullable: true },
      partita_iva_fornitore: { type: "STRING", nullable: true },
      codice_fiscale_fornitore: { type: "STRING", nullable: true },
      numero_documento: { type: "STRING", nullable: true },
      data_documento: { type: "STRING", nullable: true },
      data_scadenza: { type: "STRING", nullable: true },
      importo_totale: { type: "NUMBER", nullable: true },
      importo_netto: { type: "NUMBER", nullable: true },
      importo_iva: { type: "NUMBER", nullable: true },
      importo_ritenuta: { type: "NUMBER", nullable: true },
      aliquota_ritenuta: { type: "NUMBER", nullable: true },
      descrizione: { type: "STRING", nullable: true },
      categoria_consigliata: { type: "STRING", nullable: true },
      tipo_lavoro_consigliato: { type: "STRING", nullable: true },
      banca_o_iban: { type: "STRING", nullable: true },
      note: { type: "STRING", nullable: true }
    },
    required: ["tipo_documento", "titolo_rilevato"]
  };

  const userPrompt = (isVisual || isPdf)
    ? 'Classifica questo documento per il gestionale condominiale ed estrai tutti i dati necessari.'
    : `Classifica questo documento per il gestionale condominiale ed estrai tutti i dati necessari.\n\nTesto del documento:\n${String(contenuto).substring(0, 30000)}`;

  return await withAutoRetry(async () => {
    const raw = isVisual
      ? await callGeminiVision(`${systemPrompt}\n\n${userPrompt}`, contenuto, mediaType, { funzione: 'classifica_universale', maxTokens: 4000, jsonMode: true, jsonSchema })
      : isPdf
      ? await callGeminiDocument(userPrompt, contenuto, { system: systemPrompt, funzione: 'classifica_universale', maxTokens: 4000, jsonMode: true, jsonSchema })
      : await callGemini(userPrompt, { system: systemPrompt, funzione: 'classifica_universale', maxTokens: 4000, jsonMode: true, jsonSchema });

    const parsed = pulisciEdEstraiJson(raw, false) || {};
    
    // Normalizzazione categoria rilevata
    let tipo = parsed.tipo_documento || 'fattura_spesa';
    if (!['fattura_spesa', 'estratto_conto', 'verbale_assemblea', 'tabella_millesimale', 'f24_quietanza', 'anagrafica', 'documento_generale'].includes(tipo)) {
      tipo = (parsed.fornitore || parsed.importo_totale != null || parsed.numero_documento) ? 'fattura_spesa' : 'documento_generale';
    }

    const azioniMap = {
      fattura_spesa: {
        label: '✨ Registra Spesa / Fattura',
        tipo: 'fattura_spesa',
        route: '/spese',
        icon: 'Receipt',
        descrizione: 'Inserimento nei costi del condominio e calcolo ripartizioni'
      },
      estratto_conto: {
        label: '✨ Vai a Riconciliazioni Bancarie',
        tipo: 'estratto_conto',
        route: '/condomini',
        icon: 'Landmark',
        descrizione: 'Importa movimenti bancari e riconcilia con fatture e quote condòmini'
      },
      verbale_assemblea: {
        label: '✨ Archivia Verbale di Assemblea',
        tipo: 'verbale_assemblea',
        route: '/condomini',
        icon: 'FileText',
        descrizione: 'Salva con estrazione automatica delle delibere e ricerca AI'
      },
      tabella_millesimale: {
        label: '✨ Importa Tabella nei Millesimi',
        tipo: 'tabella_millesimale',
        route: '/condomini',
        icon: 'Scale',
        descrizione: 'Assegna i valori millesimali alle unità immobiliari'
      },
      f24_quietanza: {
        label: '✨ Registra nel Modulo Fiscale',
        tipo: 'f24_quietanza',
        route: '/modulo-fiscale',
        icon: 'ShieldCheck',
        descrizione: 'Abbina la quietanza alle ritenute d\'acconto e deleghe F24'
      },
      anagrafica: {
        label: '✨ Importa Anagrafica Condòmini',
        tipo: 'anagrafica',
        route: '/condomini',
        icon: 'Users',
        descrizione: 'Popola il registro anagrafe con proprietari, inquilini e unità'
      },
      documento_generale: {
        label: '✨ Archivia nei Documenti',
        tipo: 'documento_generale',
        route: '/condomini',
        icon: 'Archive',
        descrizione: 'Cataloga con tag automatici nell\'archivio documentale'
      }
    };

    return {
      tipo_documento: tipo,
      titolo_rilevato: parsed.titolo_rilevato || file.name,
      condominio_destinatario: parsed.condominio_destinatario_nome || null,
      condominio_destinatario_codice_fiscale: parsed.condominio_destinatario_codice_fiscale || null,
      condominio_destinatario_indirizzo: parsed.condominio_destinatario_indirizzo || null,
      condominio_destinatario_citta: parsed.condominio_destinatario_citta || null,
      condominio_destinatario_cap: parsed.condominio_destinatario_cap || null,
      condominio_destinatario_provincia: parsed.condominio_destinatario_provincia || null,
      dati_estratti: {
        fornitore: parsed.fornitore || null,
        partita_iva_fornitore: parsed.partita_iva_fornitore || null,
        codice_fiscale_fornitore: parsed.codice_fiscale_fornitore || null,
        numero_fattura: parsed.numero_documento || null,
        data_fattura: parsed.data_documento || null,
        data_scadenza: parsed.data_scadenza || null,
        importo_totale: parsed.importo_totale != null ? Number(parsed.importo_totale) : null,
        importo_netto: parsed.importo_netto != null ? Number(parsed.importo_netto) : null,
        importo_iva: parsed.importo_iva != null ? Number(parsed.importo_iva) : 0,
        importo_ritenuta: parsed.importo_ritenuta != null ? Number(parsed.importo_ritenuta) : 0,
        aliquota_ritenuta: parsed.aliquota_ritenuta != null ? Number(parsed.aliquota_ritenuta) : 4,
        descrizione: parsed.descrizione || parsed.titolo_rilevato || '',
        categoria: parsed.categoria_consigliata || 'ordinaria',
        tipo_lavoro: parsed.tipo_lavoro_consigliato || 'ordinario',
        criterio_ripartizione: 'millesimi',
        banca_o_iban: parsed.banca_o_iban || null,
        note: parsed.note || ''
      },
      azione_suggerita: azioniMap[tipo] || azioniMap.fattura_spesa,
      raw_extraction: parsed
    };
  });
}