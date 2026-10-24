import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2' });

async function main() {
  const tbls = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%tax%' OR table_name ILIKE '%vat%')");
  console.log('Tables matching tax/vat:', tbls.rows);
  await pool.end();
}
main();
