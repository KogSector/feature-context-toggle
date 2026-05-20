import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.secret') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env.secret') });

const dbUrl = process.env.DATABASE_URL;
console.log('Using DATABASE_URL:', dbUrl ? 'Found' : 'Not found');

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: dbUrl && (dbUrl.includes('sslmode=require') || dbUrl.includes('ssl=true')) ? { rejectUnauthorized: false } : false
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Connected to database. Setting search_path...');
    await client.query('SET search_path TO feature_toggles, public');
    
    console.log('Checking existing toggles...');
    const res = await client.query("SELECT name, enabled FROM toggles WHERE name IN ('hideOnboarding', 'hideSwitchUse')");
    console.log('Current values:', res.rows);
    
    console.log('Updating toggles...');
    const updateRes = await client.query(
      "UPDATE toggles SET enabled = true WHERE name IN ('hideOnboarding', 'hideSwitchUse') RETURNING name, enabled"
    );
    console.log('Updated values:', updateRes.rows);
    
  } catch (err) {
    console.error('Error running update:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
