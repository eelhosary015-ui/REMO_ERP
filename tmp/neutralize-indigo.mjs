import fs from "node:fs";

const file = "src/components/treasury/TreasuryTransactionsEnterprise.tsx";
let s = fs.readFileSync(file, "utf8");

const formStart = s.indexOf(`          <form\n            onSubmit={handleCreateVoucher}`);
const formEnd = s.indexOf(`          </form>`, formStart);
if (formStart === -1 || formEnd === -1) throw new Error("modal bounds not found");

let modal = s.slice(formStart, formEnd);

// إزالة اللون البنفسجي الافتراضي من كتل اختيار الطرف، حتى يبقى اللون الدلالي
// الوحيد في النافذة هو لون نوع السند (أخضر قبض / أحمر صرف).
const swaps = [
  ["hover:bg-indigo-50", "hover:bg-slate-100"],
  ["bg-indigo-50/70 border border-indigo-100", "bg-slate-50 border border-slate-200"],
  ["bg-indigo-600 text-white", "bg-slate-800 text-white"],
  ["border-indigo-200 text-indigo-700", "border-slate-200 text-slate-700"],
  ["focus:border-indigo-500", "focus:border-slate-400"],
  ["text-indigo-600", "text-slate-700"],
];
let changed = 0;
for (const [from, to] of swaps) {
  const parts = modal.split(from);
  changed += parts.length - 1;
  modal = parts.join(to);
}

s = s.slice(0, formStart) + modal + s.slice(formEnd);
fs.writeFileSync(file, s, "utf8");
console.log("neutralized indigo classes:", changed);
console.log("remaining indigo in modal:", (modal.match(/indigo/g) || []).length);
