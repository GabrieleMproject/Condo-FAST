import fs from 'fs'

async function test() {
  try {
    const res = await fetch('https://btlxynwpcoiodvwvbnbe.supabase.co/functions/v1/gemini-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer asdfasdfasdf'
      },
      body: JSON.stringify({
        prompt: 'test',
        type: 'text',
        model: 'gemini-flash-latest',
        maxTokens: 10
      })
    });
    
    console.log(`Status:`, res.status);
    console.log(`Body:`, await res.text());
  } catch (e) {
    console.error(e);
  }
}

test();
