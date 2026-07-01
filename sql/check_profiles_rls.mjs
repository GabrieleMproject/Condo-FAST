import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Manca .env.local")
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data, error } = await supabase.rpc('query', { query_text: "SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE tablename = 'profiles'" })
  console.log("Policies via RPC:", data, error)
}

check()
