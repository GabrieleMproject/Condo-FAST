import Stripe from 'stripe';

async function main() {
  console.log("=== Configurazione Automatica Stripe per CondoFAST ===");
  const secretKey = process.argv[2];
  
  if (!secretKey) {
    console.log("Chiave non fornita come argomento.");
    process.exit(1);
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

  try {
    // Verifica connessione
    await stripe.accounts.retrieve();
    console.log("✓ Connessione a Stripe riuscita.\n");
  } catch (err) {
    console.error("Errore di connessione a Stripe. Verifica che la chiave sia corretta:", err.message);
    process.exit(1);
  }

  const envVars = {
    STRIPE_SECRET_KEY: secretKey,
  };

  const piani = [
    { id: 'base', name: 'Piano Base / Starter', canone: 59, extra: 3 },
    { id: 'studio', name: 'Piano Studio', canone: 169, extra: 2.50 },
    { id: 'professional', name: 'Piano Professional', canone: 299, extra: 2 }
  ];

  console.log("Creazione Prodotti e Prezzi in corso...");

  for (const piano of piani) {
    // Crea il prodotto
    const product = await stripe.products.create({
      name: piano.name,
      metadata: { piano: piano.id }
    });
    console.log(`✓ Prodotto creato: ${piano.name}`);

    // Crea il prezzo mensile fisso
    const fixedPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(piano.canone * 100),
      currency: 'eur',
      recurring: { interval: 'month' },
      metadata: { tipo: 'fisso' }
    });
    
    // Crea il prezzo per i condomini extra (metrica graduata/extra)
    const extraPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(piano.extra * 100),
      currency: 'eur',
      recurring: { interval: 'month' },
      metadata: { tipo: 'extra_condominio' }
    });

    const envPrefix = piano.id.toUpperCase();
    envVars[`STRIPE_PRICE_${envPrefix}`] = fixedPrice.id;
    envVars[`STRIPE_PRICE_EXTRA_COND_${envPrefix}`] = extraPrice.id;
  }

  console.log("\nConfigurazione Webhook...");
  const webhookUrl = 'https://btlxynwpcoiodvwvbnbe.supabase.co/functions/v1/stripe-webhook';
  const webhook = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: [
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted'
    ],
  });

  envVars['STRIPE_WEBHOOK_SECRET'] = webhook.secret;
  console.log("✓ Webhook creato con successo.\n");

  console.log("=========================================================");
  console.log("Copia e incolla le seguenti variabili nel tuo file .env:");
  console.log("=========================================================\n");

  for (const [key, value] of Object.entries(envVars)) {
    console.log(`${key}=${value}`);
  }

  console.log("\n=========================================================");
  console.log("Inoltre, esegui questo comando per aggiornare Supabase Edge Functions:");
  console.log("supabase secrets set \\");
  for (const [key, value] of Object.entries(envVars)) {
    console.log(`  ${key}=${value} \\`);
  }
  console.log("\n(Configurazione terminata)");
}

main().catch(err => {
  console.error("Errore fatale:", err);
  process.exit(1);
});
