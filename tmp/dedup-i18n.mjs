import fs from "node:fs";
const p = "src/i18n/autoTranslate.ts";
let s = fs.readFileSync(p, "utf8");
// إزالة المفاتيح المكررة (TS يرفض التكرار في object literal)
s = s.replace(`  "الإجراءات": "Actions", "التفاصيل": "Details", "المستخدم": "User", "التوقيت": "Timestamp",`, `  "الإجراءات": "Actions", "التوقيت": "Timestamp",`);
s = s.replace(`"المرتبات": "Payroll", "التكاليف": "Costs", "مراكز التكلفة": "Cost Centers", "التقارير المركزية": "Central Reports",`, `"المرتبات": "Payroll", "التكاليف": "Costs", "التقارير المركزية": "Central Reports",`);
s = s.replace(`  "عرض": "Show", "صف": "rows", "من": "of", "الصفحة الأولى": "First page", "الصفحة الأخيرة": "Last page",`, `  "عرض": "Show", "صف": "rows", "الصفحة الأولى": "First page", "الصفحة الأخيرة": "Last page",`);
fs.writeFileSync(p, s, "utf8");
console.log("dedup done");
