import fs from "node:fs";
let s = fs.readFileSync(".env", "utf8");
const before = s;
s = s.replace(/(^|\n)DATABASE_URL=.*?(?=\n|$)/, "$1DATABASE_URL=postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system1");
if (s === before) { console.log("NO CHANGE — pattern not found"); process.exit(1); }
fs.writeFileSync(".env", s, "utf8");
console.log("DATABASE_URL restored → erp_system1");
