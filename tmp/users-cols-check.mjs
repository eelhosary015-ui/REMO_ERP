import "dotenv/config";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const cols = await pool.query(`SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position`);
console.table(cols.rows);
const fk = await pool.query(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='user_logs'::regclass`);
console.log(fk.rows);
await pool.end();
