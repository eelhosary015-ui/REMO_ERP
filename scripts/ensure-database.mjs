#!/usr/bin/env node
/**
 * ensure-database.mjs
 * ------------------------------------------------------------------
 * يشتغل تلقائيًا قبل `npm run dev` (عبر predev).
 * - لو القاعدة في .env موجودة وفيها السكيما الكاملة (>= 50 جدول) → يخرج فورًا.
 * - لو القاعدة غير موجودة أو فاضية أو ناقصة (محاولة تهيئة فاشلة) → يجهّزها
 *   بنسخ السكيما المرجعية الكاملة (340 جدول) قبل أن يبدأ السيرفر.
 *
 * متغيرات اختيارية:
 *   PROVISION_AUTO=false        → تعطيل الفحص التلقائي تمامًا
 *   PROVISION_SOURCE_DB=<name>  → القاعدة المرجعية (افتراضي: أكبر قاعدة أخرى)
 *   PROVISION_SCHEMA_ONLY=true  → نقل الهيكل بدون بيانات
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import pg from "pg";

if (String(process.env.PROVISION_AUTO || "").toLowerCase() === "false") {
  console.log("[db-guard] PROVISION_AUTO=false — تم تخطي الفحص.");
  process.exit(0);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : v];
  })
);

const envText = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
const envUrl = (envText.match(/^DATABASE_URL=(.*)$/m) || [])[1]?.trim();
if (!envUrl) {
  console.log("[db-guard] لا يوجد DATABASE_URL في .env — تخطي.");
  process.exit(0);
}

const u = new URL(envUrl);
const HOST = u.hostname;
const PORT = u.port || "5432";
const USER = decodeURIComponent(u.username || "postgres");
const PASS = decodeURIComponent(u.password || "");
const TARGET = args.to || u.pathname.replace(/^\//, "");

const conn = (db) => `postgres://${USER}:${encodeURIComponent(PASS)}@${HOST}:${PORT}/${db}`;

// ملفات السكيما المحمولة — تسمح بتجهيز قاعدة على سيرفر جديد بدون قاعدة مرجعية
const SCHEMA_FILE = path.join("db", "schema.sql");
const SEED_FILE = path.join("db", "seed-baseline.sql");
const SCHEMA_ONLY = String(process.env.PROVISION_SCHEMA_ONLY || "").toLowerCase() === "true";

/** إزالة أوامر psql الخاصة (\) حتى ينفع التنفيذ عبر مشغل node-postgres */
const psqlSafe = (sql) => sql.split(/\r?\n/).filter((line) => !line.startsWith("\\")).join("\n");

async function restoreFromFiles(dbName) {
  if (!fs.existsSync(SCHEMA_FILE)) return false;
  const c = new pg.Client({ connectionString: conn(dbName) });
  await c.connect();
  try {
    await c.query("SET session_replication_role = replica");
    await c.query(psqlSafe(fs.readFileSync(SCHEMA_FILE, "utf8")));
    if (!SCHEMA_ONLY && fs.existsSync(SEED_FILE)) {
      await c.query(psqlSafe(fs.readFileSync(SEED_FILE, "utf8")));
    }
    await c.query("SET session_replication_role = DEFAULT");
    return true;
  } finally {
    await c.end();
  }
}

async function withDb(db, fn) {
  const c = new pg.Client({ connectionString: conn(db) });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

async function main() {
  // 1) هل القاعدة موجودة؟
  const exists = await withDb("postgres", async (c) => {
    const r = await c.query("SELECT 1 FROM pg_database WHERE datname=$1", [TARGET]);
    return r.rowCount > 0;
  });

  if (!exists) {
    console.log(`[db-guard] القاعدة "${TARGET}" غير موجودة — سيتم إنشاؤها وتجهيزها بالكامل.`);
  }

  let tables = 0, usersRows = 0, hasUsers = false;
  if (exists) {
    const info = await withDb(TARGET, async (c) => {
      const t = await c.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
      const hu = await c.query("SELECT to_regclass('public.users') AS t");
      let ur = 0;
      if (hu.rows[0].t) ur = (await c.query("SELECT count(*)::int n FROM users")).rows[0].n;
      return { tables: t.rows[0].n, hasUsers: !!hu.rows[0].t, usersRows: ur };
    });
    tables = info.tables; hasUsers = info.hasUsers; usersRows = info.usersRows;
  }

  // 2) السكيما كاملة → لا شيء نعمله
  if (tables >= 50) {
    console.log(`[db-guard] "${TARGET}": ${tables} جدول — السكيما جاهزة.`);
    process.exit(0);
  }

  // 3) حماية: لو فيه مستخدمين فعليين لا نلمس شيئًا
  if (hasUsers && usersRows > 0) {
    console.log(`[db-guard] ⚠️ "${TARGET}" فيها ${usersRows} مستخدم — لن يتم تعديلها.`);
    process.exit(0);
  }

  // 4) اختيار القاعدة المرجعية
  const all = await withDb("postgres", async (c) =>
    (await c.query("SELECT datname FROM pg_database WHERE datistemplate=false")).rows.map((r) => r.datname)
  );
  let source = process.env.PROVISION_SOURCE_DB;
  const forceFile = !!args.file;
  if (!source && !forceFile) {
    let best = null, bestCount = 0;
    for (const db of all) {
      if (db === TARGET) continue;
      try {
        const n = await withDb(db, async (c) =>
          (await c.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows[0].n
        );
        if (n > bestCount) { bestCount = n; best = db; }
      } catch { /* تجاهل */ }
    }
    source = bestCount >= 50 ? best : null;
    console.log(`[db-guard] المرجع المستخدم: ${source || "ملفات db/"}`);
  }

  // 4-ب) لا يوجد مرجع على السيرفر (سيرفر جديد) → استعادة من الملفات المحمولة
  if (!source) {
    if (!fs.existsSync(SCHEMA_FILE)) {
      console.log("[db-guard] ⚠️ لا توجد قاعدة مرجعية ولا ملف db/schema.sql — لا يمكن التجهيز التلقائي.");
      process.exit(0);
    }
    console.log(`[db-guard] تجهيز "${TARGET}" من ملفات db/ (سكيما كاملة${SCHEMA_ONLY ? "" : " + بيانات أساسية"})...`);
    try {
      if (exists && tables > 0) {
        console.log("[db-guard] الهدف فيه جداول جزئية — إعادة تهيئة الـ public schema...");
        await withDb(TARGET, async (c) => {
          await c.query("DROP SCHEMA IF EXISTS public CASCADE");
          await c.query("CREATE SCHEMA public");
        });
      }
      const ok = await restoreFromFiles(TARGET);
      const n = await withDb(TARGET, async (c) =>
        (await c.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows[0].n
      );
      console.log(`[db-guard] ${ok ? "✅ تم التجهيز" : "⚠️ لم يتم"} — ${n} جدول في "${TARGET}".`);
    } catch (e) {
      console.error("[db-guard] ❌ فشل التجهيز من الملفات:", String(e?.message || e).slice(0, 600));
    }
    process.exit(0);
  }

  console.log(`[db-guard] تجهيز "${TARGET}" من المرجع "${source}" (${tables} جدول حاليًا)...`);

  const argv = ["scripts/provision-database.mjs", `--from=${source}`, `--to=${TARGET}`, "--force"];
  if (String(process.env.PROVISION_SCHEMA_ONLY || "").toLowerCase() === "true") argv.push("--schema-only");

  try {
    execFileSync(process.execPath, argv, { stdio: "inherit", env: process.env });
    console.log("[db-guard] ✅ تم تجهيز القاعدة — بدء السيرفر.");
  } catch (e) {
    console.error("[db-guard] ❌ فشل تجهيز القاعدة. السيرفر سيكمل لكن قد تفشل بعض المسارات.");
    console.error(String(e?.message || e).slice(0, 800));
  }
}

main().catch((e) => {
  console.error("[db-guard] تحذير:", e.message);
});
