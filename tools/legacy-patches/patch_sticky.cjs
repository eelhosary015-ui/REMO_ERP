const fs = require('fs');
let code = fs.readFileSync('src/components/HR.tsx', 'utf8');

// 1. Replace header start
const headerStartRegex = /\{\/\* Header - Sticky so filter bar stays visible when scrolling the employee table \*\/\}\s*<div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white shadow-md sticky top-0 z-30">/;
const newHeaderStart = `{/* Header - Sticky Wrapper */}
      <div className="sticky top-0 z-50 flex flex-col shadow-md">
      <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white relative z-20">`;
code = code.replace(headerStartRegex, newHeaderStart);

// 2. Replace header end and insert the steps nav
const headerEndRegex = /<Download className="w-5 h-5" \/>\s*<span>استيراد Excel<\/span>\s*<\/button>\s*<\/div>\s*\)\}\s*<\/div>\s*\{\/\* Content - no overflow-y-auto so thead sticky is relative to the dashboard scroll container \*\/\}/;
const newHeaderEnd = `<Download className="w-5 h-5" />
              <span>استيراد Excel</span>
            </button>
          </div>
        )}
      </div>
      {/* Steps Navigation Bar (Moved to sticky header) */}
      {activeTab === "employees" && (
          <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 overflow-hidden relative z-10 shadow-sm">
            <div className="flex flex-row-reverse items-center justify-center gap-4 sm:gap-8 md:gap-16 py-3 px-2 overflow-x-auto custom-scrollbar">
              {[
                { num: 1, label: "بحث عن الموظفين" },
                { num: 2, label: "البيانات الأساسية" },
                { num: 3, label: "البيانات الوظيفية" },
                { num: 4, label: "مكونات الراتب" },
                { num: 5, label: "ورديات الموظف" },
                { num: 6, label: "مرفقات الموظف" }
              ].map((step, idx) => {
                const isAccessible = step.num === 1 || employeeActiveStep > 1;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (isAccessible) {
                        setEmployeeActiveStep(step.num);
                      } else {
                        alert("يرجى الضغط على 'إضافة موظف' أو اختيار 'تعديل بيانات الموظف' من قائمة الحركات أولاً للدخول على هذه المرحلة.");
                      }
                    }}
                    className={\`flex flex-col items-center gap-1.5 min-w-max transition-all duration-300 \${
                      isAccessible 
                        ? "cursor-pointer hover:scale-105" 
                        : "cursor-not-allowed opacity-40 hover:opacity-50"
                    }\`}
                  >
                    <div className={\`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm md:text-lg font-bold border-2 transition-colors
                      \${employeeActiveStep === step.num ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/40 scale-110" : "bg-white border-slate-300 text-slate-500"}\`}>
                      {step.num}
                    </div>
                    <span className={\`text-[10px] md:text-xs font-bold transition-colors \${
                      employeeActiveStep === step.num ? "text-orange-600" : "text-slate-600"
                    }\`}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
      )}
      </div>
      {/* Content - no overflow-y-auto so thead sticky is relative to the dashboard scroll container */}`;
code = code.replace(headerEndRegex, newHeaderEnd);

// 3. Remove the old steps nav
const oldStepsNavRegex = /<div className="sticky top-0 z-40 bg-white\/95 backdrop-blur-md rounded-b-xl border-x border-b border-slate-200 shadow-md mb-6 overflow-hidden">[\s\S]*?<\/div>\s*<\/div>\s*\{\/\* Step 1: Employee Search & List \*\/\}/;
code = code.replace(oldStepsNavRegex, '{/* Step 1: Employee Search & List */}');

fs.writeFileSync('src/components/HR.tsx', code);
console.log("Patched sticky headers successfully.");
