#!/usr/bin/env node
/**
 * set-password.mjs
 * ------------------------------------------------------------------
 * إعادة تعيين كلمة مرور مستخدم على قاعدة البيانات الحالية (DATABASE_URL في .env).
 *
 * سبب وجوده: تم حذف بوابة كلمات المرور الثابتة من `POST /api/login`
 * (كانت تقبل Admin@1234 / 123456 لأي مستخدم إداري)، ولم يبقَ أي مسار
 * لاستعادة الدخول إذا فُقدت كلمة المرور — السكربت هو هذا المسار.
 *
 * الاستخدام:
 *   npm run user:set-password -- <username> [newPassword]
 *   npm run user:set-password -- admin
 *     ← يولّد كلمة مرور عشوائية ويطبعها مرة واحدة
 *
 * بعد التعيين تُضبط must_change_password = true، فيُطلب من المستخدم
 * تغييرها عند أول دخول من شاشة تغيير كلمة المرور الحالية.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";
import bcrypt from "bcryptjs";

const readDatabaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envText = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
  const match = envText.match(/^DATABASE_URL=(.*)$/m);
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
};

const [usernameArg, passwordArg] = process.argv.slice(2);
const username = String(usernameArg || "").trim();

if (!username) {
  console.error("الاستخدام: npm run user:set-password -- <username> [newPassword]");
  process.exit(1);
}

const password = passwordArg
  ? String(passwordArg)
  : crypto.randomBytes(12).toString("base64url");

if (password.length < 8) {
  console.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
  process.exit(1);
}

const connectionString = readDatabaseUrl();
if (!connectionString) {
  console.error("لا يوجد DATABASE_URL في البيئة أو في ملف .env.");
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();
try {
  const user = await client.query(
    "SELECT id, username, role FROM users WHERE username = $1",
    [username]
  );
  if (user.rowCount === 0) {
    console.error(`لا يوجد مستخدم باسم "${username}".`);
    process.exit(1);
  }

  await client.query(
    "UPDATE users SET password = $1, must_change_password = true WHERE username = $2",
    [bcrypt.hashSync(password, 10), username]
  );

  const target = user.rows[0];
  console.log(`✅ تم تعيين كلمة مرور جديدة للمستخدم "${target.username}" (#${target.id}, role=${target.role}).`);
  console.log("سيُطلب تغييرها عند أول تسجيل دخول.");
  if (!passwordArg) {
    console.log(`كلمة المرور المؤقتة (تُعرض مرة واحدة): ${password}`);
  }
} finally {
  await client.end();
}
