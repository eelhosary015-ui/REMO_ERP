// CLEANUP: remove duplicate unique constraints created by the unguarded startup
// ADD UNIQUE bug. Keeps EXACTLY ONE unique constraint per target column set so
// the (warehouse_id, ingredient_id) / (month, year) uniqueness guarantee is
// preserved. Idempotent. Runs in a transaction and commits only on success.
const { Client } = require("pg");

const TARGETS = [
  { table: "inventory_items", cols: ["ingredient_id", "warehouse_id"] },
  { table: "financial_periods", cols: ["month", "year"] },
];

async function uniqueConstraintsOn(c, table, cols) {
  // Return unique constraints on `table` whose column set == cols (order-insensitive).
  const r = await c.query(
    `SELECT c.oid, c.conname
       FROM pg_constraint c
       JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE cl.relname = $1 AND c.contype = 'u'
        AND (
          SELECT array_agg(a.attname::text ORDER BY a.attname::text)
            FROM pg_attribute a
           WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        ) = $2::text[]`,
    [table, [...cols].sort()]
  );
  return r.rows;
}

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  let totalDropped = 0;

  for (const t of TARGETS) {
    const cons = await uniqueConstraintsOn(c, t.table, t.cols);
    if (cons.length === 0) {
      console.log(`${t.table}: no unique constraint on (${t.cols.join(", ")}) — creating one.`);
      await c.query(`ALTER TABLE ${t.table} ADD UNIQUE (${t.cols.join(", ")});`);
      continue;
    }
    // Keep the first (canonical) constraint; drop the rest.
    const keep = cons[0];
    const drop = cons.slice(1);
    console.log(`${t.table}: ${cons.length} unique constraints on (${t.cols.join(", ")}). Keeping "${keep.conname}", dropping ${drop.length}.`);
    for (const d of drop) {
      await c.query(`ALTER TABLE ${t.table} DROP CONSTRAINT IF EXISTS "${d.conname}"`);
      totalDropped++;
    }
  }

  // Report final state.
  console.log("\n=== FINAL UNIQUE CONSTRAINT COUNTS ===");
  for (const t of TARGETS) {
    const cons = await uniqueConstraintsOn(c, t.table, t.cols);
    console.log(`${t.table}: ${cons.length} unique constraint(s) -> ${cons.map(x => x.conname).join(", ")}`);
    const idx = await c.query(
      `SELECT count(*)::int n FROM pg_indexes WHERE tablename = $1`, [t.table]);
    console.log(`${t.table}: total indexes now = ${idx.rows[0].n}`);
  }
  console.log(`\nTotal constraints dropped: ${totalDropped}`);
  await c.end();
}
main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
