const fs = require('fs');
let code = fs.readFileSync('src/components/HR.tsx', 'utf-8');

if (!code.includes('import { HRComprehensiveReport }')) {
  code = code.replace(
    'import { RecruitmentSuite } from "./recruitment/RecruitmentSuite";',
    'import { RecruitmentSuite } from "./recruitment/RecruitmentSuite";\nimport { HRComprehensiveReport } from "./HRComprehensiveReport";'
  );
}

if (!code.includes('activeTab === "comprehensive_report"')) {
  code = code.replace(
    '{activeTab === "clearance" && (',
    '{activeTab === "comprehensive_report" && (\n              <HRComprehensiveReport \n                employees={employees}\n                departments={departments}\n                branches={branches}\n                shifts={shifts}\n                attendance={[]} // Will fetch inside\n                payroll={[]} // Will fetch inside\n                evaluations={evaluationsList}\n                penalties={[]} // Will fetch inside\n              />\n            )}\n\n            {activeTab === "clearance" && ('
  );
}

fs.writeFileSync('src/components/HR.tsx', code);
