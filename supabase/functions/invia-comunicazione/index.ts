// supabase/functions/invia-comunicazione/index.ts
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
    // Inizializza client Supabase con il token dell'utente chiamante per preservare RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Ottieni utente autenticato
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token non valido o utente non autenticato' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { condominio_id, destinatari, oggetto, messaggio, tipo } = await req.json()

    // Validazione RLS: verifica che l'utente gestisca il condominio prima di procedere all'invio
    if (condominio_id) {
      const { data: condo, error: condoErr } = await supabase
        .from('condomini')
        .select('id')
        .eq('id', condominio_id)
        .maybeSingle()

      if (condoErr || !condo) {
        return new Response(JSON.stringify({ error: 'Accesso non autorizzato a questo condominio o condominio inesistente' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Validazione campi obbligatori
    if (!destinatari || !Array.isArray(destinatari) || destinatari.length === 0 || !oggetto || !messaggio || !tipo) {
      return new Response(JSON.stringify({ error: 'Campi obbligatori mancanti o malformati' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'Chiave API Resend non configurata nel server' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const invii = []
    const logInseriti = []

    for (const dest of destinatari) {
      let statoInvio: 'inviata' | 'fallita' = 'inviata'
      let errorMsg = null

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'CondoAI Amministratore <onboarding@resend.dev>', // Corretto typo resends -> resend
            to: [dest.email],
            subject: oggetto,
            html: messaggio,
            reply_to: user.email, // Estratto direttamente da JWT user.email per evitare spoofing
          }),
        })

        if (!res.ok) {
          const resError = await res.json()
          throw new Error(resError.message || `Errore HTTP ${res.status}`)
        }

        const resData = await res.json()
        invii.push({ email: dest.email, id: resData.id })
      } catch (err) {
        console.error(`Errore invio (email offuscata):`, err.message)
        statoInvio = 'fallita'
        errorMsg = err.message
      }

      // Registrazione dell'invio sul Database (rispetta RLS)
      const { data: dbData, error: dbError } = await supabase
        .from('comunicazioni')
        .insert({
          condominio_id: condominio_id || null,
          amministratore_id: user.id,
          destinatario_email: dest.email,
          destinatario_nome: dest.nome || null,
          oggetto,
          messaggio,
          tipo,
          stato: statoInvio,
        })
        .select()
        .single()

      if (dbError) {
        console.error(`Errore scrittura log DB (email offuscata):`, dbError.message)
        logInseriti.push({ email: dest.email, success: false, error: dbError.message })
      } else {
        logInseriti.push({ email: dest.email, success: true, id: dbData.id })
      }
    }

    return new Response(JSON.stringify({ message: 'Procedura di invio completata', invii, logInseriti }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
