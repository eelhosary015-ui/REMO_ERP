import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2' });

async function main() {
  const tables = ['sales_invoices', 'purchases', 'sales_returns', 'purchase_returns', 'journal_entries', 'journal_items', 'account_config'];
  for (const t of tables) {
    const cols = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
      [t]
    );
    console.log(`\n=== Table: ${t} ===`);
    console.log(cols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));
  }
  await pool.end();
}
main();
