import fs from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);

const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();

const q = async (label, sql) => {
  try {
    const r = await client.query(sql);
    console.log("\n== " + label + " ==");
    console.table(r.rows);
  } catch (e) {
    console.log("\n== " + label + " == ERROR: " + e.message);
  }
};

await q("orders count / source", `SELECT COALESCE(source,'(null)') AS source, COUNT(*)::int AS cnt FROM orders GROUP BY 1 ORDER BY 2 DESC`);
await q("phone+type by source", `SELECT COALESCE(source,'(null)') AS source, order_type, (customer_phone IS NOT NULL AND customer_phone <> '') AS has_phone, COUNT(*)::int AS cnt FROM orders GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT 40`);
await q("status mix", `SELECT status, COUNT(*)::int AS cnt FROM orders GROUP BY 1 ORDER BY 2 DESC`);
await q("date range", `SELECT MIN(timestamp) AS min_ts, MAX(timestamp) AS max_ts, COUNT(*)::int AS cnt FROM orders`);
await q("source column def", `SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='orders' AND column_name IN ('source','subtotal','discount_amount','paid_amount','tax_amount','service_charge')`);
await q("payments table?", `SELECT table_name FROM information_schema.tables WHERE table_name IN ('order_payments','payments')`);

await client.end();
