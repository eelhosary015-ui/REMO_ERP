const fs = require('fs');
let code = fs.readFileSync('src/components/HR.tsx', 'utf8');

const oldLogic = `                                if (selItem === "اخبار بند") return;
                                
                                const matchedElement = payrollElements.find(el => el.name === selItem);`;

const newLogic = `                                if (selItem === "اخبار بند") return;
                                
                                if (selItem.includes("تأمين")) {
                                  const hasInsurance = (editingEmployee as any).has_insurance;
                                  if (hasInsurance === "لا" || hasInsurance === false) {
                                    alert("لا يمكن إضافة بند التأمينات لأن الموظف غير مسجل بالتأمينات في البيانات الأساسية.");
                                    return;
                                  }
                                }
                                
                                const matchedElement = payrollElements.find(el => el.name === selItem);`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('src/components/HR.tsx', code);
console.log("Patched insurance validation logic.");
