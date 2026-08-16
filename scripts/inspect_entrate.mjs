import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

try {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
// login come superadmin per bypassare RLS se serve, o usiamo admin login
async function main() {
  await supabase.auth.signInWithPassword({ email: process.env.SMOKE_EMAIL, password: process.env.SMOKE_PASSWORD });
  
  const { data: entrate } = await supabase.from('estratto_conto').select('causale, importo').eq('tipo', 'entrata');
  console.log("ENTRATE BANCARIE (Prime 5):", entrate?.slice(0, 5));

  const { data: rate } = await supabase.from('rate_unita').select('importo, importo_pagato');
  console.log("RATE (Prime 5):", rate?.slice(0, 5));
}
main();
