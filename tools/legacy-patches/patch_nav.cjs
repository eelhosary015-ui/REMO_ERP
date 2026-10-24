const fs = require('fs');
let code = fs.readFileSync('src/components/HR.tsx', 'utf8');

const oldNav = `<div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-6">
                  {/* Steps Navigation Bar */}
                  <div className="flex flex-row-reverse items-center justify-center gap-10 py-6 border-b border-slate-100 overflow-x-auto">
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
                          className={\`flex flex-col items-center gap-2 min-w-max transition-opacity \${
                            isAccessible 
                              ? "cursor-pointer opacity-80 hover:opacity-100" 
                              : "cursor-not-allowed opacity-40 hover:opacity-50"
                          }\`}
                        >
                          <div className={\`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors
                            \${employeeActiveStep === step.num ? "bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20" : "bg-white border-slate-300 text-slate-500"}\`}>
                            {step.num}
                          </div>
                          <span className="text-xs font-bold text-slate-600">{step.label}</span>
                        </div>
                      );
                    })}
                  </div>`;

const newNav = `<div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md rounded-b-xl border-x border-b border-slate-200 shadow-md mb-6 py-4 px-6 mx-2 transition-all">
                  {/* Steps Navigation Bar */}
                  <div className="flex flex-row-reverse items-center justify-center gap-8 md:gap-16 overflow-x-auto">
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
                          className={\`flex flex-col items-center gap-2 min-w-max transition-all duration-300 \${
                            isAccessible 
                              ? "cursor-pointer hover:scale-105" 
                              : "cursor-not-allowed opacity-40 hover:opacity-50"
                          }\`}
                        >
                          <div className={\`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold border-2 transition-colors
                            \${employeeActiveStep === step.num ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/40 scale-110" : "bg-white border-slate-300 text-slate-500"}\`}>
                            {step.num}
                          </div>
                          <span className={\`text-sm font-bold transition-colors \${
                            employeeActiveStep === step.num ? "text-orange-600" : "text-slate-600"
                          }\`}>{step.label}</span>
                        </div>
                      );
                    })}
                  </div>`;

if (code.includes(oldNav)) {
  code = code.replace(oldNav, newNav);
  
  // also need to remove the closing </div> that belonged to <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-6">
  // but wait, is there another div wrapping everything in step 1?
  
} else {
  console.log("Could not find oldNav.");
}

fs.writeFileSync('src/components/HR.tsx', code);
