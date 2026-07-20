import { getCorsHeaders } from '../_shared/cors.ts'
// supabase/functions/stripe-checkout/index.ts
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

// ── Mappa piano → price_ids ───────────────────────────────────────────────
function prezziPerPiano(piano: string) {
  const map: Record<string, { fisso: string; extra: string }> = {
    base: {
      fisso: Deno.env.get('STRIPE_PRICE_BASE') ?? '',
      extra: Deno.env.get('STRIPE_PRICE_EXTRA_COND_BASE') ?? '',
    },
    studio: {
      fisso: Deno.env.get('STRIPE_PRICE_STUDIO') ?? '',
      extra: Deno.env.get('STRIPE_PRICE_EXTRA_COND_STUDIO') ?? '',
    },
    professional: {
      fisso: Deno.env.get('STRIPE_PRICE_PROFESSIONAL') ?? '',
      extra: Deno.env.get('STRIPE_PRICE_EXTRA_COND_PROFESSIONAL') ?? '',
    },
  }
  return map[piano] ?? null
}

// ─────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const supabaseAuthClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseAuthClient.auth.getUser()
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token non valido o utente non autenticato' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const { piano } = await req.json()
    const userId = user.id
    const userEmail = user.email

    if (!piano || !userId || !userEmail) {
      return new Response(
        JSON.stringify({ error: 'Parametri mancanti: piano, userId, userEmail' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const prezzi = prezziPerPiano(piano)
    if (!prezzi) {
      return new Response(
        JSON.stringify({ error: `Piano non valido: ${piano}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Recupera o crea customer Stripe
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { supabase_user_id: userId },
      })
      customerId = customer.id

      // Salva subito il customer_id
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId)
    }

    // Controlla se ci sono crediti referral pendenti da applicare a Stripe
    const { data: pendingReferrals } = await supabase
      .from('referrals')
      .select('id, sconto_valore, referred_email')
      .eq('referrer_id', userId)
      .eq('stato', 'convalidato')

    if (pendingReferrals && pendingReferrals.length > 0) {
      for (const ref of pendingReferrals) {
        const amountCents = Math.round(Number(ref.sconto_valore) * 100)
        try {
          await stripe.customers.createBalanceTransaction(customerId, {
            amount: -amountCents, // Negativo per accreditare
            currency: 'eur',
            description: `Bonus invito amico: ${ref.referred_email}`,
          })
          
          await supabase
            .from('referrals')
            .update({ 
              stato: 'applicato', 
              applied_at: new Date().toISOString() 
            })
            .eq('id', ref.id)
        } catch (e) {
          console.error(`Errore applicazione sconto referral ${ref.id}:`, e)
        }
      }
    }

    // Crea sessione Checkout
    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card', 'sepa_debit'],
      mode: 'subscription',
      line_items: [
        {
          price: prezzi.fisso,
          quantity: 1,
        },
        {
          // Condomini extra — parte da 0, aggiornato via webhook
          price: prezzi.extra,
          quantity: 0,
        },
      ],
      subscription_data: {
        metadata: { user_id: userId, piano },
        // Sconto SEPA 5€/mese per Studio e Professional
        ...(piano === 'studio' || piano === 'professional'
          ? {
              discounts: [], // gestito lato Stripe con coupon se necessario
            }
          : {}),
      },
      metadata: { user_id: userId, piano },
      success_url: `${appUrl}/impostazioni?checkout=success`,
      cancel_url: `${appUrl}/impostazioni?checkout=cancel`,
      // Attivazione abbonamento: 0,50€ una tantum
      setup_future_usage: undefined,
      allow_promotion_codes: true,
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
    console.error('Errore stripe-checkout:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
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
