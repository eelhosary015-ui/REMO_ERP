import fs from 'fs';
import pg from 'pg';
const env = fs.readFileSync('.env','utf8');
const get = (k) => (new RegExp('^'+k+'\s*=\s*(.+)$','m').exec(env)?.[1]||'').trim().replace(/^["']|["']$/g,'');
const base = get('DATABASE_URL');
for (const name of ['erp_system2','erp_system2_test']) {
  const url = base.replace(/\/[^/]+$/, '/' + name);
  const pool = new pg.Pool({ connectionString: url });
  try {
    const cc = await pool.query('select id,name,code from cost_centers order by id limit 8');
    const wh = await pool.query('select id,name,code from warehouses order by id limit 8');
    const mr = await pool.query('select count(*)::int c from material_requests');
    console.log('==', name, 'cc=', cc.rows, 'wh=', wh.rows, 'mr=', mr.rows[0].c);
  } catch (e) { console.log('==', name, 'ERR', e.message); }
  await pool.end();
}
