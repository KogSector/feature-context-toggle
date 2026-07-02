import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env.secret' });
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const pool1 = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

pool1.query('SELECT 1').then(() => {
  console.log('Pool1 connected with connectionString!');
}).catch(e => console.error('Pool1 error:', e.message));

const url = new URL(process.env.DATABASE_URL);
const pool2 = new pg.Pool({
  host: url.hostname,
  port: parseInt(url.port || '5432'),
  database: url.pathname.slice(1),
  user: url.username,
  password: url.password,
  ssl: { rejectUnauthorized: false },
});

pool2.query('SELECT 1').then(() => {
  console.log('Pool2 connected with explicit config!');
}).catch(e => console.error('Pool2 error:', e.message));
