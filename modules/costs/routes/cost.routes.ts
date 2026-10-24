import { Router } from "express";
import { costController } from "../controllers/cost.controller.js";

const router = Router();

// Enforce authentication on all cost management operations
router.use((req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: "AUTH_REQUIRED", message: "تسجيل الدخول مطلوب للوصول لعمليات التكاليف" });
  }
  next();
});

// ────────────────── INTEGRATION LOOKUPS ──────────────────
router.get("/integrations/employees", (req, res) => costController.getIntegrationEmployees(req, res));
router.get("/integrations/suppliers", (req, res) => costController.getIntegrationSuppliers(req, res));
router.get("/integrations/customers", (req, res) => costController.getIntegrationCustomers(req, res));
router.get("/integrations/products", (req, res) => costController.getIntegrationProducts(req, res));
router.get("/integrations/ingredients", (req, res) => costController.getIntegrationIngredients(req, res));
router.get("/integrations/warehouses", (req, res) => costController.getIntegrationWarehouses(req, res));
router.get("/integrations/accounts", (req, res) => costController.getIntegrationAccounts(req, res));
router.get("/integration-summary", (req, res) => costController.getIntegrationSummary(req, res));
router.get("/integration-ledger", (req, res) => costController.getIntegrationLedger(req, res));
router.post("/integration/rebuild-purchase/:id", (req, res) => costController.rebuildPurchaseIntegration(req, res));
router.post("/integration/rebuild-production/:orderNumber", (req, res) => costController.rebuildProductionIntegration(req, res));
router.post("/integration/rebuild-all", (req, res) => costController.rebuildAllIntegrations(req, res));
router.get("/dashboard", (req, res) => costController.getOperatingCostDashboard(req, res));
router.post("/allocation/preview", (req, res) => costController.previewCostAllocation(req, res));
router.post("/:id/status", (req, res) => costController.transitionOperatingCost(req, res));
router.get("/:id/audit", (req, res) => costController.getCostAuditTrail(req, res));
router.post("/:id/allocate", (req, res) => costController.allocateOperatingCost(req, res));

// ────────────────── COST CENTERS ──────────────────
router.get(["/centers", "/cost-centers"], (req, res) => costController.listCostCenters(req, res));
router.post(["/centers", "/cost-centers"], (req, res) => costController.createCostCenter(req, res));
router.put("/centers/:id", (req, res) => costController.updateCostCenter(req, res));
router.delete("/centers/:id", (req, res) => costController.deleteCostCenter(req, res));

// ────────────────── OPERATING COSTS ALIAS ──────────────────
router.get("/operating-costs", (req, res) => costController.listCosts(req, res));
router.get("/allocations", (req, res) => costController.getOperatingCostDashboard(req, res));

// ────────────────── COST ITEMS ──────────────────
router.get("/items", (req, res) => costController.listCostItems(req, res));
router.post("/items", (req, res) => costController.createCostItem(req, res));
router.put("/items/:id", (req, res) => costController.updateCostItem(req, res));
router.delete("/items/:id", (req, res) => costController.deleteCostItem(req, res));

// ────────────────── ESTIMATED BUDGETS ──────────────────
router.get("/budgets", (req, res) => costController.listBudgets(req, res));
router.post("/budgets", (req, res) => costController.createBudget(req, res));
router.delete("/budgets/:id", (req, res) => costController.deleteBudget(req, res));

// ────────────────── STANDARD & PRODUCT COSTS ──────────────────
router.get("/standard", (req, res) => costController.getStandardCosts(req, res));
router.post("/standard", (req, res) => costController.saveStandardCosts(req, res));
router.get("/product", (req, res) => costController.getProductCosts(req, res));
router.post("/product", (req, res) => costController.saveProductCosts(req, res));
router.get("/reports/product-costs", (req, res) => costController.getProductCostReport(req, res));
router.get("/recipe-costing/reports", (req, res) => costController.getProductCostReport(req, res));

// ────────────────── SYSTEM SETTINGS ──────────────────
router.get("/settings", (req, res) => costController.getSettings(req, res));
router.post("/settings", (req, res) => costController.saveSettings(req, res));

// ────────────────── RECIPE COSTING & PROFITABILITY ──────────────────
router.get("/recipe-costing/recipes", (req, res) => costController.getRecipeProducts(req, res));
router.get("/recipe-costing/all-ingredients", (req, res) => costController.getAllIngredientsWithCost(req, res));
router.post("/recipe-costing/update-recipe-ingredients", (req, res) => costController.updateRecipeIngredients(req, res));
router.get("/recipe-costing/calculate/:productId", (req, res) => costController.calculateRecipeCost(req, res));
router.post("/recipe-costing/save", (req, res) => costController.saveRecipeCost(req, res));
router.get("/recipe-costing/history/:productId", (req, res) => costController.getRecipeCostHistory(req, res));

// ────────────────── ACTIVITY LOGS ──────────────────
router.get("/activity-logs", (req, res) => costController.getActivityLogs(req, res));
router.post("/activity-logs", (req, res) => costController.logActivity(req, res));

// ────────────────── OPERATING COSTS ACTIONS ──────────────────
router.post("/:id/post", (req, res) => costController.postCostToLedger(req, res));
router.post("/:id/approve", (req, res) => costController.approveCost(req, res));
router.post("/:id/cancel", (req, res) => costController.cancelCost(req, res));

// ────────────────── BATCH / SYSTEM ──────────────────
router.delete("/clear-all-data", (req, res) => costController.clearAllData(req, res));

// ────────────────── OPERATING COSTS CRUD ──────────────────
router.get("/", (req, res) => costController.listCosts(req, res));
router.get("/:id", (req, res) => costController.getCost(req, res));
router.post("/", (req, res) => costController.createCost(req, res));
router.put("/:id", (req, res) => costController.updateCost(req, res));
router.delete("/:id", (req, res) => costController.deleteCost(req, res));

export default router;
