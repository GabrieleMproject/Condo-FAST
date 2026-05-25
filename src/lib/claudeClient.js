// src/lib/claudeClient.js
import { supabase } from './supabaseClient';

const EDGE_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/claude-proxy';

// ─── Helper: sanitizza input prima di mandarlo all'AI ───────────────────────
function sanitizeInput(text, maxLength = 40000) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, '')          // strip HTML
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .slice(0, maxLength)
    .trim();
}

// ─── Helper: log su ai_call_log (best-effort, non blocca mai) ────────────────
async function logAiCall({ funzione, condominio_id, inputTokens, outputTokens }) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('ai_call_log').insert({
      user_id: user.id,
      condominio_id: condominio_id ?? null,
      funzione: funzione ?? 'generic',
      token_input: inputTokens ?? null,
      token_output: outputTokens ?? null,
    });
  } catch {
    // silenzioso — il logging non deve mai rompere il flusso principale
  }
}

// ─── Helper condiviso: chiama la Edge Function ───────────────────────────────
async function callEdge(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Edge Function error ${res.status}`);
  }
  return res.json();
}

// ─── callClaude ──────────────────────────────────────────────────────────────
/**
 * @param {string} prompt
 * @param {object} [opts]
 * @param {string} [opts.funzione]      - nome logico per il log (es. 'suggerisci_criterio')
 * @param {string} [opts.condominio_id] - uuid condominio, se disponibile
 * @param {number} [opts.maxTokens]
 * @param {string} [opts.system]
 * @returns {Promise<string>}
 */
export async function callClaude(prompt, opts = {}) {
  const { funzione, condominio_id, maxTokens = 1000, system } = opts;

  const cleanPrompt = sanitizeInput(prompt);

  const data = await callEdge({
    type: 'text',
    prompt: cleanPrompt,
    maxTokens,
    system: system ? sanitizeInput(system, 4000) : undefined,
  });

  // Log (fire-and-forget)
  logAiCall({
    funzione,
    condominio_id,
    inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
  });

  const block = data.content?.find(b => b.type === 'text');
  return block?.text ?? '';
}

// ─── callClaudeWithHistory ───────────────────────────────────────────────────
/**
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [opts]
 */
export async function callClaudeWithHistory(messages, opts = {}) {
  const { funzione, condominio_id, maxTokens = 1000, system } = opts;

  const cleanMessages = messages.map(m => ({
    role: m.role,
    content: sanitizeInput(m.content),
  }));

  const data = await callEdge({
    type: 'history',
    messages: cleanMessages,
    maxTokens,
    system: system ? sanitizeInput(system, 4000) : undefined,
  });

  logAiCall({
    funzione,
    condominio_id,
    inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
  });

  const block = data.content?.find(b => b.type === 'text');
  return block?.text ?? '';
}

// ─── callClaudeVision ────────────────────────────────────────────────────────
/**
 * @param {string} prompt
 * @param {string} base64Image   - base64 puro (senza prefisso data:...)
 * @param {string} mediaType     - es. 'image/jpeg'
 * @param {object} [opts]
 */
export async function callClaudeVision(prompt, base64Image, mediaType, opts = {}) {
  const { funzione, condominio_id, maxTokens = 1000 } = opts;

  const data = await callEdge({
    type: 'vision',
    prompt: sanitizeInput(prompt),
    image: base64Image,
    mediaType,
    maxTokens,
  });

  logAiCall({
    funzione,
    condominio_id,
    inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
  });

  const block = data.content?.find(b => b.type === 'text');
  return block?.text ?? '';
}
