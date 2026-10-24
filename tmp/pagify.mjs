import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("apply");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).toLowerCase();

const S = (f, l, e, o) => ({ f, l, e, o });
const SITES = [
  S("accounting/CentralFinancialIntegrationView.tsx", 621),
  S("accounting/DailyJournalEntries.tsx", 1907),
  S("AnnualIncreasesManagement.tsx", 356),
  S("Approvals.tsx", 921),
  S("Attendance.tsx", 2483), S("Attendance.tsx", 2540), S("Attendance.tsx", 2666), S("Attendance.tsx", 2701),
  S("BankManagement.tsx", 98),
  S("BankReconciliationView.tsx", 554), S("BankReconciliationView.tsx", 648), S("BankReconciliationView.tsx", 708), S("BankReconciliationView.tsx", 792),
  S("BranchReports.tsx", 1517, null, { stripSlice: true }),
  S("BudgetsManagementView.tsx", 581),
  S("ClearanceManagement.tsx", 1025),
  S("Complaints.tsx", 646),
  S("costs/CostsReportsDetails.tsx", 895),
  S("costs/product-costing/BOMMaterialsTable.tsx", 169),
  S("costs/product-costing/CostReportsTab.tsx", 195),
  S("costs/product-costing/VarianceAndAuditTab.tsx", 65), S("costs/product-costing/VarianceAndAuditTab.tsx", 148),
  S("Costs.tsx", 3083), S("Costs.tsx", 3185), S("Costs.tsx", 3278), S("Costs.tsx", 4992), S("Costs.tsx", 5092), S("Costs.tsx", 5782), S("Costs.tsx", 6774),
  S("CustomerAccounts.tsx", 464, null, { override: "[...trWithBal].reverse()" }),
  S("Customers.tsx", 256), S("Customers.tsx", 527),
  S("CustomersSuppliersView.tsx", 1487),
  S("DatabaseManager.tsx", 543),
  S("Delivery.tsx", 739),
  S("DeliveryNotes.tsx", 140),
  S("DeliverySettings.tsx", 271),
  S("EmployeeWarningsManagement.tsx", 574),
  S("ERPIntegrationHubView.tsx", 782),
  S("FixedAssetsView.tsx", 1589),
  S("GeneralAccounts.tsx", 1372), S("GeneralAccounts.tsx", 3975), S("GeneralAccounts.tsx", 4355), S("GeneralAccounts.tsx", 5356),
  S("GLAuditTrailView.tsx", 408),
  S("hotel/reports/Revenue.tsx", 175),
  S("HotelManagement.tsx", 2410), S("HotelManagement.tsx", 3210), S("HotelManagement.tsx", 3574), S("HotelManagement.tsx", 3645), S("HotelManagement.tsx", 3942), S("HotelManagement.tsx", 4429),
  S("HR.tsx", 7558), S("HR.tsx", 7665), S("HR.tsx", 7904), S("HR.tsx", 8535), S("HR.tsx", 8725), S("HR.tsx", 8895), S("HR.tsx", 9028), S("HR.tsx", 10053), S("HR.tsx", 10979),
  S("HRProfessionalSuite.tsx", 891), S("HRProfessionalSuite.tsx", 1047), S("HRProfessionalSuite.tsx", 1076),
  S("Inventory.tsx", 1586), S("Inventory.tsx", 1710), S("Inventory.tsx", 1819), S("Inventory.tsx", 1894), S("Inventory.tsx", 2409), S("Inventory.tsx", 2495), S("Inventory.tsx", 2539), S("Inventory.tsx", 2582), S("Inventory.tsx", 2669), S("Inventory.tsx", 2728), S("Inventory.tsx", 2941), S("Inventory.tsx", 4343),
  S("inventory/adjustments/InventoryAdjustmentsView.tsx", 223),
  S("inventory/GoodsReceiptsView.tsx", 304),
  S("inventory/InventoryAuditTrailView.tsx", 128),
  S("inventory/InventoryPlanningView.tsx", 153),
  S("inventory/MaterialRequestsView.tsx", 674),
  S("inventory/reports/InventoryReportsView.tsx", 926), S("inventory/reports/InventoryReportsView.tsx", 1063), S("inventory/reports/InventoryReportsView.tsx", 1157), S("inventory/reports/InventoryReportsView.tsx", 1195), S("inventory/reports/InventoryReportsView.tsx", 1231),
  S("inventory/StockItemDetailsDrawer.tsx", 313), S("inventory/StockItemDetailsDrawer.tsx", 458), S("inventory/StockItemDetailsDrawer.tsx", 560), S("inventory/StockItemDetailsDrawer.tsx", 659), S("inventory/StockItemDetailsDrawer.tsx", 756),
  S("inventory/WarehouseLocationsView.tsx", 242),
  S("inventory/WarehouseTransfersView.tsx", 466),
  S("inventory/wastage/WastageView.tsx", 192),
  S("InvoiceOCRModal.tsx", 484),
  S("Kitchen.tsx", 863),
  S("LeaveApprovalsWorkflow.tsx", 629),
  S("ModificationsReport.tsx", 282), S("ModificationsReport.tsx", 351),
  S("OrganizationsManagement.tsx", 271),
  S("Payroll.tsx", 1692), S("Payroll.tsx", 2253), S("Payroll.tsx", 3221), S("Payroll.tsx", 3751),
  S("PayrollRunPanel.tsx", 488), S("PayrollRunPanel.tsx", 538),
  S("POSDetailedReports.tsx", 276, "rows"),
  S("POSShiftManagement.tsx", 266),
  S("Printers.tsx", 150), S("Printers.tsx", 439),
  S("ProductBundles.tsx", 93),
  S("production/BOMManagement.tsx", 527), S("production/BOMManagement.tsx", 581),
  S("production/CostManagement.tsx", 1451),
  S("production/MaintenanceManagement.tsx", 100),
  S("production/ProductionPlanningMRP.tsx", 195),
  S("production/ProductionReports.tsx", 1299), S("production/ProductionReports.tsx", 1345), S("production/ProductionReports.tsx", 1392), S("production/ProductionReports.tsx", 1430), S("production/ProductionReports.tsx", 1469), S("production/ProductionReports.tsx", 1508), S("production/ProductionReports.tsx", 1550),
  S("production/QualityControlManagement.tsx", 703), S("production/QualityControlManagement.tsx", 784),
  S("production/ShopFloorControl.tsx", 570), S("production/ShopFloorControl.tsx", 660), S("production/ShopFloorControl.tsx", 753),
  S("Products.tsx", 1203),
  S("Purchases.tsx", 1540, "tableRows"),
  S("PutawayRules.tsx", 96),
  S("RealEstateManagement.tsx", 21),
  S("RecruitmentSuite.tsx", 1321), S("RecruitmentSuite.tsx", 1997),
  S("Reservations.tsx", 745),
  S("ReturnModal.tsx", 759),
  S("Safes.tsx", 994),
  S("sales/SalesProductsManagement.tsx", 2852),
  S("sales/SalesProductsView.tsx", 739), S("sales/SalesProductsView.tsx", 1378),
  S("sales/SalesSettings.tsx", 1448),
  S("Sales.tsx", 9047), S("Sales.tsx", 9161), S("Sales.tsx", 9288),
  S("Security.tsx", 836),
  S("StockEntries.tsx", 247),
  S("SupplierReports.tsx", 1900), S("SupplierReports.tsx", 2059), S("SupplierReports.tsx", 2103), S("SupplierReports.tsx", 2126), S("SupplierReports.tsx", 2144), S("SupplierReports.tsx", 2168), S("SupplierReports.tsx", 2194), S("SupplierReports.tsx", 2226), S("SupplierReports.tsx", 2241), S("SupplierReports.tsx", 2264), S("SupplierReports.tsx", 2286), S("SupplierReports.tsx", 2362),
  S("SystemHealthView.tsx", 253), S("SystemHealthView.tsx", 360),
  S("Tables.tsx", 670),
  S("TaxesView.tsx", 760), S("TaxesView.tsx", 1158), S("TaxesView.tsx", 1248),
  S("TransferLog.tsx", 95),
  S("treasury/closings/CashVarianceReportView.tsx", 250),
  S("treasury/closings/ClosingArchiveTable.tsx", 370),
  S("treasury/closings/PreClosingLedgerModal.tsx", 161),
  S("treasury/custody/CustodyListView.tsx", 495),
  S("treasury/transfers/TransferListView.tsx", 397),
  S("TreasuryReports.tsx", 877), S("TreasuryReports.tsx", 985), S("TreasuryReports.tsx", 1084), S("TreasuryReports.tsx", 1170),
  S("TreasurySystem.tsx", 1196),
  S("UserManagement.tsx", 495),
  S("WebOrders.tsx", 317),
];

const norm = (t) => t.replace(/\s+/g, " ").trim();

// قراءة تعبير المصفوفة للخلف مع تخطي المسافات داخل السلاسل متعددة الأسطر
function readExprBack(s, mapIdx) {
  let j = mapIdx - 1;
  while (j >= 0 && /\s/.test(s[j])) j--;
  const exprEnd = j + 1;
  let k = j, parens = 0, brackets = 0, braces = 0;
  while (k >= 0) {
    const c = s[k];
    if (c === ";" && parens === 0 && brackets === 0 && braces === 0) break; // فاصل بيانات على المستوى الأعلى فقط
    if (/\s/.test(c)) { k--; continue; }
    if (c === ")") parens++;
    else if (c === "(") { if (parens === 0) break; parens--; }
    else if (c === "]") brackets++;
    else if (c === "[") { if (brackets === 0) break; brackets--; }
    else if (c === "}") braces++;
    else if (c === "{") { if (braces === 0) break; braces--; }
    else if (parens === 0 && brackets === 0 && braces === 0) {
      if (!/[\w$.]/.test(c)) break;
    }
    k--;
  }
  return { expr: s.slice(k + 1, exprEnd).trim(), start: k + 1 };
}

// تحقق أن التعبير تعبير مصفوفة سليم: متوازن، وبلا كلمات محجوزة على المستوى الأعلى
function isValidExpr(expr) {
  if (!expr) return false;
  if ( /^[)}\]]/.test(expr)) return false;
  let p = 0, b = 0, c = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === "(") p++; else if (ch === ")") p--;
    else if (ch === "[") b++; else if (ch === "]") b--;
    else if (ch === "{") c++; else if (ch === "}") c--;
    if (p < 0 || b < 0 || c < 0) return false;
  }
  if (p !== 0 || b !== 0 || c !== 0) return false;
  // كلمة محجوزة على المستوى الأعلى (خارج كل الأقواس) = التقطاط خاطئ لسيق بلوك
  let d = expr, prev;
  do {
    prev = d;
    d = d.replace(/\([^()]*\)/g, "()").replace(/\{[^{}]*\}/g, "{}").replace(/\[[^\[\]]*\]/g, "[]");
  } while (d !== prev);
  if (/\b(if|return|const|let|var|for|while|else|switch|case|await|function)\b/.test(d)) return false;
  return true;
}

// رؤوس تعريف المكوّنات (تكبير أول حرف)
const compRe = /^(?:export\s+)?(?:default\s+)?(?:function\s+|const\s+)([A-Z]\w*)(?=[\s:(=])/gm;

function findComponent(s, siteIdx) {
  let best = null;
  compRe.lastIndex = 0;
  let m;
  while ((m = compRe.exec(s))) {
    if (m.index >= siteIdx) break;
    best = { name: m[1], start: m.index, end: compRe.lastIndex };
  }
  return best;
}

// موضع "=" التعيين بعد اسم المكوّن (تخطي التعليق النوعي الذي قد يحوي =>)
function skipToAssignment(s, i) {
  let depth = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "=" && s[i + 1] === ">") { i += 2; continue; }
    if (c === "<" || c === "(" || c === "{" || c === "[") depth++;
    else if (c === ">" || c === ")" || c === "}" || c === "]") depth--;
    else if (c === "=" && depth === 0 && s[i + 1] !== "=" && s[i - 1] !== "!" && s[i - 1] !== "<" && s[i - 1] !== ">" && s[i - 1] !== "=") return i;
    i++;
  }
  return -1;
}

function balancedEnd(s, openIdx) {
  const open = s[openIdx];
  const close = open === "(" ? ")" : open === "{" ? "}" : open === "[" ? "]" : ">";
  let depth = 0, quote = null;
  for (let i = openIdx; i < s.length && i < openIdx + 200000; i++) {
    const c = s[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function findBodyOpen(s, comp) {
  let i = comp.end;
  // function X(...) {  أو  const X: T = ... 
  while (i < s.length && /\s/.test(s[i])) i++;
  if (s[i] === ":") {
    const eq = skipToAssignment(s, i);
    if (eq === -1) return null;
    i = eq + 1;
  } else if (s[i] === "(") {
    // function — البارامترات ثم الجسم
  } else if (s[i] === "=") {
    i++;
  } else return null;
  while (i < s.length && /\s/.test(s[i])) i++;
  // غلاف اختياري: memo( / forwardRef<...>( / memo(
  for (let layer = 0; layer < 3; layer++) {
    const idm = /^[A-Za-z_$][\w$.]*/.exec(s.slice(i));
    if (idm && (s[i + idm[0].length] === "(" || s[i + idm[0].length] === "<")) {
      let j = i + idm[0].length;
      if (s[j] === "<") {
        const gt = balancedEnd(s, j);
        if (gt === -1) return null;
        j = gt + 1;
      }
      if (s[j] === "(") {
        const cp = balancedEnd(s, j);
        if (cp === -1) return null;
        i = cp + 1;
        while (i < s.length && /\s/.test(s[i])) i++;
        continue;
      }
      break;
    }
    break;
  }
  // البارامترات
  if (s[i] === "(") {
    const cp = balancedEnd(s, i);
    if (cp === -1) return null;
    i = cp + 1;
    while (i < s.length && /\s/.test(s[i])) i++;
  }
  if (s.startsWith("=>", i)) i += 2;
  while (i < s.length && /\s/.test(s[i])) i++;
  if (s[i] === "{" || s[i] === "(") return { idx: i + 1 };
  return null;
}

function lineOf(s, idx) {
  const start = s.lastIndexOf("\n", idx) + 1;
  let end = s.indexOf("\n", idx);
  if (end === -1) end = s.length;
  return { start, end };
}

function findStateAnchor(s, compStart, siteIdx) {
  const re = /const\s+\[[^\]]*\]\s*=\s*useState\(/g;
  re.lastIndex = compStart;
  let last = null, m;
  while ((m = re.exec(s)) && m.index < siteIdx) last = m;
  if (!last) return null;
  const line = lineOf(s, last.index);
  return { idx: line.end + 1, lineNo: s.slice(0, last.index).split("\n").length };
}

// هل الموقع داخل map خارجي (جدول لكل عنصر)؟
function enclosingMap(s, siteIdx) {
  const re = /\.map\(/g;
  const candidates = [];
  let m;
  while ((m = re.exec(s)) && m.index < siteIdx) {
    if (siteIdx - m.index > 60000) break;
    candidates.push(m.index);
  }
  for (let c = candidates.length - 1; c >= 0; c--) {
    const open = candidates[c] + 4; // قوس (
    const close = balancedEnd(s, open);
    if (close > siteIdx) return { idx: candidates[c] };
  }
  return null;
}

const relImport = (target) => {
  const dir = path.dirname(target);
  let rel = path.relative(dir, path.join("src", "components", "PaginationBar")).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
};

const byFile = {};
for (const site of SITES) (byFile[site.f] ||= []).push(site);

let okCount = 0, skipCount = 0;
const appliedFiles = [];

for (const [f, sites] of Object.entries(byFile)) {
  if (ONLY && !f.toLowerCase().includes(ONLY)) continue;
  const target = path.join("src", "components", f);
  const s = fs.readFileSync(target, "utf8");
  const lines = s.split("\n");
  const edits = [];
  let counter = 1;
  const usedNames = new Set();
  const notes = [];

  for (const site of sites) {
    const lineIdx = site.l - 1;
    if (lineIdx >= lines.length) { notes.push(`L${site.l}: سطر غير موجود`); skipCount++; continue; }
    let lineStart = 0;
    for (let i = 0; i < lineIdx; i++) lineStart += lines[i].length + 1;
    const lineEnd = lineStart + lines[lineIdx].length;

    const mapRe = /\.map\(/g;
    let chosen = null, m;
    while ((m = mapRe.exec(s))) {
      if (m.index < lineStart || m.index >= lineEnd) continue;
      const after = s.slice(m.index, m.index + 1200);
      const trIdx = after.search(/<tr[\s>/]/);
      if (trIdx === -1) continue;
      const btCount = (after.slice(0, trIdx).match(/`/g) || []).length;
      if (btCount % 2 === 1) continue; // قالب نصي غير مغلق قبل <tr
      let { expr, start } = readExprBack(s, m.index);
      // بادئة return ليست جزءًا من التعبير — تُشال مع ضبط موضع البداية
      const rawSlice = s.slice(start, m.index);
      const retPrefix = /^\s*return\s+/.exec(rawSlice);
      if (retPrefix) {
        start += retPrefix[0].length;
        expr = s.slice(start, m.index).trim();
      }
      if (!expr || expr.endsWith("?")) continue;
      if (!isValidExpr(expr)) continue;
      if (site.e && norm(expr) !== norm(site.e)) continue;
      chosen = { mapIdx: m.index, expr, exprStart: start };
      break;
    }
    if (!chosen) { notes.push(`L${site.l}: لم يُعثر على الموقع (${site.e || "أول map"})`); skipCount++; continue; }

    let expr = site.o?.override || chosen.expr;
    if (site.o?.stripSlice) expr = expr.replace(/\.slice\(\s*0\s*,\s*\d+\s*\)\s*$/, "").trim();

    const tableClose = s.indexOf("</table>", chosen.mapIdx);
    if (tableClose === -1 || tableClose > chosen.mapIdx + 30000) { notes.push(`L${site.l}: </table> بعيد/غير موجود`); skipCount++; continue; }

    const comp = findComponent(s, chosen.exprStart);
    if (!comp) { notes.push(`L${site.l}: لم يُعثر على المكوّن الحاوي`); skipCount++; continue; }

    const encl = enclosingMap(s, chosen.exprStart);
    if (encl) {
      const ln = s.slice(0, encl.idx).split("\n").length;
      notes.push(`L${site.l}: ⛔ داخل map خارجي عند L${ln} (جدول لكل عنصر)`); skipCount++; continue;
    }

    let anchor = findStateAnchor(s, comp.start, chosen.exprStart);
    let anchorDesc;
    if (!anchor) {
      const body = findBodyOpen(s, comp);
      if (!body) { notes.push(`L${site.l}: ${comp.name} بلا useState ولا جسم واضح`); skipCount++; continue; }
      anchor = { idx: body.idx, lineNo: s.slice(0, body.idx).split("\n").length };
      anchorDesc = `بداية ${comp.name} (L${anchor.lineNo})`;
    } else {
      anchorDesc = `بعد useState L${anchor.lineNo}`;
    }

    let name;
    do { name = `pgn${counter++}`; } while (s.includes(name) || usedNames.has(name));
    usedNames.add(name);

    const flatExpr = norm(expr);
    const warnMut = /\.reverse\(\)|\.sort\(/.test(flatExpr) && !site.o?.override ? " ⚠️mutating" : "";

    edits.push({ idx: anchor.idx, text: `  const ${name} = usePaginationState();\n`, kind: "state" });
    edits.push({
      start: chosen.exprStart, end: chosen.mapIdx + 5,
      text: `pageRows(${expr}, ${name}).map(`, kind: "map",
    });
    const barLine = lineOf(s, tableClose);
    const indent = s.slice(barLine.start, barLine.start + 200).match(/^\s*/)[0];
    edits.push({
      idx: tableClose + "</table>".length,
      text: `\n${indent}<PaginationBar page={${name}.page} pageSize={${name}.pageSize} total={(${expr}).length} onPage={${name}.setPage} onPageSize=${name}.setPageSize} />`,
      kind: "bar",
    });

    okCount++;
    notes.push(`L${site.l} ✓ ${comp.name} | ${anchorDesc} | ${name} | ${flatExpr.slice(0, 55)}${warnMut}`);
  }

  console.log(`\n=== ${f}`);
  for (const n of notes) console.log("  " + n);

  if (!APPLY || edits.length === 0) continue;

  let importIdx = 0;
  const importRe = /^import[^\n]*$/gm;
  let im, lastImp = null;
  while ((im = importRe.exec(s)) && im.index < 6000) lastImp = im;
  if (lastImp) importIdx = lastImp.index + lastImp[0].length + 1;
  const impText = `import { pageRows, PaginationBar, usePaginationState } from "${relImport(target)}";\n`;

  const all = [{ idx: importIdx, text: impText, kind: "import" }, ...edits];
  all.sort((a, b) => (a.start ?? a.idx) - (b.start ?? b.idx));
  let out = s;
  for (let i = all.length - 1; i >= 0; i--) {
    const e = all[i];
    if (e.start !== undefined) out = out.slice(0, e.start) + e.text + out.slice(e.end);
    else out = out.slice(0, e.idx) + e.text + out.slice(e.idx);
  }
  fs.writeFileSync(target, out, "utf8");
  appliedFiles.push(f);
}

console.log(`\n\n===== ${APPLY ? "APPLIED" : "DRY RUN"}: ${okCount} جاهز، ${skipCount} متجاهل =====`);
if (APPLY) console.log("ملفات معدّلة:", appliedFiles.length);
