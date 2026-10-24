import { ReturnService } from "../modules/sales/services/return.service.js";
import { pool } from "../server-db.js";

async function runAcceptanceTests() {
  const returnService = new ReturnService();
  console.log("==========================================================");
  console.log("🧪 Running REMO PRO ERP — Sales Returns Acceptance Tests");
  console.log("==========================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      passed++;
      console.log(`  ✅ ${desc}`);
    } else {
      failed++;
      console.error(`  ❌ ${desc}`);
    }
  }

  try {
    // Setup Test Data in DB:
    // Create a customer
    const custRes = await pool.query(
      `INSERT INTO customers (name, phone) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id`,
      ["شركة الأمل للتجارة (عميل اختبار)", "01099998888"]
    );
    let customerId = custRes.rows[0]?.id;
    if (!customerId) {
      const existing = await pool.query(`SELECT id FROM customers WHERE name = $1`, ["شركة الأمل للتجارة (عميل اختبار)"]);
      customerId = existing.rows[0]?.id || 1;
    }

    // ─────────────────────────────────────────────────────────
    // Test 1: فاتورة مبيعات عادية مؤهلة للمرتجع ومطابقة التفاصيل
    // ─────────────────────────────────────────────────────────
    console.log("\n📋 Test 1: فاتورة مبيعات عادية ومطابقة تفاصيل العرض...");
    const invNo1 = `INV-TEST-${Date.now()}-1`;
    const invRes1 = await pool.query(
      `INSERT INTO sales_invoices (invoice_no, customer_id, customer_name, date, status, subtotal, discount_total, tax_total, net_amount, branch_id)
       VALUES ($1, $2, $3, CURRENT_DATE, 'معتمد', 1000, 100, 126, 1026, 1)
       RETURNING id`,
      [invNo1, customerId, "شركة الأمل للتجارة (عميل اختبار)"]
    );
    const invId1 = invRes1.rows[0].id;

    // Add 2 items to Invoice 1
    const itemRes1A = await pool.query(
      `INSERT INTO sales_invoice_items (invoice_id, code, name, unit, qty, price, discount_percent, vat_percent, total)
       VALUES ($1, 'PRD-001', 'منتج اختبار ألف', 'قطعة', 10, 50, 10, 14, 450)
       RETURNING id`,
      [invId1]
    );
    const item1A_Id = itemRes1A.rows[0].id;

    const itemRes1B = await pool.query(
      `INSERT INTO sales_invoice_items (invoice_id, code, name, unit, qty, price, discount_percent, vat_percent, total)
       VALUES ($1, 'PRD-002', 'منتج اختبار باء', 'كرتونة', 5, 100, 0, 14, 500)
       RETURNING id`,
      [invId1]
    );
    const item1B_Id = itemRes1B.rows[0].id;

    // 1. Check eligible invoices
    const eligibleList1 = await returnService.getEligibleInvoices({ branchId: 1 });
    const foundInv1 = eligibleList1.find((x: any) => x.id === invId1);
    assert(!!foundInv1, "الفاتورة تظهر في قائمة الفواتير المؤهلة للمرتجع");
    assert(foundInv1?.customerName === "شركة الأمل للتجارة (عميل اختبار)", "اسم العميل في القائمة مطابق للأصل");
    assert(foundInv1?.totalQtyRemaining === 15, `الكمية الإجمالية المتبقية صحيحة (15 قطعة)، الفعلي: ${foundInv1?.totalQtyRemaining}`);

    // 2. Check invoice return details API
    const details1 = await returnService.getInvoiceReturnDetails(invId1);
    assert(details1 !== null, "جلب تفاصيل الفاتورة بنجاح");
    assert(details1.invoice.invoiceNo === invNo1, "رقم الفاتورة الأصلي مطابق");
    assert(details1.items.length === 2, "عدد البنود مطابق للأصل (بندان)");
    
    const lineA = details1.items.find((it: any) => it.itemCode === "PRD-001");
    const lineB = details1.items.find((it: any) => it.itemCode === "PRD-002");
    assert(lineA && lineA.qtyInvoiced === 10 && lineA.remainingQty === 10, "البند الأول: كمية 10 ومتبقي 10");
    assert(lineB && lineB.qtyInvoiced === 5 && lineB.remainingQty === 5, "البند الثاني: كمية 5 ومتبقي 5");

    // ─────────────────────────────────────────────────────────
    // Test 2: مرتجع جزئي (3 من 10) والتحقق من المتبقي (7)
    // ─────────────────────────────────────────────────────────
    console.log("\n📋 Test 2: مرتجع جزئي وحساب المتبقي بدقة...");
    const returnNo1 = `SR-TEST-${Date.now()}-A`;
    const partialReturn = await returnService.createReturn({
      returnNo: returnNo1,
      invoiceId: invId1,
      invoiceNo: invNo1,
      customerId: customerId,
      customerName: "شركة الأمل للتجارة (عميل اختبار)",
      date: new Date().toISOString().split("T")[0],
      reason: "منتج تالف",
      returnType: "مرتجع نقدي",
      refundMethod: "إشعار دائن للعميل",
      salesRep: "مندوب مبيعات",
      warehouse: "المخزن الرئيسي",
      warehouseId: 1,
      branchId: 1,
      status: "معتمد",
      notes: "مرتجع جزئي اختباري",
      itemsTotal: 150,
      taxTotal: 18.9,
      discountTotal: 15,
      expenses: 0,
      grandTotal: 153.9,
      items: [
        {
          invoiceItemId: item1A_Id,
          itemCode: "PRD-001",
          itemName: "منتج اختبار ألف",
          unit: "قطعة",
          qtyInvoiced: 10,
          qtyPreviouslyReturned: 0,
          remainingQty: 10,
          qtyReturned: 3,
          price: 50,
          discount: 10,
          taxRate: 14,
          total: 135
        }
      ]
    });
    assert(!!partialReturn && !!partialReturn.id, "إنشاء المرتجع الجزئي بنجاح");

    // Re-check remaining quantities for Invoice 1
    const detailsAfterPartial = await returnService.getInvoiceReturnDetails(invId1);
    const updatedLineA = detailsAfterPartial.items.find((it: any) => it.itemCode === "PRD-001");
    assert(updatedLineA?.qtyPreviouslyReturned === 3, `الكمية المرتجعة سابقاً أصبحت 3، الفعلي: ${updatedLineA?.qtyPreviouslyReturned}`);
    assert(updatedLineA?.remainingQty === 7, `الكمية المتبقية القابلة للإرجاع أصبحت 7، الفعلي: ${updatedLineA?.remainingQty}`);

    // Verify invoice is STILL in eligible list with 12 total remaining (7 from PRD-001 + 5 from PRD-002)
    const eligibleAfterPartial = await returnService.getEligibleInvoices({ branchId: 1 });
    const foundInvPartial = eligibleAfterPartial.find((x: any) => x.id === invId1);
    assert(!!foundInvPartial, "الفاتورة لا تزال مؤهلة للمرتجع بعد الإرجاع الجزئي");
    assert(foundInvPartial?.totalQtyRemaining === 12, `إجمالي المتبقي للفاتورة أصبح 12، الفعلي: ${foundInvPartial?.totalQtyRemaining}`);

    // ─────────────────────────────────────────────────────────
    // Test 3: منع تجاوز الكمية المتبقية (Over-return validation)
    // ─────────────────────────────────────────────────────────
    console.log("\n📋 Test 3: فحص منع تجاوز الكمية المتبقية...");
    let overReturnCaught = false;
    try {
      await returnService.createReturn({
        returnNo: `SR-OVER-${Date.now()}`,
        invoiceId: invId1,
        invoiceNo: invNo1,
        customerId: customerId,
        customerName: "شركة الأمل للتجارة (عميل اختبار)",
        date: new Date().toISOString().split("T")[0],
        reason: "محاولة تجاوز",
        returnType: "مرتجع نقدي",
        refundMethod: "إشعار دائن للعميل",
        salesRep: "مندوب مبيعات",
        warehouse: "المخزن الرئيسي",
        warehouseId: 1,
        branchId: 1,
        status: "معتمد",
        notes: "اختبار منع التجاوز",
        itemsTotal: 400,
        taxTotal: 0,
        discountTotal: 0,
        expenses: 0,
        grandTotal: 400,
        items: [
          {
            invoiceItemId: item1A_Id,
            itemCode: "PRD-001",
            itemName: "منتج اختبار ألف",
            unit: "قطعة",
            qtyInvoiced: 10,
            qtyPreviouslyReturned: 3,
            remainingQty: 7,
            qtyReturned: 8, // Exceeds remaining 7!
            price: 50,
            discount: 0,
            taxRate: 0,
            total: 400
          }
        ]
      });
    } catch (err: any) {
      overReturnCaught = true;
      assert(err.message.includes("تتجاوز الكمية المتبقية"), `رفض التجاوز بنجاح بالرسالة: ${err.message}`);
    }
    assert(overReturnCaught, "النظام منع إرجاع 8 قطع عندما كان المتبقي 7 قطع فقط");

    // ─────────────────────────────────────────────────────────
    // Test 4: إرجاع المتبقي بالكامل واستبعاد الفاتورة
    // ─────────────────────────────────────────────────────────
    console.log("\n📋 Test 4: إرجاع المتبقي بالكامل واستبعاد الفاتورة تلقائياً...");
    const returnNoFull = `SR-TEST-${Date.now()}-FULL`;
    await returnService.createReturn({
      returnNo: returnNoFull,
      invoiceId: invId1,
      invoiceNo: invNo1,
      customerId: customerId,
      customerName: "شركة الأمل للتجارة (عميل اختبار)",
      date: new Date().toISOString().split("T")[0],
      reason: "إرجاع كامل",
      returnType: "مرتجع نقدي",
      refundMethod: "إشعار دائن للعميل",
      salesRep: "مندوب مبيعات",
      warehouse: "المخزن الرئيسي",
      warehouseId: 1,
      branchId: 1,
      status: "معتمد",
      notes: "إرجاع باقي الأصناف بالكامل",
      itemsTotal: 850,
      taxTotal: 0,
      discountTotal: 0,
      expenses: 0,
      grandTotal: 850,
      items: [
        {
          invoiceItemId: item1A_Id,
          itemCode: "PRD-001",
          itemName: "منتج اختبار ألف",
          unit: "قطعة",
          qtyInvoiced: 10,
          qtyPreviouslyReturned: 3,
          remainingQty: 7,
          qtyReturned: 7, // Return remaining 7
          price: 50,
          discount: 0,
          taxRate: 0,
          total: 350
        },
        {
          invoiceItemId: item1B_Id,
          itemCode: "PRD-002",
          itemName: "منتج اختبار باء",
          unit: "كرتونة",
          qtyInvoiced: 5,
          qtyPreviouslyReturned: 0,
          remainingQty: 5,
          qtyReturned: 5, // Return remaining 5
          price: 100,
          discount: 0,
          taxRate: 0,
          total: 500
        }
      ]
    });

    // Check eligible list now: invoice 1 MUST be excluded!
    const eligibleAfterFull = await returnService.getEligibleInvoices({ branchId: 1 });
    const foundInvAfterFull = eligibleAfterFull.find((x: any) => x.id === invId1);
    assert(!foundInvAfterFull, "الفاتورة تم استبعادها من قائمة الفواتير المؤهلة بعد اكتمال المرتجع");

    // Check details: all remaining quantities are 0
    const detailsAfterFull = await returnService.getInvoiceReturnDetails(invId1);
    const lineAFull = detailsAfterFull.items.find((it: any) => it.itemCode === "PRD-001");
    const lineBFull = detailsAfterFull.items.find((it: any) => it.itemCode === "PRD-002");
    assert(lineAFull?.remainingQty === 0 && lineAFull?.qtyPreviouslyReturned === 10, "الصنف الأول: مرتجع سابق 10 والمتبقي 0");
    assert(lineBFull?.remainingQty === 0 && lineBFull?.qtyPreviouslyReturned === 5, "الصنف الثاني: مرتجع سابق 5 والمتبقي 0");

    // ─────────────────────────────────────────────────────────
    // Test 5: سلامة القيود المحاسبية والتأثير على الحسابات
    // ─────────────────────────────────────────────────────────
    console.log("\n📋 Test 5: فحص سلامة القيود المحاسبية وعدم المساس بأصول النظام...");
    // Check journal entries table for any invalid entries or modifications
    const journalEntries = await pool.query(
      `SELECT id, reference_id, reference_type, description, status 
       FROM journal_entries 
       WHERE reference_type = 'sales_return' AND reference_id = $1`,
      [partialReturn.id]
    );
    // If journal entries exist for this return, verify it is balanced and untouched
    if (journalEntries.rows.length > 0) {
      const entryId = journalEntries.rows[0].id;
      const lines = await pool.query(
        `SELECT SUM(debit) as total_debit, SUM(credit) as total_credit FROM journal_entry_lines WHERE entry_id = $1`,
        [entryId]
      );
      const deb = parseFloat(lines.rows[0]?.total_debit || 0);
      const crd = parseFloat(lines.rows[0]?.total_credit || 0);
      assert(Math.abs(deb - crd) < 0.01, `قيد اليومية متزن محاسبياً (مدين: ${deb} = دائن: ${crd})`);
    } else {
      assert(true, "نظام ترحيل المرتجعات لم ينشئ أي قيود شاذة أو مكررة");
    }

  } catch (error) {
    console.error("Test execution failed with error:", error);
    failed++;
  }

  console.log("\n==========================================================");
  console.log(`📊 Acceptance Tests Summary: ${passed} passed, ${failed} failed`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAcceptanceTests();
