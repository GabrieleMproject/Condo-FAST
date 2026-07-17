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
    // 1. Validazione Token di Sicurezza
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    const expectedToken = Deno.env.get('INBOUND_EMAIL_TOKEN')

    if (!expectedToken) {
      console.error('[Inbound Email] ERRORE CONFIGURAZIONE: Variabile INBOUND_EMAIL_TOKEN mancante')
      return new Response(JSON.stringify({ error: 'Errore interno di configurazione server' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (token !== expectedToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Parsing del Webhook Payload di Resend
    const payload = await req.json()
    console.log('[Inbound Email] Ricevuto webhook email.received, email_id:', payload?.data?.email_id || 'N/A')

    if (payload.type !== 'email.received' || !payload.data) {
      return new Response(JSON.stringify({ message: 'Ignorato: non è un evento email.received' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email_id, from, to, subject, text, html, attachments } = payload.data
    const emailCorpo = text || html || ''

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

    // 4. Connessione a Supabase con Service Role Key (bypassa RLS)
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

    // 5. Matching del mittente ed associazione automatica Condominio (con validazione staff/condomini)
    let emailMittente = ''
    const fromMatch = from.match(/<([^>]+)>/)
    if (fromMatch) {
      emailMittente = fromMatch[1].trim().toLowerCase()
    } else {
      emailMittente = from.trim().toLowerCase()
    }

    // Verifica se il mittente è l'amministratore stesso o un collaboratore registrato
    const { data: staffMember, error: staffErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', emailMittente)
      .or(`id.eq.${amministratoreId},amministratore_id.eq.${amministratoreId}`)
      .maybeSingle()

    let isAuthorized = !!staffMember

    let matchedPersonaId = null
    let matchedCondoId = null

    if (emailMittente && condominiList && condominiList.length > 0) {
      const { data: personeTrovate, error: personeErr } = await supabase
        .from('persone')
        .select(`
          id,
          occupanti_unita (
            unita (
              condominio_id
            )
          )
        `)
        .eq('email', emailMittente)

      if (personeErr) {
        console.error('[Inbound Email] Errore ricerca mittente in persone:', personeErr)
      } else if (personeTrovate && personeTrovate.length > 0) {
        for (const p of personeTrovate) {
          const occupanti = Array.isArray(p.occupanti_unita) ? p.occupanti_unita : [p.occupanti_unita]
          for (const occ of occupanti) {
            const condoId = occ?.unita?.condominio_id
            if (condoId && condominiList.some(c => c.id === condoId)) {
              matchedPersonaId = p.id
              matchedCondoId = condoId
              isAuthorized = true
              break
            }
          }
          if (matchedPersonaId) break
        }
      }
    }

    if (!isAuthorized) {
      console.warn(`[Inbound Email] Ricevuta email da mittente non autorizzato: ${emailMittente}`)
      return new Response(JSON.stringify({ message: `Ignorato: mittente ${emailMittente} non autorizzato` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 6. Download e caricamento allegati su Storage
    const uploadedAttachments = []
    const rawAttachments = attachments || []

    for (const attachment of rawAttachments) {
      const filename = attachment.filename || attachment.name || 'documento'
      const contentType = attachment.content_type || attachment.contentType || 'application/pdf'
      const ext = filename.split('.').pop()?.toLowerCase() || ''

      const estensioniValide = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'docx', 'xlsx', 'xls', 'csv', 'txt']
      if (!estensioniValide.includes(ext) && !contentType.includes('pdf') && !contentType.includes('image')) {
        console.log(`[Inbound Email] Allegato saltato (estensione non valida): ${filename}`)
        continue
      }

      console.log(`[Inbound Email] Scarico allegato da Resend: ${filename}`)

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

      if (!downloadUrl) continue

      const fileRes = await fetch(downloadUrl)
      if (!fileRes.ok) continue

      const arrayBuffer = await fileRes.arrayBuffer()
      const base64Content = encodeBase64(new Uint8Array(arrayBuffer))

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

      uploadedAttachments.push({
        filename,
        contentType,
        storagePath,
        base64Content
      })
    }

    // 7. Chiamata a Gemini per classificazione ed estrazione dati
    let extractedData = null
    try {
      const geminiPrompt = `Sei un assistente contabile ed amministrativo AI per condomìni italiani.
Analizza il testo dell'email (e l'eventuale documento allegato) e classifica la comunicazione in una di queste categorie:
1. "spesa": Se l'email contiene una fattura, ricevuta fiscale, preventivo di spesa o nota di un fornitore.
2. "subentro": Se l'email contiene un atto di compravendita (rogito), modulo di variazione anagrafica, autocertificazione catastale, dichiarazione di subentro o comunicazione di un nuovo inquilino/proprietario.
3. "messaggio": Se l'email contiene una segnalazione generica, richiesta di informazioni, avviso di pagamento effettuato o altra comunicazione ordinaria senza documenti contabili/catastali da inserire.

Restituisci unicamente un oggetto JSON valido (senza markdown o spiegazioni) con la seguente struttura:
{
  "tipo": "spesa" | "subentro" | "messaggio",
  "condominio_destinatario_nome": "Nome del condominio se menzionato (es. Condominio Primavera)",
  "condominio_destinatario_codice_fiscale": "Codice Fiscale del condominio se menzionato (solo cifre)",
  "dati_estratti": {
    // SE tipo = 'spesa'
    "fornitore": "Ragione Sociale fornitore",
    "partita_iva_fornitore": "P.IVA fornitore (solo cifre)",
    "numero_fattura": "Numero fattura (se presente)",
    "data_fattura": "Data emissione YYYY-MM-DD",
    "importo_totale": 123.45,
    "importo_iva": 22.00,
    "importo_netto": 101.45,
    "descrizione": "Sintesi della spesa",
    "categoria": "ordinaria" | "straordinaria" | "manutenzione" | "utenze" | "assicurazione" | "altro",
    
    // SE tipo = 'subentro'
    "nuovo_condomino": {
      "cognome": "Cognome",
      "nome": "Nome",
      "codice_fiscale": "CF (16 caratteri)",
      "email": "Email del nuovo condomino",
      "telefono": "Telefono",
      "indirizzo_residenza": "Indirizzo completo di residenza",
      "ruolo": "proprietario" | "inquilino" | "usufruttuario"
    },
    "condomino_uscente": {
      "cognome": "Cognome",
      "nome": "Nome"
    },
    "unita": {
      "scala": "Scala (se menzionata)",
      "piano": "Piano (se menzionato)",
      "interno": "Interno/Numero unità",
      "foglio": "Foglio catastale",
      "particella": "Particella/Mappale",
      "subalterno": "Subalterno catastale"
    },
    "data_decorrenza": "Data del subentro YYYY-MM-DD",
    
    // SE tipo = 'messaggio'
    "sintesi_richiesta": "Breve riassunto di 1 riga del messaggio",
    "categoria_messaggio": "segnalazione_guasto" | "richiesta_informazioni" | "ricevuta_pagamento" | "altro"
  }
}`

      // Prepariamo i componenti per la richiesta Gemini (testo email + allegato principale se presente)
      const parts = [
        { text: `Oggetto email: ${subject}\n\nTesto email:\n${emailCorpo}\n\n` },
        { text: geminiPrompt }
      ]

      if (uploadedAttachments.length > 0) {
        const principal = uploadedAttachments[0]
        parts.unshift({
          inlineData: {
            mimeType: principal.contentType.includes('pdf') ? 'application/pdf' : principal.contentType,
            data: principal.base64Content
          }
        } as any)
      }

      const geminiPayload = {
        contents: [{
          role: 'user',
          parts: parts
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
      console.log(`[Inbound Email] Classificazione completata: ${extractedData?.tipo}`)
    } catch (geminiErr) {
      console.error(`[Inbound Email] Errore analisi/classificazione Gemini:`, geminiErr)
    }

    // 8. Abbinamento automatico del Condominio (se non già associato tramite condomino)
    if (!matchedCondoId && extractedData && condominiList && condominiList.length > 0) {
      const cfFattura = String(extractedData.condominio_destinatario_codice_fiscale || '').replace(/\D/g, '')
      if (cfFattura) {
        const condoMatch = condominiList.find(c => {
          const cfCondo = String(c.codice_fiscale || '').replace(/\D/g, '')
          return cfCondo && cfCondo === cfFattura
        })
        if (condoMatch) matchedCondoId = condoMatch.id
      }

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

    const docTipo = extractedData?.tipo || 'messaggio'
    const docStato = extractedData ? 'rilevato' : 'da_smistare'
    const processedFiles = []

    // 9. Inserimento in database
    if (uploadedAttachments.length > 0) {
      // Inseriamo un record per ogni allegato caricato
      for (const att of uploadedAttachments) {
        const { error: insertErr } = await supabase
          .from('inbox_documenti')
          .insert({
            amministratore_id: amministratoreId,
            condominio_id: matchedCondoId,
            file_path: att.storagePath,
            file_name: att.filename,
            email_mittente: from,
            email_oggetto: subject,
            email_corpo: emailCorpo,
            tipo: docTipo,
            stato: docStato,
            dati_estratti: extractedData ? extractedData.dati_estratti : null
          })

        if (insertErr) {
          console.error(`[Inbound Email] Errore inserimento allegato:`, insertErr)
        } else {
          processedFiles.push({ filename: att.filename, matchedCondoId })
        }
      }
    } else {
      // Nessun allegato: inseriamo un record generico per il messaggio
      const { error: insertErr } = await supabase
        .from('inbox_documenti')
        .insert({
          amministratore_id: amministratoreId,
          condominio_id: matchedCondoId,
          file_path: null,
          file_name: null,
          email_mittente: from,
          email_oggetto: subject,
          email_corpo: emailCorpo,
          tipo: docTipo,
          stato: docStato,
          dati_estratti: extractedData ? extractedData.dati_estratti : null
        })

      if (insertErr) {
        console.error(`[Inbound Email] Errore inserimento email senza allegati:`, insertErr)
      } else {
        processedFiles.push({ filename: 'email_testo', matchedCondoId })
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
