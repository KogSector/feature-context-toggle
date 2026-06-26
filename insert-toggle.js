import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.secret' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function insertToggle() {
    try {
        await pool.query(`
            INSERT INTO public.toggles (name, enabled, description, category, category_type, metadata)
            VALUES ('enableMicrosoftAuth', false, 'Enable Microsoft authentication', 'auth', 'userFacing', '{}'::jsonb)
            ON CONFLICT (name) DO NOTHING;
        `);
        console.log('Inserted enableMicrosoftAuth');
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
insertToggle();
