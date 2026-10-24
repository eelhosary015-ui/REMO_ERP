const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace('title="شات الذكاء الاصطناعي (AI Chat API)"\n              >\n                <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-300" />\n                <span className="hidden md:inline">الذكاء الاصطناعي</span>', 'title="شات الذكاء الاصطناعي (AI Chat API)"\n              >\n                <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-300" />\n                <span className="hidden md:inline">الذكاء الاصطناعي</span>');

fs.writeFileSync('src/App.tsx', content, 'utf8');
