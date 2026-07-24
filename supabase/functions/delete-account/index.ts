import { getCorsHeaders } from '../_shared/cors.ts'
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }

  const corsHeaders = getCorsHeaders(req)

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

    // 3. Inizializza l'Admin Client privilegiato (SERVICE_ROLE_KEY)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. Raccogli tutti i condomini di questo amministratore
    const { data: condomini, error: condominiError } = await supabaseAdmin
      .from('condomini')
      .select('id')
      .eq('amministratore_id', user.id)

    if (condominiError) {
      console.error(`Errore durante il recupero dei condomini: ${condominiError.message}`)
    }

    // 5. Pulisci lo Storage in documenti-condominio (per ogni condominio legato all'utente)
    if (condomini && condomini.length > 0) {
      for (const condo of condomini) {
        try {
          let allFiles = []
          let offset = 0
          let hasMore = true
          while (hasMore) {
            const { data: fileList, error: listError } = await supabaseAdmin.storage
              .from('documenti-condominio')
              .list(condo.id, { limit: 1000, offset })
            
            if (listError || !fileList || fileList.length === 0) {
              hasMore = false
            } else {
              allFiles = allFiles.concat(fileList)
              offset += fileList.length
              hasMore = fileList.length === 1000
            }
          }

          if (allFiles.length > 0) {
            const pathsToRemove = allFiles.map(f => `${condo.id}/${f.name}`)
            for (let i = 0; i < pathsToRemove.length; i += 100) {
              const chunk = pathsToRemove.slice(i, i + 100)
              const { error: removeError } = await supabaseAdmin.storage
                .from('documenti-condominio')
                .remove(chunk)
              
              if (removeError) {
                console.error(`Errore rimozione file documenti-condominio per condo ${condo.id}:`, removeError.message)
              }
            }
          }
        } catch (storageErr: any) {
          console.error(`Eccezione pulizia storage documenti-condominio per condo ${condo.id}:`, storageErr.message)
        }
      }
    }

    // 6. Pulisci lo Storage in fatture (tutti i file sotto la cartella user.id) — Fix L2: pulizia ricorsiva
    const removeFilesRecursive = async (bucket: string, basePath: string, depth = 0) => {
      if (depth > 5) return // Sicurezza: evita ricorsione infinita
      try {
        let items = []
        let offset = 0
        let hasMore = true
        while (hasMore) {
          const { data: chunk, error: listError } = await supabaseAdmin.storage
            .from(bucket)
            .list(basePath, { limit: 1000, offset })
          
          if (listError || !chunk || chunk.length === 0) {
            hasMore = false
          } else {
            items = items.concat(chunk)
            offset += chunk.length
            hasMore = chunk.length === 1000
          }
        }
        
        if (items.length === 0) return

        // Separa file e directory
        const files = items.filter(i => i.id) // Ha un id = è un file
        const dirs = items.filter(i => !i.id)  // Senza id = è una directory

        // Rimuovi i file nel livello corrente
        if (files.length > 0) {
          const paths = files.map(f => `${basePath}/${f.name}`)
          for (let i = 0; i < paths.length; i += 100) {
            const chunk = paths.slice(i, i + 100)
            const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove(chunk)
            if (removeError) {
              console.error(`Errore rimozione file in ${bucket}/${basePath}:`, removeError.message)
            }
          }
        }

        // Ricorsione nelle sotto-directory
        for (const dir of dirs) {
          await removeFilesRecursive(bucket, `${basePath}/${dir.name}`, depth + 1)
        }
      } catch (err: any) {
        console.error(`Eccezione pulizia ricorsiva ${bucket}/${basePath}:`, err.message)
      }
    }

    try {
      await removeFilesRecursive('fatture', user.id)
    } catch (storageErr: any) {
      console.error(`Eccezione generale pulizia storage fatture per utente ${user.id}:`, storageErr.message)
    }

    // 7. Esegui la cancellazione definitiva da auth.users
    // Il vincolo ON DELETE CASCADE sulle foreign key nel DB (es. profiles) 
    // distruggerà a catena i condomini, spese, fatture collegate.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    
    if (deleteError) {
      throw new Error(`Impossibile eliminare l'utente: ${deleteError.message}`)
    }

    return new Response(JSON.stringify({ success: true, message: 'Account e dati fisici/logici eliminati con successo' }), {
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
