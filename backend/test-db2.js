import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env.secret' });
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const url = new URL(process.env.DATABASE_URL);
const pool2 = new pg.Pool({
  host: url.hostname,
  port: parseInt(url.port || '5432'),
  database: url.pathname.slice(1),
  user: url.username,
  password: url.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
});

pool2.on('connect', (client) => {
  client.query(`SET search_path TO public, public`);
});

pool2.query('SELECT 1').then(() => {
  console.log('Pool2 connected with explicit config!');
}).catch(e => console.error('Pool2 error:', e));

setTimeout(() => {
  pool2.query('SELECT 1').then(() => {
    console.log('Pool2 second query worked!');
  }).catch(e => console.error('Pool2 second query error:', e));
}, 11000); // wait longer than connectionTimeoutMillis
