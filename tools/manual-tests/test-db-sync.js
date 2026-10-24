import pg from 'pg';
import fs from 'fs';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres' });
async function test() {
  const q = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='production_boms'");
  fs.writeFileSync('db_cols.txt', JSON.stringify(q.rows));
  process.exit();
}
test();
