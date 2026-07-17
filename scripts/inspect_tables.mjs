import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Manca .env o variabili d'ambiente")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspect() {
  const tables = ['profiles', 'collaboratori_studio', 'user_sessions', 'inbox_documenti']
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1)
    if (error) {
      console.log(`Table '${t}': Error: ${error.message} (${error.code})`)
    } else {
      console.log(`Table '${t}': OK (exists)`)
    }
  }
}

inspect()
