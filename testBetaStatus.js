import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const url = 'https://btlxynwpcoiodvwvbnbe.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0bHh5bndwY29pb2R2d3ZibmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MTk4MjksImV4cCI6MjEwMjI5NTgyOX0.QBI6RJEJor_udVk5pIW3LvDFH6DdkwzCVuNr27RmLec'

const supabase = createClient(url, key)

async function test() {
  // Query using service role key if we have it? We don't. We only have anon key.
  // Wait, if RLS is on, anon key might not be able to see profiles.
  // Let's just try to login with SMOKE_EMAIL and SMOKE_PASSWORD!
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'gabrimae003@gmail.com',
    password: 'Troia118'
  })
  
  if (authError) {
    console.log("Auth error:", authError.message)
    return
  }
  
  console.log("Logged in as:", authData.user.id)
  
  const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single()
  
  console.log("Profile:", profile)
  if (profileError) console.log("Profile error:", profileError.message)
}

test()
