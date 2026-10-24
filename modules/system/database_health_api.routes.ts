import { Router } from "express";
import { pool } from "../../server-db.js";
import { authenticateToken } from "./system_api.routes.js";

const router = Router();

async function tableExists(table: string) {
  const result = await pool.query("SELECT to_regclass($1) AS table_name", [`public.${table}`]);
  return Boolean(result.rows[0]?.table_name);
}

async function columnExists(table: string, column: string) {
  const result = await pool.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2",
    [table, column]
  );
  return result.rowCount === 1;
}

async function orphanCount(table: string, childColumn: string, parentTable: string, parentColumn = "id") {
  if (!(await tableExists(table)) || !(await tableExists(parentTable))) return null;
  if (!(await columnExists(table, childColumn)) || !(await columnExists(parentTable, parentColumn))) return null;
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM "${table}" c LEFT JOIN "${parentTable}" p ON c."${childColumn}" = p."${parentColumn}" WHERE c."${childColumn}" IS NOT NULL AND p."${parentColumn}" IS NULL`
  );
  return Number(result.rows[0]?.count || 0);
}

router.get("/api/enterprise/db-health", authenticateToken, async (req: any, res) => {
  const role = String(req.user?.role || "").toLowerCase();
  if (!['admin', 'super_admin', 'owner'].includes(role)) {
    return res.status(403).json({ error: "FORBIDDEN", message: "هذا الفحص متاح لمدير النظام فقط" });
  }

  try {
    const checks = [
      ["order_items.order_id -> orders.id", "order_items", "order_id", "orders"],
      ["order_items.product_id -> products.id", "order_items", "product_id", "products"],
      ["inventory_items.warehouse_id -> warehouses.id", "inventory_items", "warehouse_id", "warehouses"],
      ["inventory_items.ingredient_id -> ingredients.id", "inventory_items", "ingredient_id", "ingredients"],
      ["inventory_transactions.warehouse_id -> warehouses.id", "inventory_transactions", "warehouse_id", "warehouses"],
      ["inventory_transactions.ingredient_id -> ingredients.id", "inventory_transactions", "ingredient_id", "ingredients"],
      ["purchase_orders.supplier_id -> suppliers.id", "purchase_orders", "supplier_id", "suppliers"],
      ["employees.branch_id -> branches.id", "employees", "branch_id", "branches"],
      ["orders.branch_id -> branches.id", "orders", "branch_id", "branches"],
      ["treasury_transactions.account_id -> treasury_accounts.id", "treasury_transactions", "account_id", "treasury_accounts"],
      ["safe_transactions.safe_id -> safes.id", "safe_transactions", "safe_id", "safes"],
      ["attendance.employee_id -> employees.id", "attendance", "employee_id", "employees"],
    ] as const;

    const relations = [];
    for (const [name, table, childColumn, parentTable] of checks) {
      relations.push({ name, orphan_rows: await orphanCount(table, childColumn, parentTable) });
    }

    const requiredTables = ["users", "branches", "products", "orders", "customers", "suppliers", "employees", "warehouses", "inventory_items", "inventory_transactions", "accounts", "journal_entries", "treasury_accounts", "treasury_transactions"];
    const tableStatus: Record<string, boolean> = {};
    for (const table of requiredTables) tableStatus[table] = await tableExists(table);

    const missingTables = requiredTables.filter(t => !tableStatus[t]);
    const brokenRelations = relations.filter(r => r.orphan_rows !== null && r.orphan_rows > 0);
    const status = missingTables.length || brokenRelations.length ? "attention_required" : "healthy";

    res.json({
      status,
      generated_at: new Date().toISOString(),
      tables: tableStatus,
      missing_tables: missingTables,
      relations,
      broken_relations: brokenRelations,
      note: "هذا الفحص قراءة فقط ولا يحذف أو يعدل أي بيانات."
    });
  } catch (error: any) {
    console.error("Database health check failed:", error);
    res.status(500).json({ error: "DB_HEALTH_FAILED", message: "تعذر تنفيذ فحص سلامة قاعدة البيانات" });
  }
});

export default router;
