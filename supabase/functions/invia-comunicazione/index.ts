// supabase/functions/invia-comunicazione/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer'

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

    const { condominio_id, destinatari, oggetto, messaggio, tipo, allegati } = await req.json()

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

    // Carica profilo amministratore per le impostazioni email/SMTP
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('mail_invio_tipo, mail_mittente_email, mail_mittente_nome, smtp_host, smtp_port, smtp_user, smtp_password, resend_api_key')
      .eq('id', user.id)
      .maybeSingle()

    if (profileErr) {
      console.warn("Impossibile caricare il profilo, uso impostazioni di default:", profileErr.message)
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const mailInvioTipo = profile?.mail_invio_tipo || 'sistema'

    const invii = []
    const logInseriti = []

    // Configura transporter SMTP se necessario per evitare di ricrearlo in loop
    let transporter: any = null
    if (mailInvioTipo === 'smtp' && profile?.smtp_host) {
      transporter = nodemailer.createTransport({
        host: profile.smtp_host,
        port: profile.smtp_port || 587,
        secure: profile.smtp_port === 465,
        auth: {
          user: profile.smtp_user || '',
          pass: profile.smtp_password || '',
        },
        tls: {
          rejectUnauthorized: false
        }
      })
    }

    for (const dest of destinatari) {
      let statoInvio: 'inviata' | 'fallita' = 'inviata'
      let errorMsg = null

      try {
        if (mailInvioTipo === 'smtp' && transporter) {
          // 1. Invio via SMTP
          await transporter.sendMail({
            from: `"${profile.mail_mittente_nome || 'CondoAI Amministratore'}" <${profile.mail_mittente_email || user.email}>`,
            to: dest.email,
            subject: oggetto,
            html: messaggio,
            attachments: (allegati || []).map((a: any) => ({
              filename: a.filename,
              content: a.content,
              encoding: 'base64'
            }))
          })
          invii.push({ email: dest.email, success: true })
        } else {
          // 2. Invio via Resend (di sistema o personalizzato)
          const apiKey = (mailInvioTipo === 'resend_custom' && profile?.resend_api_key) ? profile.resend_api_key : resendApiKey
          const fromEmail = (mailInvioTipo === 'resend_custom' && profile?.mail_mittente_email) ? profile.mail_mittente_email : 'onboarding@resend.dev'
          const fromName = (mailInvioTipo === 'resend_custom' && profile?.mail_mittente_nome) ? profile.mail_mittente_nome : 'CondoAI Amministratore'

          if (!apiKey) {
            throw new Error('Chiave API Resend non configurata')
          }

          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              from: `${fromName} <${fromEmail}>`,
              to: [dest.email],
              subject: oggetto,
              html: messaggio,
              reply_to: user.email,
              attachments: (allegati || []).map((a: any) => ({
                content: a.content,
                filename: a.filename,
              }))
            }),
          })

          if (!res.ok) {
            const resError = await res.json()
            throw new Error(resError.message || `Errore HTTP ${res.status}`)
          }

          const resData = await res.json()
          invii.push({ email: dest.email, id: resData.id })
        }
      } catch (err) {
        console.error(`Errore invio email al destinatario:`, err.message)
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
        console.error(`Errore scrittura log DB per la comunicazione:`, dbError.message)
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
