const fs = require('fs');
let code = fs.readFileSync('src/components/HR.tsx', 'utf8');

const oldLogic = `onClick={() => alert("قواعد بنود التأمينات مفعّلة")}`;
const newLogic = `onClick={() => {
                                const hasInsurance = (editingEmployee as any).has_insurance;
                                if (hasInsurance === "لا" || hasInsurance === false) {
                                  alert("لا يمكن تفعيل التأمينات. الموظف غير مسجل بالتأمينات.");
                                } else {
                                  alert("قواعد بنود التأمينات مفعّلة");
                                }
                              }}`;

// Just replace the first occurrence in the Step 4 section.
// Actually, it's better to use regex or string replace exactly.
const toReplace = `<button
                            type="button"
                            onClick={() => alert("قواعد بنود التأمينات مفعّلة")}
                            className="px-2 py-0.5 bg-slate-200 text-slate-800 hover:bg-white text-[10px] font-bold rounded border border-slate-400 cursor-pointer"
                          >
                            بنود التأمينات
                          </button>`;
const replacement = `<button
                            type="button"
                            onClick={() => {
                              const hasInsurance = (editingEmployee as any).has_insurance;
                              if (hasInsurance === "لا" || hasInsurance === false) {
                                alert("لا يمكن تفعيل التأمينات. الموظف غير مسجل بالتأمينات.");
                              } else {
                                alert("قواعد بنود التأمينات مفعّلة");
                              }
                            }}
                            className="px-2 py-0.5 bg-slate-200 text-slate-800 hover:bg-white text-[10px] font-bold rounded border border-slate-400 cursor-pointer"
                          >
                            بنود التأمينات
                          </button>`;

code = code.replace(toReplace, replacement);
fs.writeFileSync('src/components/HR.tsx', code);
console.log("Patched insurance button.");
