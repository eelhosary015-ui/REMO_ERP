// ═══════════════════════════════════════════════════════════════
// Enterprise Module Test Suite
// Run with: npx tsx tests/enterprise.test.ts
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

// ═══════════════════════════════════════════════════════════════
// Test Permission Service
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 Testing Permission Service...');

import { hasPermission, hasAllPermissions, hasAnyPermission, getOperationalLimits, invalidatePermissionCache } from '../modules/enterprise/services/permission.service.js';

const adminPermSet = {
  userId: 1,
  roleId: 1,
  roleName: 'admin',
  isAdmin: true,
  modules: new Map(),
};

const userPermSet: any = {
  userId: 2,
  roleId: 2,
  roleName: 'user',
  isAdmin: false,
  modules: new Map([
    ['inventory', {
      module: 'inventory',
      actions: { view: true, create: true, update: false, delete: false, approve: false, export: true },
      limits: { max_order_amount: 5000 },
    }],
    ['pos', {
      module: 'pos',
      actions: { view: true, create: true, update: true, delete: false, approve: false, export: false },
    }],
  ]),
};

// Admin should have all permissions
assert(hasPermission(adminPermSet, 'inventory', 'delete'), 'Admin has delete on inventory');
assert(hasPermission(adminPermSet, 'nonexistent', 'create'), 'Admin has create on any module');

// Regular user checks
assert(hasPermission(userPermSet, 'inventory', 'view'), 'User has view on inventory');
assert(hasPermission(userPermSet, 'inventory', 'create'), 'User has create on inventory');
assert(!hasPermission(userPermSet, 'inventory', 'update'), 'User does NOT have update on inventory');
assert(!hasPermission(userPermSet, 'inventory', 'delete'), 'User does NOT have delete on inventory');
assert(hasPermission(userPermSet, 'pos', 'update'), 'User has update on pos');
assert(!hasPermission(userPermSet, 'hr', 'view'), 'User does NOT have access to unconfigured module');

// hasAllPermissions
assert(hasAllPermissions(adminPermSet, [{ module: 'a', action: 'view' }, { module: 'b', action: 'delete' }]), 'Admin passes hasAllPermissions');
assert(hasAllPermissions(userPermSet, [{ module: 'inventory', action: 'view' }, { module: 'pos', action: 'view' }]), 'User passes hasAllPermissions for granted modules');
assert(!hasAllPermissions(userPermSet, [{ module: 'inventory', action: 'view' }, { module: 'inventory', action: 'delete' }]), 'User fails hasAllPermissions for denied action');

// hasAnyPermission
assert(hasAnyPermission(userPermSet, [{ module: 'hr', action: 'view' }, { module: 'pos', action: 'view' }]), 'User passes hasAnyPermission (OR logic)');
assert(!hasAnyPermission(userPermSet, [{ module: 'hr', action: 'view' }, { module: 'hr', action: 'create' }]), 'User fails hasAnyPermission when none match');

// getOperationalLimits
const limits = getOperationalLimits(userPermSet);
assertEqual(limits.max_order_amount, 5000, 'Operational limits include max_order_amount');

// ═══════════════════════════════════════════════════════════════
// Test Company Context Middleware
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 Testing Company Context Middleware...');

import { buildScopeFilter, applyInsertScope, guardCompanyAccess } from '../modules/enterprise/middleware/companyContext.middleware.js';

// Admin context - no filtering
const adminCtx = { company_id: null, branch_id: null, is_admin: true };
const adminScope = buildScopeFilter(adminCtx, 'orders');
assertEqual(adminScope.clause, '', 'Admin context produces empty WHERE clause');
assertEqual(adminScope.params.length, 0, 'Admin context has no params');

// Regular user context - with filtering
const userCtx = { company_id: 1, branch_id: 5, is_admin: false };
const userScope = buildScopeFilter(userCtx, 'orders');
assertIncludes(userScope.clause, 'company_id', 'User scope includes company_id filter');
assertIncludes(userScope.clause, 'branch_id', 'User scope includes branch_id filter');
assertEqual(userScope.params.length, 2, 'User scope has 2 params');

// Tables not in scope lists
const noScopeResult = buildScopeFilter(userCtx, 'nonexistent_table');
assertEqual(noScopeResult.clause, '', 'Non-scoped table produces empty clause');

// applyInsertScope
const insertData = { name: 'Test', quantity: 10 };
const scopedData = applyInsertScope(userCtx, insertData, 'orders');
assertEqual(scopedData.company_id, 1, 'applyInsertScope adds company_id');
assertEqual(scopedData.branch_id, 5, 'applyInsertScope adds branch_id');
assertEqual(scopedData.name, 'Test', 'applyInsertScope preserves original data');

// Don't overwrite existing values
const existingData = { name: 'Test', company_id: 3, branch_id: 7 };
const notOverwritten = applyInsertScope(userCtx, existingData, 'orders');
assertEqual(notOverwritten.company_id, 3, 'applyInsertScope does NOT overwrite existing company_id');
assertEqual(notOverwritten.branch_id, 7, 'applyInsertScope does NOT overwrite existing branch_id');

// Admin context - no injection
const adminInsert = applyInsertScope(adminCtx, { name: 'Test' }, 'orders');
assertEqual(adminInsert.company_id, undefined, 'Admin context does NOT inject company_id');

// guardCompanyAccess
assert(guardCompanyAccess(undefined, { company_id: 1, branch_id: 5 }, 'orders'), 'No context passes guard');
assert(guardCompanyAccess(adminCtx, { company_id: 99, branch_id: 99 }, 'orders'), 'Admin passes guard for any data');
assert(guardCompanyAccess(userCtx, { company_id: 1, branch_id: 5 }, 'orders'), 'User passes guard for own data');
assert(!guardCompanyAccess(userCtx, { company_id: 2, branch_id: 5 }, 'orders'), 'User fails guard for different company');
assert(!guardCompanyAccess(userCtx, { company_id: 1, branch_id: 99 }, 'orders'), 'User fails guard for different branch');
assert(guardCompanyAccess(userCtx, { name: 'test' }, 'orders'), 'User passes guard for record without company_id (not filtered)');

// ═══════════════════════════════════════════════════════════════
// Test Audit Service
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 Testing Audit Service...');

import { determineRiskLevel } from '../modules/enterprise/services/audit.service.js';

// We can't easily test DB operations without a DB, so test the utility functions
// Test risk level determination (internal logic, not exported, so test indirectly)

// ═══════════════════════════════════════════════════════════════
// Test Migration Runner
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 Testing Migration System...');

import { migrationRunner } from '../modules/enterprise/services/migration.service.js';

// Test duplicate registration
try {
  migrationRunner.register({ version: 'TEST_001', name: 'Test', module: 'test', type: 'schema', up: async () => {} });
  migrationRunner.register({ version: 'TEST_001', name: 'Test Duplicate', module: 'test', type: 'schema', up: async () => {} });
  failed++;
  console.log('  ❌ Should throw on duplicate migration version');
} catch (e: any) {
  if (e.message.includes('already registered')) {
    passed++;
    console.log('  ✅ Throws error on duplicate migration version');
  } else {
    failed++;
    console.log(`  ❌ Unexpected error: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Test Auto Posting Service
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 Testing Auto Posting Service...');

import { postSalesInvoice, postPurchaseInvoice, postScrap, postManufacturingCompletion, postInventoryAdjustment, postPayroll } from '../modules/enterprise/services/autoPosting.service.js';

// These would need a DB to fully test, but we can verify they return proper error structures
// when accounts aren't configured (which they won't be in a test env without config)

// ═══════════════════════════════════════════════════════════════
// Test Validators
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 Testing Validators...');

import { ValidationErrorBuilder } from '../modules/enterprise/validators/enterprise.validator.js';

const v = new ValidationErrorBuilder();
v.required({ name: '' }, 'name', 'الاسم');
v.required({ email: 'test@test.com' }, 'email', 'البريد');
v.number({ age: 'abc' }, 'age', 'العمر');
v.number({ price: 100 }, 'price', 'السعر');
v.positiveNumber({ qty: -5 }, 'qty', 'الكمية');
v.positiveNumber({ qty: 10 }, 'qty2', 'الكمية');
v.email({ email: 'invalid' }, 'email');
v.email({ email: 'valid@test.com' }, 'email2');
v.maxLength({ name: 'a'.repeat(300) }, 'name', 'الاسم', 200);
v.inArray({ status: 'invalid' }, 'status', ['active', 'inactive'], 'الحالة');
v.inArray({ status: 'active' }, 'status2', ['active', 'inactive'], 'الحالة');
v.array({ items: 'not-array' }, 'items', 'العناصر');
v.array({ items: [1, 2] }, 'items2', 'العناصر');

assertEqual(v.errorList.length, 6, `ValidationErrorBuilder caught 6 errors (got ${v.errorList.length})`);
assert(v.hasErrors, 'ValidationErrorBuilder hasErrors is true');

const v2 = new ValidationErrorBuilder();
v2.required({ name: 'test' }, 'name', 'الاسم');
v2.number({ age: 25 }, 'age', 'العمر');
assert(!v2.hasErrors, 'ValidationErrorBuilder with valid data has no errors');

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(50));
console.log(`📊 Test Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (errors.length > 0) {
  console.log('\n❌ Failed Tests:');
  for (const e of errors) {
    console.log(`   - ${e.test}: ${e.error}`);
  }
}
console.log('═'.repeat(50));

process.exit(failed > 0 ? 1 : 0);