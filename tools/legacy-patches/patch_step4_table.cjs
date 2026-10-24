const fs = require('fs');
let code = fs.readFileSync('src/components/HR.tsx', 'utf8');

const oldNameCell = `<td className="p-1 border-r border-slate-200 font-bold text-slate-800">
                                    <input
                                      type="text"
                                      value={item.name}
                                      onChange={(e) => updateItem("name", e.target.value)}
                                      className="w-full text-right bg-transparent border-b border-transparent focus:border-blue-400 font-bold"
                                    />
                                  </td>`;

const newNameCell = `<td className="p-1 border-r border-slate-200 font-bold text-slate-800">
                                    <div className="w-full text-right px-1 py-0.5 font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded">
                                      {item.name}
                                    </div>
                                  </td>`;

const oldTypeCell = `<td className="p-1 border-r border-slate-200">
                                    <select
                                      value={item.type}
                                      onChange={(e) => updateItem("type", e.target.value)}
                                      className={\`w-full text-center font-bold rounded px-1 py-0.5 border \${
                                        item.type === "استحقاق" ? "text-emerald-700 bg-emerald-50 border-emerald-300" : "text-rose-700 bg-rose-50 border-rose-300"
                                      }\`}
                                    >
                                      <option value="استحقاق">استحقاق</option>
                                      <option value="استقطاع">استقطاع</option>
                                    </select>
                                  </td>`;

const newTypeCell = `<td className="p-1 border-r border-slate-200">
                                    <div
                                      className={\`w-full text-center font-bold rounded px-1 py-1 border \${
                                        item.type === "استحقاق" ? "text-emerald-700 bg-emerald-50 border-emerald-300" : "text-rose-700 bg-rose-50 border-rose-300"
                                      }\`}
                                    >
                                      {item.type}
                                    </div>
                                  </td>`;

const oldValueTypeCell = `<td className="p-1 border-r border-slate-200">
                                    <select
                                      value={item.value_type}
                                      onChange={(e) => updateItem("value_type", e.target.value)}
                                      className="w-full text-center bg-white border border-slate-200 rounded px-1 py-0.5"
                                    >
                                      <option value="مبلغ ثابت">مبلغ ثابت</option>
                                      <option value="نسبة من الأساسي">نسبة من الأساسي</option>
                                      <option value="نسبة من الشامل">نسبة من الشامل</option>
                                    </select>
                                  </td>`;

const newValueTypeCell = `<td className="p-1 border-r border-slate-200">
                                    <div className="w-full text-center bg-slate-50 border border-slate-200 rounded px-1 py-1 text-slate-600 font-semibold">
                                      {item.value_type}
                                    </div>
                                  </td>`;

code = code.replace(oldNameCell, newNameCell);
code = code.replace(oldTypeCell, newTypeCell);
code = code.replace(oldValueTypeCell, newValueTypeCell);

fs.writeFileSync('src/components/HR.tsx', code);
console.log("Patched step 4 table cells to be read-only.");
