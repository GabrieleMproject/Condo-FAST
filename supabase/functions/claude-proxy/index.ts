// supabase/functions/claude-proxy/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL             = 'claude-sonnet-4-6'   // modello standard — non sovrascrivibile dal client
const RATE_LIMIT        = 60                     // max richieste per finestra
const RATE_WINDOW_MS    = 60 * 1000              // finestra = 1 minuto

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
  await supabase
    .from('claude_rate_limit')
    .insert({ user_id: userId })

  return { allowed: true }
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

    // ── 3. Costruzione payload per Anthropic ───────────────────────────
    const body = await req.json()

    // Normalizza i messaggi in base al tipo di chiamata
    let messages: Array<{ role: string; content: unknown }>

    if (body.type === 'vision') {
      messages = [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: body.mediaType, data: body.image } },
          { type: 'text', text: body.prompt },
        ],
      }]
    } else if (body.type === 'document') {
      // PDF (e altri documenti) via blocco document — Anthropic legge il file nativamente.
      // media_type default 'application/pdf'. Il system, se presente, va in anthropicPayload.system (sotto).
      messages = [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: body.mediaType ?? 'application/pdf', data: body.document } },
          { type: 'text', text: body.prompt },
        ],
      }]
    } else if (body.type === 'history') {
      messages = body.messages
    } else {
      // type === 'text' (default)
      messages = [{ role: 'user', content: body.prompt }]
    }

    // ── 4. Chiamata Anthropic ──────────────────────────────────────────
    const anthropicPayload: Record<string, unknown> = {
      model:      MODEL,   // il modello è fisso lato server — il client non può sovrascriverlo
      max_tokens: body.max_tokens ?? body.maxTokens ?? 1000,
      messages,
    }
    if (body.system) anthropicPayload.system = body.system
    if (body.tools)  anthropicPayload.tools  = body.tools

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicPayload),
    })

    const data = await response.json()

    return new Response(
      JSON.stringify(data),
      {
        status: response.status,
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