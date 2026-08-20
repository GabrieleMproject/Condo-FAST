import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const url = 'https://btlxynwpcoiodvwvbnbe.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0bHh5bndwY29pb2R2d3ZibmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MTk4MjksImV4cCI6MjEwMjI5NTgyOX0.QBI6RJEJor_udVk5pIW3LvDFH6DdkwzCVuNr27RmLec'

const supabase = createClient(url, key)

async function test() {
  const functionsToTest = [
    { funzione: 'estrai_fattura', prompt: 'Estrai dati da questa fattura' },
    { funzione: 'criterio_spesa', prompt: 'Descrizione: Pulizia scale. Quale tabella millesimale usare?' },
    { funzione: 'criterio_ripartizione', prompt: 'Descrizione: Manutenzione ascensore. Quale tabella millesimale?' }
  ]

  for (const fn of functionsToTest) {
    const res = await fetch('https://btlxynwpcoiodvwvbnbe.supabase.co/functions/v1/gemini-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CondoFAST-Demo': 'true'
      },
      body: JSON.stringify({
        prompt: fn.prompt,
        funzione: fn.funzione,
        maxTokens: 4000,
        max_tokens: 4000
      })
    })
    const data = await res.json()
    console.log(`Funzione ${fn.funzione}: Status=${res.status}, modelUsed=${data.modelUsed}, finishReason=${data.finishReason}`)
    console.log(`Response preview:`, data.content?.[0]?.text?.substring(0, 100))
  }
}

test()
