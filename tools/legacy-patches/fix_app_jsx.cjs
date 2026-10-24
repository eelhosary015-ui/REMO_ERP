const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// The replacement was duplicate earlier, let's just make it simple.
// we have a duplicate className on the Download button
content = content.replace('className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200"\n                  title="تحميل التطبيق على الموبايل"\n                  className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200"\n                  >', 'className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200"\n                  title="تحميل التطبيق على الموبايل"\n                  >');


fs.writeFileSync('src/App.tsx', content, 'utf8');
