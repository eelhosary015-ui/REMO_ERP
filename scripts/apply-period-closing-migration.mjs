/**
 * تطبيق migration تقوية إقفال الفترات مع نسخة احتياطية قبل التنفيذ.
 *
 *   node scripts/apply-period-closing-migration.mjs                # على DATABASE_URL
 *   node scripts/apply-period-closing-migration.mjs --db=test      # على قاعدة *_test
 *   node scripts/apply-period-closing-migration.mjs --rollback     # تراجع عن الحماية
 *   node scripts/apply-period-closing-migration.mjs --dry-run      # فحص فقط دون تنفيذ
 *
 * النسخة الاحتياطية تُحفظ كـ JSON في backups/period-closing-<timestamp>/
 * وتشمل الصفوف المتأثرة قبل التغيير (الفترات، السنوات المالية، وربط القيود).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { config as loadEnv } from "dotenv";

loadEnv({ quiet: true });

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const args = process.argv.slice(2);
const useTestDb = args.includes("--db=test");
const rollback = args.includes("--rollback");
const dryRun = args.includes("--dry-run");

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL غير مضبوط.");
  process.exit(1);
}
if (useTestDb) {
  const url = new URL(databaseUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}_test`;
  databaseUrl = url.toString();
  if (!/_test$/.test(url.pathname)) {
    console.error("رفض التنفيذ: اسم قاعدة الاختبار يجب أن ينتهي بـ _test.");
    process.exit(1);
  }
}

const sqlFile = rollback
  ? path.join(root, "migrations", "2026-10-19-period-closing-hardening-rollback.sql")
  : path.join(root, "migrations", "2026-10-19-period-closing-hardening.sql");

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

const dbName = (await client.query("SELECT current_database() AS db")).rows[0].db;
console.log(`قاعدة البيانات: ${dbName}`);
console.log(`الملف: ${path.relative(root, sqlFile)}`);

const before = {
  periods: (await client.query(
    `SELECT id, month, year, status, to_char(start_date,'YYYY-MM-DD') AS start_date,
            to_char(end_date,'YYYY-MM-DD') AS end_date, closed_at
       FROM financial_periods ORDER BY year, month`,
  )).rows,
  fiscal_years: (await client.query("SELECT * FROM fiscal_years ORDER BY id")).rows,
  journal_entry_periods: (await client.query(
    "SELECT id, to_char(date,'YYYY-MM-DD') AS date, period_id FROM journal_entries WHERE period_id IS NULL ORDER BY id",
  )).rows,
};

console.log(`فترات: ${before.periods.length} · قيود بلا فترة: ${before.journal_entry_periods.length}`);

if (dryRun) {
  console.log("وضع الفحص فقط — لم يُنفَّذ أي تغيير.");
  await client.end();
  process.exit(0);
}

if (!rollback) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(root, "backups", `period-closing-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "before-migration.json"), JSON.stringify(before, null, 2), "utf8");
  console.log(`نسخة احتياطية: ${path.relative(root, path.join(dir, "before-migration.json"))}`);
}

const sql = fs.readFileSync(sqlFile, "utf8");
await client.query(sql);
console.log("تم تنفيذ الملف بنجاح.");

const after = {
  periods: (await client.query(
    `SELECT id, month, year, status, to_char(start_date,'YYYY-MM-DD') AS start_date,
            to_char(end_date,'YYYY-MM-DD') AS end_date, closed_at
       FROM financial_periods ORDER BY year, month`,
  )).rows,
  unassignedEntries: (await client.query(
    "SELECT COUNT(*)::int AS n FROM journal_entries WHERE period_id IS NULL",
  )).rows[0].n,
  triggers: (await client.query(
    `SELECT tgname FROM pg_trigger WHERE tgname IN ('trg_journal_entries_period_guard','trg_journal_items_period_guard')`,
  )).rows.map((r) => r.tgname),
  eventsTable: (await client.query("SELECT to_regclass('public.financial_period_events') AS t")).rows[0].t,
};

console.log(`قيود بلا فترة بعد التنفيذ: ${after.unassignedEntries}`);
console.log(`Triggers: ${after.triggers.join(", ") || "لا شيء"}`);
console.log(`جدول الأحداث: ${after.eventsTable || "غير موجود"}`);

await client.end();
