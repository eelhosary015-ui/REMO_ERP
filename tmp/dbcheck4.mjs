import "dotenv/config";
import pg from "pg";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query("select column_name from information_schema.columns where table_name='material_requests' order by ordinal_position");
console.log("material_requests:", r.rows.map(x => x.column_name).join(", "));
const i = await c.query("select column_name from information_schema.columns where table_name='material_request_items' order by ordinal_position");
console.log("items:", i.rows.map(x => x.column_name).join(", "));
await c.end();
