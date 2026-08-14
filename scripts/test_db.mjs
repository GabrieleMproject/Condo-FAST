import pkg from 'pg';
const { Client } = pkg;

async function test(pw) {
  const connectionString = `postgresql://postgres:${pw}@db.btlxynwpcoiodvwvbnbe.supabase.co:5432/postgres`;
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log(`Success with password: ${pw}`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`Failed with password: ${pw} - ${err.message}`);
    return false;
  }
}

async function main() {
  const p1 = 'Condosmart2%40'; // without brackets
  const p2 = '%5BCondosmart2%40%5D'; // with brackets URL encoded
  const p3 = 'Condosmart2@'; // without brackets, not url encoded (just in case)
  
  if (await test(p1)) return;
  if (await test(p2)) return;
  if (await test(p3)) return;
}
main();
