import fs from 'fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';
const env = fs.readFileSync('.env','utf8');
const get = (k) => (new RegExp('^'+k+'\s*=\s*(.+)$','m').exec(env)?.[1]||'').trim().replace(/^["']|["']$/g,'');
const pool = new pg.Pool({ connectionString: get('DATABASE_URL') });
const USER = '__ui_design_check';
const PASS = 'DesignCheck!2026';
if ((process.argv[2]||'create') === 'create') {
  await pool.query('DELETE FROM users WHERE username = $1', [USER]);
  await pool.query(`INSERT INTO users (username, password, role, permissions, must_change_password, status)
    VALUES ($1,$2,'admin','{"all":true}',false,'active')`, [USER, bcrypt.hashSync(PASS,10)]);
  console.log('created');
} else {
  const r = await pool.query('DELETE FROM users WHERE username = $1', [USER]);
  console.log('deleted', r.rowCount);
}
await pool.end();
