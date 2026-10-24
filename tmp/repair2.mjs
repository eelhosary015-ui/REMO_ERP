import fs from "node:fs";
import path from "node:path";

// 1) Costs.tsx — نقل سطر الاستيراد من داخل import متعدد الأسطر
{
  const target = "src/components/Costs.tsx";
  let lines = fs.readFileSync(target, "utf8").split("\n");
  const idx = lines.findIndex((l, i) => l.trim().startsWith('import { pageRows') && i < 200);
  if (idx !== -1) {
    let p = idx - 1;
    while (p >= 0 && lines[p].trim() === "") p--;
    if (lines[p].trim().startsWith("import") && !/from\s+['"]/.test(lines[p])) {
      lines.splice(idx, 1);
      const end = lines.findIndex((l) => /^\}\s*from\s+['"]/.test(l.trim()));
      const insertAt = end !== -1 ? end + 1 : 12;
      lines.splice(insertAt, 0, 'import { pageRows, PaginationBar, usePaginationState } from "./PaginationBar";');
      fs.writeFileSync(target, lines.join("\n"), "utf8");
      console.log("Costs.tsx: import moved");
    }
  }
}

// 2) CostManagement.tsx — نقل سطر الحالة من داخل useState متعدد الأسطر
{
  const target = "src/components/production/CostManagement.tsx";
  let lines = fs.readFileSync(target, "utf8").split("\n");
  const idx = lines.findIndex((l) => l.includes("const pgn1 = usePaginationState();"));
  if (idx !== -1) {
    // هل نحن داخل قوس غير مغلق؟ افحص التوازن من بداية الملف
    const balance = (upto) => {
      let p = 0, b = 0, c = 0, quote = null;
      const text = lines.slice(0, upto).join("\n");
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quote) { if (ch === "\\") i++; else if (ch === quote) quote = null; continue; }
        if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
        if (ch === "(") p++; else if (ch === ")") p--;
        else if (ch === "[") b++; else if (ch === "]") b--;
        else if (ch === "{") c++; else if (ch === "}") c--;
      }
      return { p, b, c };
    };
    const bal = balance(idx);
    if (bal.p > 0 || bal.c > 0 || bal.b > 0) {
      const line = lines[idx];
      lines.splice(idx, 1);
      // أول سطر يعيد التوازن
      let j = idx;
      for (; j < lines.length; j++) {
        const bb = balance(j + 1);
        if (bb.p <= 0 && bb.c <= 1 && bb.b <= 0) break;
      }
      lines.splice(j + 1, 0, line);
      fs.writeFileSync(target, lines.join("\n"), "utf8");
      console.log("CostManagement.tsx: state moved after multiline useState");
    }
  }
}
