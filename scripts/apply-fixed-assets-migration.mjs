/**
 * تطبيق migration الأصول الثابتة على قاعدة البيانات الحالية، مع تسجيل حالة ما قبل التنفيذ.
 * العملية إضافية بالكامل: CREATE TABLE/INDEX IF NOT EXISTS — لا تمس أي جدول قائم.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { config as loadEnv } from "dotenv";

loadEnv({ quiet: true });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const dbName = (await client.query("SELECT current_database() AS db")).rows[0].db;
const before = {
  database: dbName,
  captured_at: new Date().toISOString(),
  fixed_assets_exists: (await client.query("SELECT to_regclass('public.fixed_assets') AS t")).rows[0].t,
  journal_entries: (await client.query("SELECT COUNT(*)::int AS n FROM journal_entries")).rows[0].n,
  asset_indexes: (
    await client.query("SELECT indexname FROM pg_indexes WHERE indexname IN ('ux_je_asset_acquisition','ux_je_asset_disposal','ux_je_asset_depreciation','idx_fa_branch','idx_fa_employee','idx_fa_status','ux_fa_code')")
  ).rows.map((r) => r.indexname),
};

const dir = path.join("backups", `fixed-assets-${new Date().toISOString().replace(/[:.]/g, "-")}`);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "before.json"), JSON.stringify(before, null, 2), "utf8");
console.log("before:", JSON.stringify(before));
console.log("backup:", path.join(dir, "before.json"));

const sql = fs.readFileSync("migrations/2026-10-20-fixed-assets.sql", "utf8");
await client.query(sql);

const after = {
  fixed_assets_exists: (await client.query("SELECT to_regclass('public.fixed_assets') AS t")).rows[0].t,
  columns: (await client.query("SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name='fixed_assets'")).rows[0].n,
  indexes: (
    await client.query("SELECT indexname FROM pg_indexes WHERE indexname IN ('ux_je_asset_acquisition','ux_je_asset_disposal','ux_je_asset_depreciation','idx_fa_branch','idx_fa_employee','idx_fa_status','ux_fa_code') ORDER BY 1")
  ).rows.map((r) => r.indexname),
};
console.log("after:", JSON.stringify(after, null, 2));

await client.end();
