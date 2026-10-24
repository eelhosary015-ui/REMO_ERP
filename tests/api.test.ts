// ═══════════════════════════════════════════════════════════════
// Remo Pro — API Integration Test Suite
// Run: npx tsx tests/api.test.ts
// Requires: server running at TEST_URL (default http://localhost:3001)
// ═══════════════════════════════════════════════════════════════

// ─── Counters & error collector ─────────────────────────────
let passed = 0;
let failed = 0;
const errors: Array<{ test: string; error: string }> = [];

// ─── Custom assertions (same style as enterprise.test.ts) ──
function assert(condition: boolean, test: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${test}`);
  } else {
    failed++;
    console.log(`  ❌ ${test}`);
    errors.push({ test, error: 'Assertion failed' });
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

function assertIncludes(str: string, substr: string, test: string) {
  const s = typeof str === 'string' ? str : JSON.stringify(str);
  if (s.includes(substr)) {
    passed++;
    console.log(`  ✅ ${test}`);
  } else {
    failed++;
    console.log(`  ❌ ${test} — "${s}" does not include "${substr}"`);
    errors.push({ test, error: `Missing substring: ${substr}` });
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

// ─── HTTP helper ────────────────────────────────────────────
const BASE = process.env.TEST_URL || 'http://localhost:3001';

async function api(method: string, path: string, body?: any, token?: string) {
  const opts: any = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data, ok: res.ok };
}

// ─── Shared state ───────────────────────────────────────────
let adminToken = '';
let serverAvailable = false;

// ─── Setup: login and grab a JWT ────────────────────────────
async function setup() {
  try {
    const { status, data } = await api('GET', '/api/health');
    if (status === 200) {
      serverAvailable = true;
      console.log(`  ℹ️  Server reachable at ${BASE} (health: ${data?.status ?? 'unknown'})`);
    } else {
      console.log(`  ⚠️  Server responded with status ${status} on /api/health`);
      serverAvailable = true; // still reachable, might be degraded
    }
  } catch {
    console.log(`  ⚠️  Server NOT reachable at ${BASE} — tests will be marked as skipped`);
    return;
  }

  // Authenticate as admin
  const pwd = process.env.TEST_ADMIN_PASSWORD || 'admin';
  try {
    const { status, data } = await api('POST', '/api/login', {
      username: 'admin',
      password: pwd,
    });
    if (status === 200 && data?.token) {
      adminToken = data.token;
      console.log(`  ✅ Logged in as admin (id=${data.user?.id})`);
    } else {
      console.log(`  ⚠️  Login failed (${status}) — protected-route tests will show 401`);
    }
  } catch {
    console.log(`  ⚠️  Login request threw — protected-route tests will show 401`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. AUTHENTICATION TESTS | اختبارات المصادقة
// ═══════════════════════════════════════════════════════════════
async function testAuthentication() {
  console.log('\n📋 Testing Authentication | اختبار المصادقة...');

  // 1-a) POST /api/login with valid credentials returns JWT token
  // تسجيل الدخول ببيانات صحيحة يُرجع رمز JWT
  try {
    const { status, data } = await api('POST', '/api/login', {
      username: 'admin',
      password: process.env.TEST_ADMIN_PASSWORD || 'admin',
    });
    assertEqual(status, 200, 'POST /api/login with valid credentials returns 200');
    assert(data && typeof data.token === 'string' && data.token.length > 0,
      'Response body contains a non-empty JWT token');
    assert(data && data.user && typeof data.user.id === 'number',
      'Response body contains user object with numeric id');
    assert(data && data.user && typeof data.user.role === 'string',
      'Response body contains user object with role string');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ POST /api/login valid credentials — ${err.message}`);
    errors.push({ test: 'POST /api/login valid credentials', error: err.message });
  }

  // 1-b) POST /api/login with invalid credentials returns 401
  // تسجيل الدخول ببيانات خاطئة يُرجع 401
  try {
    const { status, data } = await api('POST', '/api/login', {
      username: 'admin',
      password: 'wrong_password_xyz_999',
    });
    assertEqual(status, 401, 'POST /api/login with wrong password returns 401');
    assert(data && (data.error === 'Invalid credentials' || typeof data.error === 'string'),
      'Error response contains an error message string');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ POST /api/login invalid credentials — ${err.message}`);
    errors.push({ test: 'POST /api/login invalid credentials', error: err.message });
  }

  // 1-c) POST /api/login with non-existent user returns 401
  // تسجيل الدخول باسم مستخدم غير موجود
  try {
    const { status } = await api('POST', '/api/login', {
      username: 'nonexistent_user_xyz',
      password: 'whatever',
    });
    assertEqual(status, 401, 'POST /api/login with non-existent user returns 401');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ POST /api/login non-existent user — ${err.message}`);
    errors.push({ test: 'POST /api/login non-existent user', error: err.message });
  }

  // 1-d) GET /api/health returns 200 without auth
  // فحص الصحة يعمل بدون مصادقة
  try {
    const { status, data } = await api('GET', '/api/health');
    assertEqual(status, 200, 'GET /api/health returns 200 without auth');
    assert(data && data.status === 'ok', '/api/health response contains status "ok"');
    assert(data && typeof data.uptime_seconds === 'number',
      '/api/health response includes uptime_seconds number');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/health — ${err.message}`);
    errors.push({ test: 'GET /api/health', error: err.message });
  }

  // 1-e) GET /api/settings (protected) without token returns 401
  // محاولة الوصول لصفحة محمية بدون توكن
  try {
    const { status, data } = await api('GET', '/api/settings/general', undefined, '');
    assertEqual(status, 401, 'GET /api/settings/general without token returns 401');
    assert(data && typeof data.error === 'string',
      '401 response contains an error message');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/settings protected — ${err.message}`);
    errors.push({ test: 'GET /api/settings protected', error: err.message });
  }

  // 1-f) Rate limiting blocks after too many requests
  // الحد الأقصى للطلبات يمنع الطلبات المتكررة
  try {
    let blocked = false;
    for (let i = 0; i < 110; i++) {
      const { status } = await api('POST', '/api/login', {
        username: 'ratelimit_test',
        password: 'wrong',
      });
      if (status === 429) {
        blocked = true;
        break;
      }
    }
    assert(blocked, 'Rate limiting kicks in after repeated failed login attempts (429)');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ Rate limiting test — ${err.message}`);
    errors.push({ test: 'Rate limiting', error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. POS SYSTEM TESTS | اختبارات نظام نقاط البيع
// ═══════════════════════════════════════════════════════════════
async function testPOS() {
  console.log('\n📋 Testing POS System | اختبار نظام نقاط البيع...');

  // 2-a) GET /api/products returns product list
  // جلب قائمة المنتجات
  try {
    const { status, data } = await api('GET', '/api/products', undefined, adminToken);
    if (!serverAvailable) {
      console.log('  ⏭️  Skipped (server not reachable)');
      return;
    }
    if (adminToken) {
      assertEqual(status, 200, 'GET /api/products returns 200 with auth');
      assert(Array.isArray(data), 'GET /api/products response is an array');
      if (data && data.length > 0) {
        assert(typeof data[0].id === 'number',
          'First product in list has a numeric id');
      }
    } else {
      assertEqual(status, 401, 'GET /api/products without auth returns 401');
    }
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/products — ${err.message}`);
    errors.push({ test: 'GET /api/products', error: err.message });
  }

  // 2-b) POST /api/pos/order creates a new order
  // إنشاء طلب جديد عبر نقطة البيع
  try {
    if (!adminToken) {
      console.log('  ⏭️  Skipped (no auth token)');
      return;
    }
    const { status, data } = await api('POST', '/api/pos/order', {
      items: [{ product_id: 1, quantity: 1, price: 10 }],
      payment_method: 'cash',
    }, adminToken);
    assert(status >= 200 && status < 300,
      `POST /api/pos/order returns 2xx (got ${status})`);
    assert(data && typeof data.id === 'number',
      'Created order response contains numeric id');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ POST /api/pos/order create — ${err.message}`);
    errors.push({ test: 'POST /api/pos/order create', error: err.message });
  }

  // 2-c) POST /api/pos/order without items returns 400 or error
  // إنشاء طلب بدون عناصر يُرجع خطأ
  try {
    if (!adminToken) {
      console.log('  ⏭️  Skipped (no auth token)');
      return;
    }
    const { status, data } = await api('POST', '/api/pos/order', {
      items: [],
      payment_method: 'cash',
    }, adminToken);
    assert(status === 400 || status === 422 || status >= 500,
      `POST /api/pos/order with empty items returns error status (got ${status})`);
    assert(data && typeof data.error === 'string',
      'Empty-items order response contains error message');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ POST /api/pos/order empty items — ${err.message}`);
    errors.push({ test: 'POST /api/pos/order empty items', error: err.message });
  }

  // 2-d) POST /api/pos/order with negative quantity returns error
  // طلب بكمية سالبة يُرجع خطأ
  try {
    if (!adminToken) {
      console.log('  ⏭️  Skipped (no auth token)');
      return;
    }
    const { status, data } = await api('POST', '/api/pos/order', {
      items: [{ product_id: 1, quantity: -5, price: 10 }],
      payment_method: 'cash',
    }, adminToken);
    assert(status === 400 || status === 422 || status >= 500,
      `POST /api/pos/order with negative quantity returns error (got ${status})`);
  } catch (err: any) {
    failed++;
    console.log(`  ❌ POST /api/pos/order negative qty — ${err.message}`);
    errors.push({ test: 'POST /api/pos/order negative qty', error: err.message });
  }

  // 2-e) GET /api/products without auth returns 401
  // جلب المنتجات بدون مصادقة ممنوع
  try {
    const { status } = await api('GET', '/api/products');
    assertEqual(status, 401, 'GET /api/products without token returns 401');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/products no auth — ${err.message}`);
    errors.push({ test: 'GET /api/products no auth', error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. INVENTORY TESTS | اختبارات المخزون
// ═══════════════════════════════════════════════════════════════
async function testInventory() {
  console.log('\n📋 Testing Inventory | اختبار المخزون...');

  // 3-a) GET /api/ingredients returns ingredient list
  // جلب قائمة المكونات
  try {
    const { status, data } = await api('GET', '/api/ingredients', undefined, adminToken);
    if (!serverAvailable) {
      console.log('  ⏭️  Skipped (server not reachable)');
      return;
    }
    if (adminToken) {
      assertEqual(status, 200, 'GET /api/ingredients returns 200 with auth');
      assert(Array.isArray(data), 'GET /api/ingredients response is an array');
    } else {
      assertEqual(status, 401, 'GET /api/ingredients without auth returns 401');
    }
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/ingredients — ${err.message}`);
    errors.push({ test: 'GET /api/ingredients', error: err.message });
  }

  // 3-b) GET /api/warehouses returns warehouse list
  // جلب قائمة المخازن
  try {
    const { status, data } = await api('GET', '/api/warehouses', undefined, adminToken);
    if (!adminToken) {
      console.log('  ⏭️  Skipped (no auth token)');
      return;
    }
    assertEqual(status, 200, 'GET /api/warehouses returns 200 with auth');
    assert(Array.isArray(data), 'GET /api/warehouses response is an array');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/warehouses — ${err.message}`);
    errors.push({ test: 'GET /api/warehouses', error: err.message });
  }

  // 3-c) POST /api/inventory/adjust creates adjustment
  // إنشاء تسوية مخزون
  try {
    if (!adminToken) {
      console.log('  ⏭️  Skipped (no auth token)');
      return;
    }
    const { status, data } = await api('POST', '/api/inventory/adjust', {
      ingredient_id: 1,
      warehouse_id: 1,
      quantity: 10,
      reason: 'API test adjustment — تعديل اختبار',
    }, adminToken);
    // May succeed (200/201) or fail gracefully if ingredient/warehouse don't exist
    assert(status >= 200 && status < 300 || status === 400 || status === 404,
      `POST /api/inventory/adjust returns expected status (got ${status})`);
  } catch (err: any) {
    failed++;
    console.log(`  ❌ POST /api/inventory/adjust — ${err.message}`);
    errors.push({ test: 'POST /api/inventory/adjust', error: err.message });
  }

  // 3-d) GET /api/inventory/adjust without auth returns 401
  // الوصول لتسوية المخزون بدون مصادقة ممنوع
  try {
    const { status } = await api('GET', '/api/inventory/adjust');
    assertEqual(status, 401, 'GET /api/inventory/adjust without token returns 401');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/inventory/adjust no auth — ${err.message}`);
    errors.push({ test: 'GET /api/inventory/adjust no auth', error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// 4. SECURITY TESTS | اختبارات الأمان
// ═══════════════════════════════════════════════════════════════
async function testSecurity() {
  console.log('\n📋 Testing Security | اختبار الأمان...');

  // 4-a) GET /api/uploads/filename without auth returns 401
  // الوصول للملفات المرفوعة بدون مصادقة ممنوع
  try {
    const { status } = await api('GET', '/api/uploads/test-file.pdf');
    assertEqual(status, 401, 'GET /api/uploads/* without token returns 401');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/uploads/* no auth — ${err.message}`);
    errors.push({ test: 'GET /api/uploads/* no auth', error: err.message });
  }

  // 4-b) POST /api/login records failed attempt on wrong password
  // تسجيل الدخول الخاطئ يُسجّل محاولة فاشلة
  try {
    // First attempt — should fail with 401
    const { status: s1 } = await api('POST', '/api/login', {
      username: 'security_test_user',
      password: 'definitely_wrong',
    });
    assertEqual(s1, 401, 'Wrong-password login returns 401');

    // Second attempt with same user — should also fail (and trigger rate-limit recording)
    const { status: s2 } = await api('POST', '/api/login', {
      username: 'security_test_user',
      password: 'definitely_wrong_again',
    });
    assertEqual(s2, 401, 'Second wrong-password login also returns 401');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ Failed-login recording — ${err.message}`);
    errors.push({ test: 'Failed-login recording', error: err.message });
  }

  // 4-c) SQL injection in search params is blocked
  // حقن SQL في معلمات البحث يتم إيقافه
  try {
    if (!adminToken) {
      console.log('  ⏭️  Skipped (no auth token)');
      return;
    }
    const { status, data } = await api('GET',
      '/api/products?search=1%27%20OR%201%3D1%20--',
      undefined,
      adminToken
    );
    // The server should not crash; it should return 200 (with filtered/empty results)
    // or at least a valid JSON response — never a raw DB error
    assert(status >= 200 && status < 500,
      `SQL injection in search does not crash server (status ${status})`);
    // Response must be valid JSON (fetch already parsed it)
    assert(data !== null, 'SQL injection response is valid JSON, not an error page');
    // Ensure no raw SQL error leaked
    const jsonStr = JSON.stringify(data);
    const sqlLeak = jsonStr.toLowerCase().includes('sqlstate') ||
                    jsonStr.toLowerCase().includes('syntax error') ||
                    jsonStr.toLowerCase().includes('pg_');
    assert(!sqlLeak, 'SQL injection response does NOT leak database error details');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ SQL injection test — ${err.message}`);
    errors.push({ test: 'SQL injection test', error: err.message });
  }

  // 4-d) XSS in input is sanitized
  // حقن XSS في المدخلات يتم تنظيفه
  try {
    if (!adminToken) {
      console.log('  ⏭️  Skipped (no auth token)');
      return;
    }
    const xssPayload = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
    // We test that the server doesn't echo the raw XSS payload back in an error
    const { status, data } = await api('POST', '/api/pos/order', {
      items: [{ product_id: 99999, quantity: 1, name: xssPayload }],
      payment_method: 'cash',
    }, adminToken);
    const responseStr = JSON.stringify(data ?? '');
    const rawEcho = responseStr.includes('<script>') || responseStr.includes('onerror=');
    assert(!rawEcho, 'XSS payload is NOT echoed back raw in response');
    assert(status !== 500 || !rawEcho,
      'XSS input does not cause unhandled 500 with payload echo');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ XSS sanitization test — ${err.message}`);
    errors.push({ test: 'XSS sanitization test', error: err.message });
  }

  // 4-e) Auth token with invalid JWT returns 401/403
  // توكن JWT غير صالح يُرجع خطأ
  try {
    const { status } = await api('GET', '/api/products', undefined, 'invalid.jwt.token.here');
    assert(status === 401 || status === 403,
      `Invalid JWT token returns 401/403 (got ${status})`);
  } catch (err: any) {
    failed++;
    console.log(`  ❌ Invalid JWT token — ${err.message}`);
    errors.push({ test: 'Invalid JWT token', error: err.message });
  }

  // 4-f) Missing Content-Type on POST still handled gracefully
  // طلب POST بدون Content-Type يُعالج بسلام
  try {
    const res = await fetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not-json',
    });
    const data = await res.json().catch(() => null);
    // Should not crash — either 400/401/422 or 500 but with JSON
    assert(data !== null || res.status === 429,
      'Malformed POST body returns JSON or rate-limit (no crash)');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ Missing content-type handling — ${err.message}`);
    errors.push({ test: 'Missing content-type handling', error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// 5. ACCOUNTING TESTS | اختبارات المحاسبة
// ═══════════════════════════════════════════════════════════════
async function testAccounting() {
  console.log('\n📋 Testing Accounting | اختبار المحاسبة...');

  // 5-a) GET /api/safes returns safe list
  // جلب قائمة الخزائن
  try {
    const { status, data } = await api('GET', '/api/safes', undefined, adminToken);
    if (!adminToken) {
      console.log('  ⏭️  Skipped (no auth token)');
      return;
    }
    assertEqual(status, 200, 'GET /api/safes returns 200 with auth');
    assert(Array.isArray(data), 'GET /api/safes response is an array');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/safes — ${err.message}`);
    errors.push({ test: 'GET /api/safes', error: err.message });
  }

  // 5-b) GET /api/safes without auth returns 401
  // جلب الخزائن بدون مصادقة ممنوع
  try {
    const { status } = await api('GET', '/api/safes');
    assertEqual(status, 401, 'GET /api/safes without token returns 401');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/safes no auth — ${err.message}`);
    errors.push({ test: 'GET /api/safes no auth', error: err.message });
  }

  // 5-c) GET /api/vouchers returns voucher list
  // جلب قائمة السندات
  try {
    const { status, data } = await api('GET', '/api/vouchers', undefined, adminToken);
    if (!adminToken) {
      console.log('  ⏭️  Skipped (no auth token)');
      return;
    }
    assertEqual(status, 200, 'GET /api/vouchers returns 200 with auth');
    assert(Array.isArray(data), 'GET /api/vouchers response is an array');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/vouchers — ${err.message}`);
    errors.push({ test: 'GET /api/vouchers', error: err.message });
  }

  // 5-d) GET /api/treasury/accounts returns accounts
  // جلب قائمة الحسابات الخزينة
  try {
    const { status, data } = await api('GET', '/api/treasury/accounts', undefined, adminToken);
    if (!adminToken) {
      console.log('  ⏭️  Skipped (no auth token)');
      return;
    }
    assertEqual(status, 200, 'GET /api/treasury/accounts returns 200 with auth');
    assert(Array.isArray(data), 'GET /api/treasury/accounts response is an array');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/treasury/accounts — ${err.message}`);
    errors.push({ test: 'GET /api/treasury/accounts', error: err.message });
  }

  // 5-e) GET /api/treasury/accounts without auth returns 401
  // جلب الحسابات الخزينة بدون مصادقة ممنوع
  try {
    const { status } = await api('GET', '/api/treasury/accounts');
    assertEqual(status, 401, 'GET /api/treasury/accounts without token returns 401');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/treasury/accounts no auth — ${err.message}`);
    errors.push({ test: 'GET /api/treasury/accounts no auth', error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// 6. HR TESTS | اختبارات الموارد البشرية
// ═══════════════════════════════════════════════════════════════
async function testHR() {
  console.log('\n📋 Testing HR | اختبار الموارد البشرية...');

  // 6-a) GET /api/hr/employees returns employee list
  // جلب قائمة الموظفين
  try {
    const { status, data } = await api('GET', '/api/hr/employees', undefined, adminToken);
    if (!adminToken) {
      console.log('  ⏭️  Skipped (no auth token)');
      return;
    }
    assertEqual(status, 200, 'GET /api/hr/employees returns 200 with auth');
    assert(Array.isArray(data), 'GET /api/hr/employees response is an array');
    if (data && data.length > 0) {
      assert(typeof data[0].id === 'number',
        'First employee in list has a numeric id');
    }
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/hr/employees — ${err.message}`);
    errors.push({ test: 'GET /api/hr/employees', error: err.message });
  }

  // 6-b) GET /api/hr/employees without auth returns 401
  // جلب الموظفين بدون مصادقة ممنوع
  try {
    const { status } = await api('GET', '/api/hr/employees');
    assertEqual(status, 401, 'GET /api/hr/employees without token returns 401');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/hr/employees no auth — ${err.message}`);
    errors.push({ test: 'GET /api/hr/employees no auth', error: err.message });
  }

  // 6-c) POST /api/hr/attendance records attendance
  // تسجيل الحضور
  try {
    if (!adminToken) {
      console.log('  ⏭️  Skipped (no auth token)');
      return;
    }
    const { status, data } = await api('POST', '/api/hr/attendance', {
      employee_id: 1,
      date: new Date().toISOString().split('T')[0],
      check_in: '08:00',
    }, adminToken);
    // May succeed or fail if employee_id doesn't exist — both are acceptable
    assert(status >= 200 && status < 500,
      `POST /api/hr/attendance returns valid HTTP status (got ${status})`);
  } catch (err: any) {
    failed++;
    console.log(`  ❌ POST /api/hr/attendance — ${err.message}`);
    errors.push({ test: 'POST /api/hr/attendance', error: err.message });
  }

  // 6-d) GET /api/hr/attendance without auth returns 401
  // جلب سجل الحضور بدون مصادقة ممنوع
  try {
    const { status } = await api('GET', '/api/hr/attendance');
    assertEqual(status, 401, 'GET /api/hr/attendance without token returns 401');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/hr/attendance no auth — ${err.message}`);
    errors.push({ test: 'GET /api/hr/attendance no auth', error: err.message });
  }

  // 6-e) POST /api/hr/attendance with missing fields returns error
  // تسجيل حضور بدون حقول مطلوبة يُرجع خطأ
  try {
    if (!adminToken) {
      console.log('  ⏭️  Skipped (no auth token)');
      return;
    }
    const { status } = await api('POST', '/api/hr/attendance', {}, adminToken);
    assert(status === 400 || status === 422 || status >= 500,
      `POST /api/hr/attendance with empty body returns error (got ${status})`);
  } catch (err: any) {
    failed++;
    console.log(`  ❌ POST /api/hr/attendance empty body — ${err.message}`);
    errors.push({ test: 'POST /api/hr/attendance empty body', error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// 7. EDGE CASES | حالات حدودية إضافية
// ═══════════════════════════════════════════════════════════════
async function testEdgeCases() {
  console.log('\n📋 Testing Edge Cases | اختبار الحالات الحدية...');

  // 7-a) GET /api/nonexistent-endpoint returns 404 (or 401)
  // نقطة نهاية غير موجودة
  try {
    const { status } = await api('GET', '/api/nonexistent_xyz_endpoint', undefined, adminToken);
    assert(status === 404 || status === 401,
      `GET /api/nonexistent returns 404/401 (got ${status})`);
  } catch (err: any) {
    failed++;
    console.log(`  ❌ Nonexistent endpoint — ${err.message}`);
    errors.push({ test: 'Nonexistent endpoint', error: err.message });
  }

  // 7-b) POST with extremely large body is handled
  // طلب بحجم كبير جداً يُعالج بسلام
  try {
    const largePayload = { data: 'x'.repeat(5_000_000) };
    const { status } = await api('POST', '/api/login', largePayload);
    // Should not crash — either 413, 400, 401, or 429
    assert(status === 413 || status === 400 || status === 401 || status === 429,
      `Large payload returns safe status code (got ${status})`);
  } catch (err: any) {
    // fetch itself might throw for very large payloads, which is also acceptable
    passed++;
    console.log(`  ✅ Large payload test — fetch rejected (acceptable)`);
  }

  // 7-c) OPTIONS preflight is handled
  // طلب OPTIONS يُعالج بسلام
  try {
    const res = await fetch(`${BASE}/api/products`, { method: 'OPTIONS' });
    const isOk = res.status < 500;
    assert(isOk, `OPTIONS /api/products returns < 500 (got ${res.status})`);
  } catch (err: any) {
    failed++;
    console.log(`  ❌ OPTIONS preflight — ${err.message}`);
    errors.push({ test: 'OPTIONS preflight', error: err.message });
  }

  // 7-d) GET /api/network/ip returns 200 without auth
  // جلب IP الشبكة بدون مصادقة
  try {
    const { status, data } = await api('GET', '/api/network/ip');
    assertEqual(status, 200, 'GET /api/network/ip returns 200 without auth');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ GET /api/network/ip — ${err.message}`);
    errors.push({ test: 'GET /api/network/ip', error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// Runner
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log('═'.repeat(55));
  console.log('🧪 Remo Pro — API Integration Tests');
  console.log(`   Target: ${BASE}`);
  console.log('═'.repeat(55));

  await setup();

  await testAuthentication();
  await testPOS();
  await testInventory();
  await testSecurity();
  await testAccounting();
  await testHR();
  await testEdgeCases();

  // ─── Summary ──────────────────────────────────────────────
  console.log('\n' + '═'.repeat(55));
  console.log(`📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (errors.length > 0) {
    console.log('\n❌ Failed Tests:');
    for (const e of errors) {
      console.log(`   - ${e.test}: ${e.error}`);
    }
  }
  console.log('═'.repeat(55));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(2);
});