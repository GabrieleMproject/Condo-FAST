import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const url = 'https://btlxynwpcoiodvwvbnbe.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0bHh5bndwY29pb2R2d3ZibmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MTk4MjksImV4cCI6MjEwMjI5NTgyOX0.QBI6RJEJor_udVk5pIW3LvDFH6DdkwzCVuNr27RmLec'

const supabase = createClient(url, key)

async function test() {
  const { data: profiles, error: err1 } = await supabase.from('profiles').select('id, email').limit(10)
  const { data: condomini, error: err2 } = await supabase.from('condomini').select('id, nome').limit(10)
  
  console.log("Profiles:", profiles?.length || 0, err1?.message)
  console.log("Condomini:", condomini?.length || 0, err2?.message)
}

test()
