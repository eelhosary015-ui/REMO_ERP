const fs = require('fs');
let code = fs.readFileSync('src/components/HR.tsx', 'utf8');

const effectCode = `  // Auto-calculate hour rate for hourly workers and sync codes
  useEffect(() => {
    if (editingEmployee) {
      const emp = editingEmployee as any;
      const isHourly = emp.works_hourly === "نعم";
      let rate = emp.new_hour_rate;
      if (isHourly) {
        const basic = Number(emp.basic_salary || emp.salary || 0);
        const days = Number(emp.work_days_count || 26);
        if (basic > 0 && days > 0) {
          rate = (basic / (days * 8)).toFixed(2);
        }
      }
      
      const attCode = emp.attendance_code || emp.fingerprint_code || emp.code || "";
      const fingerCode = emp.fingerprint_code || emp.attendance_code || emp.code || "";
      
      let needsUpdate = false;
      const updates: any = {};
      
      if (isHourly && emp.new_hour_rate !== rate) {
        updates.new_hour_rate = rate;
        needsUpdate = true;
      }
      if (emp.attendance_code !== attCode) {
        updates.attendance_code = attCode;
        needsUpdate = true;
      }
      if (emp.fingerprint_code !== fingerCode) {
        updates.fingerprint_code = fingerCode;
        needsUpdate = true;
      }

      if (needsUpdate) {
        setEditingEmployee((prev: any) => ({ ...prev, ...updates }));
      }
    }
  }, [(editingEmployee as any)?.works_hourly, (editingEmployee as any)?.basic_salary, (editingEmployee as any)?.salary, (editingEmployee as any)?.work_days_count, (editingEmployee as any)?.attendance_code, (editingEmployee as any)?.fingerprint_code, (editingEmployee as any)?.code, (editingEmployee as any)?.new_hour_rate]);

  // Load everything on mount`;

code = code.replace("  // Load everything on mount", effectCode);
fs.writeFileSync('src/components/HR.tsx', code);
