// src/lib/geminiClient.js
import { supabase } from './supabaseClient.js';

// ── Errore specifico per rate limit ──────────────────────────────────────
export class RateLimitError extends Error {
  constructor(retryAfter = 60) {
    super('Troppe richieste AI. Riprova tra poco.')
    this.name       = 'RateLimitError'
    this.retryAfter = retryAfter  // secondi, letto dall'header Retry-After
  }
}

// ── Helper: sanitizza input ───────────────────────────────────────────────
function sanitizeInput(text, maxLength = 40000) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, maxLength)
    .trim();
}

// ── Helper: estrae un messaggio leggibile dall'errore del proxy ───────────
function estraiMessaggioErrore(err, status) {
  const e = err?.error;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') return e.message || JSON.stringify(e);
  if (typeof err?.message === 'string') return err.message;
  return `Edge Function error ${status}`;
}

// ── Helper: log su ai_call_log (best-effort) ──────────────────────────────
async function logAiCall({ funzione, condominio_id, inputTokens, outputTokens }) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('ai_call_log').insert({
      user_id:       user.id,
      condominio_id: condominio_id ?? null,
      funzione:      funzione ?? 'generic',
      token_input:   inputTokens ?? null,
      token_output:  outputTokens ?? null,
    });
  } catch {
    // silenzioso
  }
}

// ── Helper: Timeout per promesse ──────────────────────────────────────────
function withTimeout(promise, ms = 50000, errorMsg = 'Tempo di risposta AI scaduto (timeout 50s)') {
  let timer
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(errorMsg)
      err.name = 'TimeoutError'
      reject(err)
    }, ms)
  })
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeoutPromise
  ])
}

// ── Helper condiviso: chiama la Edge Function ─────────────────────────────
async function callEdge(body) {
  const tokenLimit = body.maxTokens || body.max_tokens || 8192;
  const isProFunction = ['ricerca_verbali_ai', 'criterio_ripartizione', 'struttura_tabella_millesimale'].includes(body.funzione);
  const preferredModel = isProFunction ? 'gemini-1.5-pro-latest' : 'gemini-2.0-flash';
  const timeoutMs = body.timeoutMs || 50000;

  const payload = {
    ...body,
    maxTokens: tokenLimit,
    max_tokens: tokenLimit,
    model: body.model || preferredModel
  };

  const { data, error } = await withTimeout(
    supabase.functions.invoke('gemini-proxy', {
      body: payload,
    }),
    timeoutMs,
    `Tempo limite AI superato (${Math.round(timeoutMs / 1000)}s)`
  );

  if (error) {
    if (error.status === 429 || error.message?.includes('429') || error.message?.includes('Troppe richieste')) {
      throw new RateLimitError(60);
    }
    
    // Tentativo di estrazione messaggio dal context di Supabase Functions
    let errorMsg = error.message || 'Errore durante la chiamata AI';
    try {
      if (error.context && typeof error.context.json === 'function') {
        const bodyErr = await error.context.json();
        if (bodyErr?.error) {
          errorMsg = typeof bodyErr.error === 'string' ? bodyErr.error : bodyErr.error.message || errorMsg;
        }
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : data.error.message || 'Errore Edge Function AI');
  }

  return data;
}

// ── callGemini ────────────────────────────────────────────────────────────
/**
 * @param {string} prompt
 * @param {object} [opts]
 * @param {string} [opts.funzione]      - nome logico per il log
 * @param {string} [opts.condominio_id]
 * @param {number} [opts.maxTokens]
 * @param {string} [opts.system]
 * @returns {Promise<string>}
 * @throws {RateLimitError} se il rate limit è raggiunto
 */
export async function callGemini(prompt, opts = {}) {
  const { funzione, condominio_id, maxTokens = 4000, system, jsonMode, jsonSchema } = opts;

  const data = await callEdge({
    type:      'text',
    prompt:    sanitizeInput(prompt),
    maxTokens,
    system:    system ? sanitizeInput(system, 4000) : undefined,
    funzione,
    jsonMode,
    jsonSchema,
  });

  logAiCall({
    funzione,
    condominio_id,
    inputTokens:  data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
  });

  const block = data.content?.find(b => b.type === 'text');
  if (data.finishReason && data.finishReason !== 'STOP') {
    console.warn(`[geminiClient] Chiamata terminata con finishReason: ${data.finishReason} (Modello: ${data.modelUsed})`);
  }
  return block?.text ?? '';
}

// ── callGeminiWithHistory ─────────────────────────────────────────────────
/**
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [opts]
 */
export async function callGeminiWithHistory(messages, opts = {}) {
  const { funzione, condominio_id, maxTokens = 4000, system, jsonMode, jsonSchema } = opts;

  const data = await callEdge({
    type:     'history',
    messages: messages.map(m => ({ role: m.role, content: sanitizeInput(m.content) })),
    maxTokens,
    system:   system ? sanitizeInput(system, 4000) : undefined,
    funzione,
    jsonMode,
    jsonSchema,
  });

  logAiCall({
    funzione,
    condominio_id,
    inputTokens:  data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
  });

  const block = data.content?.find(b => b.type === 'text');
  return block?.text ?? '';
}

// ── callGeminiVision ──────────────────────────────────────────────────────
/**
 * @param {string} prompt
 * @param {string} base64Image   - base64 puro (senza prefisso data:...)
 * @param {string} mediaType     - es. 'image/jpeg'
 * @param {object} [opts]
 * NB: il path vision NON inoltra `system` → il chiamante accorpa system+user nel prompt.
 */
export async function callGeminiVision(prompt, base64Image, mediaType, opts = {}) {
  const { funzione, condominio_id, maxTokens = 4000, jsonMode, jsonSchema } = opts;

  const data = await callEdge({
    type:      'vision',
    prompt:    sanitizeInput(prompt),
    image:     base64Image,
    mediaType,
    maxTokens,
    funzione,
    jsonMode,
    jsonSchema,
  });

  logAiCall({
    funzione,
    condominio_id,
    inputTokens:  data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
  });

  const block = data.content?.find(b => b.type === 'text');
  return block?.text ?? '';
}

// ── callGeminiDocument ────────────────────────────────────────────────────
/**
 * Estrazione da PDF (e altri documenti) via blocco `document` del proxy.
 * A differenza di callGeminiVision, QUESTO inoltra `system` (il path document
 * lo supporta nativamente lato proxy), come callGemini testo.
 *
 * @param {string} prompt
 * @param {string} base64Document - base64 puro del PDF (senza prefisso data:...)
 * @param {object} [opts]
 * @param {string} [opts.system]
 * @param {string} [opts.mediaType] - default 'application/pdf'
 * @param {string} [opts.funzione]
 * @param {string} [opts.condominio_id]
 * @param {number} [opts.maxTokens]
 * @throws {RateLimitError} se il rate limit è raggiunto
 */
export async function callGeminiDocument(prompt, base64Document, opts = {}) {
  const {
    funzione, condominio_id, maxTokens = 4000, system,
    mediaType = 'application/pdf', jsonMode, jsonSchema
  } = opts;

  const data = await callEdge({
    type:      'document',
    prompt:    sanitizeInput(prompt),
    document:  base64Document,   // NON sanitizzare: base64 grezzo
    mediaType,
    maxTokens,
    system:    system ? sanitizeInput(system, 4000) : undefined,
    funzione,
    jsonMode,
    jsonSchema,
  });

  logAiCall({
    funzione,
    condominio_id,
    inputTokens:  data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
  });

  const block = data.content?.find(b => b.type === 'text');
  if (data.finishReason && data.finishReason !== 'STOP') {
    console.warn(`[geminiClient] Chiamata terminata con finishReason: ${data.finishReason} (Modello: ${data.modelUsed})`);
  }
  return block?.text ?? '';
}
