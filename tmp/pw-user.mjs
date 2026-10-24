import fs from 'fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const envText = fs.readFileSync('.env', 'utf8');
const url = envText.match(/^DATABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^["']|["']$/g, '');
const pool = new pg.Pool({ connectionString: url });

const USER = '__ui_pw_tmp';
const PASS = 'TempPass!2026';
const action = process.argv[2] || 'create';

if (action === 'create') {
  await pool.query('DELETE FROM users WHERE username = $1', [USER]);
  await pool.query(
    `INSERT INTO users (username, password, role, permissions, must_change_password, status, name)
     VALUES ($1, $2, 'admin', '{"all":true}', true, 'active', 'UI PW TEST')`,
    [USER, bcrypt.hashSync(PASS, 10)]
  );
  console.log(`created ${USER} (must_change_password=true)`);
} else {
  const r = await pool.query('DELETE FROM users WHERE username = $1', [USER]);
  console.log(`deleted rows: ${r.rowCount}`);
}

await pool.end();
