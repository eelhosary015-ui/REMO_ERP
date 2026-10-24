import fs from "node:fs";

const target = "src/components/Costs.tsx";
let s = fs.readFileSync(target, "utf8");
const before = s;

// 1) إرجاع خريطة قائمة المستودعات كما كانت (ليست جدولًا)
s = s.replace("{pageRows(systemWarehouses, pgn7).map(warehouse =>", "{systemWarehouses.map(warehouse =>");

// 2) حذف شريط الترقيم الزائف
s = s.replace(/\n[ \t]*<PaginationBar page=\{pgn7\.page\}[^\n]*\/>/, "");

// 3) حذف حالة pgn7
s = s.replace(/\n[ \t]*const pgn7 = usePaginationState\(\);/, "");

if (s !== before) {
  fs.writeFileSync(target, s, "utf8");
  console.log("pgn7 reverted");
}
console.log("remaining pgn7 refs:", (s.match(/pgn7/g) || []).length);
