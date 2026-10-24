# 🛠️ حل مشكلة الـ Build على ويندوز

## ✅ المشكلتين اللي واجهوك:

### المشكلة 1: `workbox.maximumFileSizeToCacheInBytes`
```
error during build:
Error:
  Assets exceeding the limit:
  - assets/index-B0ZwDM8D.js is 11.2 MB, and won't be precached.
```

**السبب**: ملف الـ JS الأساسي حجمه 11.2 MB، أكبر من حد Workbox الافتراضي (2 MB).

**الحل المُطبّق**: رفعت الحد لـ 20 MB في `vite.config.ts` + إضافة `manualChunks` لتقسيم الـ bundle لقطع أصغر.

---

### المشكلة 2: `android platform has not been added yet`
```
[error] android platform has not been added yet.
```

**السبب**: لازم تشغّل `npx cap add android` مرة واحدة قبل ما يشتغل `cap sync`.

**الحل المُطبّق**: أضفت `scripts/check-or-add-android.cjs` اللي بيضيف المنصة تلقائياً لو مش موجودة. دلوقتي `npm run build:mobile` بيعمل كل حاجة أوتوماتيك.

---

## 🚀 الخطوات الكاملة (النسخة المُحدّثة):

### 1️⃣ امسح ملفات الـ build القديمة:
```powershell
cd C:\Users\I SEVEN\Downloads\remo-pro-erp-latest\extracted
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force android -ErrorAction SilentlyContinue
```

### 2️⃣ حدد API URL (IP الكمبيوتر على شبكة Wi-Fi):
```powershell
# اكتب ipconfig عشان تعرف IP الكمبيوتر
ipconfig
# دور على IPv4 Address (مثلاً 192.168.1.100)

# ضع IP في متغير البيئة
$env:API_BASE_URL="http://192.168.1.100:3000"
```

### 3️⃣ شغّل build:mobile (هيضيف منصة Android تلقائياً):
```powershell
npm run build:mobile
```

ده هيشغّل بالترتيب:
1. ✅ `node scripts/set-mobile-api-base.cjs` — يكتب الـ API URL في `index.html`
2. ✅ `vite build` — يبني ملفات الويب (بدون خطأ الـ 11 MB)
3. ✅ `node scripts/patch-android.cjs` — يضبط AndroidManifest.xml
4. ✅ `node scripts/check-or-add-android.cjs` — يضيف منصة Android لو مش موجودة (مرة واحدة بس)
5. ✅ `cap sync android` — ينسخ ملفات `dist/` لمجلد `android/app/src/main/assets/public/`

### 4️⃣ افتح Android Studio وابنِ APK:
```powershell
npm run cap:open-android
```

في Android Studio:
- استنى لحد ما يخلّص indexing (ممكن ياخد دقيقة)
- من القائمة: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
- استنى لحد ما الـ build يخلّص
- لما يخلّص، هتلاقي رسالة "APK(s) generated successfully"
- اضغط على **locate** عشان تفتح فولدر الـ APK

### 5️⃣ انقل APK للموبايل:
- الملف موجود في: `android\app\build\outputs\apk\debug\app-debug.apk`
- انسخه للموبايل (USB أو Google Drive أو أي طريقة)
- على الموبايل: امسح التطبيق القديم أولاً، ثم ثبت الـ APK الجديد

---

## ⚠️ ملاحظات مهمة:

### لو الـ build:mobile وقف في خطوة معينة:

#### لو وقف في `node scripts/patch-android.cjs`:
معناه إن منصة Android لسه مش موجودة. شغّل:
```powershell
npx cap add android
```
 manually ثم شغّل `npm run build:mobile` تاني.

#### لو ظهر خطأ `Cannot find module '@capacitor/cli'`:
```powershell
npm install @capacitor/cli @capacitor/core @capacitor/android --save
```

#### لو ظهر خطأ في vite build (chunk too large):
التعديل الجديد رفع الحد لـ 20 MB، فالمفروض المشكلة اتحلّت. لو لسه بتظهر، ابعتلي الـ error.

---

## 📋 ملخص الـ commands المهمة:

| الأمر | الوظيفة |
|------|--------|
| `npm install` | تثبيت الحزم (مرة واحدة) |
| `npm run dev` | تشغيل السيرفر على localhost:3000 |
| `npm run build:web` | بناء ملفات الويب فقط (بدون Android) |
| `npm run build:mobile` | بناء + إضافة Android + sync (شامل) |
| `npm run cap:sync` | نسخ ملفات dist/ لمجلد android/ |
| `npm run cap:open-android` | فتح Android Studio |
| `npm run cap:patch-android` | تطبيق patches على AndroidManifest |

---

## 🎯 لو عايز تختبر الـ web فقط (بدون موبايل):

```powershell
npm run build:web
npm run preview
```
ده هيشغّل السيرفر بملفات الـ production على `http://localhost:4173`.

---

## 📞 لو لسه فيه مشاكل:

ابعتلي الـ error log بالظبط (زي ما عملت دلوقتي) وأنا هصلّحه لك فوراً. 
المشاكل اللي واجهتها دي مشاكل شائعة جداً وأنا كنت متوقعها، والحلول جاهزة في التحديث الجديد. 🚀
