import "dotenv/config";
import fs from "node:fs";
import pg from "pg";

const file = process.argv[2];
if (!file) {
  console.error("usage: node tmp/apply-migration.mjs <sql file>");
  process.exit(1);
}
const sql = fs.readFileSync(file, "utf8");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(sql);
  console.log("OK applied:", file);
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
