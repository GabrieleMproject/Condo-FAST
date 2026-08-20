import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const url = 'https://btlxynwpcoiodvwvbnbe.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0bHh5bndwY29pb2R2d3ZibmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MTk4MjksImV4cCI6MjEwMjI5NTgyOX0.QBI6RJEJor_udVk5pIW3LvDFH6DdkwzCVuNr27RmLec'

const supabase = createClient(url, key)

async function test() {
  const candidateCols = [
    'id', 'email', 'full_name', 'nome', 'cognome', 'ragione_sociale', 'ruolo', 'role',
    'avatar_url', 'created_at', 'onboarding_state', 'onboarding_step', 'onboarding_completed',
    'has_completed_onboarding', 'settings', 'studio_nome', 'partita_iva', 'codice_fiscale'
  ]

  const existingCols = []
  for (const col of candidateCols) {
    const { error } = await supabase.from('profiles').select(col).limit(1)
    if (!error) {
      existingCols.push(col)
    } else {
      console.log(`Profile column ${col} FAIL:`, error.message)
    }
  }

  console.log('\nValid columns on profiles:', existingCols)
}

test()
