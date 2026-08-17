import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const url = 'https://btlxynwpcoiodvwvbnbe.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0bHh5bndwY29pb2R2d3ZibmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MTk4MjksImV4cCI6MjEwMjI5NTgyOX0.QBI6RJEJor_udVk5pIW3LvDFH6DdkwzCVuNr27RmLec'

const supabase = createClient(url, key)

async function test() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'gabriele@mprojectsrl.it',
    password: 'Troia118'
  })
  
  if (authError) {
    console.log("Auth error:", authError.message)
    // Maybe try the other password they might use?
  } else {
    console.log("Logged in auth user:", authData.user.id)
  }
  
  // Try querying profiles as anon to see if grants worked
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('email, is_superadmin, is_beta_tester')
  console.log("All Profiles:", profiles)
  if (pErr) console.log("Profiles error:", pErr.message)
}

test()
