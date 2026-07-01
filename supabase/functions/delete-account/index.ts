import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Inizializza il client Supabase col token di sessione (anon) fornito dal client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 2. Verifica identità: chiediamo al server Supabase chi è il vero proprietario del token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      throw new Error('Token non valido o utente non autenticato')
    }

    // 3. Inizializza l'Admin Client
    // Il client Admin usa la SERVICE_ROLE_KEY, che scavalca la RLS. 
    // Lo usiamo solo per operazioni privilegiate (es. cancellare l'utente da auth.users)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // TODO: Eventuale logica per cancellare fisicamente i file da Supabase Storage associati a questo utente,
    // dato che il cascade SQL non pulisce i bucket (essendo esterni al database).
    // Per l'MVP si consiglia l'uso di un hook webhook/trigger sul DB, oppure una cron per i bucket.

    // 4. Esegui la cancellazione da auth.users
    // Il vincolo ON DELETE CASCADE sulle foreign key nel DB (es. profiles) 
    // distruggerà a catena i condomini, spese, fatture collegate.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    
    if (deleteError) {
      throw new Error(`Impossibile eliminare l'utente: ${deleteError.message}`)
    }

    return new Response(JSON.stringify({ success: true, message: 'Account e dati eliminati con successo' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
