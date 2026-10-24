const fs = require('fs');
let content = fs.readFileSync('src/components/production/QualityControlManagement.tsx', 'utf8');

content = content.replace(/const INITIAL_TEAMS = \[[\s\S]*?\];/m, 'const INITIAL_TEAMS = [];');
content = content.replace(/const INITIAL_QCP = \[[\s\S]*?\];/m, 'const INITIAL_QCP = [];');
content = content.replace(/const INITIAL_CHECKS = \[[\s\S]*?\];/m, 'const INITIAL_CHECKS = [];');
content = content.replace(/const INITIAL_ALERTS = \[[\s\S]*?\];/m, 'const INITIAL_ALERTS = [];');

fs.writeFileSync('src/components/production/QualityControlManagement.tsx', content);
