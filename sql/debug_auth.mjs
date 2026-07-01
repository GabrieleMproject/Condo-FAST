import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf-8')
const envs = {}
envContent.split('\n').forEach(line => {
  if(line.includes('=')) {
    const [k, ...v] = line.split('=')
    envs[k.trim()] = v.join('=').trim()
  }
})

const supabaseUrl = envs['VITE_SUPABASE_URL']
const supabaseKey = envs['VITE_SUPABASE_ANON_KEY']

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: envs['SMOKE_EMAIL'],
    password: envs['SMOKE_PASSWORD']
  })
  
  if (authErr) {
    console.error("Auth error:", authErr)
    return
  }
  
  console.log("Logged in as:", authData.user.id)
  
  const { data, error } = await supabase.from('profiles').select('id, is_superadmin').eq('id', authData.user.id).single()
  console.log("Profiles query result:", data)
  if (error) console.error("Error:", error)
}
check()
