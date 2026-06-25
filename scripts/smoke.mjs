// scripts/smoke.mjs
// Smoke-test del claude-proxy: verifica deploy + model id + AI in ~2s.
// Uso:  npm run smoke   (o: node scripts/smoke.mjs)
// Richiede in .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SMOKE_EMAIL, SMOKE_PASSWORD
// SMOKE_EMAIL/PASSWORD = un utente reale di test (serve un JWT valido per il proxy).

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// carica .env minimale (zero dipendenze)
try {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* .env opzionale */ }

const URL  = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const EMAIL = process.env.SMOKE_EMAIL;
const PASS  = process.env.SMOKE_PASSWORD;

if (!URL || !ANON || !EMAIL || !PASS) {
  console.error('❌ Mancano: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SMOKE_EMAIL, SMOKE_PASSWORD');
  process.exit(2);
}

const supabase = createClient(URL, ANON);
const { data: auth, error: authErr } =
  await supabase.auth.signInWithPassword({ email: EMAIL, password: PASS });
if (authErr) { console.error('❌ Login fallito:', authErr.message); process.exit(2); }

const token = auth.session.access_token;

// Body identico a quello che invia il frontend (callClaude → type:'text').
const payload = { type: 'text', prompt: 'Rispondi solo con la parola: OK', maxTokens: 16 };

const t0 = Date.now();
const r = await fetch(`${URL}/functions/v1/claude-proxy`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'apikey': ANON,
  },
  body: JSON.stringify(payload),
});
const ms = Date.now() - t0;
const txt = await r.text();

if (r.status !== 200) {
  console.error(`❌ Proxy KO (HTTP ${r.status}, ${ms}ms):`, txt.slice(0, 300));
  process.exit(1);
}
if (/invalid_request|not_found_error|"error"/i.test(txt)) {
  console.error(`⚠️  Risposta sospetta (${ms}ms):`, txt.slice(0, 300));
  process.exit(1);
}

let modello = '?';
try { modello = JSON.parse(txt).model ?? '?'; } catch {}
console.log(`✅ Proxy OK (${ms}ms). Modello: ${modello}. Risposta:`, txt.slice(0, 120));
process.exit(0);
