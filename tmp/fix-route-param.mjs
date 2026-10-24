import fs from "node:fs";
const f = "modules/purchases/suppliers_api.routes.ts";
let s = fs.readFileSync(f, "utf8");
s = s.replace('"/api/purchases/:id(\\\\\\\\d+)"', '"/api/purchases/:id(\\\\d+)"');
fs.writeFileSync(f, s, "utf8");
console.log(s.split("\n")[1659]);
