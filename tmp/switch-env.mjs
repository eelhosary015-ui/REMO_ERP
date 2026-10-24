import fs from "node:fs";
let s = fs.readFileSync(".env", "utf8");
s = s.replace(/(^|\n)DATABASE_URL=.*?(?=\n|$)/, "$1DATABASE_URL=postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2");
fs.writeFileSync(".env", s, "utf8");
console.log("DATABASE_URL → erp_system2");
