import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Manca .env.local")
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1)
  console.log("Profiles sample:", data, error)
  
  const { data: tData, error: tErr } = await supabase.from('tickets').select('*').limit(1)
  console.log("Tickets sample:", tData, tErr)
  
  const { data: aData, error: aErr } = await supabase.from('assistenza_tickets').select('*').limit(1)
  console.log("Assistenza_tickets sample:", aData, aErr)
}

check()
