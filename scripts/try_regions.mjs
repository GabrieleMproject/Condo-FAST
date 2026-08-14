import pkg from 'pg';
const { Client } = pkg;

const password = 'CondoFAST2@@';
const user = 'postgres.aapksiokakavarwaumwy';

const regions = [
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3'
];

async function tryRegion(region) {
  const connectionString = `postgresql://${user}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log(`Success on region: ${region}`);
    await client.end();
    return connectionString;
  } catch (err) {
    console.log(`Failed on region ${region}: ${err.message}`);
    return null;
  }
}

async function main() {
  for (const r of regions) {
    const success = await tryRegion(r);
    if (success) return;
  }
}
main();
