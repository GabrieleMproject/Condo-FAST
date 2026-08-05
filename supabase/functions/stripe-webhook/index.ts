import { getCorsHeaders } from '../_shared/cors.ts'
// supabase/functions/stripe-webhook/index.ts
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

// ── Mappa price_id → piano ────────────────────────────────────────────────
function pianoFromPriceId(priceId: string): string | null {
  const map: Record<string, string> = {
    [Deno.env.get('STRIPE_PRICE_BASE') ?? '']:         'base',
    [Deno.env.get('STRIPE_PRICE_STUDIO') ?? '']:       'studio',
    [Deno.env.get('STRIPE_PRICE_PROFESSIONAL') ?? '']: 'professional',
  }
  return map[priceId] ?? null
}

// ── Aggiorna profiles ─────────────────────────────────────────────────────
async function aggiornaProfile(userId: string, data: Record<string, unknown>) {
  const { error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', userId)

  if (error) {
    console.error('Errore aggiornamento profiles:', error)
    throw error
  }
}

// ── Trova user_id da stripe_customer_id ───────────────────────────────────
async function userIdFromCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()
  return data?.id ?? null
}

// ── Controlla e convalida referral all'abbonamento ─────────────────────────
async function checkAndApplyReferral(referredUserId: string) {
  // Trova se c'è un referral registrato per questo utente
  const { data: referral, error: refError } = await supabase
    .from('referrals')
    .select('id, referrer_id, sconto_valore, referred_email, stato')
    .eq('referred_id', referredUserId)
    .eq('stato', 'registrato')
    .maybeSingle()

  if (!referral || refError) {
    if (refError) console.error('Errore ricerca referral:', refError)
    return
  }

  // Verifica se l'utente referred ha attivato un piano a pagamento
  const { data: referredProfile, error: profError } = await supabase
    .from('profiles')
    .select('piano, stripe_status')
    .eq('id', referredUserId)
    .single()

  if (profError || !referredProfile) {
    console.error('Errore caricamento profilo referred:', profError)
    return
  }

  const { piano, stripe_status } = referredProfile
  if (piano && piano !== 'trial' && (stripe_status === 'active' || stripe_status === 'trialing')) {
    // Recupera il referrer
    const { data: referrerProfile, error: referrerError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', referral.referrer_id)
      .single()

    if (referrerError || !referrerProfile) {
      console.error('Errore caricamento profilo referrer:', referrerError)
      return
    }

    const referrerCustomerId = referrerProfile.stripe_customer_id

    if (referrerCustomerId) {
      // Il referrer ha già Stripe. Applichiamo il credito su Stripe
      const amountCents = Math.round(Number(referral.sconto_valore) * 100)
      try {
        await stripe.customers.createBalanceTransaction(referrerCustomerId, {
          amount: -amountCents, // Negativo per accreditare
          currency: 'eur',
          description: `Sconto referral per invito di ${referral.referred_email}`,
        })

        // Segna come applicato
        await supabase
          .from('referrals')
          .update({
            stato: 'applicato',
            validated_at: new Date().toISOString(),
            applied_at: new Date().toISOString()
          })
          .eq('id', referral.id)

        console.log(`Referral ${referral.id} applicato con successo a Stripe del referrer.`)
      } catch (err) {
        console.error('Errore Stripe balance transaction:', err)
        // Se Stripe fallisce, lo segnamo comunque come convalidato
        await supabase
          .from('referrals')
          .update({
            stato: 'convalidato',
            validated_at: new Date().toISOString()
          })
          .eq('id', referral.id)
      }
    } else {
      // Il referrer non ha Stripe. Segna solo come convalidato.
      await supabase
        .from('referrals')
        .update({
          stato: 'convalidato',
          validated_at: new Date().toISOString()
        })
        .eq('id', referral.id)
      
      console.log(`Referral ${referral.id} convalidato (referrer non ha stripe_customer_id).`)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Solo POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 })
  }

  const body = await req.text()

  // ── Verifica firma — OBBLIGATORIO per sicurezza ───────────────────────
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
    )
  } catch (err) {
    console.error('Firma webhook non valida:', err)
    return new Response(`Webhook signature verification failed: ${err}`, { status: 400 })
  }

  console.log(`Evento Stripe ricevuto: ${event.type}`)

  try {
    switch (event.type) {

      // ── Checkout completato → attiva abbonamento ──────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        if (!userId) break

        // Gestione Checkout Pacchetti Telematici (Condomini)
        const isTelematici = session.metadata?.is_telematici === 'true'
        if (isTelematici) {
          const condominioId = session.metadata?.condominio_id
          const scontoAdminStr = session.metadata?.sconto_admin
          if (!condominioId) break

          // Conferma l'attivazione fiduciaria nel DB (e aggiorna stripe_subscription_id)
          await supabase
            .from('condominio_servizi_telematici')
            .update({ 
              attivo: true,
              stripe_subscription_id: session.subscription as string
            })
            .eq('condominio_id', condominioId)

          // Gestione Wallet Admin (Cap 75%)
          if (scontoAdminStr) {
            const scontoAdmin = Number(scontoAdminStr)
            
            const { data: profile } = await supabase
              .from('profiles')
              .select('stripe_customer_id, piano')
              .eq('id', userId)
              .single()

            if (profile?.stripe_customer_id) {
              let maxScontoAnnuoCents = 0
              if (profile.piano === 'base') maxScontoAnnuoCents = 32400 // 75% di 432€
              if (profile.piano === 'studio') maxScontoAnnuoCents = 53100 // 75% di 708€
              if (profile.piano === 'professional') maxScontoAnnuoCents = 80100 // 75% di 1068€

              if (maxScontoAnnuoCents > 0) {
                 const customerStripe = await stripe.customers.retrieve(profile.stripe_customer_id) as Stripe.Customer
                 const currentBalanceCents = customerStripe.balance || 0 
                 const requestedCreditCents = Math.round(scontoAdmin * 100)

                 let actualCreditToApply = requestedCreditCents;
                 const futureBalanceCents = currentBalanceCents - requestedCreditCents; 
                 
                 if (futureBalanceCents < -maxScontoAnnuoCents) {
                     const availableCreditCents = maxScontoAnnuoCents + currentBalanceCents; 
                     if (availableCreditCents > 0) {
                         actualCreditToApply = availableCreditCents;
                     } else {
                         actualCreditToApply = 0; 
                     }
                 }

                 if (actualCreditToApply > 0) {
                    try {
                      await stripe.customers.createBalanceTransaction(profile.stripe_customer_id, {
                        amount: -actualCreditToApply, // Negativo per accreditare
                        currency: 'eur',
                        description: `Credito cliente applicato (Pacchetti Telematici Condominio: ${condominioId})`,
                      })
                      console.log(`Credito di ${actualCreditToApply/100}€ applicato all'admin ${userId}`)
                    } catch (e) {
                      console.error("Errore balance transaction:", e)
                    }
                 } else {
                    console.log(`Cap 75% raggiunto per admin ${userId}. Nessun credito extra applicato.`)
                 }
              }
            }
          }
          break; // Fine gestione telematici, evitiamo di aggiornare l'abbonamento gestionale!
        }


        const subscriptionId = session.subscription as string
        const customerId = session.customer as string

        // Recupera subscription per trovare il piano
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price'],
        })

        // Trova il price_id del canone fisso (non extra)
        const extraPrices = [
          Deno.env.get('STRIPE_PRICE_EXTRA_COND_BASE'),
          Deno.env.get('STRIPE_PRICE_EXTRA_COND_STUDIO'),
          Deno.env.get('STRIPE_PRICE_EXTRA_COND_PROFESSIONAL'),
        ]
        const item = subscription.items.data.find(
          i => !extraPrices.includes(i.price.id)
        )
        const piano = item ? pianoFromPriceId(item.price.id) : null

        // Trova item condomini extra
        const extraItem = subscription.items.data.find(
          i => extraPrices.includes(i.price.id)
        )

        if (!piano && (subscription.status === 'active' || subscription.status === 'trialing')) {
          console.warn('[stripe-webhook] Piano non mappato per price_id:', item?.price?.id)
          await aggiornaProfile(userId, {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_status: subscription.status,
            stripe_condomini_item_id: extraItem?.id ?? null,
          })
        } else {
          await aggiornaProfile(userId, {
            piano: piano || 'base',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_status: subscription.status,
            stripe_condomini_item_id: extraItem?.id ?? null,
          })
        }

        // Convalida / applica eventuale sconto referral
        await checkAndApplyReferral(userId)

        console.log(`Piano attivato: ${piano} per user ${userId}`)
        break
      }

      // ── Subscription aggiornata (upgrade/downgrade/rinnovo) ───────────
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const userId = await userIdFromCustomer(customerId)
        if (!userId) break

        const extraPrices = [
          Deno.env.get('STRIPE_PRICE_EXTRA_COND_BASE'),
          Deno.env.get('STRIPE_PRICE_EXTRA_COND_STUDIO'),
          Deno.env.get('STRIPE_PRICE_EXTRA_COND_PROFESSIONAL'),
        ]
        const item = subscription.items.data.find(
          i => !extraPrices.includes(i.price.id)
        )
        const piano = item ? pianoFromPriceId(item.price.id) : null
        const extraItem = subscription.items.data.find(
          i => extraPrices.includes(i.price.id)
        )

        if (!piano && (subscription.status === 'active' || subscription.status === 'trialing')) {
          console.warn('[stripe-webhook] Piano non mappato per price_id:', item?.price?.id)
          await aggiornaProfile(userId, {
            stripe_status: subscription.status,
            stripe_subscription_id: subscription.id,
            stripe_condomini_item_id: extraItem?.id ?? null,
          })
        } else {
          await aggiornaProfile(userId, {
            piano: piano || 'base',
            stripe_status: subscription.status,
            stripe_subscription_id: subscription.id,
            stripe_condomini_item_id: extraItem?.id ?? null,
          })
        }

        // Convalida / applica eventuale sconto referral
        await checkAndApplyReferral(userId)

        console.log(`Subscription aggiornata: ${piano} status=${subscription.status}`)
        break
      }

      // ── Subscription cancellata ───────────────────────────────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const userId = await userIdFromCustomer(customerId)
        if (!userId) break

        await aggiornaProfile(userId, {
          stripe_status: 'canceled',
          piano: 'trial', // torna a trial (bloccato senza carta)
        })

        console.log(`Subscription cancellata per user ${userId}`)
        break
      }

      // ── Fattura pagata → conferma stato attivo ────────────────────────
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        const userId = await userIdFromCustomer(customerId)
        if (!userId) {
          console.log(`Fattura pagata per customer ${customerId} (possibile Condominio/Pacchetto Telematico)`)
          break
        }

        await aggiornaProfile(userId, {
          stripe_status: 'active',
        })

        console.log(`Fattura pagata per user ${userId}`)
        break
      }

      // ── Fattura fallita (es. SDD stornato) → disattiva telematici / avvisa admin
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string
        if (subscriptionId) {
           const { data: condominiData } = await supabase
              .from('condominio_servizi_telematici')
              .select('id, condominio_id')
              .eq('stripe_subscription_id', subscriptionId)
              .maybeSingle()
           
           if (condominiData) {
              await supabase
                .from('condominio_servizi_telematici')
                .update({ attivo: false })
                .eq('id', condominiData.id)
              
              console.log(`Pagamento fallito per il Condominio ID ${condominiData.condominio_id}. Servizio disattivato.`)
           }
        }
        break
      }

      default:
        console.log(`Evento non gestito: ${event.type}`)
    }
  } catch (err) {
    console.error('Errore gestione evento:', err)
    return new Response(JSON.stringify({ error: 'Errore interno del server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
