// Read-only: current POS settings + how the receipt of order #24 is stored.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const keys = (await pool.query(
    `SELECT key FROM settings WHERE key ILIKE '%pos%' ORDER BY key`
  )).rows;
  console.log("POS setting keys:", JSON.stringify(keys));

  for (const k of keys) {
    const row = (await pool.query(`SELECT value FROM settings WHERE key=$1 LIMIT 1`, [k.key])).rows[0];
    let v = row?.value;
    try { v = typeof v === "string" ? JSON.parse(v) : v; } catch (_) {}
    console.log("=== " + k.key + " ===");
    console.log(JSON.stringify(v, null, 1).slice(0, 2500));
  }
}
main().catch(e => { console.error("ERR", e.message); process.exitCode = 1; }).finally(() => pool.end());
