# تقرير إصلاح: `require is not defined` و`jwt malformed` — REMO PRO ERP

**التاريخ:** 2026-10-21
**الفرع:** `cleanup/phase-1`
**قاعدة التشغيل:** `erp_system2` (لم تُعدَّل)
**قواعد الاختبار:** `erp_system2_test` (مُعاد بناؤها هيكليًا)، و`erp_system2_e2e_test` (أُنشئت ثم حُذفت)

---

## 1. السبب الجذري

### 1.1 `Database initialization failed: require is not defined`

- **الملف:** `server-db-init.ts`
- **السطر الأصلي:** 2558
- **الدالة:** `initDb()` — قسم «Create or update default admin»
- **الكود المتسبب:** `require("crypto").randomBytes(12).toString("base64url")`

المشروع ES Modules بالكامل: `package.json` يحمل `"type": "module"`، و`tsconfig.json` يستخدم `"module": "ESNext"` و`"moduleResolution": "bundler"`، والتشغيل عبر `tsx server.ts`. في ESM لا يوجد المتغير العام `require`، فيرمي التعبير `ReferenceError: require is not defined`.

الخطأ لا يظهر عند تحميل الوحدة، بل عند الوصول إلى هذا السطر داخل `initDb`، ويلتقطه `catch` الخارجي (السطر 5678) الذي كان يكتفي بالطباعة:

```ts
} catch (error: any) {
  console.error("Database initialization failed:", error.message);
  ...
}
```

**الأثر الفعلي:** كل ما يلي السطر 2558 داخل نفس `try` لم يُنفَّذ إطلاقًا في كل تشغيل مصاب:

- إنشاء/تحديث حسابي `admin` و`elhosary` وصلاحياتهما (السطور 2562–2590)
- إنشاء الفرع الرئيسي والمخزن الرئيسي وأقسام HR عند كونها فارغة
- بذر دليل الحسابات عند كونه فارغًا (4249–4379)
- «ERP Accounting enhancements» (4415)
- رسالة `Database initialized successfully` (4420) — أي أن السيرفر لم يكن يعلن اكتمال التهيئة أصلًا
- ترقيع الإعدادات، أعمدة الموردين، جداول الموافقات، `warehouse_stock_alerts`، أعمدة `products`
- كل كتل Enterprise: `companies`, `roles`/`role_permissions`, `batch_tracking`, `reordering_rules`, `stock_valuation`, `production_boms`, `work_centers`, `manufacturing_orders`, `production_routing`, `quality_checks`, `scrap_records`, `maintenance_*`, `preventive_maintenance`, CRM، `recipes`/`waste_records`, `enterprise_audit_log`, `daily_kpi_snapshots`
- تهيئة سكيما المخازن Enterprise، والفهارس الإضافية
- المعالجة الذاتية لـ GRN: ترحيل المخزون للاستلامات المُرحَّلة وإنشاء فواتير الشراء الناقصة (5494–5666)

**لماذا 344 جدولًا لا تثبت النجاح:** الجداول كانت موجودة من تشغيلات سابقة ناجحة قبل إدخال هذا السطر، كما أن `runEnterpriseMigrations()` يعمل بعد `initDb` في `startServer` ويطبق 8 ترحيلات. العدد الكلي للجداول لا يعكس أن بذر البيانات والفهارس والمعالجات اللاحقة لم تُنفَّذ. الدليل الحاسم: رسالة `Database initialized successfully` و`ERP Enterprise database extensions complete` كانت غائبة من السجل، وحساب `admin` لم يكن يُنشأ على قاعدة جديدة.

### 1.2 `Global API security error: jwt malformed`

- **نقطة الالتقاط:** `server.ts` — `globalApiSecurityMiddleware()`، المعالج العام `catch` (كان السطر 676)
- **المصدر:** توكنات غير JWT كانت تُرسل من الواجهة، و`jwt.verify()` يرمي `JsonWebTokenError: jwt malformed`.

مصادر التوكن غير الصالح في الواجهة:

1. **`src/utils/api.ts` → `getHeaders()`** (السبب الرئيسي): عند غياب توكن المستخدم كان الكود يستخدم
   `localStorage.getItem('employee_mobile_token') || 'preview-bypass-token'`، أي أنه يُرسل `Authorization: Bearer preview-bypass-token` مع كل طلب `api.get/post/...` قبل تسجيل الدخول. هذه القيمة ليست JWT (جزء واحد بلا نقاط) فيرمي التحقق `jwt malformed`، ثم يُسجَّل الخطأ ويُعاد 403.
2. **`src/utils/fetcher.ts`**: كان يضيف `Bearer preview-bypass-token` عند غياب التوكن (نفس المشكلة عبر SWR).
3. **`AIDeveloperCenter.tsx`, `TaxesView.tsx`, مكونات الخزينة** (`DailyClosingEnterprise`, `TreasuryTransactionsEnterprise`, `closings/*`): كانت تستخدم `localStorage.getItem("token") || "preview-bypass-token"`.
4. **24 موضعًا** في مكونات الواجهة تستخدم `` `Bearer ${localStorage.getItem("token")}` `` مباشرة، فيُرسَل حرفيًا `Bearer null` عند عدم تسجيل الدخول، وتُلتقط في `jwt.verify` كخطأ تنسيق.
5. **`server.ts:56`**: نفس خطأ `require("crypto")` داخل `resolveJwtSecret()`؛ لم يُفعَّل عند التشغيل لأنه `JWT_SECRET` في `.env` بطول 96 حرفًا، لكنه كان قنبلة موقوتة لأي بيئة بلا سر كافٍ.

### 1.3 عيبان مساعدان

- التقاط الأخطاء في الـ middleware كان يعيد **403** لكل خطأ (حتى أخطاء JWT وأخطاء قاعدة البيانات) ويسجل الرسالة بلا مسار، ما يجعل تشخيص المصدر صعبًا.
- `initDb` كان يبتلع الفشل، فيبدأ السيرفر بالاستماع على 3000 رغم فشل التهيئة.

---

## 2. الملفات المعدلة

### الخادم

| الملف | التعديل |
|---|---|
| `server-db-init.ts` | استخدام `randomBytes` المستورد من `crypto` بدلاً من `require` (2558)؛ وإعادة رمي الخطأ بعد الرسائل التشخيصية (5709) |
| `server.ts` | `randomBytes` بدلاً من `require` في `resolveJwtSecret` (56)؛ دالة `extractBearerToken()` (490)؛ استخراج آمن + تسجيل مسار وسبب فقط (515–524)؛ 401 واضح لـ `TOKEN_EXPIRED`/`TOKEN_INVALID` (584–600)؛ 500 لأخطاء داخلية بدل 403 (718)؛ إيقاف التشغيل عند فشل البدء (2004) |

### الواجهة

| الملف | التعديل |
|---|---|
| `src/utils/api.ts` | `JWT_SHAPE`، `isUsableAuthToken()`، `getAuthToken()`، `authHeaders()`؛ إزالة fallback الـ bypass؛ لم يعد يُرسل `Authorization` إلا لتوكن صالح |
| `src/utils/fetcher.ts` | استخدام `authHeaders()` وإزالة `Bearer preview-bypass-token` |
| `src/contexts/AuthContext.tsx` | التحقق من شكل التوكن عند الإقلاع، وحذف أي قيمة تالفة مع `user` والعودة لشاشة الدخول |
| `src/App.tsx` | socket.io يتصل فقط بتوكن صالح |
| `src/components/AIChatAssistantModal.tsx` | `authHeaders()` بدل `Bearer ${token || ""}` |
| `src/components/AIDeveloperCenter.tsx` | إزالة bypass من `getHeaders()` |
| `src/components/AppearanceSettings.tsx` | `authHeaders()` |
| `src/components/ChangePasswordModal.tsx` | `authHeaders()` |
| `src/components/ChatModal.tsx` | `authHeaders()` (4 مواضع) |
| `src/components/CustomerAccounts.tsx` | `authHeaders()` (3 مواضع) |
| `src/components/ERPCore.tsx` | `authHeaders()` (4 مواضع) |
| `src/components/GlobalReportPrint.tsx` | `authHeaders()` |
| `src/components/Products.tsx` | `authHeaders()` في رفع الملفات |
| `src/components/ReportTemplateDesigner.tsx` | `authHeaders()` (موضعان) |
| `src/components/Reservations.tsx` | `authHeaders()` (4 مواضع) |
| `src/components/TaxesView.tsx` | إزالة bypass واستخدام `authHeaders()` |
| `src/components/production/BOMManagement.tsx` | `authHeaders()` |
| `src/components/treasury/DailyClosingEnterprise.tsx` | إزالة bypass |
| `src/components/treasury/TreasuryTransactionsEnterprise.tsx` | إزالة bypass (موضعان) |
| `src/components/treasury/closings/CashVarianceReportView.tsx` | إزالة bypass |
| `src/components/treasury/closings/ClosingDetailModal.tsx` | إزالة bypass |
| `src/components/treasury/closings/DenominationCalculator.tsx` | إزالة bypass (موضعان) |
| `src/components/treasury/closings/PreClosingLedgerModal.tsx` | إزالة bypass |
| `src/utils/wordExport.ts` | `authHeaders()` |

> لم يُحوَّل المشروع إلى CommonJS، ولم يُحذف أي ترحيل أو عملية تهيئة، ولم يُخفَّف أي تحقق أمني. `createRequire` الموجود في `modules/hr/hr_api.routes.ts:8779` صحيح ومتوافق مع ESM، فلم يُغيَّر.

---

## 3. وصف الإصلاح

### 3.1 إصلاح `require`

- `server-db-init.ts` يستورد أصلًا `randomBytes` من `crypto` في السطر 2، فاستُخدم مباشرة.
- `server.ts` يستورد `randomBytes` في السطر 23، فاستُخدم في `resolveJwtSecret`.

### 3.2 الفشل لم يعد صامتًا

- `initDb` يعيد رمي الخطأ بعد طباعة الرسائل التشخيصية.
- `startServer()` مربوط بـ `.catch()` يطبع `SERVER STARTUP ABORTED` ويغلق الـ pool بخروج بالرمز 1، ولا يبدأ الاستماع على المنفذ.
- تحقّق: استدعاء `initDb` بـ pool وهمي يرمي خطأ → `initDb` يرفض (reject) بنفس الخطأ (PASS).

### 3.3 JWT

- استخراج الرأس: `Bearer` حقيقي فقط، مع رفض `null`/`undefined`/الفارغ/غير المكوَّن من 3 مقاطع قبل الوصول إلى `jwt.verify` → النتيجة 401 `AUTH_REQUIRED` نظيف بلا ضجيج.
- توكن صالح الشكل لكن توقيعه غير صالح → 401 `TOKEN_INVALID`.
- توكن منتهٍ → 401 `TOKEN_EXPIRED`.
- المستخدم/الصلاحية غير صحيحة → 403 كما كان (`INVALID_USER`, `PERMISSION_DENIED`).
- الخطأ الداخلي (مثل تعذر قاعدة البيانات) → 500 بدل 403 مضلِّل.
- التسجيل: `[AUTH] <method> <path> — <reason>` فقط، بلا توكن وبلا كلمة مرور.
- الواجهة: لا يُرسل `Authorization` إلا لتوكن من 3 مقاطع؛ التوكن التالف في `localStorage` يُحذف ويُعرض تسجيل الدخول من جديد، دون أي مساس ببيانات المستخدمين أو النظام.

---

## 4. نتائج الاختبارات

بيئة الاختبار: قاعدة `erp_system2_test` (نسخة هيكلية من قواعد الإنتاج) وسيرفر منفصل على المنفذ **3100**، وقاعدة `erp_system2_e2e_test` للاختبار الشامل ثم حُذفت.

| # | الاختبار | النتيجة | الدليل |
|---|---|---|---|
| 1 | `tsc --noEmit` | **PASS** | exit 0 |
| 2 | `npm run build` (vite + esbuild) | **PASS** | 4362 module، `dist/server.cjs` 4.4mb |
| 3 | تشغيل السيرفر على قاعدة اختبار | **PASS** | `Server running on http://localhost:3100` |
| 4 | `Database initialized successfully` | **PASS** | ظهر مرة واحدة (كان غائبًا قبل الإصلاح) |
| 5 | `ERP Enterprise database extensions complete.` | **PASS** | ظهر مرة واحدة |
| 6 | عدم ظهور `require is not defined` | **PASS** | 0 في السجل، و`initDb` يعمل عبر فرع كلمة المرور العشوائية |
| 7 | عدم ظهور `jwt malformed` | **PASS** | 0 في سجلي السيرفرين |
| 8 | `initDb` يرفض عند فشل فعلي | **PASS** | سكربت `tmp/init-failfast.ts` |
| 9 | مسار كلمة مرور admin العشوائية (السطر المتسبب) | **PASS** | `tmp/init-random-admin.ts` — exit 0، صف admin موجود |
| 10 | مصفوفة المصادقة (25 حالة) | **PASS 25/25** | `tmp/auth-matrix.mjs` |
| 11 | دخول صحيح عبر الواجهة (admin) | **PASS** | `POST /api/login → 200` ثم كل طلبات لوحة التحكم 200 |
| 12 | تحميل الصفحة بدون تسجيل دخول | **PASS** | صفر طلبات مصادقة، صفر `[AUTH]` |
| 13 | توكن تالف في `localStorage` | **PASS** | حُذف و`user` معه، عادت شاشة الدخول بلا طلب غير صالح |
| 14 | صلاحيات مستخدم محدود (role=user) | **PASS** | `/api/users` → 403، `/api/v2/sales/invoices` → 200 |
| 15 | اختبارات السلوك `npm test` | **FAIL (قائم مسبقًا)** | 19 فشل / 58 نجاح — نفس الـ19 بالضبط عند إرجاع تعديلاتي مؤقتًا (control run) |

### تفصيل الفشل 15

الاختبارات الفاشلة: `fiscal-period-close`، `payroll-run`، وحالة واحدة في `sales-invoice` («ينشئ ويربط الحسابات الناقصة عند وجود دليل حسابات جزئي»). أعيد تشغيل المجموعة على قاعدة اختبار مُعاد بناؤها، وبإرجاع تعديلي `server-db-init.ts` مؤقتًا: **نفس الـ19 فشلًا ونفس رسائل الحسابات غير المعرّفة**، إذن هذه ليست انحدارًا من هذا الإصلاح، بل حالة قائمة في الشجرة الحالية لتعديلات وحدات المحاسبة/الرواتب/المبيعات. لم تُعدَّل الاختبارات ولم تُخفَّف أي تحققات.

### NOT TESTED

- تسجيل دخول بوابة الموظف (`employee_mobile_token`) عبر المتصفح.
- الوضع `DEV_AUTH_BYPASS=true` (الافتراضي في `.env` هو `false`).
- تشغيل `dist/server.cjs` بوضع `NODE_ENV=production`.
- تغطية كل مسار/صلاحية من الصلاحيات التفصيلية، والفروع المتعددة.
- PM2 / خدمة Windows / Capacitor.
- سلوك التزامن والتحميل العالي.

---

## 5. ما لم يكتمل من تهيئة/ترحيل

- في كل تشغيل مصاب، لم تكن كتلة التهيئة بعد السطر 2558 تُنفَّذ (البند 1.1). القاعدة الحالية تحتوي 345 جدولًا لأن معظم الكائنات أُنشئت في تشغيلات سابقة، لكن **بيانات البذر والفهارس والمعالجة الذاتية بعد هذا السطر لم تُطبَّق** في التشغيلات المصابة.
- `runEnterpriseMigrations()` كان يعمل (فهو بعد `initDb`) وطُبِّق منه 8 ترحيلات، فلا يُخلط بينه وبين ما فشل.
- بعد الإصلاح، أول تشغيل على `erp_system2` سيكمل هذه الخطوات تلقائيًا (كلها `CREATE IF NOT EXISTS` / `ALTER ... IF NOT EXISTS` / بذر شرطي). يُنصح بأخذ نسخة احتياطية قبل إعادة التشغيل.
- لم يُطبَّق أي ترحيل على قاعدة التشغيل من قِبَلي؛ كل كتابات الاختبار تمت على قواعد `*_test` فقط.

---

## 6. المخاطر المتبقية

1. **السيرفر القديم ما زال يعمل:** العملية على المنفذ 3000 (PID 22840) تشغّل الكود القديم. الإصلاح لا يسري إلا بعد إعادة تشغيلها.
2. **الـ offline fallback في `server-db.ts`:** عند تعذر PostgreSQL يتحول النظام صامتًا إلى مخزن JSON، ويمكن أن «تنجح» التهيئة عليه ويبدأ السيرفر (مع `/api/health` = 503). لم أغيّر هذا السلوك لأنه تصميم قائم للعمل دون اتصال، لكنه يعني أن fail-fast لا يغطي حالة انقطاع القاعدة.
3. **كلمة مرور admin في السجل:** عند غياب `DEFAULT_ADMIN_PASSWORD` تُطبع كلمة مرور عشوائية في الـ console (سلوك قائم لم أغيّره). يُنصح بضبط المتغير أو إسكات الطباعة.
4. **سر JWT مؤقت:** إذا كان `JWT_SECRET` أقل من 32 حرفًا خارج الإنتاج، يولَّد سر عشوائي كل تشغيل فتصبح كل التوكنات غير صالحة بعد إعادة التشغيل (الملف الحالي 96 حرفًا، فالمشكلة غير نشطة).
5. **مواضع واجهة لم تُحوَّل:** بعض المكونات (مثل `HR.tsx`, `RecruitmentSuite.tsx`, `EmployeeMobilePortal.tsx`, `SetEmployeePasswordModal.tsx`) ما زالت تقرأ `localStorage` مباشرة. معظمها محمي بفحص أو لا يعمل قبل الدخول، والسيرفر الآن يرفض القيم التالفة بـ401 نظيف بدل `jwt malformed`، لكن توحيدها على `authHeaders()` مفيد لاحقًا.
6. **ملف ميت:** `src/components/AuthContext.tsx` نسخة غير مستخدمة (المستخدم فعليًا `src/contexts/AuthContext.tsx`) وتحوي معالجة bypass قديمة؛ تُرك كما هو.
7. **قاعدة الاختبار أُعيد بناؤها:** استُخدم `node scripts/create-test-db.cjs --reset` (هيكل فقط من `erp_system2`) بعد أن أثّرت تشغيلات التهيئة عليها. لا تغيير على قاعدة التشغيل.
8. **19 فشلًا قائمًا في اختبارات السلوك** خارج نطاق هذا الإصلاح (المحاسبة/الرواتب).

---

## 7. إعادة الإنتاج

```bash
npm run lint                # tsc --noEmit
npm run build               # vite + esbuild

# قاعدة اختبار هيكلية + سيرفر منفصل
node scripts/create-test-db.cjs --reset
DATABASE_URL="postgres://.../erp_system2_test" PORT=3100 DEFAULT_ADMIN_PASSWORD='TestAdmin#12345' \
  DISABLE_BACKGROUND_JOBS=true npx tsx server.ts

node tmp/auth-matrix.mjs    # 25/25
npx tsx tmp/init-random-admin.ts   # فرع كلمة المرور العشوائية
npx tsx tmp/init-failfast.ts       # إثبات إعادة رمي الخطأ
npm test                    # 19 فشل قائم مسبقًا
```
