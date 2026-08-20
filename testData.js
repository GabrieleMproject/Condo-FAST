import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const url = 'https://btlxynwpcoiodvwvbnbe.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0bHh5bndwY29pb2R2d3ZibmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MTk4MjksImV4cCI6MjEwMjI5NTgyOX0.QBI6RJEJor_udVk5pIW3LvDFH6DdkwzCVuNr27RmLec'

const supabase = createClient(url, key)

async function test() {
  const candidateCols = [
    'id', 'nome', 'codice_fiscale', 'indirizzo', 'cap', 'citta', 'comune', 'provincia',
    'amministratore_id', 'user_id', 'stato', 'iban', 'note', 'created_at'
  ]

  const existingCols = []
  for (const col of candidateCols) {
    const { error } = await supabase.from('condomini').select(col).limit(1)
    if (!error) {
      existingCols.push(col)
    } else {
      console.log(`Condomini column ${col} FAIL:`, error.message)
    }
  }

  console.log('\nValid columns on condomini:', existingCols)
}

test()
