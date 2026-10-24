/**
 * تحقق HTTP من مسارات شاشة الهالك (قراءة فقط):
 * يركّب نفس الراوتر على تطبيق Express مستقل ويتأكد من الأشكال التي تستهلكها الواجهة.
 */
import express from "express";
import { wastageRouter } from "../modules/warehouses/routes/wastage.routes.js";
import compatRouter from "../modules/system/compat_api.routes.js";
import { pool } from "../server-db.js";

const app = express();
app.use(express.json());
app.use(wastageRouter);
app.use(compatRouter);

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

const server = app.listen(3999, async () => {
  const base = "http://127.0.0.1:3999";
  const get = async (path: string) => {
    const res = await fetch(base + path);
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  };

  try {
    console.log("\n[HTTP] GET /api/wastage-reasons");
    const reasons = await get("/api/wastage-reasons");
    check(reasons.status === 200 && Array.isArray(reasons.body), "يعيد مصفوفة أسباب", reasons.status);
    check(reasons.body.every((r: any) => r.id && r.name_ar), "كل سبب له معرّف حقيقي واسم", reasons.body);

    console.log("\n[HTTP] GET /api/inventory-wastage/available-items?warehouse_id=1");
    const avail = await get("/api/inventory-wastage/available-items?warehouse_id=1");
    check(avail.status === 200, "المسار يعمل", avail.status);
    check(Array.isArray(avail.body.items), "يعيد { items: [] } كما تتوقع الواجهة");
    check(
      avail.body.items.some((i: any) => Number(i.available_qty) > 0),
      "يحمل رصيداً فعلياً > 0",
      avail.body.items.map((i: any) => [i.name, i.available_qty])
    );
    check(
      avail.body.items.every((i: any) => i.unit_cost !== undefined && i.available_qty !== undefined),
      "كل صنف يحمل available_qty و unit_cost"
    );

    console.log("\n[HTTP] GET /api/inventory-wastage/available-items (بدون مخزن)");
    const missing = await get("/api/inventory-wastage/available-items");
    check(missing.status === 400 && missing.body.code === "WAREHOUSE_REQUIRED", "رفض واضح عند غياب المخزن", missing.body);

    console.log("\n[HTTP] GET /api/inventory-wastage/summary");
    const summary = await get("/api/inventory-wastage/summary");
    check(summary.status === 200, "الملخص يعمل", summary.status);
    check(
      ["total_docs", "total_value", "draft_count", "top_products"].every((k) => summary.body[k] !== undefined),
      "الملخص يحمل المؤشرات التي تعرضها الشاشة",
      Object.keys(summary.body || {})
    );

    console.log("\n[HTTP] GET /api/inventory-wastage");
    const list = await get("/api/inventory-wastage");
    check(list.status === 200 && Array.isArray(list.body), "قائمة الأذون مصفوفة", list.status);

    console.log("\n[HTTP] GET /api/inventory-wastage/999999");
    const missingDoc = await get("/api/inventory-wastage/999999");
    check(missingDoc.status === 404, "إذن غير موجود يعيد 404", missingDoc.status);

    console.log("\n[HTTP] GET /api/inventory/stock (المسار القديم بعد إصلاح المصدر)");
    const legacy = await fetch(base + "/api/inventory/stock?warehouse_id=1&product_id=1").then((r) => r.json());
    check(Number(legacy.quantity) > 0, "المسار القديم يعيد رصيداً حقيقياً الآن", legacy);
  } catch (error: any) {
    failed++;
    console.log("  ❌ خطأ:", error.message);
  } finally {
    server.close();
    console.log(`\nالنتيجة: ${passed} ناجح / ${failed} فاشل`);
    process.exitCode = failed === 0 ? 0 : 1;
    await (pool as any).end?.().catch(() => {});
  }
});
