const fs = require('fs');
let c = fs.readFileSync('src/components/Attendance.tsx', 'utf8');

c = c.replace(/\{\(user\?\.role === "admin" \|\|\n\s*user\?\.permissions\?\\.\["attendance\.import"\] !== false\) && \(\n\s*\{user\?\.role === "admin" && \(/, 
  '{user?.role === "admin" && (');

c = c.replace(/<\/button>\n\s*\)\}\n\s*<label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200/,
  '</button>\n          )}\n          {(user?.role === "admin" || user?.permissions?.["attendance.import"] !== false) && (\n          <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200');

fs.writeFileSync('src/components/Attendance.tsx', c);
