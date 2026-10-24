const fs = require('fs');
let code = fs.readFileSync('src/components/HR.tsx', 'utf8');

const replacement = `  const handleEditEmployeeAction = (emp: any) => {
    // Fill in first_name, second_name, third_name, fourth_name if missing but name is present
    let updatedEmp = { ...emp };
    if (updatedEmp.name && !updatedEmp.first_name) {
      const parts = updatedEmp.name.split(" ").filter(Boolean);
      updatedEmp.first_name = parts[0] || "";
      updatedEmp.second_name = parts[1] || "";
      updatedEmp.third_name = parts[2] || "";
      updatedEmp.fourth_name = parts.slice(3).join(" ") || "";
    }
    
    setEditingEmployee(updatedEmp);
    setActiveActionMenuId(null);
    setEmployeeActiveStep(2);
  };

  const handleSaveEmployee`;

code = code.replace("  const handleSaveEmployee", replacement);

code = code.replace(/setEditingEmployee\(emp\);\s*setActiveActionMenuId\(null\);\s*setEmployeeActiveStep\(2\);/g, "handleEditEmployeeAction(emp);");

fs.writeFileSync('src/components/HR.tsx', code);
