import pkg from 'pg';
const { Client } = pkg;

const pwd = 'Condosmart2@ ';
const encPwd = encodeURIComponent(pwd);
const connectionString = `postgresql://postgres.btlxynwpcoiodvwvbnbe:${encPwd}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
const client = new Client({ connectionString });

async function main() {
  try {
    await client.connect();
    const res = await client.query(`UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'gabrimae003@gmail.com'`);
    console.log(`Updated ${res.rowCount} rows.`);
    await client.end();
  } catch (err) {
    console.error(err);
  }
}
main();
