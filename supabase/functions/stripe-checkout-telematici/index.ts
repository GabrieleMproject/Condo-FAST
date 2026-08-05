import { getCorsHeaders } from '../_shared/cors.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

function getPacchettoConfig(pacchetto: string) {
  const map: Record<string, { priceId: string; scontoAdmin: number }> = {
    'base_36': {
      priceId: Deno.env.get('STRIPE_PRICE_TELEMATICI_BASE') ?? '',
      scontoAdmin: 12,
    },
    'app_limitata_100': {
      priceId: Deno.env.get('STRIPE_PRICE_TELEMATICI_100') ?? '',
      scontoAdmin: 30,
    },
    'app_full_150': {
      priceId: Deno.env.get('STRIPE_PRICE_TELEMATICI_150') ?? '',
      scontoAdmin: 50,
    },
  }
  return map[pacchetto] ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } })
    }

    const supabaseAuthClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseAuthClient.auth.getUser()
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token non valido o utente non autenticato' }), { status: 401, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } })
    }

    const { condominio_id, pacchetto } = await req.json()
    const userId = user.id
    const userEmail = user.email

    if (!condominio_id || !pacchetto) {
      return new Response(
        JSON.stringify({ error: 'Parametri mancanti: condominio_id, pacchetto' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
      )
    }

    const config = getPacchettoConfig(pacchetto)
    if (!config || !config.priceId) {
      return new Response(
        JSON.stringify({ error: `Pacchetto non valido o price_id non configurato: ${pacchetto}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
      )
    }

    // Fetch nome condominio per la creazione del Customer Stripe
    const { data: condominio } = await supabase
      .from('condomini')
      .select('nome')
      .eq('id', condominio_id)
      .single()

    const nomeCondominio = condominio?.nome ? `Condominio ${condominio.nome}` : `Condominio ${condominio_id}`

    // Creiamo un nuovo Customer in Stripe appositamente per questo condominio.
    // L'IBAN e i dati di fatturazione verranno inseriti nel Checkout.
    const customer = await stripe.customers.create({
      email: userEmail, // Mandiamo le ricevute all'amministratore
      name: nomeCondominio,
      metadata: { 
        condominio_id: condominio_id,
        supabase_user_id: userId 
      },
    })

    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card', 'sepa_debit'],
      mode: 'subscription',
      line_items: [
        {
          price: config.priceId,
          quantity: 1,
        }
      ],
      subscription_data: {
        metadata: { 
          user_id: userId, 
          condominio_id: condominio_id, 
          pacchetto: pacchetto,
          sconto_admin: config.scontoAdmin.toString(),
          is_telematici: 'true'
        },
      },
      metadata: { 
        user_id: userId, 
        condominio_id: condominio_id, 
        pacchetto: pacchetto,
        sconto_admin: config.scontoAdmin.toString(),
        is_telematici: 'true'
      },
      success_url: `${appUrl}/condomini/${condominio_id}?checkout_telematici=success`,
      cancel_url: `${appUrl}/condomini/${condominio_id}?checkout_telematici=cancel`,
      billing_address_collection: 'required',
      locale: 'it',
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(req),
        },
      }
    )
  } catch (err) {
    console.error('Errore stripe-checkout-telematici:', err)
    return new Response(
      JSON.stringify({ error: 'Errore interno. Riprova o contatta il supporto.' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(req),
        },
      }
    )
  }
})
