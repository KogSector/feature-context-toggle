import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.map') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.secret') });

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
    
    console.log('Deleting obsolete toggles...');
    await client.query("DELETE FROM toggles");
    
    console.log('Inserting new toggles...');
    const insertQuery = `
      INSERT INTO toggles (name, enabled, description, category, category_type, metadata) VALUES
      ('enableRepositories', true, 'Enable repositories pipeline and feature', 'features', 'userFacing', '{}'::jsonb),
      ('enableDocuments', true, 'Enable documents pipeline and feature', 'features', 'userFacing', '{}'::jsonb),
      ('enableURLs', false, 'Enable URLs pipeline and feature', 'features', 'userFacing', '{}'::jsonb),
      ('enableChats', false, 'Enable chats pipeline and feature', 'features', 'userFacing', '{}'::jsonb),
      ('enableDesign', false, 'Enable design options feature', 'features', 'userFacing', '{}'::jsonb)
      ON CONFLICT (name) DO UPDATE SET 
        enabled = EXCLUDED.enabled,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        category_type = EXCLUDED.category_type
      RETURNING name, enabled
    `;
    const updateRes = await client.query(insertQuery);
    console.log('Inserted/Updated toggles:', updateRes.rows);
    
  } catch (err) {
    console.error('Error running update:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
