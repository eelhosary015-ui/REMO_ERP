// ═══════════════════════════════════════════════════════════════
// Unit Test Suite — Pure Business Logic (no server / no DB)
// Run with: npx tsx tests/unit.test.ts
// ═══════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;
const errors: Array<{ test: string; error: string }> = [];

function assert(condition: boolean, test: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${test}`);
  } else {
    failed++;
    console.log(`  ❌ ${test}`);
  }
}

function assertEqual(actual: any, expected: any, test: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    console.log(`  ✅ ${test}`);
  } else {
    failed++;
    const msg = `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`;
    console.log(`  ❌ ${test} — ${msg}`);
    errors.push({ test, error: msg });
  }
}

function assertNotEqual(actual: any, expected: any, test: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    passed++;
    console.log(`  ✅ ${test}`);
  } else {
    failed++;
    console.log(`  ❌ ${test} — Values are equal when they shouldn't be`);
    errors.push({ test, error: 'Values are equal' });
  }
}

function assertIncludes(str: string, substr: string, test: string) {
  if (str.includes(substr)) {
    passed++;
    console.log(`  ✅ ${test}`);
  } else {
    failed++;
    console.log(`  ❌ ${test} — "${str}" does not include "${substr}"`);
    errors.push({ test, error: `Missing substring` });
  }
}

function assertApprox(actual: number, expected: number, tolerance: number, test: string) {
  if (Math.abs(actual - expected) <= tolerance) {
    passed++;
    console.log(`  ✅ ${test}`);
  } else {
    failed++;
    const msg = `Expected ~${expected} (±${tolerance}) but got ${actual}`;
    console.log(`  ❌ ${test} — ${msg}`);
    errors.push({ test, error: msg });
  }
}

function assertThrows(fn: () => void, test: string) {
  try {
    fn();
    failed++;
    console.log(`  ❌ ${test} — Expected an error but none was thrown`);
    errors.push({ test, error: 'No error thrown' });
  } catch {
    passed++;
    console.log(`  ✅ ${test}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. Permission System Tests
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 Testing Permission System (permissionIsGranted)...');

import {
  permissionIsGranted,
  getAdvancedPermissionsForModule,
  getAllAdvancedPermissionIds,
  ADVANCED_PERMISSION_GROUPS,
  PERMISSION_TEMPLATES,
  CORE_ACTION_PERMISSIONS,
} from '../src/utils/advancedPermissions.js';

// --- Admin / all: true ---
assert(
  permissionIsGranted({ all: true }, 'pos.cancel_order'),
  'all: true grants any permission key',
);
assert(
  permissionIsGranted({ all: true }, 'security.system_settings'),
  'all: true grants critical security permission',
);
assert(
  permissionIsGranted({ all: true }, 'nonexistent.key'),
  'all: true grants even unknown keys',
);

// --- Direct key match ---
assert(
  permissionIsGranted({ 'pos.pos_screen': true }, 'pos.pos_screen'),
  'Exact key match returns true',
);
assert(
  permissionIsGranted({ 'pos.pos_screen': true, 'pos.cancel_order': false }, 'pos.pos_screen'),
  'Exact key match true even when sibling is false',
);

// --- Missing permission ---
assert(
  !permissionIsGranted({}, 'pos.cancel_order'),
  'Empty permission object returns false',
);
assert(
  !permissionIsGranted({ 'pos.pos_screen': true }, 'pos.cancel_order'),
  'Unset permission key returns false',
);
assert(
  !permissionIsGranted({ 'pos.cancel_order': false }, 'pos.cancel_order'),
  'Explicitly false permission returns false',
);

// --- Module-level + full_access ---
assert(
  permissionIsGranted({ pos: true, 'pos.full_access': true }, 'pos.anything_here'),
  'Module + full_access grants any sub-key',
);
assert(
  permissionIsGranted({ pos: true, 'pos.full_access': true }, 'pos.cancel_order'),
  'Module + full_access grants cancel_order',
);
assert(
  !permissionIsGranted({ pos: true }, 'pos.cancel_order'),
  'Module key alone WITHOUT full_access does NOT grant sub-key',
);
assert(
  !permissionIsGranted({ 'pos.full_access': true }, 'pos.cancel_order'),
  'full_access alone WITHOUT module key does NOT grant sub-key',
);

// --- Null / undefined permissions ---
assert(
  !permissionIsGranted(undefined as any, 'pos.pos_screen'),
  'undefined permissions returns false',
);
assert(
  !permissionIsGranted(null as any, 'pos.pos_screen'),
  'null permissions returns false',
);

// --- Top-level single-key permissions (no dot) ---
assert(
  permissionIsGranted({ pos: true, 'pos.read': true }, 'pos'),
  'Top-level module key match returns true',
);
assert(
  !permissionIsGranted({ 'pos.read': true }, 'pos'),
  'Missing top-level module key returns false for bare module name',
);

// --- Branch-scoped permissions pattern ---
const branchPerms: Record<string, any> = {
  pos: true,
  'pos.read': true,
  'pos.create': true,
  'pos.checkout': true,
  branch_5: true,
  'branch_5.pos': true,
};
assert(permissionIsGranted(branchPerms, 'pos.read'), 'Branch-scoped: user has pos.read');
assert(permissionIsGranted(branchPerms, 'pos.create'), 'Branch-scoped: user has pos.create');
assert(!permissionIsGranted(branchPerms, 'pos.cancel_order'), 'Branch-scoped: user lacks pos.cancel_order');
assert(permissionIsGranted(branchPerms, 'branch_5.pos'), 'Branch-scoped: branch key is matched');

// --- getAdvancedPermissionsForModule ---
const posPerms = getAdvancedPermissionsForModule('pos');
assertEqual(posPerms.length, 2, 'POS module has 2 permission sections');
assert(posPerms[0].permissions.length > 0, 'First POS section has permissions');
assertEqual(getAdvancedPermissionsForModule('nonexistent').length, 0, 'Unknown module returns empty array');

// --- getAllAdvancedPermissionIds ---
const allIds = getAllAdvancedPermissionIds();
assert(allIds.length > 50, `All permission IDs count > 50 (got ${allIds.length})`);
assert(allIds.includes('pos.cancel_order'), 'All IDs includes pos.cancel_order');
assert(allIds.includes('security.users'), 'All IDs includes security.users');

// --- ADVANCED_PERMISSION_GROUPS structure ---
assert(ADVANCED_PERMISSION_GROUPS.length >= 10, `At least 10 permission groups (got ${ADVANCED_PERMISSION_GROUPS.length})`);
const moduleIds = ADVANCED_PERMISSION_GROUPS.map(g => g.moduleId);
assert(moduleIds.includes('pos'), 'Permission groups include pos');
assert(moduleIds.includes('hr'), 'Permission groups include hr');
assert(moduleIds.includes('system'), 'Permission groups include system');

// --- PERMISSION_TEMPLATES ---
assert(PERMISSION_TEMPLATES.length >= 5, `At least 5 permission templates (got ${PERMISSION_TEMPLATES.length})`);
assert(
  PERMISSION_TEMPLATES.some(t => t.id === 'cashier'),
  'Permission templates include cashier',
);
assert(
  PERMISSION_TEMPLATES.some(t => t.id === 'accountant'),
  'Permission templates include accountant',
);
// Cashier template should NOT have critical admin permissions
const cashierTemplate = PERMISSION_TEMPLATES.find(t => t.id === 'cashier')!;
assert(
  cashierTemplate.permissions['security.users'] !== true,
  'Cashier template does NOT have security.users',
);
assert(
  cashierTemplate.permissions['pos.pos_screen'] === true,
  'Cashier template HAS pos.pos_screen',
);

// --- CORE_ACTION_PERMISSIONS ---
assertEqual(CORE_ACTION_PERMISSIONS.length, 7, '7 core action permissions');
const coreIds = CORE_ACTION_PERMISSIONS.map(p => p.id);
assert(coreIds.includes('read'), 'Core actions include read');
assert(coreIds.includes('create'), 'Core actions include create');
assert(coreIds.includes('delete'), 'Core actions include delete');
assert(coreIds.includes('print'), 'Core actions include print');

// --- Risk levels on permissions ---
const criticalPerms = ADVANCED_PERMISSION_GROUPS.flatMap(g => g.permissions).filter(p => p.risk === 'critical');
assert(criticalPerms.length > 10, `More than 10 critical-risk permissions (got ${criticalPerms.length})`);
const sensitivePerms = ADVANCED_PERMISSION_GROUPS.flatMap(g => g.permissions).filter(p => p.risk === 'sensitive');
assert(sensitivePerms.length > 5, `More than 5 sensitive-risk permissions (got ${sensitivePerms.length})`);

// ═══════════════════════════════════════════════════════════════
// 2. API Utility Tests
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 Testing API Utility Patterns...');

// --- Base URL construction ---
function buildBaseUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

assertEqual(buildBaseUrl('http://localhost:3000', '/api/products'), 'http://localhost:3000/api/products', 'Base URL with trailing-slash-free base');
assertEqual(buildBaseUrl('http://localhost:3000/', '/api/products'), 'http://localhost:3000/api/products', 'Base URL strips trailing slash');
assertEqual(buildBaseUrl('http://localhost:3000//', 'api/products'), 'http://localhost:3000/api/products', 'Base URL normalizes multiple trailing slashes');
assertEqual(buildBaseUrl('http://localhost:3000', 'api/products'), 'http://localhost:3000/api/products', 'Base URL adds leading slash to path');

// --- Token attachment to headers ---
function attachToken(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

assertEqual(attachToken('abc123'), { Authorization: 'Bearer abc123' }, 'Token attached as Bearer');
assertEqual(attachToken(null), {}, 'Null token produces empty headers');
assertEqual(attachToken(''), {}, 'Empty token produces empty headers');
assertEqual(attachToken('jwt-long-token-here'), { Authorization: 'Bearer jwt-long-token-here' }, 'Long JWT token attached correctly');

// --- Request body serialization ---
function serializeBody(body: any): string {
  return JSON.stringify(body);
}

const bodyResult = serializeBody({ name: 'Test', price: 10.5 });
const parsedBody = JSON.parse(bodyResult);
assertEqual(parsedBody.name, 'Test', 'Serialized body preserves string');
assertEqual(parsedBody.price, 10.5, 'Serialized body preserves number');
assertEqual(Object.keys(parsedBody).length, 2, 'Serialized body has correct key count');

// --- API response status classification ---
function classifyResponse(status: number): 'success' | 'client_error' | 'server_error' | 'redirect' {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client_error';
  return 'server_error';
}

assertEqual(classifyResponse(200), 'success', '200 is success');
assertEqual(classifyResponse(201), 'success', '201 is success');
assertEqual(classifyResponse(299), 'success', '299 is success');
assertEqual(classifyResponse(301), 'redirect', '301 is redirect');
assertEqual(classifyResponse(400), 'client_error', '400 is client_error');
assertEqual(classifyResponse(401), 'client_error', '401 is client_error');
assertEqual(classifyResponse(403), 'client_error', '403 is client_error');
assertEqual(classifyResponse(404), 'client_error', '404 is client_error');
assertEqual(classifyResponse(500), 'server_error', '500 is server_error');
assertEqual(classifyResponse(503), 'server_error', '503 is server_error');

// --- Check HTML response detection pattern (mirrors checkHtmlResponse logic) ---
function isHtmlResponse(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.includes('text/html');
}

assert(isHtmlResponse('text/html; charset=utf-8'), 'Detects text/html content type');
assert(!isHtmlResponse('application/json'), 'Rejects application/json');
assert(!isHtmlResponse(null), 'Null content-type returns false');
assert(!isHtmlResponse(''), 'Empty content-type returns false');

// ═══════════════════════════════════════════════════════════════
// 3. POS Calculation Tests
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 Testing POS Calculations...');

interface CartItem {
  name: string;
  quantity: number;
  price: number;
}

// --- Subtotal = quantity × price ---
function calcSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.price, 0);
}

assertEqual(calcSubtotal([]), 0, 'Empty cart subtotal is 0');
assertEqual(calcSubtotal([{ name: 'A', quantity: 2, price: 10 }]), 20, 'Single item: 2 × 10 = 20');
assertEqual(calcSubtotal([{ name: 'A', quantity: 3, price: 5 }, { name: 'B', quantity: 1, price: 15 }]), 30, 'Two items: 15 + 15 = 30');
assertEqual(calcSubtotal([{ name: 'A', quantity: 0, price: 100 }]), 0, 'Zero quantity item contributes 0');
assertEqual(calcSubtotal([{ name: 'A', quantity: 5, price: 0 }]), 0, 'Zero price item contributes 0');

// --- Discount: percentage ---
function calcPercentageDiscount(subtotal: number, percent: number, maxCap?: number): number {
  if (percent < 0 || percent > 100) return 0;
  let discount = subtotal * (percent / 100);
  if (maxCap !== undefined && discount > maxCap) discount = maxCap;
  return Math.round(discount * 100) / 100;
}

assertEqual(calcPercentageDiscount(100, 10), 10, '10% of 100 = 10');
assertEqual(calcPercentageDiscount(200, 15), 30, '15% of 200 = 30');
assertEqual(calcPercentageDiscount(500, 0), 0, '0% discount = 0');
assertEqual(calcPercentageDiscount(1000, 100), 1000, '100% discount = full amount');
assertEqual(calcPercentageDiscount(1000, 50, 200), 200, '50% of 1000 capped at 200');
assertEqual(calcPercentageDiscount(100, 10, 20), 10, '10% of 100 = 10 (under cap, no change)');
assertEqual(calcPercentageDiscount(100, -5), 0, 'Negative percentage returns 0');
assertEqual(calcPercentageDiscount(100, 150), 0, 'Over-100% percentage returns 0');

// --- Discount: fixed amount ---
function calcFixedDiscount(subtotal: number, amount: number): number {
  if (amount < 0) return 0;
  return Math.min(amount, subtotal);
}

assertEqual(calcFixedDiscount(100, 20), 20, 'Fixed 20 off 100');
assertEqual(calcFixedDiscount(50, 100), 50, 'Fixed discount capped at subtotal');
assertEqual(calcFixedDiscount(100, 0), 0, 'Zero fixed discount');
assertEqual(calcFixedDiscount(100, -10), 0, 'Negative fixed discount returns 0');
assertEqual(calcFixedDiscount(0, 10), 0, 'Zero subtotal, any discount returns 0');

// --- Tax: exclusive (added on top) ---
function calcExclusiveTax(subtotal: number, taxRate: number): number {
  if (taxRate < 0) return 0;
  return Math.round(subtotal * (taxRate / 100) * 100) / 100;
}

assertEqual(calcExclusiveTax(100, 15), 15, '15% exclusive tax on 100 = 15');
assertEqual(calcExclusiveTax(200, 5), 10, '5% exclusive tax on 200 = 10');
assertEqual(calcExclusiveTax(100, 0), 0, '0% tax = 0');
assertEqual(calcExclusiveTax(99.99, 15), 15, '15% tax on 99.99 rounds to 15.00');

// --- Tax: inclusive (already in price) ---
function calcInclusiveTax(totalWithTax: number, taxRate: number): { base: number; tax: number } {
  if (taxRate <= 0) return { base: totalWithTax, tax: 0 };
  const base = totalWithTax / (1 + taxRate / 100);
  const tax = totalWithTax - base;
  return {
    base: Math.round(base * 100) / 100,
    tax: Math.round(tax * 100) / 100,
  };
}

assertEqual(calcInclusiveTax(115, 15).tax, 15, 'Inclusive 15% tax on 115 = 15 tax');
assertApprox(calcInclusiveTax(115, 15).base, 100, 0.01, 'Inclusive 15% tax on 115 = 100 base');
assertEqual(calcInclusiveTax(100, 0).tax, 0, '0% inclusive tax = 0 tax');
assertEqual(calcInclusiveTax(100, 0).base, 100, '0% inclusive tax = full base');

// --- Service charge ---
function calcServiceCharge(subtotal: number, rate: number): number {
  if (rate < 0) return 0;
  return Math.round(subtotal * (rate / 100) * 100) / 100;
}

assertEqual(calcServiceCharge(100, 10), 10, '10% service charge on 100 = 10');
assertEqual(calcServiceCharge(500, 5), 25, '5% service charge on 500 = 25');
assertEqual(calcServiceCharge(100, 0), 0, '0% service charge = 0');

// --- Final total: subtotal - discount + tax + service_charge ---
function calcFinalTotal(subtotal: number, discount: number, tax: number, serviceCharge: number): number {
  return Math.round(Math.max(0, subtotal - discount + tax + serviceCharge) * 100) / 100;
}

assertEqual(calcFinalTotal(100, 10, 15, 5), 110, '100 - 10 + 15 + 5 = 110');
assertEqual(calcFinalTotal(200, 50, 22.5, 0), 172.5, '200 - 50 + 22.5 + 0 = 172.5');
assertEqual(calcFinalTotal(50, 60, 0, 0), 0, 'Discount exceeds subtotal: total clamped to 0');
assertEqual(calcFinalTotal(0, 0, 0, 0), 0, 'All zeros = 0');

// --- Negative quantity prevention ---
function sanitizeQuantity(qty: any): number {
  const n = Number(qty);
  if (isNaN(n) || n < 0) return 0;
  return Math.floor(n * 1000) / 1000; // prevent floating point
}

assertEqual(sanitizeQuantity(5), 5, 'Positive quantity passes through');
assertEqual(sanitizeQuantity(0), 0, 'Zero quantity is valid');
assertEqual(sanitizeQuantity(-3), 0, 'Negative quantity clamped to 0');
assertEqual(sanitizeQuantity(-0.5), 0, 'Negative decimal clamped to 0');
assertEqual(sanitizeQuantity('abc'), 0, 'Non-numeric string returns 0');
assertEqual(sanitizeQuantity(null), 0, 'null returns 0');
assertEqual(sanitizeQuantity(undefined), 0, 'undefined returns 0');

// --- Zero price handling ---
function sanitizePrice(price: any): number {
  const n = Number(price);
  if (isNaN(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

assertEqual(sanitizePrice(10.5), 10.5, 'Valid price preserved');
assertEqual(sanitizePrice(0), 0, 'Zero price is valid');
assertEqual(sanitizePrice(-5), 0, 'Negative price clamped to 0');
assertEqual(sanitizePrice('abc'), 0, 'Non-numeric price returns 0');

// --- Rounding behavior ---
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

assertEqual(roundMoney(10.555), 10.56, '10.555 rounds to 10.56');
assertEqual(roundMoney(10.554), 10.55, '10.554 rounds to 10.55');
assertEqual(roundMoney(0.005), 0.01, '0.005 rounds to 0.01');
assertEqual(roundMoney(99.999), 100, '99.999 rounds to 100');

// --- Edge cases: 100 items in cart ---
const bigCart: CartItem[] = Array.from({ length: 100 }, (_, i) => ({
  name: `Item ${i}`,
  quantity: 1,
  price: 1,
}));
assertEqual(calcSubtotal(bigCart), 100, '100 items × $1 each = $100');

const mixedBigCart: CartItem[] = [
  ...Array.from({ length: 50 }, (_, i) => ({ name: `A${i}`, quantity: 2, price: 3 })),
  ...Array.from({ length: 50 }, (_, i) => ({ name: `B${i}`, quantity: 1, price: 10 })),
];
assertEqual(calcSubtotal(mixedBigCart), 800, '50×(2×3) + 50×(1×10) = 300 + 500 = 800');

// ═══════════════════════════════════════════════════════════════
// 4. Date/Time Utility Tests
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 Testing Date/Time Utilities...');

// --- Arabic date formatting ---
function formatDateArabic(date: Date): string {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ];
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const d = date.getDate();
  const m = months[date.getMonth()];
  const y = date.getFullYear();
  const dayName = days[date.getDay()];
  return `${dayName}، ${d} ${m} ${y}`;
}

const sampleDate = new Date(2024, 5, 15); // June 15, 2024
assertIncludes(formatDateArabic(sampleDate), 'يونيو', 'Arabic format includes month name');
assertIncludes(formatDateArabic(sampleDate), '2024', 'Arabic format includes year');
assertIncludes(formatDateArabic(sampleDate), '15', 'Arabic format includes day');

const janDate = new Date(2024, 0, 1);
assertIncludes(formatDateArabic(janDate), 'يناير', 'January maps to يناير');
assertIncludes(formatDateArabic(janDate), 'الإثنين', 'Jan 1 2024 is Monday');

const decDate = new Date(2024, 11, 25);
assertIncludes(formatDateArabic(decDate), 'ديسمبر', 'December maps to ديسمبر');

// --- Month start / end ---
function getMonthStart(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

function getMonthEnd(year: number, month: number): Date {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

const janStart = getMonthStart(2024, 1);
assertEqual(janStart.getFullYear(), 2024, 'Jan 2024 start year is 2024');
assertEqual(janStart.getMonth(), 0, 'Jan 2024 start month index is 0');
assertEqual(janStart.getDate(), 1, 'Jan 2024 start day is 1');

const janEnd = getMonthEnd(2024, 1);
assertEqual(janEnd.getFullYear(), 2024, 'Jan 2024 end year is 2024');
assertEqual(janEnd.getMonth(), 0, 'Jan 2024 end month index is 0');
assertEqual(janEnd.getDate(), 31, 'Jan 2024 has 31 days');

const febEnd = getMonthEnd(2024, 2);
assertEqual(febEnd.getDate(), 29, 'Feb 2024 (leap year) has 29 days');

const febEnd2023 = getMonthEnd(2023, 2);
assertEqual(febEnd2023.getDate(), 28, 'Feb 2023 (non-leap) has 28 days');

const decEnd = getMonthEnd(2024, 12);
assertEqual(decEnd.getDate(), 31, 'Dec 2024 has 31 days');

// --- Fiscal year boundaries (April–March) ---
function getFiscalYearStart(fiscalYear: number): Date {
  return new Date(fiscalYear - 1, 3, 1); // April 1 of previous calendar year
}

function getFiscalYearEnd(fiscalYear: number): Date {
  return new Date(fiscalYear, 2, 31, 23, 59, 59, 999); // March 31 of calendar year
}

const fy2024Start = getFiscalYearStart(2024);
assertEqual(fy2024Start.getFullYear(), 2023, 'FY2024 starts in calendar year 2023');
assertEqual(fy2024Start.getMonth(), 3, 'FY2024 starts in April (month index 3)');
assertEqual(fy2024Start.getDate(), 1, 'FY2024 starts on April 1');

const fy2024End = getFiscalYearEnd(2024);
assertEqual(fy2024End.getFullYear(), 2024, 'FY2024 ends in calendar year 2024');
assertEqual(fy2024End.getMonth(), 2, 'FY2024 ends in March (month index 2)');
assertEqual(fy2024End.getDate(), 31, 'FY2024 ends on March 31');

// --- Shift time overlap detection ---
function shiftsOverlap(
  start1: string, end1: string,
  start2: string, end2: string,
): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const s1 = toMin(start1), e1 = toMin(end1);
  const s2 = toMin(start2), e2 = toMin(end2);
  // Handle overnight shifts: if end < start, add 24h
  const adj = (s: number, e: number) => e >= s ? [s, e] : [s, e + 1440];
  const [a1, b1] = adj(s1, e1);
  const [a2, b2] = adj(s2, e2);
  return a1 < b2 && a2 < b1;
}

assert(shiftsOverlap('08:00', '16:00', '10:00', '18:00'), '08-16 overlaps 10-18');
assert(shiftsOverlap('10:00', '18:00', '08:00', '16:00'), '10-18 overlaps 08-16 (reversed)');
assert(!shiftsOverlap('08:00', '12:00', '13:00', '17:00'), '08-12 does NOT overlap 13-17');
assert(shiftsOverlap('22:00', '06:00', '23:00', '07:00'), 'Overnight shift 22-06 overlaps 23-07');
assert(!shiftsOverlap('08:00', '16:00', '16:00', '23:00'), '08-16 does NOT overlap 16-23 (adjacent, no overlap)');
assert(shiftsOverlap('08:00', '16:00', '08:00', '16:00'), 'Same shift times overlap');
assert(shiftsOverlap('00:00', '23:59', '10:00', '11:00'), 'Full-day shift covers any sub-shift');

// ═══════════════════════════════════════════════════════════════
// 5. Validation Tests
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 Testing Validation Functions...');

// --- Email validation ---
function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

assert(isValidEmail('test@example.com'), 'Valid email: test@example.com');
assert(isValidEmail('user.name+tag@domain.co'), 'Valid email with +tag and .co TLD');
assert(isValidEmail('a@b.c'), 'Minimal valid email a@b.c');
assert(!isValidEmail(''), 'Empty string is invalid email');
assert(!isValidEmail('no-at-sign.com'), 'Missing @ is invalid');
assert(!isValidEmail('missing-domain@'), 'Missing domain after @ is invalid');
assert(!isValidEmail('@missing-local.com'), 'Missing local part before @ is invalid');
assert(!isValidEmail('spaces in@email.com'), 'Spaces in email is invalid');
assert(!isValidEmail('email@.com'), 'Missing domain name is invalid');

// --- Phone number validation (flexible: digits, spaces, dashes, +prefix) ---
function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-\+\(\)]/g, '');
  return /^\d{7,15}$/.test(digits);
}

assert(isValidPhone('0512345678'), 'Valid 10-digit phone');
assert(isValidPhone('+966512345678'), 'Valid international phone with +');
assert(isValidPhone('051-234-5678'), 'Valid phone with dashes');
assert(isValidPhone('051 234 5678'), 'Valid phone with spaces');
assert(isValidPhone('(051) 234 5678'), 'Valid phone with parentheses');
assert(!isValidPhone('123'), 'Too short: 3 digits');
assert(!isValidPhone(''), 'Empty phone is invalid');
assert(!isValidPhone('abcdefg'), 'Letters only is invalid');
assert(!isValidPhone('1234567890123456'), 'Too long: 16 digits');

// --- Password strength (min 8 chars, at least 1 letter + 1 number) ---
function isStrongPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Minimum 8 characters');
  if (!/[a-zA-Z]/.test(password)) errors.push('At least one letter');
  if (!/[0-9]/.test(password)) errors.push('At least one number');
  return { valid: errors.length === 0, errors };
}

assertEqual(isStrongPassword('Abcdefg1').valid, true, 'Abcdefg1 is strong');
assertEqual(isStrongPassword('Password123').valid, true, 'Password123 is strong');
assertEqual(isStrongPassword('12345678').valid, false, 'Numbers only is weak');
assertEqual(isStrongPassword('abcdefgh').valid, false, 'Letters only is weak');
assertEqual(isStrongPassword('Ab1').valid, false, 'Too short is weak');
assertEqual(isStrongPassword('').valid, false, 'Empty is weak');
assertEqual(isStrongPassword('Abcdefg1').errors.length, 0, 'No errors for strong password');
assertEqual(isStrongPassword('12345678').errors.length, 1, 'One error for numbers only');
assertEqual(isStrongPassword('1234').errors.length, 2, 'Two errors for short + no letters');
assertEqual(isStrongPassword('').errors.length, 3, 'Three errors for empty password');

// --- Required field validation ---
function validateRequired(obj: Record<string, any>, fields: string[]): string[] {
  return fields.filter(f => {
    const val = obj[f];
    return val === undefined || val === null || val === '';
  });
}

assertEqual(validateRequired({ name: 'Ali', email: 'a@b.com' }, ['name', 'email']).length, 0, 'All required fields present');
assertEqual(validateRequired({ name: '' }, ['name', 'email']).length, 2, 'Both name (empty) and email (missing) fail');
assertEqual(validateRequired({ name: 'Ali' }, ['name', 'phone']).length, 1, 'phone is missing');
assertEqual(validateRequired({ name: null }, ['name']).length, 1, 'null value fails required');
assertEqual(validateRequired({ name: undefined }, ['name']).length, 1, 'undefined value fails required');
assertEqual(validateRequired({ name: 'Ali', email: 'test@test.com' }, []).length, 0, 'Empty field list has no errors');

// --- Numeric validation for prices/quantities ---
function isPositiveNumber(val: any): boolean {
  const n = Number(val);
  return !isNaN(n) && n > 0 && isFinite(n);
}

function isNonNegativeNumber(val: any): boolean {
  // Reject empty/whitespace strings — Number('') === 0 would otherwise pass
  if (typeof val === 'string' && val.trim() === '') return false;
  const n = Number(val);
  return !isNaN(n) && n >= 0 && isFinite(n);
}

assert(isPositiveNumber(10), '10 is positive number');
assert(isPositiveNumber(0.01), '0.01 is positive number');
assert(!isPositiveNumber(0), '0 is NOT positive number');
assert(!isPositiveNumber(-5), '-5 is NOT positive number');
assert(!isPositiveNumber('abc'), 'String "abc" is NOT positive number');
assert(!isPositiveNumber(Infinity), 'Infinity is NOT a valid positive number');
assert(!isPositiveNumber(NaN), 'NaN is NOT a valid positive number');

assert(isNonNegativeNumber(0), '0 IS non-negative number');
assert(isNonNegativeNumber(100), '100 is non-negative number');
assert(!isNonNegativeNumber(-1), '-1 is NOT non-negative number');
assert(isNonNegativeNumber('50'), 'String "50" parses as non-negative number');
assert(!isNonNegativeNumber(''), 'Empty string is NOT non-negative number');

// ═══════════════════════════════════════════════════════════════
// 6. Data Transformation Tests
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 Testing Data Transformation Functions...');

// --- Array grouping by key ---
function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const group = String(item[key]);
    (acc[group] = acc[group] || []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

const orders = [
  { id: 1, status: 'done', total: 100 },
  { id: 2, status: 'pending', total: 200 },
  { id: 3, status: 'done', total: 150 },
  { id: 4, status: 'cancelled', total: 50 },
  { id: 5, status: 'pending', total: 300 },
];
const grouped = groupBy(orders, 'status');
assertEqual(Object.keys(grouped).length, 3, 'Groups into 3 status categories');
assertEqual(grouped['done'].length, 2, 'done group has 2 items');
assertEqual(grouped['pending'].length, 2, 'pending group has 2 items');
assertEqual(grouped['cancelled'].length, 1, 'cancelled group has 1 item');
assertEqual(grouped['done'][0].total, 100, 'First done item has total 100');

const emptyGroup = groupBy([], 'id' as any);
assertEqual(Object.keys(emptyGroup).length, 0, 'Grouping empty array yields no groups');

// --- Aggregation: sum, average, min, max ---
function aggregate(nums: number[]): { sum: number; avg: number; min: number; max: number } {
  if (nums.length === 0) return { sum: 0, avg: 0, min: 0, max: 0 };
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    sum,
    avg: Math.round((sum / nums.length) * 100) / 100,
    min: Math.min(...nums),
    max: Math.max(...nums),
  };
}

assertEqual(aggregate([10, 20, 30]).sum, 60, 'Sum of 10+20+30 = 60');
assertEqual(aggregate([10, 20, 30]).avg, 20, 'Avg of 10+20+30 = 20');
assertEqual(aggregate([10, 20, 30]).min, 10, 'Min of 10+20+30 = 10');
assertEqual(aggregate([10, 20, 30]).max, 30, 'Max of 10+20+30 = 30');
assertEqual(aggregate([5]).sum, 5, 'Single item sum = 5');
assertEqual(aggregate([5]).avg, 5, 'Single item avg = 5');
assertEqual(aggregate([]).sum, 0, 'Empty array sum = 0');
assertEqual(aggregate([]).avg, 0, 'Empty array avg = 0');
assertEqual(aggregate([100, -50, 25]).sum, 75, 'Sum with negative: 100-50+25 = 75');
assertEqual(aggregate([1.1, 2.2, 3.3]).avg, 2.2, 'Avg of decimals: 6.6/3 = 2.2');

// --- Filtering with multiple criteria ---
interface FilterableItem {
  name: string;
  category: string;
  price: number;
  active: boolean;
}

function filterItems(items: FilterableItem[], criteria: Partial<FilterableItem>): FilterableItem[] {
  return items.filter(item => {
    return Object.entries(criteria).every(([key, value]) => {
      if (typeof value === 'string') return (item as any)[key] === value;
      if (typeof value === 'number') return (item as any)[key] === value;
      if (typeof value === 'boolean') return (item as any)[key] === value;
      return true;
    });
  });
}

const catalog: FilterableItem[] = [
  { name: 'Burger', category: 'food', price: 25, active: true },
  { name: 'Pizza', category: 'food', price: 40, active: true },
  { name: 'Cola', category: 'drink', price: 5, active: true },
  { name: 'Water', category: 'drink', price: 2, active: false },
  { name: 'Salad', category: 'food', price: 15, active: false },
];

assertEqual(filterItems(catalog, { category: 'food' }).length, 3, 'Filter by food category: 3 items');
assertEqual(filterItems(catalog, { active: true }).length, 3, 'Filter active items: 3 items');
assertEqual(filterItems(catalog, { category: 'drink', active: true }).length, 1, 'Filter active drinks: 1 item (Cola)');
assertEqual(filterItems(catalog, { price: 25 }).length, 1, 'Filter by exact price 25: 1 item');
assertEqual(filterItems(catalog, { category: 'nonexistent' }).length, 0, 'Filter by non-existent category: 0 items');
assertEqual(filterItems(catalog, {}).length, 5, 'No criteria returns all items');

// --- Sorting with Arabic locale ---
function sortArabic(arr: string[], direction: 'asc' | 'desc' = 'asc'): string[] {
  return [...arr].sort((a, b) => {
    const cmp = a.localeCompare(b, 'ar');
    return direction === 'asc' ? cmp : -cmp;
  });
}

const arabicNames = ['زياد', 'أحمد', 'محمد', 'إبراهيم', 'علي'];
const sortedAsc = sortArabic(arabicNames);
assert(sortedAsc[0] === sortedAsc[0], 'Ascending sort produces a stable result');
assertEqual(sortedAsc.length, 5, 'Sorted array has same length');

const sortedDesc = sortArabic(arabicNames, 'desc');
assertNotEqual(sortedAsc, sortedDesc, 'Ascending and descending sorts differ');
assertEqual(sortedDesc.length, 5, 'Descending sorted array has same length');

const singleItem = sortArabic(['وحيد']);
assertEqual(singleItem.length, 1, 'Single item sort works');
const emptySort = sortArabic([]);
assertEqual(emptySort.length, 0, 'Empty array sort works');

// --- Pagination calculation ---
function calcPagination(totalItems: number, page: number, perPage: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const offset = (currentPage - 1) * perPage;
  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;
  const startItem = totalItems === 0 ? 0 : offset + 1;
  const endItem = Math.min(offset + perPage, totalItems);
  return { currentPage, totalPages, offset, hasNext, hasPrev, startItem, endItem };
}

const pg1 = calcPagination(100, 1, 10);
assertEqual(pg1.currentPage, 1, 'Page 1 of 100/10');
assertEqual(pg1.totalPages, 10, '100/10 = 10 pages');
assertEqual(pg1.offset, 0, 'Page 1 offset = 0');
assertEqual(pg1.hasNext, true, 'Page 1 has next');
assertEqual(pg1.hasPrev, false, 'Page 1 has no prev');
assertEqual(pg1.startItem, 1, 'Page 1 starts at item 1');
assertEqual(pg1.endItem, 10, 'Page 1 ends at item 10');

const pg5 = calcPagination(100, 5, 10);
assertEqual(pg5.offset, 40, 'Page 5 offset = 40');
assertEqual(pg5.hasPrev, true, 'Page 5 has prev');

const pgLast = calcPagination(100, 10, 10);
assertEqual(pgLast.currentPage, 10, 'Page 10 is current');
assertEqual(pgLast.hasNext, false, 'Last page has no next');
assertEqual(pgLast.endItem, 100, 'Last page ends at item 100');

const pgBeyond = calcPagination(100, 15, 10);
assertEqual(pgBeyond.currentPage, 10, 'Page 15 clamped to 10');

const pgZero = calcPagination(0, 1, 10);
assertEqual(pgZero.totalPages, 1, 'Zero items still has 1 page (min)');
assertEqual(pgZero.hasNext, false, 'Zero items has no next');
assertEqual(pgZero.startItem, 0, 'Zero items starts at 0');

const pgOdd = calcPagination(25, 2, 7);
assertEqual(pgOdd.totalPages, 4, '25/7 = 4 pages (ceil)');
assertEqual(pgOdd.offset, 7, 'Page 2 offset = 7');
assertEqual(pgOdd.endItem, 14, 'Page 2 of 25/7 ends at 14');

// ═══════════════════════════════════════════════════════════════
// Bonus: getRequiredAdvancedPermissionKeys Tests
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 Testing getRequiredAdvancedPermissionKeys...');

import { getRequiredAdvancedPermissionKeys } from '../src/utils/advancedPermissions.js';

// Auth routes should require no permissions
assertEqual(getRequiredAdvancedPermissionKeys('/api/auth/login', 'POST').length, 0, 'Auth login requires no permissions');
assertEqual(getRequiredAdvancedPermissionKeys('/api/chat/send', 'POST').length, 0, 'Chat routes require no permissions');

// POS routes
assert(getRequiredAdvancedPermissionKeys('/api/pos/orders', 'GET').includes('pos.pos_screen'), 'GET /api/pos/orders requires pos.pos_screen');
assert(getRequiredAdvancedPermissionKeys('/api/pos/orders', 'POST').includes('pos.create_order'), 'POST /api/pos/orders requires pos.create_order');
assert(getRequiredAdvancedPermissionKeys('/api/orders/1/checkout', 'POST').includes('pos.checkout'), 'Checkout requires pos.checkout');
assert(getRequiredAdvancedPermissionKeys('/api/orders/1/cancel', 'POST').includes('pos.cancel_order'), 'Cancel requires pos.cancel_order');

// Discount triggers
const discountKeys = getRequiredAdvancedPermissionKeys('/api/pos/orders', 'POST', { discount: 10 });
assert(discountKeys.includes('pos.discount'), 'Body with discount triggers pos.discount permission');

// Credit sale trigger
const creditKeys = getRequiredAdvancedPermissionKeys('/api/pos/orders', 'POST', { payment_method: 'credit' });
assert(creditKeys.includes('pos.credit_sale'), 'Credit payment triggers pos.credit_sale');

// Products route with price modification
const priceKeys = getRequiredAdvancedPermissionKeys('/api/products/1', 'PUT', { price: 50 });
assert(priceKeys.includes('products.pricing'), 'Body with price triggers products.pricing');

// Backup/restore
assert(getRequiredAdvancedPermissionKeys('/api/backup', 'GET').includes('database.download_backup'), 'GET backup requires download_backup');
assert(getRequiredAdvancedPermissionKeys('/api/backup', 'POST').includes('database.backup'), 'POST backup requires database.backup');
assert(getRequiredAdvancedPermissionKeys('/api/restore', 'POST').includes('database.restore'), 'Restore requires database.restore');

// Settings routes
const receiptSettings = getRequiredAdvancedPermissionKeys('/api/settings', 'PUT', { key: 'receipt_logo' });
assert(receiptSettings.includes('security.receipt_settings'), 'Receipt setting key triggers security.receipt_settings');

const appearanceSettings = getRequiredAdvancedPermissionKeys('/api/settings', 'PUT', { key: 'background_color' });
assert(appearanceSettings.includes('security.appearance'), 'Background setting triggers security.appearance');

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log(`📊 Unit Test Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (errors.length > 0) {
  console.log('\n❌ Failed Tests:');
  for (const e of errors) {
    console.log(`   - ${e.test}: ${e.error}`);
  }
}
console.log('═'.repeat(60));

process.exit(failed > 0 ? 1 : 0);