import "dotenv/config";
import pg from "pg";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const cons = await c.query("select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid='public.inventory_transactions'::regclass");
console.log(cons.rows.map(r => r.conname + " ⇒ " + r.def).join("\n"));
const idx = await c.query("select indexname, indexdef from pg_indexes where tablename='inventory_transactions'");
console.log(idx.rows.map(r => r.indexname + " ⇒ " + r.indexdef).join("\n"));
await c.end();
