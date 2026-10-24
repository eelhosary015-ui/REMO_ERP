import fs from "node:fs";
const p = "tmp/patch-costs-pagination.mjs";
let s = fs.readFileSync(p, "utf8");
s = s.replace('if (matches.length !== 3) throw new Error("expected 3 inline filters in tab, found " + matches.length);',
              'if (matches.length < 3) throw new Error("expected inline filters in tab, found " + matches.length);\nconsole.log("inline filters replaced:", matches.length);');
fs.writeFileSync(p, s, "utf8");
console.log("relaxed");
