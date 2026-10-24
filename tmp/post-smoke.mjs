const BASE = "http://localhost:3111";
const H = { "Content-Type": "application/json", Authorization: "Bearer preview-bypass-token" };

async function call(method, path, body) {
  try {
    const res = await fetch(BASE + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 220) };
  } catch (e) {
    return { status: 0, body: String(e.message).slice(0, 200) };
  }
}

const cases = [
  ["POST", "/api/customers", { name: "عميل فحص تلقائي", phone: "01000000000", type: "individual" }],
  ["POST", "/api/suppliers", { name: "مورد فحص تلقائي", phone: "01111111111" }],
  ["POST", "/api/branches", { name: "فرع فحص" }],
  ["POST", "/api/cost-centers", { name: "مركز فحص", code: "TEST-CC-R2" }],
  ["POST", "/api/costs/centers", { name: "مركز فحص 2", code: "TEST-CC-R3" }],
  ["POST", "/api/costs/items", { name: "بند فحص", code: "TEST-CI-R2", category: "عام" }],
  ["POST", "/api/enterprise/workflows", { name: "مسار فحص", module_type: "custom", steps: [{ name: "خطوة", role: "approver" }] }],
  ["POST", "/api/warehouse-types", { name: "نوع فحص", code: "TEST-WT" }],
  ["POST", "/api/transaction-types", { name: "نوع حركة فحص", code: "TEST-TT" }],
  ["POST", "/api/transaction-reasons", { name: "سبب فحص", code: "TEST-TR", transaction_type: "in" }],
  ["POST", "/api/banks/accounts", { name: "بنك فحص", account_number: "1234567890" }],
  ["POST", "/api/warehouses", { name: "مخزن فحص", code: "TEST-WH" }],
];

console.log("=== POST smoke ===");
for (const [m, p, b] of cases) {
  const r = await call(m, p, b);
  console.log(`${r.status}\t${p}\t${r.status >= 400 ? r.body.replace(/\s+/g, " ").slice(0, 170) : ""}`);
}
