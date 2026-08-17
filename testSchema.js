import fs from 'fs'

async function test() {
  try {
    const code = fs.readFileSync('./src/lib/fileExtractor.js', 'utf8');
    const schemas = code.match(/const jsonSchema = (\{[\s\S]*?\});/g);
    
    console.log('Found', schemas.length, 'schemas');
    for (let i = 0; i < schemas.length; i++) {
      const schemaCode = schemas[i].replace('const jsonSchema = ', '').replace(/;\s*$/, '');
      const schema = eval('(' + schemaCode + ')');
      
      const res = await fetch('https://btlxynwpcoiodvwvbnbe.supabase.co/functions/v1/gemini-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CondoFAST-Demo': 'true'
        },
        body: JSON.stringify({
          prompt: 'test payload',
          type: 'text',
          model: 'gemini-flash-latest',
          jsonSchema: schema
        })
      });
      
      const text = await res.text();
      console.log(`Schema ${i} Status:`, res.status);
      if (res.status !== 200) {
        console.log(`Schema ${i} Error:`, text);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

test();
