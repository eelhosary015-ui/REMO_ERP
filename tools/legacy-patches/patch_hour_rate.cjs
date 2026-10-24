const fs = require('fs');
let code = fs.readFileSync('src/components/HR.tsx', 'utf8');

const oldInput = `<label className="text-slate-700 font-bold w-32 shrink-0">سعر الساعه الجديدة</label>
                            <input
                              type="text"
                              value={(editingEmployee as any).new_hour_rate || "0.00"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, new_hour_rate: e.target.value } as any)}`;

const newInput = `<label className="text-slate-700 font-bold w-32 shrink-0">سعر الساعه الجديدة</label>
                            <input
                              type="text"
                              value={(editingEmployee as any).new_hour_rate || "0.00"}
                              readOnly={(editingEmployee as any).works_hourly === "نعم"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, new_hour_rate: e.target.value } as any)}`;

if (code.includes(oldInput)) {
  code = code.replace(oldInput, newInput);
  fs.writeFileSync('src/components/HR.tsx', code);
  console.log("Patched hour rate input.");
} else {
  console.log("Could not find the old input string.");
}
