import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf-8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1].trim()
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim()

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('audit_logs').select('*').limit(1)
  console.log('Error:', error)
  console.log('Data:', data)
}

test()
