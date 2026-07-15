// supabase/functions/invia-email-marketing/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Gestione preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Nessun token di autorizzazione fornito' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // 1. Ottieni utente autenticato dal token JWT (sicuro)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token non valido o utente non autenticato' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Verifica che l'utente sia un SuperAdmin
    const { data: isAdmin, error: adminErr } = await supabase
      .rpc('is_superadmin', { check_user_id: user.id })
      .single()

    if (adminErr || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Accesso negato. Solo i SuperAdmin possono inviare email di marketing.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { destinatari, oggetto, messaggio } = await req.json()

    // Validazione campi obbligatori
    if (!destinatari || !Array.isArray(destinatari) || destinatari.length === 0 || !oggetto || !messaggio) {
      return new Response(JSON.stringify({ error: 'Campi obbligatori mancanti o malformati' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('MARKETING_FROM_EMAIL') || 'onboarding@resend.dev'
    const fromName = 'CondoSmart Team'

    if (!resendApiKey) {
      throw new Error('Chiave API Resend non configurata nel server')
    }

    const risultati = []
    
    // Inviamo le email. Per evitare di superare i limiti di Resend (es. 10/sec su account free),
    // inviamo a lotti con una breve pausa tra i lotti se i destinatari sono molti.
    const batchSize = 10
    for (let i = 0; i < destinatari.length; i += batchSize) {
      const batch = destinatari.slice(i, i + batchSize)
      const promesse = batch.map(async (email) => {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: `${fromName} <${fromEmail}>`,
              to: [email],
              subject: oggetto,
              html: messaggio,
              reply_to: 'supporto@condosmart.it',
            }),
          })

          if (!res.ok) {
            const resError = await res.json()
            throw new Error(resError.message || `Errore HTTP ${res.status}`)
          }

          return { email, success: true }
        } catch (err) {
          return { email, success: false, error: err.message }
        }
      })

      const batchRisultati = await Promise.all(promesse)
      risultati.push(...batchRisultati)

      // Se ci sono altri lotti, attendiamo 500ms per sicurezza di rate limit
      if (i + batchSize < destinatari.length) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    const falliti = risultati.filter(r => !r.success)
    const inviati = risultati.filter(r => r.success)

    return new Response(
      JSON.stringify({ 
        message: `Invio completato: ${inviati.length} email inviate con successo, ${falliti.length} fallite.`,
        dettagli: risultati
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
