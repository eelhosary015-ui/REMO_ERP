/**
 * تحقق من سجل حركات المستخدمين:
 *  - الميدلوير يلتقط الحركة كاملة (وحدة/عملية/مرجع/مبلغ/حالة/IP)
 *  - البيانات الحساسة تُنقّى
 *  - التسجيل الصريح لا يتكرر مع الميدلوير
 *  - الفلاتر والترقيم والإحصاءات
 * كل البيانات التجريبية تُحذف في النهاية (user_id = 999999).
 */
import express from "express";
import {
  auditMiddleware,
  ensureAuditSchema,
  getUserLogStats,
  listUserLogs,
  logAction,
} from "../modules/system/services/audit.service.js";
import { pool } from "../server-db.js";

let passed = 0;
let failed = 0;
const check = (condition: boolean, label: string, extra?: any) => {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}`, extra === undefined ? "" : JSON.stringify(extra));
  }
};

const TEST_USERNAME = "audit_test_user";

await ensureAuditSchema();
await pool.query(`DELETE FROM user_logs WHERE username = $1`, [TEST_USERNAME]);

// مستخدم تجريبي حقيقي حتى يمر قيد المفتاح الأجنبي، ويُحذف في النهاية
const existingUser = await pool.query(`SELECT id FROM users WHERE username = $1`, [TEST_USERNAME]);
const TEST_USER_ID = existingUser.rows.length
  ? Number(existingUser.rows[0].id)
  : Number((await pool.query(`INSERT INTO users (username, password, role) VALUES ($1, 'x', 'admin') RETURNING id`, [TEST_USERNAME])).rows[0].id);
console.log(`    مستخدم الاختبار: ${TEST_USERNAME} (#${TEST_USER_ID})`);
await pool.query(`DELETE FROM user_logs WHERE user_id = $1`, [TEST_USER_ID]);

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = { id: TEST_USER_ID, username: TEST_USERNAME, role: "admin" };
  next();
});
app.use(auditMiddleware());

app.post("/api/inventory-wastage/:id/approve", (req, res) => {
  res.json({ id: Number(req.params.id), wastage_number: "WST-2026-0099", total_value: 250, success: true });
});

app.post("/api/products", async (req, res) => {
  await logAction(TEST_USER_ID, "إنشاء منتج (تسجيل صريح)", "products", 77, "منتج اختبار التسجيل الصريح", {
    module: "المخازن",
    entityRef: "PRD-TEST-77",
    amount: 1200,
  });
  res.json({ id: 77, name: "منتج اختبار" });
});

app.delete("/api/products/:id", (_req, res) => {
  res.status(403).json({ error: "غير مصرح" });
});

app.put("/api/users/:id", (_req, res) => {
  res.status(500).json({ error: "خطأ داخلي" });
});

const server = app.listen(3998, async () => {
  const base = "http://127.0.0.1:3998";
  try {
    console.log("\n[1] إرسال حركات تجريبية عبر HTTP");
    await fetch(base + "/api/inventory-wastage/5/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "AuditVerify/1.0" },
      body: JSON.stringify({ notes: "سبب الاختبار", password: "secret-pass", total: 250 }),
    });
    await fetch(base + "/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "منتج اختبار" }),
    });
    await fetch(base + "/api/products/88", { method: "DELETE" });
    await fetch(base + "/api/users/3", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });

    // الميدلوير يسجّل بعد انتهاء الاستجابة
    await new Promise((resolve) => setTimeout(resolve, 900));

    const rows = await pool.query(`SELECT * FROM user_logs WHERE user_id = $1 ORDER BY id ASC`, [TEST_USER_ID]);
    console.log(`    عدد السجلات: ${rows.rows.length}`);

    console.log("\n[2] دقة الحركة التلقائية (اعتماد هالك)");
    const auto = rows.rows.find((r: any) => r.route === "/api/inventory-wastage/5/approve");
    check(!!auto, "تم تسجيل الطلب تلقائياً", rows.rows.map((r: any) => r.route));
    check(auto?.module === "الهالك والتالف", "الوحدة صحيحة", auto?.module);
    check(auto?.action === "اعتماد إذن هالك", "اسم العملية بالعربية صحيح", auto?.action);
    check(auto?.entity_ref === "WST-2026-0099", "رقم المستند (المرجع) مسجّل", auto?.entity_ref);
    check(Number(auto?.amount) === 250, "المبلغ مسجّل", auto?.amount);
    check(Number(auto?.record_id) === 5, "معرّف السجل مسجّل", auto?.record_id);
    check(auto?.status === "success" && Number(auto?.status_code) === 200, "الحالة وكود الاستجابة", [auto?.status, auto?.status_code]);
    check(!!auto?.ip_address, "IP مسجّل", auto?.ip_address);
    check(auto?.username === TEST_USERNAME, "المستخدم مسجّل", auto?.username);
    check(auto?.duration_ms !== null && auto?.duration_ms !== undefined, "مدة التنفيذ مسجّلة", auto?.duration_ms);
    check(auto?.meta?.source === "middleware", "مصدر التسجيل = الميدلوير", auto?.meta?.source);

    console.log("\n[3] تنقية البيانات الحساسة");
    const body = typeof auto?.request_body === "string" ? JSON.parse(auto.request_body) : auto?.request_body;
    check(body?.password === "***", "كلمة المرور مُنقّاة", body?.password);
    check(body?.notes === "سبب الاختبار", "بقية الحقول محفوظة", body?.notes);

    console.log("\n[4] منع التكرار مع التسجيل الصريح");
    const explicitRows = rows.rows.filter((r: any) => r.route === "/api/products" && r.http_method === "POST");
    check(explicitRows.length === 1, "سجل واحد فقط للحركة (لا تكرار)", explicitRows.length);
    check(explicitRows[0]?.action === "إنشاء منتج (تسجيل صريح)", "نص العملية الصريح محفوظ", explicitRows[0]?.action);
    check(explicitRows[0]?.meta?.source === "explicit", "مصدر التسجيل = الموديول", explicitRows[0]?.meta?.source);
    check(explicitRows[0]?.entity_ref === "PRD-TEST-77", "المرجع الصريح محفوظ", explicitRows[0]?.entity_ref);
    check(Number(explicitRows[0]?.amount) === 1200, "المبلغ الصريح محفوظ", explicitRows[0]?.amount);

    console.log("\n[5] الحركات الفاشلة");
    const forbidden = rows.rows.find((r: any) => r.route === "/api/products/88");
    check(forbidden?.status === "failed" && Number(forbidden?.status_code) === 403, "رفض الصلاحية مسجّل كفاشل", [forbidden?.status, forbidden?.status_code]);
    check(forbidden?.severity === "warning", "درجة الخطورة تحذير", forbidden?.severity);
    check(forbidden?.action === "حذف منتج", "اسم العملية للحذف", forbidden?.action);

    const serverError = rows.rows.find((r: any) => r.route === "/api/users/3");
    check(serverError?.status === "failed" && serverError?.severity === "critical", "خطأ السيرفر مسجّل كخطير", [serverError?.status, serverError?.severity]);

    console.log("\n[6] الفلاتر والترقيم والإحصاءات");
    const list = await listUserLogs({ userId: String(TEST_USER_ID) });
    check(list.total === 4, `إجمالي السجلات = 4 (فعلي: ${list.total})`);
    check(list.rows.length === 4, "الترقيم يعيد الصفحة الأولى");
    check(list.rows[0].module !== undefined, "الصفوف تحمل الوحدة");

    const failedList = await listUserLogs({ userId: String(TEST_USER_ID), status: "failed" });
    check(failedList.total === 2, `فلتر الحالة الفاشلة = 2 (فعلي: ${failedList.total})`);

    const searchList = await listUserLogs({ userId: String(TEST_USER_ID), search: "WST-2026-0099" });
    check(searchList.total === 1, "البحث بالمرجع يعمل", searchList.total);

    const paged = await listUserLogs({ userId: String(TEST_USER_ID), pageSize: 2, page: 2 });
    check(paged.rows.length === 2 && paged.pages === 2, "ترقيم الصفحات يعمل", [paged.rows.length, paged.pages]);

    const stats = await getUserLogStats({ userId: String(TEST_USER_ID) });
    check(stats.total === 4 && stats.success === 2 && stats.failed === 2, "إحصاءات النجاح/الفشل", stats);
    check(stats.active_users === 1, "عدد المستخدمين النشطين", stats.active_users);
    check(stats.high_risk >= 2, "الحركات الحساسة محسوبة", stats.high_risk);
    check(stats.by_module.some((m) => m.module === "الهالك والتالف"), "توزيع الوحدات", stats.by_module);
  } catch (error: any) {
    failed++;
    console.log("  ❌ خطأ:", error.message, error.stack?.split("\n")[1]);
  } finally {
    server.close();
    const removed = await pool.query(`DELETE FROM user_logs WHERE user_id = $1 OR username = $2`, [TEST_USER_ID, TEST_USERNAME]);
    console.log(`\n    تنظيف: حُذف ${removed.rowCount} سجل تجريبي`);
    const left = await pool.query(`SELECT COUNT(*)::int AS c FROM user_logs WHERE user_id = $1 OR username = $2`, [TEST_USER_ID, TEST_USERNAME]);
    check(Number(left.rows[0].c) === 0, "لا توجد بقايا في السجل");
    await pool.query(`DELETE FROM users WHERE id = $1 AND username = $2`, [TEST_USER_ID, TEST_USERNAME]);
    const userLeft = await pool.query(`SELECT COUNT(*)::int AS c FROM users WHERE username = $1`, [TEST_USERNAME]);
    check(Number(userLeft.rows[0].c) === 0, "تم حذف المستخدم التجريبي");
    console.log(`\nالنتيجة: ${passed} ناجح / ${failed} فاشل`);
    process.exitCode = failed === 0 ? 0 : 1;
    await (pool as any).end?.();
  }
});
