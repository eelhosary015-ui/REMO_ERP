import fs from "node:fs";
const p = "package.json";
let s = fs.readFileSync(p, "utf8");
if (!s.includes('"db:dump"')) {
  s = s.replace('"predev": "node scripts/ensure-database.mjs",', '"predev": "node scripts/ensure-database.mjs",\n    "db:dump": "node scripts/dump-schema.mjs",');
  fs.writeFileSync(p, s, "utf8");
  console.log("added db:dump");
} else console.log("already there");
