const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_nwMBCeG2rpW5@ep-cold-band-azixxknu-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require'
});

async function run() {
  try {
    await pool.query(`
      INSERT INTO feature_toggles.toggles (name, enabled, description, category, category_type, metadata)
      VALUES 
        ('agentRules', false, 'Enable Agent Rules configuration feature', 'features', 'userFacing', '{}'::jsonb),
        ('enableCloudLogs', true, 'Enable cloud log ingestion and temporal retention', 'features', 'userFacing', '{}'::jsonb),
        ('enableMicrosoftAuth', false, 'Enable Microsoft Authentication login option', 'features', 'userFacing', '{}'::jsonb)
      ON CONFLICT (name) DO UPDATE SET enabled = EXCLUDED.enabled;
    `);
    console.log("Toggles added successfully!");
  } catch (err) {
    console.error("Error inserting toggle:", err);
  } finally {
    pool.end();
  }
}

run();
