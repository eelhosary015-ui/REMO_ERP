import fs from "node:fs";
const f = "modules/hr/hr_api.routes.ts";
let s = fs.readFileSync(f, "utf8");
const before = s;

// ISSUE-08a: attendance لا يحتوي created_at
s = s.replace("ORDER BY a.date DESC, a.check_in DESC NULLS LAST, a.created_at DESC",
              "ORDER BY a.date DESC, a.check_in DESC NULLS LAST, a.id DESC");

// ISSUE-08b: payroll.user_id وليس employee_id — الربط عبر users.employee_id
s = s.replace(`SELECT p.*, e.name as employee_name, e.employee_code, e.job_title, e.phone,
              d.name as department_name, b.name as branch_name
       FROM payroll p
       JOIN employees e ON e.id = p.employee_id`,
`SELECT p.*, e.name as employee_name, e.employee_code, e.job_title, e.phone,
              d.name as department_name, b.name as branch_name
       FROM payroll p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN employees e ON e.id = u.employee_id`);

if (s !== before) { fs.writeFileSync(f, s, "utf8"); console.log("ISSUE-08 fixed"); }
else console.log("ISSUE-08: anchors not found");
