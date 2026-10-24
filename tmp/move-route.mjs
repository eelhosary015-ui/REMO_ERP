import fs from "node:fs";
const f = "modules/purchases/suppliers_api.routes.ts";
let lines = fs.readFileSync(f, "utf8").split("\n");

// 1) إرجاع :id كما كان
const idIdx = lines.findIndex(l => l.includes("/api/purchases/:id("));
if (idIdx !== -1) lines[idIdx] = lines[idIdx].replace(/:id\([^)]*\)/, ":id");

// 2) استخراج كتلة dashboard
const start = lines.findIndex(l => l.startsWith('router.get("/api/purchases/dashboard"'));
if (start === -1) { console.log("dashboard route not found"); process.exit(1); }
let end = start + 1;
while (end < lines.length && lines[end] !== "});") end++;
if (end >= lines.length) { console.log("end not found"); process.exit(1); }
const block = lines.slice(start, end + 1);
lines.splice(start, end - start + 1);

// 3) إدراجها قبل مسار /:id
const target = lines.findIndex(l => l.startsWith('router.get("/api/purchases/:id"'));
if (target === -1) { console.log("id route not found"); process.exit(1); }
lines.splice(target, 0, ...block, "");

fs.writeFileSync(f, lines.join("\n"), "utf8");
console.log("moved dashboard block (" + block.length + " lines) before /:id at line " + (target + 1));
