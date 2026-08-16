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
  const { data, error } = await supabase.auth.signUp({
    email: process.env.SMOKE_EMAIL,
    password: process.env.SMOKE_PASSWORD,
  });
  if (error) {
    console.error('Signup error:', error.message);
  } else {
    console.log('Signup success:', data.user?.id);
  }
}
main();
