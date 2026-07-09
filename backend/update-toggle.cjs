const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PfJsZg49bUxT@ep-small-voice-a1o0n6xl-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  try {
    // Delete the old toggle
    await pool.query(`DELETE FROM public.toggles WHERE name = 'enableDeployedMcp'`);
    
    // Insert the new general toggle
    await pool.query(`
      INSERT INTO public.toggles (name, enabled, description, category, category_type, metadata) 
      VALUES ('enableDeployedUrls', false, 'Use deployed production URLs for all services', 'features', 'userFacing', '{}'::jsonb)
      ON CONFLICT (name) DO UPDATE SET enabled = EXCLUDED.enabled;
    `);
    console.log("Renamed toggle to 'enableDeployedUrls' successfully!");
  } catch (err) {
    console.error("Error updating toggle:", err);
  } finally {
    pool.end();
  }
}

run();
