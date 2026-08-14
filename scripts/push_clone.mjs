import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Client } = pkg;
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = 'postgresql://postgres.btlxynwpcoiodvwvbnbe:Condosmart2%40%20@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected to new database!');
    
    const cloneFile = path.join(__dirname, '..', 'sql', 'public_schema_clone.sql');
    if (fs.existsSync(cloneFile)) {
      console.log(`Executing ${path.basename(cloneFile)}...`);
      const sql = fs.readFileSync(cloneFile, 'utf8');
      
      // Strip some problematic SET commands
      const cleanedSql = sql.replace(/^SET .*;$/gm, '');
      
      await client.query(cleanedSql);
      console.log(`Done ${path.basename(cloneFile)}.`);
    } else {
      console.log('Clone file not found!');
    }
    
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Error executing migrations:', err);
  } finally {
    await client.end();
  }
}

main();
