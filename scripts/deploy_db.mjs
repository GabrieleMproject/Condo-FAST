import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Client } = pkg;
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = 'postgresql://postgres.btlxynwpcoiodvwvbnbe:5GGro66kvzvsyfbm@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

async function runSQL(client, filePath) {
  console.log(`Executing ${path.basename(filePath)}...`);
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
  console.log(`Done ${path.basename(filePath)}.`);
}

async function main() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected to database!');
    
    const rootDir = path.join(__dirname, '..', 'supabase');
    
    // First run the main schema
    const mainSchema = path.join(rootDir, 'schema_sessione1.sql');
    if (fs.existsSync(mainSchema)) {
      await runSQL(client, mainSchema);
    }
    
    // Then run migrations in alphabetical order
    const migrationsDir = path.join(rootDir, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
        await runSQL(client, path.join(migrationsDir, file));
      }
    }
    
    console.log('All migrations completed successfully!');
  } catch (err) {
    console.error('Error executing migrations:', err);
  } finally {
    await client.end();
  }
}

main();
