import { getCorsHeaders } from '../_shared/cors.ts'
// supabase/functions/health-check/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  let dbStatus = 'OK'
  let dbLatencyMs = 0

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const dbStart = Date.now()
    const { error } = await supabase.from('condomini').select('id', { count: 'exact', head: true }).limit(1)
    dbLatencyMs = Date.now() - dbStart

    if (error) {
      dbStatus = `WARN: ${error.message}`
    }
  } catch (err: any) {
    dbStatus = `ERROR: ${err.message}`
  }

  const totalLatencyMs = Date.now() - startTime

  const healthPayload = {
    status: dbStatus.startsWith('ERROR') ? 'DEGRADED' : 'HEALTHY',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checks: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      edgeRuntime: {
        status: 'OK',
        uptimeMs: totalLatencyMs,
      }
    }
  }

  return new Response(JSON.stringify(healthPayload, null, 2), {
    status: healthPayload.status === 'HEALTHY' ? 200 : 503,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
})
