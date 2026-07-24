import { getCorsHeaders } from '../_shared/cors.ts'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }

  const corsHeaders = getCorsHeaders(req)

  try {
    // Autenticazione: questa funzione dovrebbe essere chiamata solo da pg_cron o dal SuperAdmin
    // Per il cron job, useremo il Service Role Key
    const authHeader = req.headers.get('Authorization')
    const isCron = authHeader === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`

    if (!isCron) {
        throw new Error('Accesso negato: questa funzione richiede privilegi di sistema')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Trova tutte le connessioni bancarie attive
    const { data: connections, error: connErr } = await supabaseAdmin
        .from('bank_connections')
        .select('*')
        .eq('status', 'LINKED')

    if (connErr) throw connErr

    let totalSynced = 0;
    const projectUrl = Deno.env.get('SUPABASE_URL') ?? ''

    // Eseguiamo il sync per ogni connessione chiamando il proxy
    const syncPromises = connections.map(async (conn) => {
        try {
            const res = await fetch(`${projectUrl}/functions/v1/gocardless-proxy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` // Autorizzazione admin
                },
                body: JSON.stringify({ action: 'sync_transactions', payload: { connectionId: conn.id } })
            });
            if (!res.ok) {
              const errBody = await res.text().catch(() => '')
              console.error(`[sync-bank] Errore sync per connessione ${conn.id}: HTTP ${res.status} - ${errBody.slice(0, 200)}`)
              return 0
            }
            const data = await res.json();
            if (data.newTransactions) return data.newTransactions;
            return 0;
        } catch (syncErr) {
            console.error(`Errore nel sync della connessione ${conn.id}:`, syncErr);
            return 0;
        }
    });
    
    const results = await Promise.allSettled(syncPromises);
    totalSynced = results.reduce((acc, curr) => acc + (curr.status === 'fulfilled' ? curr.value : 0), 0);

    return new Response(JSON.stringify({ success: true, totalNewTransactions: totalSynced }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Errore sync-bank-transactions:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
