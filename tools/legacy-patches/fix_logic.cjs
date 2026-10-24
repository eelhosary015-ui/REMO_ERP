const fs = require('fs');
let code = fs.readFileSync('src/components/HR.tsx', 'utf8');

// 1. Remove the old useEffect we just added
const effectRegex = /\/\/ Auto-calculate hour rate for hourly workers and sync codes\s+useEffect\(\(\) => \{[\s\S]*?\}, \[.*?\]\);/g;
code = code.replace(effectRegex, '');

// 2. Add the proper useEffect for just calculating hour rate
const newEffectCode = `  // Auto-calculate hour rate for hourly workers
  useEffect(() => {
    if (editingEmployee && (editingEmployee as any).works_hourly === "نعم") {
      const emp = editingEmployee as any;
      const basic = Number(emp.basic_salary || emp.salary || 0);
      const days = Number(emp.work_days_count || 26);
      if (basic > 0 && days > 0) {
        const rate = (basic / (days * 8)).toFixed(2);
        if (emp.new_hour_rate !== rate) {
          setEditingEmployee((prev: any) => ({ ...prev, new_hour_rate: rate }));
        }
      }
    }
  }, [(editingEmployee as any)?.works_hourly, (editingEmployee as any)?.basic_salary, (editingEmployee as any)?.salary, (editingEmployee as any)?.work_days_count]);`;

code = code.replace("  // Load everything on mount", newEffectCode + "\n\n  // Load everything on mount");

// 3. Update handleEditEmployeeAction
const oldHandlerRegex = /const handleEditEmployeeAction = \(emp: any\) => \{[\s\S]*?setEditingEmployee\(updatedEmp\);/g;

const newHandler = `const handleEditEmployeeAction = (emp: any) => {
    // Fill in first_name, second_name, third_name, fourth_name if missing but name is present
    let updatedEmp = { ...emp };
    if (updatedEmp.name && !updatedEmp.first_name) {
      const parts = updatedEmp.name.split(" ").filter(Boolean);
      updatedEmp.first_name = parts[0] || "";
      updatedEmp.second_name = parts[1] || "";
      updatedEmp.third_name = parts[2] || "";
      updatedEmp.fourth_name = parts.slice(3).join(" ") || "";
    }

    // Map old data to new Step 5 fields
    if (!updatedEmp.attendance_code) {
      updatedEmp.attendance_code = updatedEmp.fingerprint_code || updatedEmp.code || "";
    }
    if (!updatedEmp.work_days_count) {
      updatedEmp.work_days_count = "26";
    }
    if (updatedEmp.works_hourly === "نعم") {
      const basic = Number(updatedEmp.basic_salary || updatedEmp.salary || 0);
      const days = Number(updatedEmp.work_days_count || 26);
      if (basic > 0 && days > 0) {
        updatedEmp.new_hour_rate = (basic / (days * 8)).toFixed(2);
      }
    }
    
    setEditingEmployee(updatedEmp);`;

code = code.replace(oldHandlerRegex, newHandler);

fs.writeFileSync('src/components/HR.tsx', code);
console.log("Fixed logic successfully.");
