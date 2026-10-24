// Comprehensive schema + logic diagnostic
const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('\n========== fingerprint_devices SCHEMA ==========');
  const schema = await client.query(
    "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='fingerprint_devices' ORDER BY ordinal_position"
  );
  console.table(schema.rows);

  console.log('\n========== employees.fingerprint_code column ==========');
  const empCol = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='employees' AND column_name='fingerprint_code'"
  );
  console.log('Exists:', empCol.rowCount > 0);
  if (empCol.rowCount) console.table(empCol.rows);

  console.log('\n========== attendance table indexes/constraints ==========');
  const constraints = await client.query(
    "SELECT conname, contype FROM pg_constraint WHERE conrelid = 'attendance'::regclass"
  );
  console.table(constraints.rows);

  console.log('\n========== hr_shifts table exists? ==========');
  const shifts = await client.query(
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hr_shifts')"
  );
  console.log('hr_shifts exists:', shifts.rows[0].exists);

  console.log('\n========== employee_shifts table exists? ==========');
  const eshifts = await client.query(
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'employee_shifts')"
  );
  console.log('employee_shifts exists:', eshifts.rows[0].exists);

  console.log('\n========== payroll_months table exists? (used for closed-month check) ==========');
  const pm = await client.query(
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payroll_months')"
  );
  console.log('payroll_months exists:', pm.rows[0].exists);

  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
