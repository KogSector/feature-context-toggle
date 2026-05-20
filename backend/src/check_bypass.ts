import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.env.map') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env.map') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.secret') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env.secret') });

const dbUrl = process.env.DATABASE_URL;
console.log('DATABASE_URL is:', dbUrl);

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: dbUrl && (dbUrl.includes('sslmode=require') || dbUrl.includes('ssl=true')) ? { rejectUnauthorized: false } : false
});

async function run() {
  try {
    const res = await pool.query('SELECT * FROM feature_toggles.toggles WHERE name = $1', ['authBypass']);
    console.log('Result:', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
