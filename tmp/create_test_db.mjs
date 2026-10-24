import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgres://postgres:Aa017217*@127.0.0.1:5432/postgres' });

async function main() {
  try {
    const res = await pool.query("SELECT datname FROM pg_database WHERE datname = 'erp_tax_test'");
    if (res.rows.length === 0) {
      console.log('Creating database erp_tax_test as TEMPLATE from erp_system2...');
      // Disconnect connections or create from template
      await pool.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'erp_system2' AND pid <> pg_backend_pid()");
      await pool.query('CREATE DATABASE erp_tax_test TEMPLATE erp_system2');
      console.log('SUCCESS: erp_tax_test created.');
    } else {
      console.log('erp_tax_test exists.');
    }
  } catch (err) {
    console.error('Failed to create erp_tax_test:', err.message);
  } finally {
    await pool.end();
  }
}
main();
