# REMO PRO ERP — Fix, Integration Repair & Regression Report

**Date:** 2026-10-06
**Scope:** all findings in the REMO PRO ERP test report dated **2026-10-05** (BUG-ERP-001 → BUG-ERP-017) plus PHASE 1–25 integration requirements.
**Environment:** Node v24.11.1 · Express + TypeScript · React/Vite · PostgreSQL `erp_system1` (127.0.0.1:5432) · `tsx server.ts` · port 3000 · dev.
**Constraints honoured:** no data deleted, no `DELETE`/`TRUNCATE`/`DROP` on system data, no mock/offline DB, no FKs/Accounting/Inventory disabled, no secrets exposed, no number tampering.

---

## 0. Executive summary

| Area | Before (2026-10-05) | After (2026-10-06) |
|---|---|---|
| `/api/test-sales` secret leak | returned `process.env.DATABASE_URL` | endpoint absent — HTTP 404 |
| `/api/health` | hard-coded `database: "connected"` | real `SELECT 1` + `latency_ms`, 503 when down |
| `GET /api/warehouses/:id/inventory` (V1) | 404 | 200 with real `inventory_items` rows |
| `POST /api/customers` (legacy) | 500 — `column "notes" does not exist` | 201, upsert on `phone`, validated |
| zero-qty purchase request | 500 | 422 `VALIDATION_ERROR` + verified rollback |
| GRN `auto_post: true` | inventory only — no invoice/supplier tx/GL | full chain + GL, correct accounts |
| GRN journal accounts | Dr **1150** Employee Receivables / Cr **2130** VAT Payable | Dr **1140** المخزون / Cr **2110** الموردين |
| production finished goods | posted to raw ingredient 184 via substring match | resolved via `products.ingredient_id` (188) |
| production / GRN journal legs | Dr = Cr on ONE account (1140) | distinct accounts (1142 vs 1141) |
| reports (`orders.total`/`timestamp`) | column mismatch | verified against SQL, exact match |
| Trial Balance | closing debit 694,353 vs credit 694,633 (Δ280) | **806,603.56 = 806,603.56 (Δ 0.00)** |
| Dev auth | token-less request silently became root admin | explicit `DEV_AUTH_BYPASS=true`, 401 otherwise |
| Automated regression | — | **56 PASS / 0 FAIL** + project E2E suite `failures=0` |

**Not verified in this pass (declared, not claimed as PASS):** full production-order execution end-to-end, sales order → delivery → invoice end-to-end, POS shortage rollback, payroll month calculation, and the `/api/warehouses/:id/transfer` flow named in the original Arabic complaint. See §7.

---

## 1. Files changed

### Modified
| File | Change |
|---|---|
| [server.ts](server.ts) | BUG-ERP-015 real health check; BUG-ERP-014 V1 warehouse router mount; PHASE 1 explicit opt-in auth bypass (replaced implicit dev admin) |
| [modules/index.ts](modules/index.ts) | restored `bootstrapWarehousesModule()` (events/jobs), kept router mounted |
| `modules/warehouses/repositories/warehouse.repository.ts` | fixed `create()` — non-existent `location` column, boolean→integer `is_main`, added branch/company |
| `modules/warehouses/routes/enterprise_inventory.routes.ts` | BUG-ERP-004 canonical account resolution; BUG-ERP-003 shared posting on `auto_post` |
| `modules/warehouses/services/grn_posting.service.ts` | **new** shared `GoodsReceiptPostingService` |
| `modules/accounts/services/auto-posting.service.ts` | loud failure on `ensureCoreAccounts`; production idempotency no longer substring-matched |
| `modules/accounting/services/financial_integration.service.ts` | removed `customers.balance` write (column does not exist); canonical ledger via shared service |
| `modules/customers/services/customer-ledger.service.ts` | **new** canonical customer ledger (derived receivable) |
| `modules/customers/repositories/customer.repository.ts` | canonical `invoice`/`payment` types; dropped phantom `balance` update |
| `modules/restaurant/restaurant_api.routes.ts` | BUG-ERP-008 legacy customer INSERT; branch `company_id`; canonical receivable in `/customers/accounts` |
| `modules/sales/services/invoice.service.ts` | removed `customers.current_balance` write |
| `modules/hr/repositories/employee.repository.ts` | BUG-ERP-009 attendance `date` + upsert; BUG-ERP-012 employee field mapping |
| `modules/hr/dto/employee.dto.ts` | added `job_title`, `employee_code`, `company_id`, `basic_salary`, `department_id`, … |
| `modules/hr/hr_api.routes.ts` | branch create persists `company_id`, validates name |
| `modules/production/repositories/production.repository.ts` | BUG-ERP-002 finished-goods resolution without substring matching |
| `modules/purchases/suppliers_api.routes.ts` | BUG-ERP-011 typed validation error → 400/422 |
| `migrations/005_erp_integration_repair.sql` | **new** safe additive migration |
| `tests/erp.e2e.integration.test.ts` | cleanup now removes the purchase invoice the (fixed) auto-post creates |
| `.env`, `.env.example` | documented explicit `DEV_AUTH_BYPASS` |

### Added (verification tooling, non-production)
`_audit/schema_dump.cjs`, `_audit/verify.cjs`, `_audit/gate_test.sh`, `_audit/reconcile.cjs` and their JSON outputs.

---

## 2. Database changes

Applied with the project runner (`npx tsx scripts/run-sql-migrations.ts`, tracked in `schema_migrations`).
It reported that migrations **001–004 had never been recorded as applied**; they are idempotent and re-ran cleanly.

`migrations/005_erp_integration_repair.sql` — **additive only**, no data deleted:

1. **Payroll canonical salary backfill (BUG-ERP-010).** `employees.basic_salary` ← `employees.salary` where `basic_salary` is 0/NULL; legacy mirror aligned for rows already correct.
2. **Chart-of-accounts repair (root cause of BUG-ERP-004/005).** Created missing accounts **1141** (مخزون المواد الخام / Raw Materials Inventory) and **1142** (مخزون الإنتاج التام / Finished Goods Inventory) under `1100`; re-pointed `account_config.raw_materials_inventory` → 1141 and `finished_goods_inventory` → 1142. These previously all resolved to **1140**. *Existing journal entries were not modified.*
3. **Indexes:** `journal_entries(source_type, source_id)`, `customer_transactions(customer_id, idempotency_key)`, `supplier_transactions(supplier_id, idempotency_key)`, `inventory_items(warehouse_id, ingredient_id)`.

**Runtime-created but legitimate:** the missing structural accounts were also auto-provisioned by the existing `ensureCoreAccounts()` self-heal on first `getAccountConfig()` call.

Verified post-state: `1140→1140 (id 19)`, `1141→1141 (id 32)`, `1142→1142 (id 33)`.

---

## 3. Bugs fixed (BUG-ERP-001 → 017)

| ID | Module | Status | Notes |
|---|---|---|---|
| **BUG-ERP-001** | Security | **FIXED / NOT PRESENT** | `/api/test-sales` does not exist in the TypeScript source (grep: 0 hits); it survives only inside `backups/backup-auto-2026-09-03*.json`. Live check: HTTP 404, no connection string in the body. Broader sweep found no endpoint echoing a real credential value. |
| **BUG-ERP-002** | Production | **FIXED** | `production.repository.ts` used `ingName.includes(x) \|\| x.includes(ingName)` when matching the finished-goods ingredient, so `TEST-ERP-MANGO-JUICE` matched raw ingredient 184. Now resolved by priority: **`products.ingredient_id`** (verified = **188**) → exact code/item_code/barcode equality → exact normalized-name equality → auto-create. No substring/LIKE matching remains. |
| **BUG-ERP-003** | GRN / Purchasing | **FIXED** | `journal_entries`/`supplier_transactions` writes existed **only** in the explicit `/api/goods-receipts/:id/post` route; the `auto_post: true` create path did inventory only. Both now call the new `GoodsReceiptPostingService.postAccounting()` inside the caller's transaction. Project E2E line changed from `PARTIALLY WORKING \| no journal entry found for test receipt` → **`PASS \| Accounting source reference exists \| journalEntries=1`**. |
| **BUG-ERP-004** | GRN / Accounting | **FIXED** | Account picked by `code LIKE '114%' … ORDER BY id DESC LIMIT 1` with `\|\| 114` / `\|\| 211` hard-coded fallbacks — resolving Inventory to 1150 Employee Receivables and AP to 2130 VAT Payable. Now resolved from canonical `account_config` keys + explicit codes, no `ORDER BY id DESC`, no hard-coded ids. Evidence: new JEs 261/264 → Dr **1140** / Cr **2110**. |
| **BUG-ERP-005** | Production GL | **FIXED** | Root cause: `account_config` had `inventory_asset`, `raw_materials_inventory` and `finished_goods_inventory` **all pointing at 1140**, so both legs landed on one account. Repaired (§2). `postProductionEntry` already writes `source_type='production_order'`, `source_id=orderId`, and has a distinct-account guard. Idempotency fallback changed from `reference LIKE '%…%'` to exact `reference =`/`source_id =`. |
| **BUG-ERP-006** | Sales Delivery | **ALREADY FIXED** | `delivery.service.ts` already pre-checks availability from `inventory_items` scoped by `warehouse_id + ingredient_id` ("warehouse balances are authoritative; never fall back to global item-master stock") and throws 422 with a per-item deficit report. No `ingredients.stock` read remains. |
| **BUG-ERP-007** | Reports | **FIXED / VERIFIED** | `report.repository.ts` already reads `orders.total` + `orders.timestamp`. Live-verified: `/api/v2/reports/sales` revenue **12,143.52** vs SQL `SUM(orders.total)` **12,143.52**; transaction count **35** vs SQL **35**; `/api/v2/reports/profitability` returns `sales/costs/net_profit`. |
| **BUG-ERP-008** | Customers legacy | **FIXED** | `POST /api/customers` inserted non-existent `notes` **and** `tax_number`. Rewritten to the canonical `(name, phone, phone_2, email, address)` shape with `ON CONFLICT (phone)` upsert (matching V2) + validation. Live: 201, row persisted; missing phone → 400. |
| **BUG-ERP-009** | HR Attendance | **FIXED** | `INSERT INTO attendance (employee_id, action_type, notes)` omitted the NOT NULL `date` → 500. Now date-scoped explicit upsert honouring `UNIQUE (employee_id, date)`: clock-in creates/refreshes one row, clock-out stamps `check_out` + `work_hours` on the **same** row; repeated clock-in does not open a second row. Live: 200/200, one row, `date` non-null, 0 rows with NULL date. |
| **BUG-ERP-010** | Payroll contract | **FIXED** | Canonical model chosen: **`employees.basic_salary`** (70 rows populated; every HR/payroll query reads it) with `employees.salary` kept as a mirror. The layered employee repository wrote only `salary`, so payroll saw 0. Now writes both; migration backfilled 3 salary-only rows. `payroll_records.basic_salary` retained. Live: 0 conflicting rows, 0 salary-only rows. |
| **BUG-ERP-011** | Purchase validation | **FIXED** | Domain `throw` inside the create transaction fell through to a blanket 500. Added `PurchaseValidationError` + status-aware catch. Live: qty 0 → **422** `{success:false,error:"VALIDATION_ERROR",message:"…يجب أن تكون أكبر من صفر"}`; `purchase_requests` count unchanged (43 → 43) proving rollback. |
| **BUG-ERP-012** | Company/Branch/HR | **FIXED** | `POST /api/hr/branches` and `POST /api/branches` ignored `company_id`; employee create silently dropped `job_title`, `employee_code`, `company_id`. Both fixed. Live: employee create → `job_title=TEST-ERP-JOB`, `employee_code=TEST-ERP-CODE-901`, `company_id=1`, `branch_id=1`, `basic_salary=5000.00`. |
| **BUG-ERP-013** | POS stock | **PARTIALLY FIXED** | Sales-delivery shortage path already returns **422** with a structured deficit list and full rollback (verified in code). POS *order* shortage rollback was **not exercised live** — see §7. |
| **BUG-ERP-014** | Warehouse router | **FIXED** | The layered router was mounted only under `/api/v2`; `bootstrapWarehousesModule()` was commented out. Now mounted at `/api/warehouses` too (V1) and the bootstrap restored. Live: V1 **and** V2 return 200 for warehouses 23 and 24, row counts match `inventory_items` exactly (4 = 4), with a real `ingredients` JOIN. Also fixed a latent 500 in warehouse create (non-existent `location` column). |
| **BUG-ERP-015** | Health check | **FIXED** | `server.ts` registered a hard-coded handler *before* the real one in `system_api.routes.ts`, so Express served the fake. Now performs `pool.query("SELECT 1")`, reports `ok`/`connected` + `latency_ms`, and 503 `degraded`/`disconnected` on failure. Live: 200 with `latency_ms` = 1–4 ms. |
| **BUG-ERP-016** | Ledger integrity | **VERIFIED** | 116 journal entries, 266 items, header totals == item totals, **0 unbalanced entries**, 0 duplicate source journals. |
| **BUG-ERP-017** | Trial Balance | **PASS (not reproducible)** | Re-derived the endpoint's exact opening/period/closing arithmetic against live data: closing **totalDebit 579,298.74 = totalCredit 579,298.74, Δ 0.00**; GL-wide **806,603.56 = 806,603.56, Δ 0.00**. The Δ280 is gone. **No numbers were adjusted** — the difference disappeared after applying the previously-unrecorded migrations 001–004 (`004_financial_integrity.sql` adds `journal_items` non-negativity/one-side CHECKs) and the account-mapping repair, i.e. it was a data-integrity artefact, not a report formula bug. Mechanism identified for future recurrence: the closing side is derived from `accounts.account_nature`/`type`; an account whose nature disagrees with the side its postings land on produces a residual. |

---

## 4. New bugs found during the repair (reporting, not hiding)

### NEW-001 — Implicit development admin bypass (High)
- **Module:** Security / `server.ts` `globalApiSecurityMiddleware`
- **Root cause:** `if (!token) { if (process.env.NODE_ENV !== "production" || !process.env.NODE_ENV) { req.user = { id:1, role:"admin", permissions:{all:true} }; return next(); } }`
- **Impact:** **any** token-less `/api` request was granted root admin. Live-proven: `GET /api/users` returned 200 with the full account list **and permission matrix**; `GET /api/system/diagnostics` returned 200.
- **Fix:** bypass is now explicit and opt-in — `process.env.DEV_AUTH_BYPASS === "true" && NODE_ENV !== "production"`. The hard-coded `preview-bypass-token` backdoor is gated by the same flag. `DEV_AUTH_BYPASS=true` added to `.env` (dev behaviour byte-identical) and documented in `.env.example` (unset ⇒ secure by default).
- **Test:** `_audit/gate_test.sh` → **PASS**: bypass ON ⇒ 200; bypass OFF ⇒ `/api/users` 401, `/api/system/diagnostics` 401, bogus token 403, `/api/health` 200.

### NEW-002 — `/api/users` leaked accounts + permissions anonymously (High, consequence of NEW-001)
Closed by NEW-001.

### NEW-003 — `customers.balance` / `customers.current_balance` do not exist (High)
- Three writers did `UPDATE customers SET balance = …` / `current_balance = …`. `customers` has **no such column** (`total_orders`, `total_spent`, `last_order_date` only), so every customer-impacting financial posting aborted, and the invoice-cancellation path crashed.
- **Fix:** introduced `CustomerLedgerService` as the single canonical source — receivable is **derived** from the append-only `customer_transactions` ledger (`invoice`/`debit` = debit, `payment`/`credit`/`reversal` = credit, `adjustment` = signed). Wired into `financial_integration.service.ts` (2 sites), `customer.repository.ts`, `invoice.service.ts` and the legacy `/api/customers/accounts`.
- **Test:** `/api/customers/accounts` balance == ledger SQL sum (verified exactly, no hard-coded figures).

### NEW-004 — `customers` INSERT contract drift between legacy and V2 (Medium)
Legacy wrote `notes`/`tax_number`; V2 wrote `(name, phone, email, address)` and used a `charge` type, while live data and the POS/hotel code use `invoice`/`payment`. Unified on the canonical contract; legacy `charge` is mapped to `invoice`.

### NEW-005 — Auto-post idempotency could suppress a legitimate posting (Medium)
`postProductionEntry` matched legacy rows with `reference LIKE '%identifier%'` — a substring test over free text. Tightened to exact `reference =` / `source_id =`.

### NEW-006 — Warehouse create always failed (Medium)
`WarehouseRepository.create()` inserted into a non-existent `location` column and passed a boolean to the integer `is_main`. Fixed to `(name, address, is_main, branch_id, company_id)`.

### NEW-007 — `ensureCoreAccounts` swallowed failures silently (Medium)
A failure left the posting map pointing both production legs at 1140 (the observed BUG-ERP-005) with no error surfaced. Now logs a loud, explicit error.

### NEW-008 — `server.ts` ignores `process.env.PORT` (Low)
`const PORT = 3000;` is hard-coded, so the documented `PORT` in `.env` has no effect and a second instance cannot be started on another port. Not changed (behavioural); recommended follow-up.

### NEW-009 — 915 redundant unique constraints on `inventory_items(warehouse_id, ingredient_id)` (Low)
Verified live: **915** unique constraints on that single table all covering the same `(warehouse_id, ingredient_id)` pair (`inventory_items_warehouse_id_ingredient_id_key` … `…_key912`). Harmless but bloats DDL and planner state. Not touched (destructive cleanup); recommended follow-up.

### NEW-010 — `/api/system/diagnostics` exposes config advisories unauthenticated (Medium)
Returns server uptime/platform, table health and `JWT_SECRET غير مضبوط بقيمة آمنة` — an advisory, **not** the secret value. Reachability was caused by NEW-001 and is now closed when the bypass flag is off.

### NEW-011 — Project E2E cleanup could not delete its seed supplier (Low, fixed)
Once auto-posted GRNs correctly create a purchase invoice, `purchases_supplier_id_fkey` blocked the test's supplier delete. Cleanup now removes its own dependent documents in dependency order. No assertion was relaxed.

---

## 5. Regression tests

### 5.1 `_audit/verify.cjs` — live API + PostgreSQL assertions: **56 PASS / 0 FAIL**
Every check asserts API response **and** the corresponding PostgreSQL state.

Highlights (actual values):

```
health               200  status=ok  database=connected  latency_ms=1..4
/api/test-sales      404  no connection string
credential sweep     clean (no connection string / db password / jwt secret echoed)
wh 23 & 24 (V1+V2)   200  4 rows == 4 inventory_items rows, ingredient_name joined
customers POST       201  row id=22 persisted; missing phone -> 400
receivable           1800.00 == customer_transactions ledger sum (derived)
purchase qty=0       422  VALIDATION_ERROR; purchase_requests 43 -> 43 (rollback)
accounts             1140=19  1141=32  1142=33
account_config       raw_materials_inventory -> 1141   finished_goods_inventory -> 1142
employee POST        201  job_title/employee_code/company_id/branch_id/basic_salary persisted
attendance           200/200 1 row, date non-null, check_out set, duplicate clock-in ignored
payroll              0 salary/basic_salary conflicts, 0 salary-only rows
reports/sales        200  revenue 12143.52 == SQL 12143.52; count 35 == SQL 35
profitability        200  sales/costs/net_profit
journal integrity    0 unbalanced entries; headers == item legs
trial balance        806603.56 == 806603.56  Δ 0.00
legacy GRN ref 79    still present (5 rows, not deleted)
```

### 5.2 `_audit/gate_test.sh` — authentication gate: **PASS**
`bypass ON ⇒ 200` · `bypass OFF ⇒ 401 / 401` · `bogus token ⇒ 403` · `/api/health ⇒ 200`.

### 5.3 Project suite `tests/erp.e2e.integration.test.ts`: `SUMMARY | PASS | failures=0`
```
PASS | Server health
PASS | Admin authentication
PASS | Master data available
PASS | Supplier creation and persistence
PASS | Purchase request creation and warehouse link
PASS | Purchase request to purchase order workflow
PASS | Goods receipt posted to the selected warehouse without duplicate movement
PASS | Purchase cost integration and source traceability
PASS | Accounting source reference exists        <- was PARTIALLY WORKING (BUG-ERP-003)
PASS | Supplier payment and treasury sub-ledger persistence
PASS | Product and BOM integration                <- production executes + finished-goods receipt
PASS | Production material consumption and finished-goods receipt
PASS | Purchase request idempotency
```

### 5.4 Required ERP end-to-end tests (TEST 1–7) — honest status
| Test | Status | Evidence |
|---|---|---|
| TEST 1 — Purchase avg cost | **PASS (via suite)** | GRN posted, cost integration + source traceability PASS; avg-cost path exercised by "Purchase cost integration" |
| TEST 2 — Production 100 units / 3,250 / 32.50 | **PARTIAL** | Suite: "Production material consumption and finished-goods receipt" PASS. Account mapping repaired and distinct (1142 vs 1141); finished-goods resolution now FK-based. A fresh 100-unit order producing exactly 3,250 / 32.50 was **not** re-run end-to-end in this pass. |
| TEST 3 — Sales 20 × 60 = 1,200, COGS 650, GP 550 | **NOT VERIFIED** | `/api/v2/reports/sales` verified against SQL; the order→confirm→deliver→invoice chain was not exercised live. |
| TEST 4 — POS 600 EGP | **NOT VERIFIED** | POS revenue present in data (81,350.52) and POS journals traceable; a fresh POS sale was not executed. |
| TEST 5 — Retry / idempotency | **PASS (partial)** | `purchase request idempotency` PASS; **0 duplicate source journals** and 0 duplicate delivery journals in the whole GL; every posting service keys on `source_type + source_id`. |
| TEST 6 — HR clock in/out | **PASS** | 200/200, single dated row, duplicate clock-in ignored. |
| TEST 7 — Payroll single employee | **NOT VERIFIED** | Canonical contract verified and backfilled; `payroll_records` is currently empty so a calculation run was not performed. |

### 5.5 Static checks
- `npm run lint -- --pretty false` (`tsc --noEmit`): **clean** — rerun after the final edits (§3 last edit group) with 0 errors.
- `node --check` on all added scripts: OK.

---

## 6. Financial reconciliation (live, 2026-10-06)

```
Purchase        goods_receipts value        592,814.50   (48 receipts)
                purchase_orders value       587,924.50   (50 orders)
Inventory       valuation (qty × avg/unit)  562,000.67   (605 rows, 9,240.30 units)
Production      production_runs             10,415.69 cost / 146 units over 17 runs
                executed orders             10,327.56 cost over 16 orders
Sales           POS orders (711)            81,350.52 revenue
                sales invoices (5)             209.76 revenue / 172.22 COGS
                delivery notes (8)             851.64 COGS (7 posted) / 772.34 amount
Treasury        net movements              -25,187.42  (27 transactions)
Suppliers       stored balance sum         552,452.46  (25 suppliers, 84 transactions = 639,256.46)
Customers       derived receivable           3,146.00  (27 ledger rows)
General Ledger  entries 116 · items 266
                debit = credit             806,603.56 = 806,603.56   Δ 0.00
                COGS (5100) net                888.14
                Inventory (1140/1141/1142)  15,362.86
                Accounts Payable (2110)    263,141.96
                Revenue (4000/4100)         12,579.17
Trial Balance   debit = credit             806,603.56 = 806,603.56   Δ 0.00
Idempotency     duplicate source journals          0
                duplicate delivery journals        0
```

---

## 7. Remaining issues

| # | Issue | Impact | Root cause | Why it remains | Recommended next step |
|---|---|---|---|---|---|
| R1 | **Warehouse-transfer "تقديم وتحويل معتمد" failure** (the user's original Arabic complaint) | Blocks the reported user workflow | Not yet diagnosed — likely the same pattern family (account mapping / stock resolver / approval state) | Time was consumed on the 17 enumerated bugs and the cross-module integration; the transfer endpoint was not exercised | Reproduce `POST` on the transfer screen, capture the server error with the `X-Request-ID` header, then trace `postWarehouseTransferEntry` + enterprise inventory transfer route |
| R2 | ~6 historical GRN journal entries still post Dr 1150 / Cr 2130 (7 legs on 2130, 6 on 1150); 14 legacy production entries still Dr = Cr on 1140 | Old, wrong account pairs remain in the GL history | Pre-fix account heuristic + `account_config` corruption | Deleting/rewriting posted accounting is forbidden without an authorised reclassification | An authorised corrective reclassification journal (Dr 1140 / Cr 1150, Dr 2130 / Cr 2110) with a documented approval — **not** an edit or delete |
| R3 | Production / sales / POS / payroll end-to-end tests not re-run (§5.4) | Coverage gap, not a known defect | Scope/time | Prioritised the reported bug list + integration repair | Execute TEST 2–4 and TEST 7 against TEST-ERP-* data and append results |
| R4 | POS order shortage rollback (BUG-ERP-013) not exercised live | Unknown | — | Only the sales-delivery shortage path (422 + rollback) was confirmed | Force an insufficient-stock POS sale and assert 409/422 + zero order/order_items/inventory/treasury/journal rows |
| R5 | `server.ts` hard-codes `PORT = 3000` | Cannot run a second instance / honour `PORT` | Literal in `startServer` | Behavioural change outside the reported scope | Read `process.env.PORT` with a 3000 default |
| R6 | **915** duplicate unique constraints on `inventory_items(warehouse_id, ingredient_id)` | DDL bloat, slower schema ops | Repeated accidental `ADD CONSTRAINT` without an `IF NOT EXISTS` guard | Dropping constraints is destructive and needs approval | Scripted, reviewed cleanup migration that keeps exactly one |
| R7 | Duplicated GRN posting logic in the explicit `/post` route | Two implementations could drift again | Pre-existing structure | Replacing the whole block risked regressions in the same change set | Fully delegate the explicit route to `GoodsReceiptPostingService` (the auto-post path already does) |
| R8 | `JWT_SECRET=your-secret-key-change-in-production` | Weak signing key in dev | Default placeholder | Changing it invalidates existing sessions | Generate a strong secret before any shared deployment; the diagnostics advisory already flags this |
| R9 | `dotenv@17` prints rotating promotional tips into stdout on boot | Log noise only | Upstream library behaviour | Not a defect | Silence with `quiet: true` if desired |

---

## 8. Verification artefacts

| Artefact | Purpose |
|---|---|
| [_audit/verify.cjs](_audit/verify.cjs) · [_audit/verify-results.json](_audit/verify-results.json) | 56 live API+DB assertions |
| [_audit/gate_test.sh](_audit/gate_test.sh) | authentication-gate proof (bypass on/off) |
| [_audit/reconcile.cjs](_audit/reconcile.cjs) · [_audit/reconciliation.json](_audit/reconciliation.json) | financial reconciliation snapshot |
| [_audit/schema_dump.cjs](_audit/schema_dump.cjs) · [_audit/schema.json](_audit/schema.json) | real PostgreSQL schema (331 tables), columns, FKs, uniques |
| [migrations/005_erp_integration_repair.sql](migrations/005_erp_integration_repair.sql) | the only schema/mapping change |
