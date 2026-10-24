import fs from "node:fs";
const p = "src/index.css";
let s = fs.readFileSync(p, "utf8");
if (!s.includes("body.pos-page")) {
  s += `

/* شاشة نقطة البيع: لا شريط أبيض أسفل الصفحة — خلفية الصفحة بلون شريط الحالة */
body.pos-page {
  background-color: #1e293b;
  overflow: hidden;
}
body.pos-page #root {
  background-color: #1e293b;
}
`;
  fs.writeFileSync(p, s, "utf8");
  console.log("css appended");
} else {
  console.log("already present");
}
