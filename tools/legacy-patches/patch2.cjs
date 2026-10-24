const fs = require('fs');
let code = fs.readFileSync('src/components/HR.tsx', 'utf8');

const regex = /<div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-6">\s*\{\/\* Steps Navigation Bar \*\/\}\s*<div className="flex flex-row-reverse items-center justify-center gap-10 py-6 border-b border-slate-100 overflow-x-auto">/m;

const replacement = `<div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md rounded-b-xl border-x border-b border-slate-200 shadow-md mb-6 overflow-hidden">
                  {/* Steps Navigation Bar */}
                  <div className="flex flex-row-reverse items-center justify-center gap-8 md:gap-16 py-4 px-2 overflow-x-auto">`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  
  // Now let's fix the steps UI
  code = code.replace(/className={\`flex flex-col items-center gap-2 min-w-max transition-opacity \$\{/g, 
                      'className={`flex flex-col items-center gap-2 min-w-max transition-all duration-300 ${');
  
  code = code.replace(/"cursor-pointer opacity-80 hover:opacity-100"/g,
                      '"cursor-pointer hover:scale-105"');
                      
  code = code.replace(/<div className={\`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors/g,
                      '<div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold border-2 transition-colors');
                      
  code = code.replace(/\? "bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500\/20" : "bg-white border-slate-300 text-slate-500"}\`}>/g,
                      '? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/40 scale-110" : "bg-white border-slate-300 text-slate-500"}`}>');
                      
  code = code.replace(/<span className="text-xs font-bold text-slate-600">\{step.label\}<\/span>/g,
                      '<span className={`text-sm font-bold transition-colors ${employeeActiveStep === step.num ? "text-orange-600" : "text-slate-600"}`}>{step.label}</span>');
                      
  fs.writeFileSync('src/components/HR.tsx', code);
  console.log("Patched successfully.");
} else {
  console.log("Regex not matched.");
}
