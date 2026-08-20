import { getCorsHeaders } from '../_shared/cors.ts'
import { getWelcomeEmailHtml } from '../_shared/emailTemplate.ts'
// supabase/functions/invia-welcome-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // Gestione preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }

  const corsHeaders = getCorsHeaders(req)

  try {
    const { email, nome, confirmationUrl } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Indirizzo email mancante' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('MARKETING_FROM_EMAIL') || 'info@condofast.it'
    const fromName = 'CondoFAST'

    if (!resendApiKey) {
      console.warn('RESEND_API_KEY non configurata. Invio email simulato in ambiente di sviluppo.')
      return new Response(JSON.stringify({ success: true, simulated: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const htmlContent = getWelcomeEmailHtml({
      nome: nome || 'Amministratore',
      confirmationUrl: confirmationUrl || '',
      dashboardUrl: 'https://app.condofast.it/dashboard',
    })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [email],
        subject: `Benvenuto su CondoFast! Ecco come iniziare la tua prova 🚀`,
        html: htmlContent,
        reply_to: 'info@condofast.it',
      }),
    })

    if (!res.ok) {
      const resError = await res.json().catch(() => ({}))
      throw new Error(resError.message || `Errore HTTP ${res.status}`)
    }

    const resData = await res.json()
    return new Response(JSON.stringify({ success: true, id: resData.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('Errore invio welcome email:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
