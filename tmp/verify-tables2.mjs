import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
for (const t of ["stock_batches","stock_balances","inventory_notifications","supplier_ratings","customer_ratings"]) {
  const r = await c.query("SELECT to_regclass($1) AS x", ["public."+t]);
  console.log((r.rows[0].x ? "✓" : "✗"), t);
}
const b = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='bank_beneficiaries' AND column_name IN ('code','bank_id','branch_id','currency_code','supplier_id','customer_id','phone','email','address','created_by')");
console.log("bank_beneficiaries new cols:", b.rows.map(r=>r.column_name).join(", "));
await c.end();
