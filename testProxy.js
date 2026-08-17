import fs from 'fs'

async function test() {
  try {
    const res = await fetch('https://btlxynwpcoiodvwvbnbe.supabase.co/functions/v1/gemini-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CondoFAST-Demo': 'true'
      },
      body: JSON.stringify({
        prompt: 'Estrai i dati da questo testo: Mario Rossi nato a Milano il 12/05/1980, email mario.rossi@email.it',
        type: 'text',
        model: 'gemini-flash-latest',
        jsonSchema: {
          type: "OBJECT",
          properties: {
            nome: { type: "STRING" },
            cognome: { type: "STRING" },
            email: { type: "STRING", nullable: true }
          },
          required: ["nome", "cognome"]
        }
      })
    });
    
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
  } catch (e) {
    console.error(e);
  }
}

test();
