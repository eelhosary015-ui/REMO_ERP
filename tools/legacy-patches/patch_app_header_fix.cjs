const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace('className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200"\n                  title="تحميل التطبيق على الموبايل"\n                  className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200"\n                  >', 'title="تحميل التطبيق على الموبايل"\n                  className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200"\n                  >');


content = content.replace('className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors border border-emerald-200"\n                title="تطبيق الموبايل للموظفين (بصمة السيلفي والمرتبات)"\n                className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors border border-emerald-200"\n              >', 'title="تطبيق الموبايل للموظفين (بصمة السيلفي والمرتبات)"\n                className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors border border-emerald-200"\n              >');


fs.writeFileSync('src/App.tsx', content, 'utf8');
