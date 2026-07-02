import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.SMOKE_EMAIL
const password = process.env.SMOKE_PASSWORD

if (!supabaseUrl || !supabaseKey) {
  console.error("Manca .env o variabili d'ambiente")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testInsert() {
  // Sign in first to get an authenticated session (to pass RLS)
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (authErr) {
    console.error("Auth error:", authErr)
    return
  }
  
  const user = authData.user
  console.log("Logged in as user:", user.id)
  
  const payload = {
    user_id: user.id,
    nome: "Test Nome",
    cognome: "Test Cognome",
    email: "test.email@example.com",
    telefono: "1234567890",
    indirizzo: "Via Test 1",
    citta: "Roma",
    cap: "00100",
    provincia: "RM",
    codice_fiscale: "TSTSRA80A01F205X"
  }
  
  const { data, error } = await supabase
    .from('persone')
    .insert([payload])
    .select()
  
  if (error) {
    console.error("INSERT ERROR:", error)
  } else {
    console.log("INSERT SUCCESS:", data)
    // Delete it to keep DB clean
    const { error: delErr } = await supabase
      .from('persone')
      .delete()
      .eq('id', data[0].id)
    console.log("Delete success:", !delErr)
  }
}

testInsert()
