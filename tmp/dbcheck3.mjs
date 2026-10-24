import "dotenv/config";
import pg from "pg";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const w = await c.query("select column_name from information_schema.columns where table_name='warehouses' order by ordinal_position");
console.log("warehouses:", w.rows.map(r => r.column_name).join(", "));
const u = await c.query("select column_name from information_schema.columns where table_name='users' order by ordinal_position");
console.log("users:", u.rows.map(r => r.column_name).join(", "));
const inv = await c.query("select id, warehouse_id, ingredient_id, quantity, reserved, avg_cost, cost, unit_cost from inventory_items order by id");
console.log("inv:", inv.rows);
const ing = await c.query("select id, name, code, item_code, unit, avg_cost, cost, is_active from ingredients order by id");
console.log("ing:", ing.rows);
const whs = await c.query("select id, name, code from warehouses order by id");
console.log("whs:", whs.rows);
await c.end();
