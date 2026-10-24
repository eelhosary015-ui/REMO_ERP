import fs from 'fs';
import pg from 'pg';

const envText = fs.readFileSync('.env', 'utf8');
const url = envText.match(/^DATABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^["']|["']$/g, '');
const pool = new pg.Pool({ connectionString: url });

const cols = await pool.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'users'
  ORDER BY ordinal_position
`);
console.log(cols.rows.map(r => `${r.column_name} | ${r.data_type} | null=${r.is_nullable} | def=${r.column_default}`).join('\n'));

const trg = await pool.query(`
  SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relname = 'users' AND NOT t.tgisinternal
`);
console.log('TRIGGERS:', trg.rows.map(r => r.tgname).join(', ') || '(none)');

await pool.end();
