import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env.secret' });

const url = new URL(process.env.DATABASE_URL);
const pool = new pg.Pool({
  host: url.hostname,
  port: parseInt(url.port || '5432'),
  database: url.pathname.slice(1),
  user: url.username,
  password: url.password,
  ssl: { rejectUnauthorized: false },
  options: `-c search_path=public,public`
});

pool.query('SHOW search_path').then((res) => {
  console.log('Search path:', res.rows[0]);
}).catch(e => console.error('Pool error:', e.message));
