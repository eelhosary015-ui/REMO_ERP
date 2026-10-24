import { pool } from "../../../server-db.js";

/**
 * Schema Guard
 * ────────────────────────────────────────────────────────────────────────────
 * عقد مخطط (Schema Contract): كل عمود بتعتمد عليه استعلامات التشغيل اليومية في المنظومة.
 *
 * ليش؟ لأن أخطاء زي "column created_at does not exist" ما بتتكتشفش غير وقت التشغيل
 * وبتظهر كـ 500 في شاشة المستخدم. الحارس ده:
 *   1. بيتشيك من المخطط الحقيقي في قاعدة البيانات.
 *   2. بيضيف الأعمدة الناقصة تلقائيًا (أعمدة nullable/آمنة).
 *   3. بيقف التشغيل بصوت عالي لو فيه عمود مستحيل يتضاف.
 *
 * ملاحظة: كل الأعمدة الناقصة بتتصاف nullable — عشان متأثرش ببيانات موجودة.
 */

export type ColumnContract = {
  column: string;
  type: string;
  default?: string;
  note?: string;
};

export type TableContract = {
  table: string;
  purpose: string;
  columns: ColumnContract[];
};

const c = (column: string, type = "TEXT", extra: Partial<ColumnContract> = {}): ColumnContract => ({ column, type, ...extra });

export const SCHEMA_CONTRACTS: TableContract[] = [
  {
    table: "orders",
    purpose: "المبيعات وطلبات نقطة البيع — تاريخ الأوردر في العمود timestamp (مش created_at)",
    columns: [
      c("branch_id", "INTEGER"),
      c("user_id", "INTEGER"),
      c("table_number", "INTEGER"),
      c("table_id", "INTEGER"),
      c("customer_name"),
      c("customer_phone"),
      c("customer_phone_2"),
      c("customer_address"),
      c("delivery_time", "TIMESTAMP"),
      c("notes"),
      c("order_type"),
      c("timestamp", "TIMESTAMP", { note: "تاريخ/وقت الأوردر الفعلي" }),
      c("total", "NUMERIC(12,2)", { default: "0" }),
      c("delivery_fee", "NUMERIC(12,2)", { default: "0" }),
      c("subtotal", "NUMERIC(12,2)", { default: "0" }),
      c("discount", "NUMERIC(12,2)", { default: "0" }),
      c("discount_amount", "NUMERIC(12,2)", { default: "0" }),
      c("tax_amount", "NUMERIC(12,2)", { default: "0" }),
      c("service_charge", "NUMERIC(12,2)", { default: "0" }),
      c("paid_amount", "NUMERIC(12,2)", { default: "0" }),
      c("daily_number", "INTEGER"),
      c("payment_method"),
      c("status"),
      c("is_paid", "INTEGER", { default: "0" }),
      c("is_deducted", "INTEGER", { default: "0" }),
      c("source"),
      c("delivery_driver_id", "INTEGER"),
      c("company_id", "INTEGER"),
    ],
  },
  {
    table: "order_items",
    purpose: "أصناف كل أوردر",
    columns: [
      c("order_id", "INTEGER"),
      c("product_id", "INTEGER"),
      c("quantity", "NUMERIC(12,2)", { default: "1" }),
      c("price", "NUMERIC(12,2)", { default: "0" }),
      c("notes"),
      c("size_name"),
    ],
  },
  {
    table: "products",
    purpose: "أصناف نقطة البيع والمخزون",
    columns: [
      c("category_id", "INTEGER"),
      c("name"),
      c("price", "NUMERIC(12,2)", { default: "0" }),
      c("sales_price", "NUMERIC(12,2)"),
      c("cost", "NUMERIC(12,2)"),
      c("is_active", "INTEGER", { default: "1" }),
      c("show_in_pos", "INTEGER", { default: "1" }),
      c("is_available_in_pos", "INTEGER", { default: "1" }),
      c("code"),
      c("barcode"),
      c("unit"),
      c("brand"),
      c("stock", "NUMERIC(12,2)", { default: "0" }),
      c("tax_rate", "NUMERIC(5,2)"),
      c("track_inventory", "INTEGER", { default: "1" }),
      c("company_id", "INTEGER"),
      c("branch_id", "INTEGER"),
    ],
  },
  {
    table: "categories",
    purpose: "أقسام الأصناف وربطها بطابعات المطبخ",
    columns: [
      c("name"),
      c("printer_id", "INTEGER", { note: "طابعة المطبخ المرتبطة بالقسم" }),
      c("is_active", "INTEGER", { default: "1" }),
      c("parent_id", "INTEGER"),
      c("show_in_pos", "INTEGER", { default: "1" }),
      c("color", "TEXT", { default: "'#2563eb'" }),
      c("icon", "TEXT", { default: "'package'" }),
      c("description", "TEXT"),
      c("sort_order", "INTEGER", { default: "0" }),
      c("created_at", "TIMESTAMP", { default: "CURRENT_TIMESTAMP" }),
      c("updated_at", "TIMESTAMP", { default: "CURRENT_TIMESTAMP" }),
      c("company_id", "INTEGER"),
      c("branch_id", "INTEGER"),
    ],
  },
  {
    table: "branches",
    purpose: "الفروع",
    columns: [
      c("name"),
      c("company_id", "INTEGER"),
      c("tables_count", "INTEGER"),
    ],
  },
  {
    table: "customers",
    purpose: "عملاء نقطة البيع و CRM",
    columns: [
      c("name"),
      c("phone"),
      c("phone_2"),
      c("address"),
      c("email"),
      c("total_orders", "INTEGER", { default: "0" }),
      c("total_spent", "NUMERIC(12,2)", { default: "0" }),
      c("last_order_date", "TIMESTAMP"),
      c("company_id", "INTEGER"),
    ],
  },
  {
    table: "suppliers",
    purpose: "الموردون والمشتريات",
    columns: [
      c("name"),
      c("phone"),
      c("balance", "NUMERIC(12,2)", { default: "0" }),
      c("notes"),
      c("credit_limit", "NUMERIC(12,2)"),
      c("company_id", "INTEGER"),
      c("supplier_code"),
      c("name_en"),
      c("tax_number"),
      c("commercial_register"),
      c("group_name"),
      c("payment_terms"),
      c("opening_balance", "NUMERIC(12,2)"),
      c("currency", "TEXT", { default: "'EGP'" }),
      c("contact_person"),
      c("website"),
      c("country"),
      c("city"),
      c("approval_status", "TEXT", { default: "'approved'" }),
      c("approved_at", "TIMESTAMP"),
    ],
  },
  {
    table: "supplier_documents",
    purpose: "مستندات المورد — الملف نفسه مخزَّن في file_data (BYTEA) داخل قاعدة البيانات",
    columns: [
      c("document_type"),
      c("document_number"),
      c("file_name"),
      c("file_url"),
      c("issue_date", "DATE"),
      c("expiry_date", "DATE"),
      c("status", "TEXT", { default: "'active'" }),
      c("notes"),
      c("file_data", "BYTEA", { note: "بايتات المستند — بدونها يفشل رفع/عرض المستندات" }),
      c("mime_type"),
      c("file_size", "BIGINT"),
      c("checksum_sha256"),
      c("uploaded_by", "INTEGER"),
      c("created_at", "TIMESTAMP", { default: "CURRENT_TIMESTAMP" }),
    ],
  },
  {
    table: "settings",
    purpose: "إعدادات النظام (مفتاح/قيمة)",
    columns: [c("key"), c("value")],
  },
  {
    table: "users",
    purpose: "مستخدمو النظام",
    columns: [
      c("username"),
      c("password"),
      c("role"),
      c("permissions"),
      c("branch_id", "INTEGER"),
      c("employee_id", "INTEGER"),
      c("company_id", "INTEGER"),
      c("must_change_password", "BOOLEAN", { default: "false" }),
      c("status"),
    ],
  },
  {
    table: "employees",
    purpose: "الموظفون — التواريخ hires بالـ hire_date/actual_start_date/contract_start_date/entry_date",
    columns: [
      c("name"),
      c("employee_code"),
      c("status"),
      c("job_title"),
      c("department_name"),
      c("branch_name"),
      c("basic_salary", "NUMERIC(12,2)", { default: "0" }),
      c("hire_date", "DATE"),
      c("actual_start_date", "DATE"),
      c("contract_start_date", "DATE"),
      c("entry_date", "DATE", { note: "تاريخ الدخول الفعلي (بديل آمن عن created_at)" }),
      c("annual_increase_pct", "NUMERIC(5,2)", { default: "10.00" }),
      c("last_annual_increase_date", "DATE"),
      c("fingerprint_code"),
      c("company_id", "INTEGER"),
    ],
  },
  {
    table: "attendance",
    purpose: "الحضور والانصراف",
    columns: [
      c("employee_id", "INTEGER"),
      c("date", "DATE"),
      c("check_in", "TIMESTAMP"),
      c("check_out", "TIMESTAMP"),
      c("punch_time", "TIMESTAMP"),
      c("work_hours", "NUMERIC(8,2)", { default: "0" }),
      c("overtime", "NUMERIC(8,2)", { default: "0" }),
      c("penalty", "NUMERIC(8,2)", { default: "0" }),
      c("status"),
      c("notes"),
    ],
  },
  {
    table: "payroll",
    purpose: "مسيرات الرواتب",
    columns: [
      c("user_id", "INTEGER"),
      c("month", "INTEGER"),
      c("year", "INTEGER"),
      c("basic_salary", "NUMERIC(12,2)", { default: "0" }),
      c("bonuses", "NUMERIC(12,2)", { default: "0" }),
      c("deductions", "NUMERIC(12,2)", { default: "0" }),
      c("net_salary", "NUMERIC(12,2)", { default: "0" }),
      c("status"),
      c("paid_at", "TIMESTAMP"),
    ],
  },
  {
    table: "printers",
    purpose: "الطابعات — التي بدون أقسام تستقبل فواتير نقطة البيع تلقائيًا",
    columns: [
      c("name"),
      c("ip_address"),
      c("port", "INTEGER", { default: "9100" }),
      c("is_active", "INTEGER", { default: "1" }),
      c("branch_id", "INTEGER"),
      c("category_ids", "TEXT", { note: "فارغ/[] = طابعة فواتير رئيسية" }),
      c("connection_type", "TEXT", { default: "'local'" }),
      c("system_printer_name", "TEXT", { note: "اسم الطابعة على جهاز الخادم (للربط المحلي)" }),
    ],
  },
  {
    table: "accounts",
    purpose: "دليل الحسابات في(GL)",
    columns: [
      c("code"),
      c("name"),
      c("name_ar"),
      c("type"),
      c("account_type"),
      c("account_nature"),
      c("parent_id", "INTEGER"),
      c("balance", "NUMERIC(18,2)", { default: "0" }),
      c("status", "INTEGER", { default: "1" }),
      c("is_active", "INTEGER", { default: "1" }),
    ],
  },
  {
    table: "account_config",
    purpose: "ربط مفاتيح الإعدادات بحسابات_GL (بدون account_id = رد فعل احتياطي)",
    columns: [
      c("key"),
      c("account_id", "INTEGER"),
      c("description", "TEXT"),
      c("updated_at", "TIMESTAMP", { default: "CURRENT_TIMESTAMP" }),
    ],
  },
  {
    table: "journal_entries",
    purpose: "القيود اليومية — القيود المرحّلة status='posted'",
    columns: [
      c("date", "DATE"),
      c("description"),
      c("reference"),
      c("created_at", "TIMESTAMP", { default: "CURRENT_TIMESTAMP" }),
      c("period_id", "INTEGER"),
      c("source_type"),
      c("source_id", "INTEGER"),
      c("status", "TEXT", { default: "'draft'" }),
      c("total_debit", "NUMERIC(18,2)", { default: "0" }),
      c("total_credit", "NUMERIC(18,2)", { default: "0" }),
      c("created_by"),
      c("branch_id", "INTEGER"),
      c("company_id", "INTEGER"),
      c("idempotency_key"),
    ],
  },
  {
    table: "journal_items",
    purpose: "سطور القيود (لا يوجد عمود description — فقط notes)",
    columns: [
      c("journal_entry_id", "INTEGER"),
      c("account_id", "INTEGER"),
      c("debit", "NUMERIC(18,2)", { default: "0" }),
      c("credit", "NUMERIC(18,2)", { default: "0" }),
      c("notes", "TEXT"),
      c("cost_center_id", "INTEGER"),
    ],
  },
  {
    table: "treasury_accounts",
    purpose: "الخزائن والحسابات البنكية",
    columns: [
      c("name"),
      c("type"),
      c("currency"),
      c("current_balance", "NUMERIC(18,2)", { default: "0" }),
      c("branch_id", "INTEGER"),
      c("is_main", "INTEGER", { default: "0" }),
      c("parent_id", "INTEGER"),
      c("status"),
      c("company_id", "INTEGER"),
    ],
  },
  {
    table: "hr_annual_increases",
    purpose: "الزيادات السنوية للموظفين",
    columns: [
      c("employee_id", "INTEGER"),
      c("years_of_service", "INTEGER", { default: "1" }),
      c("hire_date", "DATE"),
      c("due_date", "DATE"),
      c("old_salary", "NUMERIC(12,2)", { default: "0" }),
      c("increase_pct", "NUMERIC(5,2)", { default: "10.00" }),
      c("increase_amount", "NUMERIC(12,2)", { default: "0" }),
      c("new_salary", "NUMERIC(12,2)", { default: "0" }),
      c("status", "TEXT", { default: "'pending'" }),
      c("approved_by"),
      c("approved_at", "TIMESTAMP"),
      c("approval_notes", "TEXT"),
      c("created_at", "TIMESTAMP", { default: "CURRENT_TIMESTAMP" }),
    ],
  },
];

/**
 * حارس أرصدة المخزون
 * ────────────────────────────────────────────────────────────────────────────
 * عمود `inventory_items.available` قيمة مُشتقة (quantity - reserved) ومخزَّنة.
 * أي مسار بيكتب الكمية بدون ما يحدّث `available` بيخلّي المخزن يبان فاضي،
 * وبيخلي مرتجعات المشتريات تترفض برسالة غلط "تم استهلاك أو بيع كامل الكمية".
 * الدالة دي بتعيد اشتقاق العمود من الأرصدة الحقيقية — idempotent وآمنة.
 */
export async function normalizeInventoryAvailability(): Promise<number> {
  try {
    const result = await pool.query(
      `UPDATE inventory_items
          SET available = GREATEST(COALESCE(quantity, 0) - COALESCE(reserved, 0), 0)
        WHERE available IS DISTINCT FROM GREATEST(COALESCE(quantity, 0) - COALESCE(reserved, 0), 0)`
    );
    return result.rowCount || 0;
  } catch (error: any) {
    console.warn("Inventory availability guard skipped:", error?.message || error);
    return 0;
  }
}

export type SchemaGuardReport = {
  generatedAt: string;
  mode: "fix" | "check";
  ok: boolean;
  totals: {
    tables: number;
    columns: number;
    ok: number;
    added: number;
    missing: number;
    missingTables: number;
  };
  added: { table: string; column: string; type: string }[];
  missing: { table: string; column: string; type: string; reason: string }[];
  missingTables: { table: string; purpose: string }[];
  tables: { table: string; purpose: string; required: number; present: number }[];
};

let lastReport: SchemaGuardReport | null = null;

export async function runSchemaGuard(options: { fix?: boolean } = {}): Promise<SchemaGuardReport> {
  const fix = options.fix !== false;
  const tableNames = SCHEMA_CONTRACTS.map((contract) => contract.table);

  const columnsResult = await pool.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [tableNames]
  );

  const columnsByTable = new Map<string, Set<string>>();
  for (const row of columnsResult.rows as { table_name: string; column_name: string }[]) {
    const existing = columnsByTable.get(row.table_name) || new Set<string>();
    existing.add(row.column_name);
    columnsByTable.set(row.table_name, existing);
  }

  const added: SchemaGuardReport["added"] = [];
  const missing: SchemaGuardReport["missing"] = [];
  const missingTables: SchemaGuardReport["missingTables"] = [];
  const tables: SchemaGuardReport["tables"] = [];
  let okCount = 0;

  for (const contract of SCHEMA_CONTRACTS) {
    const existingColumns = columnsByTable.get(contract.table);
    if (!existingColumns) {
      missingTables.push({ table: contract.table, purpose: contract.purpose });
      tables.push({ table: contract.table, purpose: contract.purpose, required: contract.columns.length, present: 0 });
      continue;
    }

    let presentCount = 0;
    for (const column of contract.columns) {
      if (existingColumns.has(column.column)) {
        presentCount++;
        okCount++;
        continue;
      }

      if (!fix) {
        missing.push({
          table: contract.table,
          column: column.column,
          type: column.type,
          reason: column.note || "العمود غير موجود ولم يتم الإصلاح (وضع الفحص فقط)",
        });
        continue;
      }

      try {
        const defaultClause = column.default !== undefined ? ` DEFAULT ${column.default}` : "";
        await pool.query(
          `ALTER TABLE "${contract.table}" ADD COLUMN IF NOT EXISTS "${column.column}" ${column.type}${defaultClause}`
        );
        existingColumns.add(column.column);
        presentCount++;
        okCount++;
        added.push({ table: contract.table, column: column.column, type: column.type });
      } catch (error: any) {
        missing.push({
          table: contract.table,
          column: column.column,
          type: column.type,
          reason: error?.message || "فشل إضافة العمود",
        });
      }
    }

    tables.push({
      table: contract.table,
      purpose: contract.purpose,
      required: contract.columns.length,
      present: presentCount,
    });
  }

  const report: SchemaGuardReport = {
    generatedAt: new Date().toISOString(),
    mode: fix ? "fix" : "check",
    ok: missing.length === 0 && missingTables.length === 0,
    totals: {
      tables: SCHEMA_CONTRACTS.length,
      columns: SCHEMA_CONTRACTS.reduce((sum, contract) => sum + contract.columns.length, 0),
      ok: okCount,
      added: added.length,
      missing: missing.length,
      missingTables: missingTables.length,
    },
    added,
    missing,
    missingTables,
    tables,
  };

  lastReport = report;
  return report;
}

export function getLastSchemaGuardReport(): SchemaGuardReport | null {
  return lastReport;
}

/** Human-readable failure summary used by the boot check and the CLI. */
export function formatSchemaGuardFailures(report: SchemaGuardReport): string {
  const lines: string[] = [];
  for (const table of report.missingTables) {
    lines.push(`  • جدول ناقص: ${table.table} — ${table.purpose}`);
  }
  for (const column of report.missing) {
    lines.push(`  • عمود ناقص: ${column.table}.${column.column} (${column.type}) — ${column.reason}`);
  }
  return lines.join("\n");
}
