const fs = require("fs");
const { Client } = require("pg");
const t = fs.readFileSync(".env", "utf8");
for (const l of t.split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query(
    "SELECT id,date,source_type,status,period_id,total_debit,reference FROM journal_entries ORDER BY id DESC LIMIT 8"
  );
  console.log(JSON.stringify(r.rows, null, 1));
  const trig = await c.query(
    "SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relname='journal_entries' AND NOT t.tgisinternal"
  );
  console.log("triggers:", JSON.stringify(trig.rows));
  await c.end();
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
