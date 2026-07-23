import { getCorsHeaders } from '../_shared/cors.ts'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const GOCARDLESS_API_URL = 'https://bankaccountdata.gocardless.com/api/v2'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }

  const corsHeaders = getCorsHeaders(req)

  try {
    const authHeader = req.headers.get('Authorization')
    const isCron = authHeader === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
    let userId = null;
    
    let supabaseClient;
    if (!isCron) {
        supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Non autorizzato')
        userId = user.id

        // H1 fix: verifica piano server-side (Open Banking solo per Professional)
        const { data: userProfile } = await supabaseClient
          .from('profiles')
          .select('piano, is_superadmin')
          .eq('id', userId)
          .single()

        if (!userProfile?.is_superadmin && userProfile?.piano !== 'professional') {
          return new Response(
            JSON.stringify({ error: 'Funzionalità Open Banking disponibile solo per il piano Professional.' }),
            { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          )
        }
    } else {
        supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
    }



    const secretId = Deno.env.get('GOCARDLESS_SECRET_ID')
    const secretKey = Deno.env.get('GOCARDLESS_SECRET_KEY')
    
    if (!secretId || !secretKey) {
        throw new Error('Chiavi GoCardless non configurate nel server')
    }

    const { action, payload } = await req.json()

    // 1. Ottieni il token di accesso GoCardless
    const tokenResponse = await fetch(`${GOCARDLESS_API_URL}/token/new/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            secret_id: secretId,
            secret_key: secretKey
        })
    })

    if (!tokenResponse.ok) {
        const err = await tokenResponse.text()
        console.error("Errore ottenimento token GoCardless", err)
        throw new Error('Errore autenticazione GoCardless')
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access

    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }

    let result = {}

    switch (action) {
        case 'get_institutions':
            // Ottiene le banche italiane
            const instRes = await fetch(`${GOCARDLESS_API_URL}/institutions/?country=IT`, { headers })
            result = await instRes.json()
            break;
            
        case 'create_requisition':
            // H2 fix: verifica ownership del condominio (anti-IDOR)
            if (userId) {
              const { data: condoCheck, error: condoErr } = await supabaseClient
                .from('condomini')
                .select('id')
                .eq('id', payload.condominioId)
                .single()
              if (condoErr || !condoCheck) {
                return new Response(
                  JSON.stringify({ error: 'Condominio non trovato o non autorizzato' }),
                  { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
                )
              }
            }

            // Fix H3: Validazione redirectUrl contro whitelist domini autorizzati
            const allowedRedirectDomains = [
              'localhost',
              'condosmart.it',
              'www.condosmart.it'
            ]
            const appUrlDomain = Deno.env.get('APP_URL')
            if (appUrlDomain) {
              try {
                allowedRedirectDomains.push(new URL(appUrlDomain).hostname)
              } catch { /* ignora URL malformati */ }
            }

            let validatedRedirectUrl = payload.redirectUrl || ''
            try {
              const redirectParsed = new URL(validatedRedirectUrl)
              if (!allowedRedirectDomains.includes(redirectParsed.hostname)) {
                return new Response(
                  JSON.stringify({ error: 'URL di redirect non autorizzato' }),
                  { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
                )
              }
            } catch {
              return new Response(
                JSON.stringify({ error: 'URL di redirect non valido' }),
                { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
              )
            }

            // Crea un link di autenticazione per l'utente
            const reqRes = await fetch(`${GOCARDLESS_API_URL}/requisitions/`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    redirect: validatedRedirectUrl,
                    institution_id: payload.institutionId,
                    reference: payload.condominioId,
                    user_language: 'IT'
                })
            })
            result = await reqRes.json()
            
            // Salva la requisition nel DB (status: CREATED)
            if (result.id) {
                // Impostiamo bypass rls usando il service role per scrivere
                const supabaseAdmin = createClient(
                    Deno.env.get('SUPABASE_URL') ?? '',
                    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
                )
                await supabaseAdmin.from('bank_connections').insert({
                    condominio_id: payload.condominioId,
                    institution_id: payload.institutionId,
                    institution_name: payload.institutionName,
                    requisition_id: result.id,
                    status: 'CREATED'
                })
            }
            break;
            
        case 'sync_transactions':
            // Sincronizza i movimenti di una connessione
            const connRes = await supabaseClient.from('bank_connections')
                .select('*, condomini(amministratore_id)')
                .eq('id', payload.connectionId)
                .single()
                
            if (connRes.error || !connRes.data) throw new Error('Connessione bancaria non trovata')
            
            const connection = connRes.data
            
            // Se non abbiamo l'account_id, dobbiamo recuperarlo dalla requisition
            let accountId = connection.account_id
            if (!accountId) {
                const reqDetails = await fetch(`${GOCARDLESS_API_URL}/requisitions/${connection.requisition_id}/`, { headers })
                const details = await reqDetails.json()
                
                if (details.accounts && details.accounts.length > 0) {
                    accountId = details.accounts[0]
                    
                    // Ottieni info del conto (es. IBAN)
                    const accDetailsRes = await fetch(`${GOCARDLESS_API_URL}/accounts/${accountId}/details/`, { headers })
                    const accDetails = await accDetailsRes.json()
                    
                    // Aggiorna la connessione
                    // Fix M4: Maschera l'IBAN per conformità GDPR (salva solo IT + ultime 4 cifre)
                    const rawIban = accDetails.account?.iban || null
                    const maskedIban = rawIban 
                      ? rawIban.slice(0, 2) + '**' + '*'.repeat(Math.max(0, rawIban.length - 6)) + rawIban.slice(-4)
                      : null

                    await supabaseAdmin.from('bank_connections').update({
                        account_id: accountId,
                        iban: maskedIban,
                        status: 'LINKED'
                    }).eq('id', connection.id)
                } else {
                    throw new Error('Nessun conto trovato o autorizzazione non ancora completata')
                }
            }
            
            // Ora scarichiamo le transazioni
            const transRes = await fetch(`${GOCARDLESS_API_URL}/accounts/${accountId}/transactions/`, { headers })
            const transData = await transRes.json()
            
            let insertedCount = 0
            if (transData.transactions && transData.transactions.booked) {
                const booked = transData.transactions.booked
                const supabaseAdmin = createClient(
                    Deno.env.get('SUPABASE_URL') ?? '',
                    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
                )
                
                const movimentiDaInserire = booked.map(t => {
                    const importoNum = parseFloat(t.transactionAmount.amount)
                    const parts = []
                    if (t.creditorName) parts.push(`Verso: ${t.creditorName}`)
                    if (t.debtorName) parts.push(`Da: ${t.debtorName}`)
                    if (t.remittanceInformationUnstructured) parts.push(t.remittanceInformationUnstructured)
                    const causale = parts.join(' - ') || 'Movimento bancario'
                    const bankTxId = t.transactionId || `${accountId}-${t.bookingDate}-${importoNum}-${t.internalTransactionId || Date.now()}`
                    
                    return {
                        condominio_id: connection.condominio_id,
                        data_movimento: t.bookingDate,
                        causale: causale,
                        importo: importoNum,
                        tipo: importoNum >= 0 ? 'entrata' : 'uscita', // FIX TIPO
                        metodo_importazione: 'open_banking',
                        bank_transaction_id: bankTxId,
                        user_id: userId || connection.condomini.amministratore_id // FIX USER
                    }
                });
                
                if (movimentiDaInserire.length > 0) {
                    const { data, error: insertErr } = await supabaseAdmin.from('estratto_conto')
                        .upsert(movimentiDaInserire, { onConflict: 'bank_transaction_id', ignoreDuplicates: true })
                        .select('id');
                    if (!insertErr && data) insertedCount = data.length;
                }
            }
            
            result = { success: true, newTransactions: insertedCount }
            break;
            
        default:
            throw new Error('Azione non supportata')
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Errore gocardless-proxy:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
