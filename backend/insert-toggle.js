const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PfJsZg49bUxT@ep-small-voice-a1o0n6xl-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  try {
    await pool.query(`
      INSERT INTO feature_toggles.toggles (name, enabled, description, category, category_type, metadata)
      VALUES ('agentRules', false, 'Enable Agent Rules configuration feature', 'features', 'userFacing', '{}'::jsonb)
      ON CONFLICT (name) DO UPDATE SET enabled = EXCLUDED.enabled;
    `);
    console.log("Toggle 'agentRules' added successfully!");
  } catch (err) {
    console.error("Error inserting toggle:", err);
  } finally {
    pool.end();
  }
}

run();
