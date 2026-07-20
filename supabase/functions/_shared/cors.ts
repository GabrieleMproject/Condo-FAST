// supabase/functions/_shared/cors.ts

const allowedOrigins = [
  'http://localhost:5173',
  'https://condosmart.it',
  'https://www.condosmart.it'
];

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin');
  // Se l'origine della richiesta è nella whitelist, permettila. Altrimenti restituiamo la stringa origin (o in alternativa una origin default) per evitare falle CSRF.
  // In alternativa per sviluppo Deno deploy permette di forzare localhost o APP_URL
  const appUrl = Deno.env.get('APP_URL');
  let allowed = allowedOrigins[0];
  
  if (origin && allowedOrigins.includes(origin)) {
    allowed = origin;
  } else if (appUrl) {
    allowed = appUrl;
  }

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}
