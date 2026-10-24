import fs from "node:fs";
const f = "modules/purchases/suppliers_api.routes.ts";
const lines = fs.readFileSync(f, "utf8").split("\n");
const i = lines.findIndex(l => l.includes("/api/purchases/:id(") );
if (i === -1) { console.log("not found"); process.exit(1); }
lines[i] = lines[i].replace(/:id\(\\+d\+\)/, ":id(\\\\d+)");
fs.writeFileSync(f, lines.join("\n"), "utf8");
console.log(JSON.stringify(lines[i]));
