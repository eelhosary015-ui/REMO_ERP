const fs = require('fs');
let content = fs.readFileSync('src/components/Login.tsx', 'utf8');

content = content.replace('className="relative min-h-screen flex items-center justify-center p-4 md:p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-black font-cairo overflow-hidden"', 'className="relative min-h-screen flex flex-col items-center justify-center p-0 sm:p-4 md:p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-black font-cairo overflow-hidden"');

content = content.replace('className="relative z-10 bg-white rounded-[32px] shadow-2xl overflow-hidden max-w-5xl w-full flex flex-col md:flex-row border border-slate-100"', 'className="relative z-10 bg-white sm:rounded-[32px] shadow-2xl overflow-hidden max-w-5xl w-full h-full sm:h-auto flex flex-col md:flex-row border border-slate-100"');

content = content.replace('className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-between"', 'className="w-full md:w-1/2 p-6 sm:p-8 md:p-12 flex flex-col justify-between flex-1 overflow-y-auto"');

content = content.replace('className="mb-8"', 'className="mb-4 sm:mb-8"');
content = content.replace('className="mb-6"', 'className="mb-4 sm:mb-6"');
content = content.replace('className="mb-6 p-4 bg-orange-50/50 border border-orange-100 rounded-2xl"', 'className="mb-4 sm:mb-6 p-3 sm:p-4 bg-orange-50/50 border border-orange-100 rounded-2xl"');

fs.writeFileSync('src/components/Login.tsx', content, 'utf8');
