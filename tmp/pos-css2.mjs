import fs from "node:fs";
const p = "src/index.css";
let s = fs.readFileSync(p, "utf8");
s = s.replace(`body.pos-page {
  background-color: #1e293b;
  overflow: hidden;
}`, `body.pos-page {
  background-color: #1e293b;
}`);
fs.writeFileSync(p, s, "utf8");
console.log("css updated");
