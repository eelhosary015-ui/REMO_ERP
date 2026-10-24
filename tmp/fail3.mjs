import fs from "node:fs";
let raw = fs.readFileSync("tmp/fix-vitest.log", "utf8").replace(/\x1b\[[0-9;]*m/g, "");
const lines = raw.split("\n");
const idx = lines.findIndex(l => l.includes("Failed Tests 6"));
for (let i = idx; i < Math.min(idx + 120, lines.length); i++) {
  const l = lines[i];
  if (/AssertionError|Error:|expected|→/.test(l)) console.log(l.trim().slice(0, 200));
}
