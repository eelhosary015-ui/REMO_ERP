# REMO PRO ERP TEST REPORT

**Date:** 2026-10-05  
**Verdict:** FAIL  
**Scope:** Live local PostgreSQL + running API + selected browser checks. No application code was modified and no existing user rows were deleted.

## 1. Environment

- Backend: Node.js/Express, started by `npm run dev` (`tsx server.ts`), local API on port 3000.
- Frontend: React/TypeScript/Vite; opened at `http://127.0.0.1:3000/`.
- Node.js: `v24.11.1`; npm: `11.6.2`; PostgreSQL: `18.3`.
- Database: `erp_system1`, PostgreSQL on `127.0.0.1`, schema `public`; `NODE_ENV=development`.
- `psql` is not installed. The project's `pg` driver was used for direct SQL verification; no credentials are included here.
- `npm run lint -- --pretty false`: passed (exit 0). `package.json` has no test script.
- The server reports a `database=connected` health value, but that value is hard-coded; connection status was verified independently with PostgreSQL.
- The browser rendered the login page. Full UI workflow was blocked because no login credentials were supplied. Browser console also showed an unauthenticated 401 and Service Worker registration failing because `/sw.js` returned HTML.

## 2. Architecture and Database

- `server.ts` bootstraps the Express server, database initialization, enterprise migrations, V2 module router, and legacy API routers.
- Backend modules use route/controller/service/repository layers where wired; legacy routes also query PostgreSQL directly. `server-db.ts` provides the shared `pg` pool and an offline fallback.
- Frontend is under `src/`; database bootstrap/schema code is in `server-db-init.ts`, `src/db/schema.ts`, and migrations under `migrations/` plus module migration services.
- Accounting: `modules/accounts`, `modules/accounting`; inventory: `modules/warehouses`; purchases/suppliers: `modules/purchases`; production: `modules/production`; sales: `modules/sales`; POS: `modules/restaurant`; costing: `modules/costs`; HR: `modules/hr`; payroll: `modules/payroll`; reports: `modules/reports`.
- PostgreSQL contains the tested relational entities and foreign keys across suppliers, purchase requests/orders, goods receipts, products/ingredients, warehouses/inventory, production BOM/orders, sales/POS, journals/accounts, treasury, employees/attendance, and payroll.
- `modules/warehouses/routes/warehouse.routes.ts` contains an inventory route, but the warehouse module router is commented out in `modules/index.ts`; the tested V2 and legacy warehouse inventory URLs both returned 404.
- Existing E2E test files were not run: `tests/erp.e2e.integration.test.ts` deletes test records in cleanup, while `tests/erp-e2e-integration.test.ts` mutates `backups/offline-db.json`. Both conflict with the no-delete/no-offline-mock constraints.

## 3. Test Statistics

| Result | Count |
|---|---:|
| PASS | 17 |
| FAIL | 8 |
| PARTIAL / WARNING | 7 |
| BLOCKED | 2 |
| **Total grouped scenarios** | **34** |

Counts group related API, service, and PostgreSQL assertions into workflow scenarios. The full UI E2E and global payroll generation/payment remain blocked, not passed.

## 4. Persistent Test Dataset

No `TEST-ERP-` master records existed before this run. Created records are intentionally retained for inspection; no cleanup or deletion was performed.

- Company `TEST-ERP-COMPANY`: ID 1.
- Branch `TEST-ERP-BRANCH-001`: ID 9; API created warehouses 23/24 and safe 8 (opening balance 0).
- Warehouses: `TEST-ERP-RAW-WH` ID 23; `TEST-ERP-FINISHED-WH` ID 24.
- Treasury account `TEST-ERP-TREASURY`: ID 2, branch 9, opening/current balance 0.
- Supplier `TEST-ERP-SUPPLIER-001`: ID 39.
- Raw materials: mango ID 184, sugar ID 185, bottle ID 186, label ID 187.
- Shared finished product `TEST-ERP-MANGO-JUICE`: product ID 306; linked inventory ingredient ID 188.
- Customer `TEST-ERP-CUSTOMER-001`: ID 21.
- Employees `TEST-ERP-EMP-001/002/003`: IDs 83/84/85.
- Purchase request ID 67, PO ID 80, first GRN ID 79 (7,500 EGP), second GRN ID 80 (6,000 EGP), generated purchase invoice ID 71.
- BOM `TEST-ERP-BOM-001`; production order ID 29; production run ID 21.
- Sales order `TEST-ERP-SO-001`: ID 10, total 1,200 EGP; linked delivery note ID 8 remains draft.
- POS shift ID 3 was opened on the test account, then closed with zero variance. No POS order was posted.

## 5. Scenario Results

| Scenario | Result | Evidence |
|---|---|---|
| Live PostgreSQL connection and schema inspection | PASS | Direct `pg` connection to `erp_system1`; business tables and foreign keys read. |
| Company validation/create | PASS | Invalid payload returned 400 with no row; `TEST-ERP-COMPANY` persisted through V2 API. |
| Branch, warehouses, and safe creation | PARTIAL | Branch API created two warehouses and zero-balance safe, but `branches.company_id` remained NULL. |
| Supplier create and duplicate prevention | PASS | Supplier persisted; duplicate name/tax number returned 409; exactly one supplier row. |
| Materials and shared sale product | PASS | Four raw material records persisted; product 306 links to ingredient 188 and is enabled for POS/sales. |
| Customer creation | PARTIAL | Legacy `/api/customers` returned 500 (`customers.notes` does not exist); `/api/v2/customers` succeeded and persisted customer 21. |
| Zero-quantity purchase negative case | FAIL | API returned 500 instead of a validation 4xx; transaction rolled back and no request row persisted. |
| Purchase request → purchase order | PASS | PR total 7,500 EGP; PO linked to supplier, branch, warehouse, and four correct lines. |
| Purchase request/approval idempotency | PASS | Repeating the same idempotency key returned the same PR; repeating approval returned the same PO. |
| First GRN with `auto_post=true` | FAIL | 7,500 EGP entered stock/cost ledger, but no purchase invoice, supplier transaction, supplier balance, or journal entry was created. |
| Second purchase and average cost | PASS | Mango moved from 100 kg @ 50 to 200 kg @ 55 after a 100 kg @ 60 receipt. |
| Explicit second GRN post | PARTIAL | Stock, purchase invoice, supplier balance, cost ledger, and a balanced JE were created; JE accounts were incorrect. |
| Duplicate GRN post | PASS | Retry returned 400 “already posted”; stock, journal ID, and balances were unchanged. |
| BOM creation | PASS | BOM persisted for product 306 with the four required ingredients. |
| Production raw consumption and cost | PASS | 100 units consumed mango 50 kg, sugar 10 kg, bottles 100, labels 100; actual production cost 3,250 EGP (32.50/unit), matching expected. |
| Finished-goods receipt | FAIL | Product header stock became 100, but inventory output was booked as 100 units of raw mango (ingredient 184) at zero cost; finished ingredient 188 had no inventory row. |
| Production GL posting | FAIL | Journal was 3,250/3,250 but debited and credited the same account 1140; `source_id` was NULL. |
| Production re-execution | PASS | Retry rejected completed order; 5 movements and 1 journal remained unchanged. |
| Sales order creation | PASS | Sales order 10 persisted at 20 × 60 = 1,200 EGP for customer 21. |
| Sales delivery/invoice | FAIL | Dispatch returned 500 (`column "stock" does not exist`); delivery remained draft and no sales invoice was created. |
| POS without an open shift | PASS | Returned 409; no order, movement, or cash impact. |
| POS with test shift but insufficient finished stock | FAIL | Returned 500 for sugar shortage instead of a structured stock-validation response; transaction rolled back fully. No order, stock move, treasury transaction, or journal was written. |
| POS report | PASS | Branch 9 report returned zero orders/zero revenue, matching the absence of a posted POS order. |
| POS shift close and retry | PASS | Zero sales produced expected cash 0, actual cash 0, variance 0; second close returned `replayed=true`. |
| Employee creation | PARTIAL | Three employees persisted, but `job_title`, `employee_code`, `company_id`, and `basic_salary` were not populated; only `salary=15000` was saved. |
| Attendance clock-in/out | FAIL | Both v2 calls returned 500: `attendance.date` is NOT NULL but repository insert omits `date`. No attendance rows were created. |
| Payroll bonus/deduction/advance inputs | PASS | Test bonus 500, deduction 150, and advance 200 persisted against employee 83. No payroll record/payment was created. |
| Payroll missing-month validation | PASS | `/api/v2/payroll/calculate` without month returned 400 and left payroll tables unchanged. |
| Payroll generation/disbursement | BLOCKED | Not run: v2 generation deletes unpaid rows for the month and recalculates every employee; it has no test-employee filter. |
| Supplier, purchase, and cost reports | PARTIAL | Purchase API shows only invoice 71/6,000 EGP; cost ledger shows both receipts/13,500 EGP. Supplier statement internally reconciles to 6,000 EGP, excluding the first un-invoiced GRN. |
| Sales/profitability reports | FAIL | Both V2 APIs returned 500 because their repository references `orders.total_amount`; the actual table has `total`. It also references `orders.created_at`, while the tested schema has `timestamp`. |
| Inventory report route | PARTIAL | Tested `/api/warehouses/23/inventory` and `/api/v2/warehouses/23/inventory` returned 404. |
| Existing legacy inventory ledger | WARNING | An older `inventory_transactions` row (2026-09-21, warehouse 8, ingredient “خيط”, reference ID 79) predates test GRN 79 and collides with its reference ID; no trigger or current test write created it. Root cause not established. |
| Trial balance | PARTIAL | Trial-balance API reports period debits=credits at 800,305.52, but closing debit=694,353 vs closing credit=694,633 (280 EGP difference). The two test JEs themselves balance at 9,250 total. System-wide baseline before test was not captured. |
| Full authenticated UI and supplied E2E suite | BLOCKED | Browser reached login page; no credentials were supplied. Existing suites were not run because their cleanup deletes data or mutates offline mock storage. |

## 6. Integration Matrix

| Integration | Result | Finding |
|---|---|---|
| Supplier → Purchase | PARTIAL | PO linked correctly; only the explicitly posted second GRN generated AP invoice/balance. |
| Purchase → Inventory | PASS | Both GRNs updated warehouse stock; cost ledger totals 13,500 EGP. |
| Inventory → Production | PASS for raw issue | Correct material quantities were deducted from raw warehouse. |
| Production → Finished inventory | FAIL | Finished output was assigned to raw mango ingredient 184, not finished ingredient 188. |
| Production → Costing | PASS | 3,250 EGP / 32.50 per unit recorded. |
| Costing → Sales | BLOCKED | Delivery failed before invoice. |
| Sales → COGS | BLOCKED | No delivery/invoice, so no sales COGS posting. Expected 650 EGP for the unposted 20-unit order; actual 0. |
| Sales → Cashbox | BLOCKED | No posted sales transaction. |
| POS → Inventory / COGS / Cashbox | BLOCKED | Stock shortage aborted the POS transaction; no financial side effects. |
| Cashbox → Accounting | NOT EXERCISED | No successful cash sale/payment occurred. |
| Payroll → Cashbox / Accounting | BLOCKED | Payroll disbursement was intentionally not run. |

## 7. Financial Reconciliation

| Measure | Expected from test dataset | Actual in PostgreSQL | Difference / status |
|---|---:|---:|---|
| Purchase receipts / cost ledger | 13,500 EGP | 13,500 EGP | 0 |
| Purchase invoices / supplier balance | 13,500 EGP | 6,000 EGP | -7,500 EGP (first GRN bypassed invoice posting) |
| Mango weighted average | 55.00 EGP/kg | 55.00 EGP/kg | 0 |
| Production cost for 100 units | 3,250 EGP | 3,250 EGP | 0 |
| Raw stock value after production | 10,250 EGP | 10,250 EGP | 0 |
| Finished inventory value after production | 3,250 EGP | 0 in `inventory_items` | -3,250 EGP; quantity incorrectly recorded as mango at zero cost |
| Total test inventory value | 13,500 EGP | 10,250 EGP in `inventory_items` | -3,250 EGP |
| Sales order pipeline value | 1,200 EGP | 1,200 EGP order; 0 invoice | Not posted |
| Sales COGS | 650 EGP expected if delivered | 0 | Not posted |
| POS sale | 600 EGP expected | 0 order/revenue | Rejected before posting |
| Test safe and treasury account | 0 opening + 0 successful receipts | 0 | 0 |
| Payroll expense/payment | Not posted | 0 payroll records | Blocked |
| System Trial Balance period totals | Debits = credits | 800,305.52 = 800,305.52 | Balanced period; closing sides differ by 280 EGP |

## 8. Bugs (Prioritized)

### BUG-ERP-001 — CRITICAL: Database connection string exposed
- **Module/API:** Restaurant legacy route, `GET /api/test-sales`.
- **Reproduction:** Unauthenticated GET on the current development server returned HTTP 200 and a JSON `db` connection URL containing username/password. Secret was redacted from all logs/report output.
- **Expected:** Never return connection credentials; remove the endpoint or return non-secret health metadata behind appropriate access controls.
- **Actual:** Full `process.env.DATABASE_URL` is returned. Global middleware currently permits unauthenticated API access in development; production mode behavior is different, but the route still exposes credentials to any authenticated caller.
- **Root cause/file/function:** Inline test route in [modules/restaurant/restaurant_api.routes.ts](modules/restaurant/restaurant_api.routes.ts), `/api/test-sales` handler.
- **Database objects:** Environment secret; no table.

### BUG-ERP-002 — HIGH: Production output assigned to a raw-material ingredient
- **Module/API:** Production execution, `POST /api/production/orders/:id/execute`.
- **Reproduction:** Execute BOM for product 306 “TEST-ERP-MANGO-JUICE”; inventory output added 100 units to ingredient 184 “TEST-ERP-MANGO” at zero cost. Product header stock became 100 while linked ingredient 188 remained absent from finished warehouse inventory.
- **Expected:** Finished quantity 100 at 32.50/unit in warehouse 24 under product ingredient 188.
- **Actual:** Wrong ingredient/warehouse ledger state; inventory valuation missed 3,250 EGP.
- **Root cause/file/function:** `executeProductionOrder` matches finished ingredient by substring before exact linked product ingredient; [modules/production/repositories/production.repository.ts](modules/production/repositories/production.repository.ts).
- **Database objects:** `products`, `ingredients`, `inventory_items`, `inventory_movements`, `inventory_stock_ledger`, `production_orders`.

### BUG-ERP-003 — HIGH: Goods-receipt auto-post skips AP invoice and accounting
- **Module/API:** Purchasing/inventory, `POST /api/goods-receipts` with `auto_post=true`.
- **Reproduction:** GRN 79 persisted 7,500 EGP as posted and updated inventory/cost transactions.
- **Expected:** Same invoice, supplier liability, and journal integration as the explicit post workflow.
- **Actual:** `purchase_id=NULL`, `journal_entry_id=NULL`, no `purchases` row, no supplier transaction, supplier balance stayed 0.
- **Root cause/file/function:** The direct auto-post branch updates inventory and emits cost integration but bypasses the purchase-invoice/GL code in `/api/goods-receipts/:id/post`; [modules/warehouses/routes/enterprise_inventory.routes.ts](modules/warehouses/routes/enterprise_inventory.routes.ts).
- **Database objects:** `goods_receipts`, `goods_receipt_items`, `inventory_items`, `inventory_transactions`, `purchases`, `supplier_transactions`, `journal_entries`.

### BUG-ERP-004 — HIGH: Goods-receipt journal uses unrelated accounts
- **Module/API:** `POST /api/goods-receipts/80/post`.
- **Reproduction:** Posted second receipt for 6,000 EGP and inspected journal 256.
- **Expected:** Debit inventory asset; credit GRNI/accounts payable.
- **Actual:** Debit account 1150 (employee receivables/advances) and credit 2130 (VAT payable). Debits equal credits, but classification is wrong.
- **Root cause/file/function:** Broad `OR type='asset'/'liability'` account selection with descending ID fallback chooses unrelated leaf accounts; [modules/warehouses/routes/enterprise_inventory.routes.ts](modules/warehouses/routes/enterprise_inventory.routes.ts).
- **Database objects:** `goods_receipts`, `journal_entries`, `journal_items`, `accounts`.

### BUG-ERP-005 — HIGH: Production GL entry posts debit and credit to the same account
- **Module/API:** Production execution and `postProductionEntry`.
- **Reproduction:** Journal 257 for TEST-ERP production has 3,250 debit and 3,250 credit, both account 1140; `source_id` is NULL.
- **Expected:** Debit finished-goods inventory; credit raw-material inventory, linked to the production order.
- **Actual:** No net account reclassification and missing source ID; JE description is the only order link.
- **Root cause/file/function:** Both mappings resolve to inventory asset account 1140; service passes `orderNumber` but not numeric `orderId`; [modules/accounts/services/auto-posting.service.ts](modules/accounts/services/auto-posting.service.ts) and [modules/production/services/production.service.ts](modules/production/services/production.service.ts).
- **Database objects:** `production_orders`, `journal_entries`, `journal_items`, `accounts`.

### BUG-ERP-006 — HIGH: Sales delivery crashes on nonexistent `ingredients.stock`
- **Module/API:** `POST /api/v2/sales/orders/:id/confirm-and-deliver`.
- **Reproduction:** Created sales order 10 (20 × 60 = 1,200 EGP) and attempted dispatch; API returned 500 `column "stock" does not exist`.
- **Expected:** Structured stock-shortage response before dispatch, or successful delivery only when actual warehouse stock exists.
- **Actual:** Draft delivery note 8 remains; no sales invoice, revenue, or COGS.
- **Root cause/file/function:** Delivery item resolver queries `stock` from `ingredients`, but actual schema stores warehouse balances in `inventory_items`; [modules/sales/services/delivery.service.ts](modules/sales/services/delivery.service.ts).
- **Database objects:** `ingredients`, `inventory_items`, `sales_delivery_notes`, `sales_invoices`, `sales_order_items`.

### BUG-ERP-007 — HIGH: Sales and profitability reports use nonexistent order columns
- **Module/API:** `GET /api/v2/reports/sales` and `/api/v2/reports/profitability`.
- **Reproduction:** Both returned HTTP 500 on the test branch; error says `orders.total_amount` does not exist.
- **Expected:** Use the actual `orders.total` and `orders.timestamp` columns, with date/branch filters matching the schema.
- **Actual:** Report repository also uses `orders.created_at`, which is absent in the inspected `orders` schema.
- **Root cause/file/function:** `ReportRepository.getBranchSalesReport` and `getOperationalProfitability`; [modules/reports/repositories/report.repository.ts](modules/reports/repositories/report.repository.ts).
- **Database objects:** `orders`, `branches`, `operating_costs`.

### BUG-ERP-008 — HIGH: Legacy customer creation inserts nonexistent `notes`
- **Module/API:** `POST /api/customers`.
- **Reproduction:** Customer creation returned 500 `column "notes" of relation "customers" does not exist`; no row persisted. V2 customer service succeeded.
- **Expected:** Insert only columns present in the live customers schema or migrate the schema intentionally.
- **Actual:** Legacy handler writes `notes`, absent from `customers`.
- **Root cause/file/function:** Inline customer route; [modules/restaurant/restaurant_api.routes.ts](modules/restaurant/restaurant_api.routes.ts).
- **Database objects:** `customers`.

### BUG-ERP-009 — HIGH: Attendance service omits required date
- **Module/API:** `POST /api/v2/hr/employees/attendance`.
- **Reproduction:** Clock-in and clock-out both return 500: `null value in column "date" of relation "attendance" violates not-null constraint`.
- **Expected:** Persist an attendance date and the corresponding check-in/out timestamp/action.
- **Actual:** No attendance row is created.
- **Root cause/file/function:** `EmployeeRepository.clockInOut` inserts only `employee_id`, `action_type`, and `notes`; [modules/hr/repositories/employee.repository.ts](modules/hr/repositories/employee.repository.ts).
- **Database objects:** `attendance`, `employees`.

### BUG-ERP-010 — HIGH: Payroll generation is global/destructive and reads mismatched salary fields
- **Module/API:** `POST /api/v2/payroll/calculate` and downstream disbursement.
- **Reproduction:** Not run; safe test is impossible because calculation deletes every unpaid row for the month and re-generates rows for all employees. Test employees have `salary=15000` but `basic_salary=NULL`; read-only payroll report returns net 0.
- **Expected:** Scope calculation to a selected company/branch/test employee set, preserve prior records, and use the canonical salary field.
- **Actual:** `generatePayrollForMonth` deletes the month's unpaid payroll records, selects all employees, and calculates from `basic_salary`. It reads `employee_bonuses`/`employee_deductions`, while the tested legacy bonus/deduction APIs write `payroll_bonuses`/`payroll_deductions`.
- **Root cause/file/function:** [modules/payroll/repositories/payroll.repository.ts](modules/payroll/repositories/payroll.repository.ts); employee writes are in [modules/hr/repositories/employee.repository.ts](modules/hr/repositories/employee.repository.ts).
- **Database objects:** `employees`, `payroll_records`, `employee_advances`, `employee_bonuses`, `employee_deductions`, `payroll_bonuses`, `payroll_deductions`.

### BUG-ERP-011 — MEDIUM: Zero-quantity purchase request returns 500
- **Module/API:** `POST /api/purchase-requests`.
- **Reproduction:** A zero-quantity line was rejected and rolled back, but returned HTTP 500 instead of a 4xx validation response.
- **Expected:** 400/422 with a clear validation message.
- **Actual:** 500 with the quantity error; no purchase request row persisted.
- **Root cause/file/function:** Validation exception reaches the generic catch; [modules/purchases/suppliers_api.routes.ts](modules/purchases/suppliers_api.routes.ts).
- **Database objects:** `purchase_requests`, `purchase_request_items`.

### BUG-ERP-012 — MEDIUM: Employee and branch APIs silently drop enterprise fields
- **Module/API:** `POST /api/v2/hr/employees`, `POST /api/branches`.
- **Reproduction:** Test employee payload included `job_title`, `employee_code`, `company_id`; returned rows had NULL for all three. Branch creation likewise left `company_id=NULL` despite company 1 existing.
- **Expected:** Persist supplied company/branch/position/code relationships.
- **Actual:** Employee repository inserts only name, role, phone, salary, branch; branch route inserts only name and table count.
- **Root cause/file/function:** [modules/hr/repositories/employee.repository.ts](modules/hr/repositories/employee.repository.ts), [modules/restaurant/restaurant_api.routes.ts](modules/restaurant/restaurant_api.routes.ts).
- **Database objects:** `employees`, `branches`, `companies`, `warehouses`, `safes`.

### BUG-ERP-013 — MEDIUM: POS stock shortage is returned as HTTP 500
- **Module/API:** `POST /api/pos/order` with an open shift and insufficient stock.
- **Reproduction:** Test sale was rejected for missing sugar; response was 500. PostgreSQL confirms full rollback: no order, inventory movement, journal, or treasury transaction; balances stayed zero.
- **Expected:** 409/422 business validation response while retaining rollback safety.
- **Actual:** Internal stock exception surfaced as generic 500.
- **Root cause/file/function:** POS handler catches `moveStock` shortage as a generic server error; [modules/restaurant/restaurant_api.routes.ts](modules/restaurant/restaurant_api.routes.ts) and [modules/warehouses/services/inventory.service.ts](modules/warehouses/services/inventory.service.ts).
- **Database objects:** `orders`, `order_items`, `inventory_items`, `inventory_movements`, `treasury_transactions`, `journal_entries`.

### BUG-ERP-014 — MEDIUM: Warehouse inventory endpoint is not registered
- **Module/API:** `GET /api/warehouses/:id/inventory` and `GET /api/v2/warehouses/:id/inventory` returned 404.
- **Expected:** Read inventory by warehouse through an active router.
- **Actual:** The implementation exists in a router that is not mounted; warehouse module registration is commented out.
- **Root cause/file/function:** [modules/warehouses/routes/warehouse.routes.ts](modules/warehouses/routes/warehouse.routes.ts), [modules/index.ts](modules/index.ts).
- **Database objects:** `warehouses`, `inventory_items`.

### BUG-ERP-015 — MEDIUM: Health endpoint reports database connected without checking
- **Module/API:** `GET /api/health`.
- **Expected:** Verify the actual PostgreSQL connection or report degraded/offline-fallback state.
- **Actual:** Handler returns `database: "connected"` without querying PostgreSQL; server code separately supports offline fallback.
- **Root cause/file/function:** Health handler in [server.ts](server.ts); fallback/pool state in [server-db.ts](server-db.ts).
- **Database objects:** PostgreSQL connection state.

### BUG-ERP-016 — LOW / DATA WARNING: Existing inventory transaction reference collision
- **Module/API:** Legacy inventory transaction reports for GRN reference 79.
- **Actual:** A row dated 2026-09-21 exists for warehouse 8/ingredient “خيط” with `reference_type='goods_receipt'`, `reference_id='79'`; it predates test GRN 79 on 2026-10-05 and is not the test movement. Root cause not established; retained untouched.
- **Database objects:** `inventory_transactions`, `goods_receipts`.

### BUG-ERP-017 — MEDIUM / SYSTEM WARNING: Trial balance closing sides differ
- **API:** `GET /api/v2/erp-gl/reports/trial-balance-enhanced`.
- **Actual:** Period debit and credit both 800,305.52; closing debit 694,353 vs credit 694,633, a 280 EGP difference. Test JEs themselves are balanced. Pre-test system baseline was not captured, so the source is unknown and this is not attributed to the test dataset.
- **Database objects:** `accounts`, `journal_entries`, `journal_items`.

## 9. Critical Issues

1. **CRITICAL:** `/api/test-sales` returns the full database connection URL, including credentials, in the current development environment. Treat the connection secret as exposed and rotate it if this server is reachable by untrusted users.
2. **HIGH:** Production reports 100 finished units in `products.stock` but books them to raw mango ingredient 184 at zero cost; finished inventory value is missing.
3. **HIGH:** GRN auto-post bypasses AP invoice/GL; explicit GRN posting uses unrelated accounts.
4. **HIGH:** Sales delivery fails on an invalid `ingredients.stock` query; sales/profitability reports fail on invalid `orders` columns.
5. **HIGH:** Attendance and payroll data contracts are inconsistent; employee attendance always fails and test payroll projection is zero.

## 10. Final Verdict

**FAIL.** API-to-PostgreSQL verification was completed for supplier, purchases, inventory, costing, production, sales order, POS safeguards, treasury shift close, HR inputs, payroll inputs, reports, and accounting entries. Several data-level integrations fail despite successful API responses. Sales invoice/COGS, successful POS, cash-sale accounting, payroll calculation/payment, full browser workflow, and some report screens remain blocked by the defects or by operations that would modify unrelated user payroll data.

The persistent `TEST-ERP-` dataset is intentionally left in the database. No production code was changed and no data was deleted.
