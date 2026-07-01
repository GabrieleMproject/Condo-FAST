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
const supabaseKey = envs['SUPABASE_SERVICE_ROLE_KEY'] || envs['VITE_SUPABASE_ANON_KEY']

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data, error } = await supabase.from('profiles').select('id, is_superadmin')
  console.log("Profiles query result length:", data?.length)
  console.log(data)
  if (error) console.error("Error:", error)
}
check()
