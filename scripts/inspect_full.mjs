import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

try {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  await supabase.auth.signInWithPassword({ email: process.env.SMOKE_EMAIL, password: process.env.SMOKE_PASSWORD });
  
  const { data: persone, error: err } = await supabase.from('persone').select('*');
  if (err) console.error("ERRORE PERSONE:", err);
  console.log("PERSONE EXTRACTION:");
  persone?.slice(0, 3).forEach(p => {
    console.log(`- ${p.nome} ${p.cognome}: Tel: ${p.telefono}, Email: ${p.email}`);
  });
}
main();
