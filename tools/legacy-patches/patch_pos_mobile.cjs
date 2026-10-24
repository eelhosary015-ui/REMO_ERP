const fs = require('fs');
let content = fs.readFileSync('src/components/POS.tsx', 'utf8');

content = content.replace('<div className="flex-1 flex overflow-hidden">', '<div className="flex-1 flex flex-col lg:flex-row overflow-hidden">');

// Cart sidebar
content = content.replace('className={`w-[380px] flex flex-col shrink-0 z-20 overflow-hidden ${', 'className={`w-full lg:w-[380px] h-[45vh] lg:h-auto flex flex-col shrink-0 z-20 overflow-hidden border-b lg:border-b-0 ${');

fs.writeFileSync('src/components/POS.tsx', content, 'utf8');
