const fs = require('fs');
let c = fs.readFileSync('src/components/Attendance.tsx', 'utf8');

const btn = `
          {user?.role === "admin" && (
            <button
              onClick={async () => {
                if (confirm("هل أنت متأكد من مسح جميع سجلات الحضور نهائياً؟ هذا الإجراء لا يمكن التراجع عنه!")) {
                  try {
                    const res = await api.delete("/api/attendance/all");
                    if (res.ok) {
                      alert("تم مسح السجلات بنجاح. سيتم إعادة تحميل الصفحة.");
                      window.location.reload();
                    }
                  } catch(e) {
                    alert("حدث خطأ أثناء المسح.");
                  }
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all font-bold border border-red-200"
              title="مسح جميع بيانات الحضور لتفريغ النظام من البيانات التجريبية القديمة"
            >
              <Trash2 className="w-4 h-4" />
              <span>مسح الكل</span>
            </button>
          )}
`;

if (!c.includes('api.delete("/api/attendance/all"')) {
  c = c.replace(/<label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200/, btn + '\n          <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200');
  fs.writeFileSync('src/components/Attendance.tsx', c);
  console.log("Patched UI");
}
