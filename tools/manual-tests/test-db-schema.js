require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'production_boms\'').then(res => {
  console.log('production_boms:', res.rows.map(r => r.column_name).join(', '));
  process.exit();
}).catch(e => {
  console.error(e);
  process.exit(1);
});
