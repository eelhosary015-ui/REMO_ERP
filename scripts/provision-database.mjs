#!/usr/bin/env node
/**
 * provision-database.mjs
 * ------------------------------------------------------------------
 * ينشئ قاعدة بيانات جديدة بنفس سكيما النظام بالكامل (340 جدول) وبياناتها،
 * لأن تهيئة التطبيق (server-db-init.ts) تكميلية فقط ولا تنشئ من الصفر.
 *
 * الاستخدام:
 *   node scripts/provision-database.mjs --from=erp_system1 --to=erp_system2
 *   node scripts/provision-database.mjs --from=erp_system1 --to=erp_system3 --schema-only
 *   node scripts/provision-database.mjs --from=erp_system1 --to=erp_system2 --force
 *
 * الخيارات:
 *   --from        قاعدة المصدر (السكيما المرجعية)
 *   --to          قاعدة الهدف (تُنشأ إن لم تكن موجودة)
 *   --schema-only نقل الهيكل فقط بدون بيانات
 *   --force       يسمح بالكتابة فوق قاعدة هدف تحتوي بيانات
 *   --keep-dump   يحتفظ بملف النسخة في backups/db-migration
 *
 * الأمان: يأخذ نسخة كاملة من الهدف قبل أي كتابة، ويوقف العمل لو الهدف فيه بيانات
 * بدون --force.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import pg from "pg";

// ---------- إعدادات الاتصال ----------
const envText = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
const envUrl = (envText.match(/^DATABASE_URL=(.*)$/m) || [])[1]?.trim();
const parsed = new URL(envUrl || "postgres://postgres@127.0.0.1:5432/erp_system1");
const PGHOST = parsed.hostname;
const PGPORT = parsed.port || "5432";
const PGUSER = decodeURIComponent(parsed.username || "postgres");
const PGPASSWORD = decodeURIComponent(parsed.password || "");

const BIN_DIR = process.env.PG_BIN || "C:\\Program Files\\PostgreSQL\\18\\bin";
const PG_DUMP = path.join(BIN_DIR, "pg_dump.exe");
const PSQL = path.join(BIN_DIR, "psql.exe");

for (const bin of [PG_DUMP, PSQL]) {
  if (!fs.existsSync(bin)) {
    console.error(`❌ لم يتم العثور على ${bin}\n   حدّد المسار عبر متغير البيئة PG_BIN`);
    process.exit(1);
  }
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : v];
  })
);

const FROM = args.from;
const TO = args.to;
const SCHEMA_ONLY = !!args["schema-only"];
const FORCE = !!args.force;
const KEEP_DUMP = !!args["keep-dump"];

if (!FROM || !TO) {
  console.error("الاستخدام: node scripts/provision-database.mjs --from=<db> --to=<db> [--schema-only] [--force]");
  process.exit(1);
}
if (FROM === TO) {
  console.error("❌ المصدر والهدف نفس القاعدة.");
  process.exit(1);
}

const client = (db) => new pg.Client({ connectionString: `postgres://${PGUSER}:${encodeURIComponent(PGPASSWORD)}@${PGHOST}:${PGPORT}/${db}` });
const psqlArgs = (db, extra = []) => ["-h", PGHOST, "-p", PGPORT, "-U", PGUSER, "-d", db, "-v", "ON_ERROR_STOP=1", ...extra];
const childEnv = { ...process.env, PGPASSWORD };

async function q(db, sql, params = []) {
  const c = client(db);
  await c.connect();
  try { return (await c.query(sql, params)).rows; } finally { await c.end(); }
}

async function ensureTargetExists() {
  const rows = await q("postgres", "SELECT 1 FROM pg_database WHERE datname = $1", [TO]);
  if (rows.length === 0) {
    await q("postgres", `CREATE DATABASE "${TO}"`);
    console.log(`🆕 تم إنشاء قاعدة ${TO}`);
    return "created";
  }
  return "exists";
}

async function targetStats() {
  const t = await q(TO, "SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
  const hasUsers = await q(TO, "SELECT to_regclass('public.users') AS t");
  let rowsCount = 0;
  if (hasUsers[0].t) {
    const r = await q(TO, "SELECT count(*)::int n FROM users");
    rowsCount = r[0].n;
  }
  return { tables: t[0].n, users: rowsCount, hasBaseSchema: !!hasUsers[0].t };
}

function run(cmd, argv, logFile) {
  const out = execFileSync(cmd, argv, { env: childEnv, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
  if (logFile) fs.appendFileSync(logFile, out);
  return out;
}

(async () => {
  console.log(`\n══ نقل السكيما: ${FROM} ➜ ${TO} ${SCHEMA_ONLY ? "(هيكل فقط)" : "(هيكل + بيانات)"} ══\n`);

  const src = await q(FROM, "SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
  const srcTables = src[0].n;
  if (srcTables < 50) {
    console.error(`❌ قاعدة المصدر ${FROM} فيها ${srcTables} جدول فقط — ليست سكيما مرجعية صالحة.`);
    process.exit(1);
  }
  console.log(`📦 المصدر: ${srcTables} جدول`);

  const state = await ensureTargetExists();
  const stats = await targetStats();
  console.log(`🎯 الهدف: ${stats.tables} جدول حالياً`);

  const dir = path.join("backups", "db-migration");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  // إيقاف احترازي لو الهدف فيه بيانات حقيقية
  if (stats.tables > 0 && stats.users > 0 && !FORCE) {
    console.error(`\n⛔ الهدف ${TO} يحتوي بيانات (${stats.users} مستخدم). أعد التشغيل مع --force للكتابة فوقه.`);
    process.exit(2);
  }

  // نسخة أمان من الهدف
  let backupPath = "";
  if (state === "exists" && stats.tables > 0) {
    backupPath = path.join(dir, `${TO}-before-${stamp}.sql`);
    run(PG_DUMP, ["-h", PGHOST, "-p", PGPORT, "-U", PGUSER, "-d", TO, "--no-owner", "--no-privileges", "-f", backupPath]);
    console.log(`💾 نسخة أمان من الهدف: ${backupPath}`);
  }

  // تفريغ المصدر
  const dumpPath = path.join(dir, `${FROM}-${SCHEMA_ONLY ? "schema" : "full"}-${stamp}.sql`);
  const dumpArgs = ["-h", PGHOST, "-p", PGPORT, "-U", PGUSER, "-d", FROM, "--clean", "--if-exists", "--no-owner", "--no-privileges", "-f", dumpPath];
  if (SCHEMA_ONLY) dumpArgs.push("--schema-only");
  console.log("⏳ تفريغ المصدر...");
  run(PG_DUMP, dumpArgs);
  console.log(`✅ تم التفريغ: ${dumpPath} (${(fs.statSync(dumpPath).size / 1024 / 1024).toFixed(2)} MB)`);

  // الترجيع
  console.log("⏳ الترجيع على الهدف...");
  const logPath = path.join(dir, `restore-${TO}-${stamp}.log`);
  try {
    run(PSQL, psqlArgs(TO, ["-q", "-f", dumpPath]), logPath);
  } catch (e) {
    console.error("❌ فشل الترجيع. راجع اللوج:", logPath);
    console.error(e.stderr?.toString?.().slice(0, 4000) || e.message);
    process.exit(3);
  }
  console.log(`✅ تم الترجيع (لوج: ${logPath})`);

  // تحقق نهائي
  const final = await targetStats();
  console.log(`\n📊 النتيجة: ${final.tables} جدول (المصدر ${srcTables})`);
  if (!SCHEMA_ONLY) {
    const u = await q(TO, "SELECT count(*)::int n FROM users");
    console.log(`👤 المستخدمون: ${u[0].n}`);
  }
  if (final.tables < srcTables * 0.95) {
    console.error("⚠️ عدد الجداول أقل من المتوقع — راجع اللوج.");
    process.exit(4);
  }

  if (!KEEP_DUMP) {
    fs.unlinkSync(dumpPath);
    console.log("🧹 تم حذف ملف التفريغ المؤقت (استخدم --keep-dump للاحتفاظ به).");
  }

  console.log("\n✅ جاهز. بدّل DATABASE_URL في .env وأعد تشغيل السيرفر.\n");
})().catch((e) => {
  console.error("❌ خطأ غير متوقع:", e.message);
  process.exit(99);
});
