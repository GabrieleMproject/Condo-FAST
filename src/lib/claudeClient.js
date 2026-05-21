import { supabase } from './supabaseClient'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-proxy`

export async function callClaude(payload) {
  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || `Errore Edge Function: ${response.status}`)
  }

  return response.json()
}
