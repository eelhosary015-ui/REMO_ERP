const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres' });
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='production_boms'").then(res => {
  console.log('production_boms:', res.rows.map(r => r.column_name));
  process.exit();
}).catch(e => {
  console.error(e.message);
  process.exit(1);
});
