import fs from 'fs'

async function test(modelName) {
  try {
    const res = await fetch('https://btlxynwpcoiodvwvbnbe.supabase.co/functions/v1/gemini-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CondoFAST-Demo': 'true'
      },
      body: JSON.stringify({
        prompt: 'test',
        type: 'text',
        model: modelName,
        maxTokens: 10
      })
    });
    
    console.log(`[${modelName}] Status:`, res.status);
    if (res.status !== 200) {
      console.log(`[${modelName}] Error:`, await res.text());
    }
  } catch (e) {
    console.error(e);
  }
}

async function runAll() {
  await test('gemini-1.5-flash-latest');
  await test('gemini-1.5-flash-001');
  await test('gemini-1.5-flash-002');
  await test('gemini-flash-latest');
  await test('gemini-pro-latest');
  await test('gemini-1.5-pro-latest');
  await test('gemini-1.5-pro-001');
  await test('gemini-1.5-pro-002');
}

runAll();
