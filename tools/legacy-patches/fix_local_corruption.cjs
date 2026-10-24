const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'backups', 'offline-db.json');

console.log('==============================================');
console.log('  REMO PRO - إصلاح قاعدة البيانات المحلية');
console.log('==============================================');

try {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, '{}', 'utf8');
  console.log('✅ تم تصفير وإصلاح ملف backups/offline-db.json بنجاح (محتوى صالح: {})');
} catch (err) {
  console.error('❌ خطأ في معالجة الملف:', err);
}

console.log('🚀 الآن يمكنك تشغيل السيرفر بأمان بدون أي SyntaxError!');
