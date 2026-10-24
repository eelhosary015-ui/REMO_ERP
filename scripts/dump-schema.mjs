#!/usr/bin/env node
/**
 * dump-schema.mjs
 * يعيد توليد ملفات التجهيز المحمولة من القاعدة الحالية:
 *   db/schema.sql        ← هيكل 340 جدول (بدون بيانات أعمال)
 *   db/seed-baseline.sql ← بيانات أساسية للدخول والتشغيل
 *
 * شغّله بعد أي Migration أو تعديل في الجداول:
 *   npm run db:dump
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const envText = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
const envUrl = (envText.match(/^DATABASE_URL=(.*)$/m) || [])[1]?.trim();
if (!envUrl) { console.error("❌ لا يوجد DATABASE_URL في .env"); process.exit(1); }
const u = new URL(envUrl);
const HOST = u.hostname;
const PORT = u.port || "5432";
const USER = decodeURIComponent(u.username || "postgres");
const PASS = decodeURIComponent(u.password || "");
const DB = process.env.SCHEMA_SOURCE_DB || u.pathname.replace(/^\//, "");

const BIN_DIR = process.env.PG_BIN || "C:\\Program Files\\PostgreSQL\\18\\bin";
const PG_DUMP = path.join(BIN_DIR, "pg_dump.exe");
if (!fs.existsSync(PG_DUMP)) {
  console.error(`❌ pg_dump غير موجود في ${PG_DUMP} — حدّد PG_BIN`);
  process.exit(1);
}

const SEED_TABLES = [
  "users", "roles", "accounts", "account_config", "settings",
  "financial_periods", "branches", "warehouses", "cost_centers", "treasury_accounts",
];

fs.mkdirSync("db", { recursive: true });

const run = (args) => execFileSync(PG_DUMP, args, { env: { ...process.env, PGPASSWORD: PASS }, encoding: "utf8" });
const common = ["-h", HOST, "-p", PORT, "-U", USER, "-d", DB, "--no-owner", "--no-privileges"];

console.log(`⏳ تفريغ السكيما من ${DB}...`);
run([...common, "--schema-only", "-f", "db/schema.sql"]);

console.log("⏳ تفريغ البيانات الأساسية...");
const tArgs = [];
for (const t of SEED_TABLES) tArgs.push("-t", `public.${t}`);
run([...common, "--data-only", "--inserts", "--rows-per-insert=20", ...tArgs, "-f", "db/seed-baseline.sql"]);

const kb = (f) => (fs.statSync(f).size / 1024).toFixed(1) + " KB";
console.log(`✅ db/schema.sql (${kb("db/schema.sql")})`);
console.log(`✅ db/seed-baseline.sql (${kb("db/seed-baseline.sql")})`);
console.log("\nهذه الملفات تُستخدم تلقائيًا عند تشغيل النظام على قاعدة فاضية/سيرفر جديد.");
