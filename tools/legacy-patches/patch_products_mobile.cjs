const fs = require('fs');
let content = fs.readFileSync('src/components/Products.tsx', 'utf8');

// Replace standard flex grids with responsive mobile classes
content = content.replace('className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8"', 'className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8"');
content = content.replace('className="w-[300px] shrink-0 overflow-y-auto custom-scrollbar"', 'className="w-full lg:w-[300px] shrink-0 overflow-y-auto custom-scrollbar lg:border-r border-slate-200 lg:pr-6"');
content = content.replace('<div className="flex-1 overflow-hidden flex gap-6">', '<div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-6">');
content = content.replace('className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 p-1"', 'className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 p-1"');

fs.writeFileSync('src/components/Products.tsx', content, 'utf8');
