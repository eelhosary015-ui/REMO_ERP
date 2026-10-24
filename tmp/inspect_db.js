const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2' });

async function inspect() {
  try {
    console.log('--- Tax Accounts in accounts ---');
    const accs = await pool.query(`
      SELECT id, code, name, name_ar, type, account_type, account_nature, status 
      FROM accounts 
      WHERE name ILIKE '%ضريب%' OR name_ar ILIKE '%ضريب%' OR name ILIKE '%tax%' OR code LIKE '2%' OR code LIKE '1%'
      ORDER BY code
    `);
    const taxAccs = accs.rows.filter(r => 
      (r.name && (r.name.includes('ضريب') || r.name.toLowerCase().includes('tax') || r.name.toLowerCase().includes('vat'))) ||
      (r.name_ar && r.name_ar.includes('ضريب'))
    );
    console.log(taxAccs);

    console.log('\n--- account_config ---');
    const cfg = await pool.query("SELECT key, account_id FROM account_config ORDER BY key");
    console.log(cfg.rows.filter(r => r.key.includes('tax') || r.key.includes('vat')));

    console.log('\n--- Relevant tables ---');
    const tbls = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' 
      ORDER BY table_name
    `);
    const relevant = tbls.rows
      .map(r => r.table_name)
      .filter(t => t.includes('tax') || t.includes('vat') || t.includes('sale') || t.includes('purchase') || t.includes('journal'));
    console.log(relevant);

    console.log('\n--- Checking taxes / vat tables if any ---');
    const taxTables = tbls.rows.map(r => r.table_name).filter(t => t.includes('tax') || t.includes('vat'));
    console.log('Tax tables:', taxTables);

    for (const t of taxTables) {
      const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`, [t]);
      console.log(`Columns for ${t}:`, cols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));
    }

  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
inspect();
