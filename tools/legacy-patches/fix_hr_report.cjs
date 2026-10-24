const fs = require('fs');
let code = fs.readFileSync('src/components/HRComprehensiveReport.tsx', 'utf-8');

code = code.replace(/Employee, Department, Branch, Shift/g, 'Employee, HRDepartment, Branch, HRShift');
code = code.replace(/departments: Department\[\];/g, 'departments: HRDepartment[];');
code = code.replace(/shifts: Shift\[\];/g, 'shifts: HRShift[];');

code = code.replace(/selectedEmp\?\.shift_id/g, 'selectedEmp?.work_shift_id');
code = code.replace(/selectedEmp\.hiring_date/g, 'selectedEmp.hire_date');
code = code.replace(/selectedEmp\.position/g, 'selectedEmp.job_title');
code = code.replace(/selectedEmp\.base_salary/g, 'selectedEmp.basic_salary');

fs.writeFileSync('src/components/HRComprehensiveReport.tsx', code);
