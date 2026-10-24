import fs from "node:fs";
let raw = fs.readFileSync("tmp/fix-vitest.log", "utf8").replace(/\x1b\[[0-9;]*m/g, "");
const lines = raw.split("\n");
let out = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith(" FAIL ")) {
    out.push("\n### " + lines[i].trim());
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const l = lines[j].trim();
      if (l.startsWith("FAIL") || l.startsWith("❯")) break;
      if (l) out.push("   " + l.slice(0, 190));
    }
  }
}
console.log(out.join("\n"));
