// supabase/functions/inbound-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encodeBase64 } from 'https://deno.land/std@0.203.0/encoding/base64.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verbali Token di Sicurezza
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    const expectedToken = Deno.env.get('INBOUND_EMAIL_TOKEN')

    // Se il token non è impostato in Deno.env, ne consentiamo l'esecuzione per facilitare i test locali,
    // altrimenti verifichiamo la corrispondenza esatta
    if (expectedToken && token !== expectedToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Parsing del Webhook Payload di Resend
    const payload = await req.json()
    console.log('[Inbound Email] Ricevuto webhook payload:', JSON.stringify(payload))

    if (payload.type !== 'email.received' || !payload.data) {
      return new Response(JSON.stringify({ message: 'Ignorato: non è un evento email.received' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email_id, from, to, subject, attachments } = payload.data

    if (!attachments || !attachments.length) {
      return new Response(JSON.stringify({ message: 'Ignorato: nessun allegato presente nell\'email' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Estrazione Prefisso Destinatario per identificare l'amministratore
    const toEmails: string[] = Array.isArray(to) ? to : [to]
    let prefix = ''
    for (const email of toEmails) {
      const match = email.match(/([^<>\s@]+)@/)
      if (match) {
        prefix = match[1].toLowerCase()
        break
      }
    }

    if (!prefix) {
      return new Response(JSON.stringify({ error: 'Impossibile estrarre il prefisso email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Connessione a Supabase con Service Role Key (bypassa RLS per query administrative)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Cerca l'amministratore associato al prefisso
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('inbound_email_prefix', prefix)
      .maybeSingle()

    if (profileErr || !profile) {
      console.warn(`[Inbound Email] Amministratore non trovato per il prefisso: ${prefix}`)
      return new Response(JSON.stringify({ message: `Ignorato: nessun amministratore registrato per il prefisso ${prefix}` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const amministratoreId = profile.id
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

    if (!RESEND_API_KEY) {
      throw new Error('Manca la variabile RESEND_API_KEY nelle impostazioni di Supabase Edge Functions')
    }
    if (!GEMINI_API_KEY) {
      throw new Error('Manca la variabile GEMINI_API_KEY nelle impostazioni di Supabase Edge Functions')
    }

    // Carica la lista dei condomini dell'amministratore per il matching
    const { data: condominiList, error: condoErr } = await supabase
      .from('condomini')
      .select('id, nome, codice_fiscale, indirizzo')
      .eq('amministratore_id', amministratoreId)

    if (condoErr) {
      console.error('[Inbound Email] Errore recupero condomini:', condoErr)
    }

    const processedFiles = []

    // 5. Elaborazione allegati
    for (const attachment of attachments) {
      const filename = attachment.filename || attachment.name || 'documento'
      const contentType = attachment.content_type || attachment.contentType || 'application/pdf'
      const ext = filename.split('.').pop()?.toLowerCase() || ''

      // Accetta solo file rilevanti per la contabilità
      const estensioniValide = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'docx', 'xlsx', 'xls', 'csv', 'txt']
      if (!estensioniValide.includes(ext) && !contentType.includes('pdf') && !contentType.includes('image')) {
        console.log(`[Inbound Email] Allegato saltato (estensione non valida): ${filename}`)
        continue
      }

      console.log(`[Inbound Email] Scarico allegato da Resend: ${filename} (ID: ${attachment.id})`)

      // Recupera download_url di Resend per l'allegato
      const resendUrl = `https://api.resend.com/emails/receiving/${email_id}/attachments/${attachment.id}`
      const resendRes = await fetch(resendUrl, {
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      if (!resendRes.ok) {
        console.error(`[Inbound Email] Errore chiamata Resend Attachments API: ${resendRes.status}`)
        continue
      }

      const resendData = await resendRes.json()
      const downloadUrl = resendData.download_url

      if (!downloadUrl) {
        console.error('[Inbound Email] download_url non presente nella risposta di Resend')
        continue
      }

      // Scarica il file binario
      const fileRes = await fetch(downloadUrl)
      if (!fileRes.ok) {
        console.error(`[Inbound Email] Errore scaricamento file da download_url: ${fileRes.status}`)
        continue
      }

      const arrayBuffer = await fileRes.arrayBuffer()
      const base64Content = encodeBase64(new Uint8Array(arrayBuffer))

      // Carica il file su Supabase Storage nel bucket privato 'inbox-ricezione'
      const timestamp = Date.now()
      const storagePath = `${amministratoreId}/${timestamp}_${filename.replace(/\s+/g, '_')}`
      
      const { error: storageErr } = await supabase.storage
        .from('inbox-ricezione')
        .upload(storagePath, arrayBuffer, {
          contentType: contentType,
          upsert: true
        })

      if (storageErr) {
        console.error(`[Inbound Email] Errore caricamento file su storage:`, storageErr)
        continue
      }

      console.log(`[Inbound Email] File caricato con successo in Storage: ${storagePath}`)

      // 6. Chiamata a Gemini per estrazione dati fattura
      let extractedData = null
      try {
        const geminiPrompt = `Sei un assistente contabile AI specializzato in condomìni italiani.
Analizza il documento allegato (una fattura o ricevuta di spesa) ed estrai i dettagli rilevanti nel seguente formato JSON:
{
  "fornitore": "Ragione Sociale del fornitore",
  "partita_iva_fornitore": "P.IVA del fornitore, solo numeri",
  "numero_fattura": "Numero della fattura (null se non presente)",
  "data_fattura": "Data di emissione nel formato YYYY-MM-DD",
  "importo_totale": 123.45,
  "importo_iva": 22.00,
  "importo_netto": 101.45,
  "descrizione": "Breve descrizione sintetica della spesa (es. Manutenzione ascensore, Pulizie scale)",
  "categoria": "ordinaria" | "straordinaria" | "manutenzione" | "utenze" | "assicurazione" | "altro",
  "condominio_destinatario_nome": "Nome del condominio committente (es. Condominio Primavera)",
  "condominio_destinatario_codice_fiscale": "Codice Fiscale del condominio committente, solo numeri (se presente, altrimenti null)",
  "condominio_destinatario_indirizzo": "Indirizzo del condominio committente (se presente, altrimenti null)",
  "note": "Note aggiuntive estratte (es. scadenze, iban per bonifico)"
}
Restituisci ESCLUSIVAMENTE il JSON valido, senza spiegazioni o markdown.`

        const geminiPayload = {
          contents: [{
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: contentType.includes('pdf') ? 'application/pdf' : contentType,
                  data: base64Content
                }
              },
              { text: geminiPrompt }
            ]
          }],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        }

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(geminiPayload),
        })

        if (!geminiRes.ok) {
          throw new Error(`Errore API Gemini (HTTP ${geminiRes.status}): ${await geminiRes.text()}`)
        }

        const geminiData = await geminiRes.json()
        const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        
        extractedData = JSON.parse(geminiText.trim())
        console.log(`[Inbound Email] Dati estratti da Gemini:`, JSON.stringify(extractedData))
      } catch (geminiErr) {
        console.error(`[Inbound Email] Errore analisi Gemini per ${filename}:`, geminiErr)
      }

      // 7. Abbinamento automatico del Condominio
      let matchedCondoId = null
      if (extractedData && condominiList && condominiList.length > 0) {
        // Matching per Codice Fiscale
        const cfFattura = String(extractedData.condominio_destinatario_codice_fiscale || '').replace(/\D/g, '')
        if (cfFattura) {
          const condoMatch = condominiList.find(c => {
            const cfCondo = String(c.codice_fiscale || '').replace(/\D/g, '')
            return cfCondo && cfCondo === cfFattura
          })
          if (condoMatch) matchedCondoId = condoMatch.id
        }

        // Matching fuzzy su nome se Codice Fiscale fallisce
        if (!matchedCondoId) {
          const nomeFattura = String(extractedData.condominio_destinatario_nome || '').trim().toLowerCase()
          if (nomeFattura && nomeFattura.length > 3) {
            const paroleChiave = nomeFattura
              .replace(/condominio/g, '')
              .split(/[\s,.-]+/)
              .filter((w: string) => w.length > 2 && !['cond', 'condo', 'condominio', 'studio', 'amministrazione'].includes(w))

            if (paroleChiave.length > 0) {
              const condoMatch = condominiList.find(c => {
                const nomeCondo = String(c.nome || '').toLowerCase()
                return paroleChiave.some((p: string) => nomeCondo.includes(p))
              })
              if (condoMatch) matchedCondoId = condoMatch.id
            }
          }
        }
      }

      // 8. Inserimento in database
      const { error: insertErr } = await supabase
        .from('inbox_documenti')
        .insert({
          amministratore_id: amministratoreId,
          condominio_id: matchedCondoId,
          file_path: storagePath,
          file_name: filename,
          email_mittente: from,
          email_oggetto: subject,
          stato: 'rilevato',
          dati_estratti: extractedData
        })

      if (insertErr) {
        console.error(`[Inbound Email] Errore inserimento record inbox_documenti:`, insertErr)
      } else {
        console.log(`[Inbound Email] Inserito record inbox per ${filename} (Abbinato condo: ${matchedCondoId})`)
        processedFiles.push({ filename, matchedCondoId })
      }
    }

    return new Response(JSON.stringify({ message: 'Ingestione completata con successo', processedFiles }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[Inbound Email] Errore fatale nella Edge Function:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
