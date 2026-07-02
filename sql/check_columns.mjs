import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Manca .env o variabili d'ambiente")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectPersone() {
  const { data, error } = await supabase
    .from('persone')
    .select('*')
    .limit(1)
  
  if (error) {
    console.error("Errore select persone:", error)
  } else {
    console.log("Persone columns:", Object.keys(data[0] || {}))
  }
  
  const { data: cols, error: colErr } = await supabase
    .rpc('get_table_columns', { table_name: 'persone' })
  
  if (colErr) {
    // Prova query generica per ottenere info schema
    const { data: pgCols, error: pgErr } = await supabase
      .from('persone')
      .select()
      .limit(0)
    console.log("pgCols error if any:", pgErr)
  } else {
    console.log("Table columns RPC:", cols)
  }
}

inspectPersone()
