import pkg from 'pg';
const { Client } = pkg;

const passwords = [
  'Condosmart2@',
  'Condosmart2@ ',
  'CondoSmart2@',
  'Condosmart2',
  'CondoFAST2@@',
  'NuovoCondo2026Manager'
];

async function tryPassword(pwd) {
  const encPwd = encodeURIComponent(pwd);
  const connectionString = `postgresql://postgres.btlxynwpcoiodvwvbnbe:${encPwd}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log(`SUCCESS with password: ${pwd}`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`Failed with password ${pwd}: ${err.message}`);
    return false;
  }
}

async function main() {
  for (const pwd of passwords) {
    const success = await tryPassword(pwd);
    if (success) process.exit(0);
  }
}
main();
