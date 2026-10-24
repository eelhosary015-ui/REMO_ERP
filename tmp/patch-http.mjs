import fs from "node:fs";
const p = "tmp/http-acceptance.mjs";
let s = fs.readFileSync(p, "utf8");
s = s.replace("record(\"الفترات مُنشأة بتواريخ صحيحة\", jan?.end_date === `${YEAR}-01-31`, `jan end=${jan?.end_date}`);",
 "const janEndLocal = jan?.end_date ? new Date(jan.end_date).toLocaleDateString(\"en-CA\") : null;\nrecord(\"الفترات مُنشأة بتواريخ صحيحة\", janEndLocal === `${YEAR}-01-31`, `jan end=${janEndLocal}`);");
fs.writeFileSync(p, s, "utf8");
console.log("patched");
