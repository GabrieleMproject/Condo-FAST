// supabase/functions/_shared/cors.ts

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigins = ['https://condofast.app', 'https://www.condofast.app', 'https://condofast.it', 'https://www.condofast.it', 'http://localhost:8080', 'http://localhost:5173'];
  
  // ATTENZIONE: Rimossa la wildcard *.vercel.app per ragioni di sicurezza. Solo domini espliciti permessi.
  const isAllowed = allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, x-condofast-demo',
  };
}
