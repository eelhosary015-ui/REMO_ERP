import fs from 'fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const envText = fs.readFileSync('.env', 'utf8');
const url = envText.match(/^DATABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^["']|["']$/g, '');
const pool = new pg.Pool({ connectionString: url });

const BASE = 'http://localhost:3000';
const USER = '__pwflow_tmp';
const OLD = 'TempPass!2026';
const NEW = 'NewTempPass!2026';

const log = (ok, label, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'} | ${label}${extra ? ' | ' + extra : ''}`);

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(body) });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, json, text };
}

try {
  await pool.query('DELETE FROM users WHERE username = $1', [USER]);
  await pool.query(
    `INSERT INTO users (username, password, role, permissions, must_change_password, status, name)
     VALUES ($1, $2, 'admin', '{"all":true}', true, 'active', 'PWFLOW TEST')`,
    [USER, bcrypt.hashSync(OLD, 10)]
  );

  // 1) Login on a fresh password → must ask for a change but still issue a token
  const login1 = await post('/api/login', { username: USER, password: OLD });
  const token = login1.json?.token;
  log(login1.status === 200, 'login with default password', `status=${login1.status}`);
  log(!!token && token.split('.').length === 3, 'login returns a usable JWT', `segments=${token ? token.split('.').length : 0}`);
  log(login1.json?.requirePasswordChange === true, 'requirePasswordChange=true on first login', String(login1.json?.requirePasswordChange));

  // 2) The old broken client sent "Bearer null" → 401 AUTH_REQUIRED
  const nullAuth = await post('/api/auth/change-password', { currentPassword: OLD, newPassword: NEW }, 'null');
  log(nullAuth.status === 401 && nullAuth.json?.error === 'AUTH_REQUIRED', 'Bearer null is rejected (root cause)', `status=${nullAuth.status} error=${nullAuth.json?.error}`);

  // 3) The fixed client sends the token from step 1 → change succeeds
  const change = await post('/api/auth/change-password', { currentPassword: OLD, newPassword: NEW }, token);
  log(change.status === 200 && change.json?.success === true, 'change-password with login token succeeds', `status=${change.status}`);

  // 4) New password works and no longer forces another change
  const login2 = await post('/api/login', { username: USER, password: NEW });
  log(login2.status === 200, 'login with the new password', `status=${login2.status}`);
  log(login2.json?.requirePasswordChange === false, 'requirePasswordChange=false after the change', String(login2.json?.requirePasswordChange));

  // 5) Old password is gone
  const login3 = await post('/api/login', { username: USER, password: OLD });
  log(login3.status === 401, 'old password no longer accepted', `status=${login3.status}`);
} finally {
  await pool.query('DELETE FROM users WHERE username = $1', [USER]);
  const left = await pool.query('SELECT COUNT(*)::int AS n FROM users WHERE username = $1', [USER]);
  console.log(`CLEANUP | temp user rows left = ${left.rows[0].n}`);
  await pool.end();
}
