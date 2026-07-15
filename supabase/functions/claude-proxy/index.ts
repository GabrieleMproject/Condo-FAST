// supabase/functions/claude-proxy/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RATE_LIMIT     = 60                     // max richieste per finestra
const RATE_WINDOW_MS = 60 * 1000              // finestra = 1 minuto

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Supabase service-role client (accesso a claude_rate_limit) ────────────
function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')            ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
}

// ── Controlla e registra rate limit ──────────────────────────────────────
async function checkRateLimit(userId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const supabase   = getServiceClient()
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()

  // Conta le chiamate nell'ultimo minuto
  const { count, error } = await supabase
    .from('claude_rate_limit')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', windowStart)

  if (error) {
    // In caso di errore DB lascia passare (fail-open) per non bloccare l'utente
    console.error('Rate limit check error:', error.message)
    return { allowed: true }
  }

  if ((count ?? 0) >= RATE_LIMIT) {
    return { allowed: false, retryAfter: 60 }
  }

  // Registra la chiamata corrente
  try {
    await supabase
      .from('claude_rate_limit')
      .insert({ user_id: userId })
  } catch (err) {
    console.error('Errore registrazione rate limit (fail-open):', err)
  }

  return { allowed: true }
}

// ── Mappatura intelligente dei modelli Gemini ─────────────────────────────
function getModel(funzione?: string): string {
  const proFunctions = [
    'ricerca_verbali_ai',
    'criterio_ripartizione',
    'struttura_tabella_millesimale',
    'assistenza_chat'
  ];
  if (funzione && proFunctions.includes(funzione)) {
    return 'gemini-pro-latest';
  }
  return 'gemini-flash-latest';
}

// ═══════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Autenticazione ──────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Non autorizzato' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token non valido o utente non autenticato' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id

    // ── 2. Rate limiting ───────────────────────────────────────────────
    const { allowed, retryAfter } = await checkRateLimit(userId)

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Troppe richieste. Riprova tra poco.' }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter ?? 60),
          },
        }
      )
    }

    // ── 3. Parsing del request body ────────────────────────────────────
    const body = await req.json()
    const type = body.type || 'text'
    const model = getModel(body.funzione || body.model)

    // ── 4. Costruzione payload per Gemini ──────────────────────────────
    let contents: any[] = []

    if (type === 'vision') {
      contents = [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: body.mediaType || 'image/jpeg',
              data: body.image
            }
          },
          { text: body.prompt }
        ]
      }]
    } else if (type === 'document') {
      contents = [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: body.mediaType || 'application/pdf',
              data: body.document
            }
          },
          { text: body.prompt }
        ]
      }]
    } else if (type === 'history') {
      contents = body.messages.map((m: any) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
    } else {
      // type === 'text' (default)
      contents = [{
        role: 'user',
        parts: [{ text: body.prompt }]
      }]
    }

    const geminiPayload: Record<string, any> = {
      contents,
      generationConfig: {
        maxOutputTokens: body.maxTokens || body.max_tokens || 2048,
        temperature: 0.1, // Temperatura bassa per risposte strutturate e deterministiche
      }
    }

    // Istruzione di sistema (se presente)
    if (body.system) {
      geminiPayload.systemInstruction = {
        parts: [{ text: body.system }]
      }
    }

    // Riconoscimento JSON mode nativo
    const isJsonRequested = body.jsonMode || 
                            (body.prompt && /json/i.test(body.prompt)) || 
                            (body.system && /json/i.test(body.system))

    if (isJsonRequested) {
      geminiPayload.generationConfig.responseMimeType = 'application/json'
    }

    // ── 5. Chiamata API Gemini con Fallback automatico su 429 (Rate Limit / Quota) ──
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) {
      throw new Error('Manca la variabile GEMINI_API_KEY nelle impostazioni di Supabase Edge Functions')
    }

    let currentModel = model
    let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiPayload),
    })

    // Se fallisce per quota esaurita o limiti, tenta il fallback su modelli alternativi
    if (!response.ok) {
      const cloneRes = response.clone()
      let isQuotaError = false
      let errText = ''
      try {
        errText = await cloneRes.text()
        isQuotaError = response.status === 429 || 
                       errText.includes('Quota exceeded') || 
                       errText.includes('RESOURCE_EXHAUSTED') || 
                       errText.includes('rate-limits')
      } catch { /* ignore */ }

      if (isQuotaError) {
        // Tenta modelli alternativi in ordine
        const fallbackModels = currentModel.includes('pro') 
          ? ['gemini-1.5-pro', 'gemini-2.5-pro', 'gemini-1.0-pro-exp'] 
          : ['gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-exp'];
          
        console.warn(`[claude-proxy] Quota esaurita per il modello ${currentModel}. Avvio fallback automatico.`);
        
        for (const altModel of fallbackModels) {
          if (altModel === currentModel) continue;
          try {
            console.log(`[claude-proxy] Tentativo di fallback con modello: ${altModel}`);
            const altResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${altModel}:generateContent?key=${GEMINI_API_KEY}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(geminiPayload),
            })
            
            if (altResponse.ok) {
              response = altResponse
              currentModel = altModel
              console.log(`[claude-proxy] Fallback riuscito! Utilizzato modello: ${altModel}`);
              break
            } else {
              console.warn(`[claude-proxy] Fallback fallito per modello ${altModel} (Status: ${altResponse.status})`);
            }
          } catch (altErr) {
            console.error(`[claude-proxy] Errore chiamata fallback ${altModel}:`, altErr)
          }
        }
      }
    }

    if (!response.ok) {
      const errText = await response.text()
      const isQuota = response.status === 429 || 
                      errText.includes('Quota exceeded') || 
                      errText.includes('RESOURCE_EXHAUSTED') || 
                      errText.includes('rate-limits')
                      
      if (isQuota) {
        throw new Error('Servizio AI temporaneamente non disponibile per esaurimento della quota giornaliera di prova. Per sbloccare l\'uso illimitato in produzione, l\'amministratore del sistema deve associare una carta di credito al piano a consumo (Pay-as-you-go) sul pannello di Google AI Studio.')
      }
      throw new Error(`Errore API Gemini (${response.status}): ${errText}`)
    }

    const geminiData = await response.json()

    // ── 6. Traduzione risposta nel formato Anthropic (per retrocompatibilità) ──
    const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const promptTokens = geminiData.usageMetadata?.promptTokenCount ?? 0
    const candidatesTokens = geminiData.usageMetadata?.candidatesTokenCount ?? 0

    const responsePayload = {
      content: [
        {
          type: 'text',
          text: geminiText,
        }
      ],
      usage: {
        input_tokens: promptTokens,
        output_tokens: candidatesTokens,
      }
    }

    return new Response(
      JSON.stringify(responsePayload),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Errore interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})