// supabase/functions/_shared/cors.ts

const allowedOrigins = [
  'http://localhost:5173',
  'https://condosmart.it',
  'https://www.condosmart.it'
];

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin');
  // Fix M5: APP_URL viene aggiunta alla whitelist solo se è un URL valido
  const appUrl = Deno.env.get('APP_URL');
  const effectiveAllowed = [...allowedOrigins];
  if (appUrl && !effectiveAllowed.includes(appUrl)) {
    // Valida che APP_URL sia un URL reale (non wildcard o stringa arbitraria)
    try {
      const parsed = new URL(appUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        effectiveAllowed.push(appUrl);
      }
    } catch { /* ignora APP_URL malformate */ }
  }

  let allowed = effectiveAllowed[0];
  if (origin && effectiveAllowed.includes(origin)) {
    allowed = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}
