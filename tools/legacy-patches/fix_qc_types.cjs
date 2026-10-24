const fs = require('fs');
let content = fs.readFileSync('src/components/production/QualityControlManagement.tsx', 'utf8');

content = content.replace(/const INITIAL_TEAMS = \[\];/g, 'const INITIAL_TEAMS: any[] = [];');
content = content.replace(/const INITIAL_QCP = \[\];/g, 'const INITIAL_QCP: any[] = [];');
content = content.replace(/const INITIAL_CHECKS = \[\];/g, 'const INITIAL_CHECKS: any[] = [];');
content = content.replace(/const INITIAL_ALERTS = \[\];/g, 'const INITIAL_ALERTS: any[] = [];');

fs.writeFileSync('src/components/production/QualityControlManagement.tsx', content);
