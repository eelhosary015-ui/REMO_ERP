const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Header responsiveness
content = content.replace('header className="h-18 flex items-center justify-between px-6 border-b border-slate-200 bg-white z-50 select-none font-cairo shadow-sm text-slate-800"', 'header className="h-18 flex items-center justify-between px-3 md:px-6 border-b border-slate-200 bg-white z-50 select-none font-cairo shadow-sm text-slate-800"');

// System name left text (Remo_pro) text-xl to text-lg
content = content.replace('className="text-xl sm:text-2xl font-extrabold', 'className="text-lg sm:text-2xl font-extrabold');
content = content.replace('className="flex items-center gap-2 mt-0.5"', 'className="hidden sm:flex items-center gap-2 mt-0.5"'); // hide version on mobile

// User Profile text hide on mobile
content = content.replace('<span className="text-xs font-extrabold text-slate-700 uppercase font-mono">', '<span className="hidden sm:block text-xs font-extrabold text-slate-700 uppercase font-mono">');

// Voice command pill hide text on mobile
content = content.replace('<span className={`text-[11px] font-bold font-mono ${isVoiceListening ? "text-white animate-pulse" : "text-slate-500"}`}>', '<span className={`hidden sm:inline-block text-[11px] font-bold font-mono ${isVoiceListening ? "text-white animate-pulse" : "text-slate-500"}`}>');

// Voice command circle hide on mobile
content = content.replace('<span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${', '<span className={`hidden sm:flex w-4 h-4 rounded-full items-center justify-center text-[9px] font-black ${');

// Hide AI Chat text on mobile (wait, it already has hidden md:inline)
// `<span className="hidden md:inline">الذكاء الاصطناعي</span>` -> good.

// Hide Publish, Mobile Portal, Install buttons on mobile?
// Let's just wrap utility icons in flex-wrap or allow horizontal scrolling, or hide some.
// Let's hide PWA install and Share on mobile.
content = content.replace('title="تحميل التطبيق على الموبايل"\n                >', 'title="تحميل التطبيق على الموبايل"\n                className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200"\n                >');
content = content.replace('className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"\n                title="مشاركة ورابط الببليش العام"\n              >', 'className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"\n                title="مشاركة ورابط الببليش العام"\n              >');

// Mobile portal icon
content = content.replace('title="تطبيق الموبايل للموظفين (بصمة السيلفي والمرتبات)"\n              >', 'title="تطبيق الموبايل للموظفين (بصمة السيلفي والمرتبات)"\n                className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors border border-emerald-200"\n              >');

// Approvals icon is important, keep it. AI chat is important.

fs.writeFileSync('src/App.tsx', content, 'utf8');
