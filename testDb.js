import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const url = 'https://btlxynwpcoiodvwvbnbe.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0bHh5bndwY29pb2R2d3ZibmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MTk4MjksImV4cCI6MjEwMjI5NTgyOX0.QBI6RJEJor_udVk5pIW3LvDFH6DdkwzCVuNr27RmLec'

const supabase = createClient(url, key)

async function test() {
  console.log("Testing vecchi database (btlxynwpcoiodvwvbnbe)...")
  
  // Test profiles
  const res1 = await supabase.from('profiles').select('onboarding_state').limit(1)
  console.log("Profiles onboarding_state:", res1.error ? res1.error.message : 'OK')

  // Test spese
  const res2 = await supabase.from('spese').select('*,fornitori(ragione_sociale),esercizi(anno,nome)').limit(1)
  console.log("Spese relazioni:", res2.error ? res2.error.message : 'OK')
}

test()
