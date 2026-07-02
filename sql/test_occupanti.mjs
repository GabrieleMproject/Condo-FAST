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

async function testFullFlow() {
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

  // Fetch a unit to test assignment
  const { data: units, error: uErr } = await supabase
    .from('unita')
    .select('id')
    .limit(1)

  if (uErr || !units || units.length === 0) {
    console.error("No unit found to test with:", uErr)
    return
  }

  const testUnitId = units[0].id
  console.log("Using test unit ID:", testUnitId)

  // Step 1: create persona
  const personaPayload = {
    user_id: user.id,
    nome: "Test Flow Nome",
    cognome: "Test Flow Cognome"
  }

  const { data: persona, error: pErr } = await supabase
    .from('persone')
    .insert([personaPayload])
    .select()
    .single()

  if (pErr) {
    console.error("Persona creation failed:", pErr)
    return
  }

  console.log("Persona created successfully:", persona.id)

  // Step 2: assegnaPersona
  const dataInizioVal = new Date().toISOString().split('T')[0]
  let dataFine = null
  try {
    const d = new Date(dataInizioVal)
    d.setDate(d.getDate() - 1)
    dataFine = d.toISOString().split('T')[0]
  } catch (e) {
    console.error('Data calc error:', e)
  }

  console.log("Deactivating previous occupants...")
  const { error: updErr } = await supabase
    .from('occupanti_unita')
    .update({ 
      attivo: false,
      data_fine: dataFine
    })
    .eq('unita_id', testUnitId)
    .eq('ruolo', 'proprietario')
    .eq('attivo', true)

  if (updErr) {
    console.error("Deactivation failed:", updErr)
  } else {
    console.log("Deactivation succeeded.")
  }

  console.log("Inserting new occupant...")
  const { data: occupant, error: oErr } = await supabase
    .from('occupanti_unita')
    .insert([{
      unita_id: testUnitId,
      persona_id: persona.id,
      ruolo: 'proprietario',
      attivo: true,
      data_inizio: dataInizioVal,
    }])
    .select()
    .single()

  if (oErr) {
    console.error("Occupant insertion failed:", oErr)
  } else {
    console.log("Occupant insertion succeeded:", occupant)
    
    // Clean up
    await supabase.from('occupanti_unita').delete().eq('id', occupant.id)
  }

  // Clean up persona
  await supabase.from('persone').delete().eq('id', persona.id)
  console.log("Cleanup finished.")
}

testFullFlow()
