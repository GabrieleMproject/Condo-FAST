import fs from 'fs'

async function test() {
  try {
    const dummyPdf = 'JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSCj4+CiAgPj4KICAvQ29udGVudHMgNSAwIFIKPj4KZW5kb2JqCgo0IDAgb2JqCjw8CiAgL1R5cGUgL0ZvbnQKICAvU3VidHlwZSAvVHlwZTUKICAvQmFzZUZvbnQgL1RpbWVzLVJvbWFuCj4+CmVuZG9iagoKNSAwIG9iago8PAogIC9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCjcwIDUwIFRECi9GMSAxMiBUZgooSGVsbG8sIHdvcmxkISkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNzkgMDAwMDAgbiAKMDAwMDAwMDE3MyAwMDAwMCBuIAowMDAwMDAwMzAxIDAwMDAwIG4gCjAwMDAwMDAzODAgMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDYKICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDc1CiUlRU9GCg==';
    const res = await fetch('https://btlxynwpcoiodvwvbnbe.supabase.co/functions/v1/gemini-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CondoFAST-Demo': 'true'
      },
      body: JSON.stringify({
        prompt: 'Analizza questa fattura ed estrai i dati in JSON.',
        type: 'document',
        document: dummyPdf,
        mediaType: 'application/pdf',
        jsonMode: true,
        jsonSchema: {
          type: "OBJECT",
          properties: {
            is_valido: { type: "BOOLEAN" },
            dati: {
              type: "OBJECT",
              properties: {
                fornitore: { type: "STRING" }
              }
            }
          },
          required: ["is_valido"]
        }
      })
    });
    
    console.log(`Status:`, res.status);
    console.log(`Body:`, await res.text());
  } catch (e) {
    console.error(e);
  }
}

test();
