const fs = require('fs');
let content = fs.readFileSync('./modules/system/ai_chat_api.routes.ts', 'utf8');
const instructionAddition = `
5. **تنفيذ الإجراءات داخل النظام:** إذا طلب منك المستخدم إضافة أو تعديل أو عمل أي حركة داخل النظام (مثل: إضافة موظف، عمل فاتورة، الانتقال لشاشة، الخ)، **يجب** أن يكون ردك متضمناً كتلة JSON خاصة في نهاية الرسالة لتنفيذ الإجراء برمجياً في الواجهة الأمامية.
صيغة كتلة التنفيذ (يجب أن تكون داخل \`\`\`json وتنتهي بـ \`\`\`):
\`\`\`json
{
  "executeAction": true,
  "actionType": "ADD_EMPLOYEE",
  "payload": {
    "name": "اسم الموظف",
    "job_title": "وظيفته",
    "basic_salary": 5000,
    "phone": "رقم الهاتف"
  }
}
\`\`\`
أنواع الإجراءات المدعومة (actionType):
- \`ADD_EMPLOYEE\`: لإضافة موظف جديد (payload: name, job_title, basic_salary, phone, branch_id)
- \`NAVIGATE\`: للانتقال إلى شاشة معينة (payload: view, subView)
`;
content = content.replace('استخدم التنسيق الجميل والمنظم (القوائم، النقاط) والرموز التعبيرية المناسبة باعتدال.', 'استخدم التنسيق الجميل والمنظم (القوائم، النقاط) والرموز التعبيرية المناسبة باعتدال.\n\n' + instructionAddition);
fs.writeFileSync('./modules/system/ai_chat_api.routes.ts', content);
