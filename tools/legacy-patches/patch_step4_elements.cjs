const fs = require('fs');
let code = fs.readFileSync('src/components/HR.tsx', 'utf8');

const oldLogic = `                                const newItem = {
                                  id: Date.now(),
                                  is_basic: false,
                                  code: \`ITEM-\${Math.floor(100 + Math.random() * 900)}\`,
                                  name: selItem,
                                  amount: selItem.includes("خصم") ? 200 : 400,
                                  type: selItem.includes("خصم") ? "استقطاع" : "استحقاق",
                                  value_type: "مبلغ ثابت",
                                  discount_pct: 0,
                                  payroll_run: "الصرفية الأساسية",
                                  position: editingEmployee.position || "كل الوظائف",
                                  last_modified: new Date().toISOString().split("T")[0],
                                  user_name: "ADMIN",
                                  is_closed: false,
                                  available_from: "2026-01-01",
                                  available_to: "2030-12-31"
                                };`;

const newLogic = `                                if (selItem === "اخبار بند") return;
                                
                                const matchedElement = payrollElements.find(el => el.name === selItem);
                                let calculatedAmount = 0;
                                let isPercent = false;
                                let pctValue = 0;
                                
                                if (matchedElement) {
                                  if (matchedElement.rule_type === "percent") {
                                    isPercent = true;
                                    pctValue = Number(matchedElement.value) || 0;
                                    const basic = Number((editingEmployee as any).basic_salary || 0);
                                    calculatedAmount = (basic * pctValue) / 100;
                                  } else {
                                    calculatedAmount = Number(matchedElement.value) || 0;
                                  }
                                } else {
                                  // Fallback
                                  calculatedAmount = selItem.includes("خصم") ? 200 : 400;
                                }

                                const newItem = {
                                  id: Date.now(),
                                  is_basic: false,
                                  code: \`ITEM-\${Math.floor(100 + Math.random() * 900)}\`,
                                  name: selItem,
                                  amount: calculatedAmount,
                                  type: matchedElement ? (matchedElement.type === "deduction" ? "استقطاع" : "استحقاق") : (selItem.includes("خصم") ? "استقطاع" : "استحقاق"),
                                  value_type: isPercent ? "نسبة من الأساسي" : "مبلغ ثابت",
                                  discount_pct: pctValue,
                                  payroll_run: "الصرفية الأساسية",
                                  position: editingEmployee.position || "كل الوظائف",
                                  last_modified: new Date().toISOString().split("T")[0],
                                  user_name: "ADMIN",
                                  is_closed: false,
                                  available_from: "2026-01-01",
                                  available_to: "2030-12-31"
                                };`;

code = code.replace(oldLogic, newLogic);

const oldSelect = `<select
                              value={(editingEmployee as any).selected_item_to_add || "اخبار بند"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, selected_item_to_add: e.target.value } as any)}
                              className="bg-white text-slate-800 border border-slate-300 rounded px-2 py-0.5 text-[11px] font-bold"
                            >
                              <option value="اخبار بند">اختيار بند...</option>
                              <option value="بدل سكن">بدل سكن</option>
                              <option value="بدل انتقال وركوب">بدل انتقال وركوب</option>
                              <option value="بدل طبيعة عمل">بدل طبيعة عمل</option>
                              <option value="حافز تميز وإشراف">حافز تميز وإشراف</option>
                              <option value="بدل وجبة وطعام">بدل وجبة وطعام</option>
                              <option value="خصم تأمينات اجتماعية">خصم تأمينات اجتماعية</option>
                              <option value="خصم ضريبة كسب عمل">خصم ضريبة كسب عمل</option>
                              <option value="خصم صندوق التكافل">خصم صندوق التكافل</option>
                              <option value="خصم جزاءات وغيابات">خصم جزاءات وغيابات</option>
                            </select>`;

const newSelect = `<select
                              value={(editingEmployee as any).selected_item_to_add || "اخبار بند"}
                              onChange={(e) => setEditingEmployee({ ...editingEmployee, selected_item_to_add: e.target.value } as any)}
                              className="bg-white text-slate-800 border border-slate-300 rounded px-2 py-0.5 text-[11px] font-bold"
                            >
                              <option value="اخبار بند">اختيار بند...</option>
                              {payrollElements.length > 0 ? (
                                payrollElements.map(el => (
                                  <option key={el.id} value={el.name}>{el.name}</option>
                                ))
                              ) : (
                                <>
                                  <option value="بدل سكن">بدل سكن</option>
                                  <option value="خصم تأمينات اجتماعية">خصم تأمينات اجتماعية</option>
                                </>
                              )}
                            </select>`;

code = code.replace(oldSelect, newSelect);

fs.writeFileSync('src/components/HR.tsx', code);
console.log("Patched payroll elements in step 4 dropdown.");
