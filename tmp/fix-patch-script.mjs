import fs from "node:fs";
const p = "tmp/patch-costs-pagination.mjs";
let s = fs.readFileSync(p, "utf8");
s = s.replace(`const filterRe = /costs\\.filter\\(c => \\{[\\s\\S]*?return matchesSearch && matchesStatus && matchesCenter && matchesDate;\\s*\\}\\)/g;
const matches = s.match(filterRe) || [];
if (matches.length !== 3) throw new Error("expected 3 inline filters, found " + matches.length);
s = s.replace(filterRe, "ocFiltered");`,
`const filterRe = /costs\\.filter\\(c => \\{[\\s\\S]*?return matchesSearch && matchesStatus && matchesCenter && matchesDate;\\s*\\}\\)/g;
const tabStart = s.indexOf("{activeTab === 'operating_costs' && (");
const tabEnd = s.indexOf("{/* TAB 1C: ESTIMATED BUDGET CONTROL", tabStart);
if (tabStart === -1 || tabEnd === -1) throw new Error("operating tab bounds not found");
let tab = s.slice(tabStart, tabEnd);
const matches = tab.match(filterRe) || [];
if (matches.length !== 3) throw new Error("expected 3 inline filters in tab, found " + matches.length);
tab = tab.replace(filterRe, "ocFiltered");
s = s.slice(0, tabStart) + tab + s.slice(tabEnd);`);
fs.writeFileSync(p, s, "utf8");
console.log("script fixed");
