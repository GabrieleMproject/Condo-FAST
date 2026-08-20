import fs from 'fs'

async function test() {
  try {
    const dummyPdf = 'JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSCj4+CiAgPj4KICAvQ29udGVudHMgNSAwIFIKPj4KZW5kb2JqCgo0IDAgb2JqCjw8CiAgL1R5cGUgL0ZvbnQKICAvU3VidHlwZSAvVHlwZTUKICAvQmFzZUZvbnQgL1RpbWVzLVJvbWFuCj4+CmVuZG9iagoKNSAwIG9iago8PAogIC9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCjcwIDUwIFRECi9GMSAxMiBUZgooSGVsbG8sIHdvcmxkISkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNzkgMDAwMDAgbiAKMDAwMDAwMDE3MyAwMDAwMCBuIAowMDAwMDAwMzAxIDAwMDAwIG4gCjAwMDAwMDAzODAgMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDYKICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDc1CiUlRU9GCg==';

    const jsonSchema = {
      type: "OBJECT",
      properties: {
        is_valido: { type: "BOOLEAN", description: "True se il file è realmente una fattura, scontrino o ricevuta pertinente. False se è palesemente un altro documento (es. estratto conto, f24, o estraneo come ricette di cucina)." },
        tipo_documento_rilevato: { type: "STRING", description: "Es: fattura, estratto_conto, f24, verbale, anagrafica, altro" },
        motivo_errore: { type: "STRING", description: "Spiega brevemente perché il file non è una fattura, se is_valido è false." },
        congruenza_condominio: {
          type: "OBJECT",
          properties: {
            e_pertinente: { type: "BOOLEAN", description: "False se l'intestazione/destinatario differisce palesemente dal condominio attivo." },
            intestatario_rilevato: { type: "STRING", nullable: true, description: "Ragione sociale e CF del condominio destinatario presente sul documento" },
            motivo_discrepanza: { type: "STRING", nullable: true, description: "Spiega perché non sembra essere intestato a questo condominio" }
          }
        },
        dati: {
          type: "OBJECT",
          properties: {
            fornitore: { type: "STRING", description: "Ragione sociale del fornitore" },
            partita_iva_fornitore: { type: "STRING", nullable: true },
            categoria_fornitore: { type: "STRING", nullable: true, description: "La categoria lavorativa dell'artigiano/ditta. Scegli tra: idraulico, elettricista, edile, spurghi, ascensorista, giardiniere, pulizie, energia, assicurazioni, professionista, altro" },
            provincia_fornitore: { type: "STRING", nullable: true, description: "La sigla della provincia di sede del fornitore (es. MI, RM, NA) estratta dall'indirizzo" },
            numero_fattura: { type: "STRING", nullable: true },
            data_fattura: { type: "STRING", description: "YYYY-MM-DD" },
            data_scadenza: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
            importo_totale: { type: "NUMBER" },
            importo_iva: { type: "NUMBER" },
            importo_netto: { type: "NUMBER" },
            aliquota_iva: { type: "NUMBER", description: "Percentuale IVA" },
            descrizione: { type: "STRING", description: "Descrizione sintetica lavori o servizi" },
            categoria: { type: "STRING", description: "manutenzione, pulizie, utenze, assicurazione, amministrazione, altro" },
            note: { type: "STRING", nullable: true },
            imponibile_ritenuta: { type: "NUMBER" },
            aliquota_ritenuta_percentuale: { type: "NUMBER" },
            importo_ritenuta: { type: "NUMBER" },
            codice_tributo_f24: { type: "STRING", nullable: true, description: "1019, 1020 o 1040" },
            condominio_destinatario_nome: { type: "STRING", nullable: true },
            condominio_destinatario_codice_fiscale: { type: "STRING", nullable: true },
            condominio_destinatario_indirizzo: { type: "STRING", nullable: true }
          },
          required: [
            "fornitore", "data_fattura", "importo_totale", "descrizione", "categoria"
          ]
        }
      },
      required: ["is_valido"]
    };

    const res = await fetch('https://btlxynwpcoiodvwvbnbe.supabase.co/functions/v1/gemini-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CondoFAST-Demo': 'true'
      },
      body: JSON.stringify({
        prompt: 'Analizza questa fattura ed estrai i dati.',
        system: 'Sei un esperto contabile italiano...',
        type: 'document',
        document: dummyPdf,
        mediaType: 'application/pdf',
        maxTokens: 4000,
        max_tokens: 4000,
        funzione: 'estrai_fattura',
        jsonMode: true,
        jsonSchema
      })
    });
    
    console.log(`Status:`, res.status);
    const text = await res.text();
    console.log(`Body:`, text);
  } catch (e) {
    console.error(e);
  }
}

test();
