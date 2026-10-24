# REMO PRO - Electron Desktop

تم تحويل المشروع إلى طبقة Desktop باستخدام Electron بدون إعادة كتابة React/Express.

## التشغيل أثناء التطوير

```bash
npm install
npm run desktop:dev
```

## إنشاء برنامج Windows Installer

```bash
npm install
npm run desktop:dist
```

سيظهر المثبت داخل مجلد `release` باسم قريب من:

`REMO-PRO-Setup-0.0.0-x64.exe`

## المعمارية

- Electron: نافذة البرنامج وإدارة تشغيل الخدمة المحلية.
- React/Vite: الواجهة الحالية.
- Node/Express: Backend الحالي، يعمل كعملية داخل Electron.
- PostgreSQL: قاعدة البيانات الحالية.
- API: تبقى على `http://127.0.0.1:3000` داخل البرنامج.

## قاعدة البيانات

النسخة الأولى لا تقوم بتثبيت PostgreSQL تلقائياً داخل جهاز العميل حتى لا يتم تغيير إعدادات قاعدة البيانات الحالية بشكل خطر.

لجهاز واحد يمكن تشغيل PostgreSQL محلياً.

للشركة/الشبكة يمكن جعل PostgreSQL على Server مركزي، وتوجيه إعدادات الاتصال من `.env` إلى عنوان الخادم.

## ملاحظات مهمة

- `server.ts` وواجهات الـ API لم يتم استبدالها بطبقة Electron جديدة.
- Electron يشغل `dist/server.cjs` بواسطة Node المدمج في Electron.
- يتم الانتظار حتى تصبح `/api/health` جاهزة قبل فتح الواجهة.
- البرنامج يمنع فتح أكثر من نسخة Desktop في نفس الوقت.
- إغلاق البرنامج يرسل إشارة إيقاف للـ backend المحلي.
