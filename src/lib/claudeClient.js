/**
 * claudeClient.js
 * Wrapper per chiamare la Edge Function Supabase claude-proxy.
 * MAI chiamare direttamente l'API Anthropic dal frontend.
 *
 * Sessione 5: aggiunto supporto vision (immagini e PDF scansionati)
 */
import { supabase } from './supabaseClient';

const EDGE_FUNCTION = 'claude-proxy';

// ─── Chiamata base testo ──────────────────────────────────────────────────────
export async function callClaude(systemPrompt, userMessage, options = {}) {
  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, {
    body: {
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: options.max_tokens || 4096,
      model: options.model || 'claude-sonnet-4-6',
    },
  });

  if (error) throw new Error(`Claude API error: ${error.message}`);
  if (data?.error) throw new Error(data.error);

  // Estrai testo dalla risposta
  const content = data?.content;
  if (Array.isArray(content)) {
    return content.map(c => c.text || '').join('');
  }
  return data?.content || '';
}

// ─── Chiamata vision (immagini / PDF scansionati) ─────────────────────────────
export async function callClaudeVision(systemPrompt, userMessage, base64Data, mediaType = 'application/pdf') {
  const isPdf = mediaType === 'application/pdf';

  const contentBlock = isPdf
    ? {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64Data,
        },
      }
    : {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      };

  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, {
    body: {
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            { type: 'text', text: userMessage },
          ],
        },
      ],
      max_tokens: 4096,
      model: 'claude-sonnet-4-5',
    },
  });

  if (error) throw new Error(`Claude Vision error: ${error.message}`);
  if (data?.error) throw new Error(data.error);

  const content = data?.content;
  if (Array.isArray(content)) {
    return content.map(c => c.text || '').join('');
  }
  return data?.content || '';
}

// ─── Chiamata con storico conversazione ──────────────────────────────────────
export async function callClaudeWithHistory(systemPrompt, messages, options = {}) {
  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, {
    body: {
      system: systemPrompt,
      messages,
      max_tokens: options.max_tokens || 4096,
      model: options.model || 'claude-sonnet-4-6',
    },
  });

  if (error) throw new Error(`Claude API error: ${error.message}`);
  if (data?.error) throw new Error(data.error);

  const content = data?.content;
  if (Array.isArray(content)) {
    return content.map(c => c.text || '').join('');
  }
  return data?.content || '';
}
