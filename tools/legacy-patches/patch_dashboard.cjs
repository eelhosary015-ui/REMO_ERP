const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

content = content.replace('content-start pb-8"', 'content-start pb-24 sm:pb-8"');
content = content.replace('className="flex flex-col gap-2 pb-8"', 'className="flex flex-col gap-2 pb-24 sm:pb-8"');

fs.writeFileSync('src/components/Dashboard.tsx', content, 'utf8');
