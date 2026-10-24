# 📱 حل مشكلة "خطأ في الملفات" في تطبيق الموبايل

## 🐛 المشكلة
عند نقل تطبيق الموبايل من هاتف إلى هاتف آخر، يظهر خطأ في تحميل الملفات (شاشة بيضاء أو "Error loading files").

## ✅ الحلول المُطبّقة في النظام

### 1️⃣ Service Worker auto-update
أضفنا `skipWaiting: true` و `clientsClaim: true` في `vite.config.ts` — هذا يجبر الـ Service Worker الجديد على تفعيل نفسه فوراً واستبدال النسخة القديمة، مما يمنع تحميل ملفات قديمة لم تعد موجودة في الـ build الجديد.

### 2️⃣ Update prompt
أضفنا Toast UI في `App.tsx` يظهر للمستخدم تلقائياً عند توفر تحديث جديد، يطلب منه الضغط على "تحديث" لإعادة تحميل الصفحة بأحدث الملفات.

### 3️⃣ Capacitor HTTPS scheme
غيّرنا `androidScheme` من `http` إلى `https` في `capacitor.config.json` — هذا يمنع مشاكل الـ Mixed Content في Android WebView الحديثة.

### 4️⃣ CleanupOutdatedCaches
فعّلنا `cleanupOutdatedCaches: true` في Workbox لمسح الـ caches القديمة تلقائياً.

### 5️⃣ Meta tag API URL
أضفنا دعم لـ `<meta name="api-base-url" content="...">` في `index.html` — يمكنك تحديد URL السيرفر وقت البناء دون تعديل الكود.

---

## 🚀 خطوات بناء APK جديد (بدون أخطاء)

### الطريقة السريعة (تلقائية):
```bash
# على جهاز الكمبيوتر الذي عليه السيرفر:

# 1. حدد عنوان السيرفر (IP الكمبيوتر على شبكة Wi-Fi)
# مثال: API_BASE_URL=http://192.168.1.100:3000

# 2. بناء + مزامنة + تثبيت على الأندرويد
API_BASE_URL=http://192.168.1.100:3000 npm run build:mobile

# 3. افتح في Android Studio واعمل Build APK
npm run cap:open-android
```

### الطريقة اليدوية (خطوة بخطوة):
```bash
# 1. ضبط API URL للـ mobile
node scripts/set-mobile-api-base.cjs
# (أو: API_BASE_URL=http://192.168.1.100:3000 node scripts/set-mobile-api-base.cjs)

# 2. بناء ملفات الويب
npm run build:web

# 3. تثبيت patches على AndroidManifest.xml
npm run cap:patch-android

# 4. مزامنة مع Android
npx cap sync android

# 5. افتح Android Studio لبناء APK
npx cap open android
# ثم من Android Studio: Build → Build APK(s)
```

---

## 🔧 حل المشاكل الشائعة

### المشكلة 1: شاشة بيضاء بعد تثبيت الـ APK الجديد
**السبب**: Service Worker قديم لسه في ذاكرة WebView.
**الحل**: 
```bash
# على الهاتف: امسح بيانات التطبيق من الإعدادات
# Settings → Apps → Remo Pro → Storage → Clear Data
# ثم افتح التطبيق من جديد
```

### المشكلة 2: "Failed to fetch" أو "Network Error"
**السبب**: الهاتف لا يستطيع الوصول للسيرفر.
**الحل**:
- تأكد أن الهاتف والكمبيوتر على نفس شبكة Wi-Fi
- تأكد أن منفذ 3000 مفتوح في Windows Firewall (شغّل `ALLOW_PORT_3000.bat` كمسؤول)
- تأكد أن `API_BASE_URL` يشير لـ IP الصحيح (مثال: `http://192.168.1.100:3000`)

### المشكلة 3: تطبيق قديم على هاتف لا يحدث نفسه تلقائياً
**السبب**: الـ APK القديم لم يكن فيه آلية التحديث.
**الحل**: 
- امسح التطبيق القديم من الهاتف تماماً
- ثبّت الـ APK الجديد (المبني بعد التعديلات)
- من الآن فصاعداً، التحديثات هتتسطّب تلقائياً

### المشكلة 4: عند نقل التطبيق لتلفون تاني
**السبب**: كل هاتف له API_BASE_URL مختلف في الـ localStorage.
**الحل**: 
- في التطبيق على الهاتف الجديد: افتح صفحة الـ Login → اضغط "إعدادات السيرفر" → أدخل IP السيرفر الصحيح
- أو: ابنِ APK مخصص لكل هاتف بـ API_BASE_URL مختلف (لو كل موظف له سيرفر مختلف)

---

## 📋 Checklist قبل توزيع الـ APK

- [ ] السيرفر شغّال على الكمبيوتر (`npm run dev` أو `npm start`)
- [ ] منفذ 3000 مفتوح في الـ Firewall
- [ ] `API_BASE_URL` محدد بشكل صحيح (IP الشبكة، مش localhost)
- [ ] الهاتف والكمبيوتر على نفس شبكة Wi-Fi
- [ ] تم تنفيذ `npm run build:mobile` (وليس `npm run build` فقط)
- [ ] تم بناء APK جديد من Android Studio
- [ ] تم مسح التطبيق القديم من الهاتف قبل تثبيت الجديد

---

## 🆘 لو المشكلة لسه موجودة

### تشخيص:
1. افتح التطبيق على الهاتف
2. إذا كان شاشة بيضاء → افتح Chrome على الكمبيوتر → `chrome://inspect/#devices` → اختر WebView الخاص بالتطبيق → شوف console errors
3. لو فيه `404` على ملفات JS/CSS → المشكلة في Service Worker cache
4. لو فيه `Failed to fetch` على `/api/*` → المشكلة في API_BASE_URL أو الـ Firewall

### حل سريع عند الطوارئ:
```bash
# على الهاتف (دون الحاجة لكمبيوتر):
# 1. امسح بيانات التطبيق من الإعدادات
# 2. افتح التطبيق من جديد
# 3. في صفحة الـ Login → اضغط "إعدادات السيرفر" → أدخل IP السيرفر
# 4. سجل الدخول
```
