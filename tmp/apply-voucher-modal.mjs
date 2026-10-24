import fs from "node:fs";

const file = "src/components/treasury/TreasuryTransactionsEnterprise.tsx";
let s = fs.readFileSync(file, "utf8");
const read = (p) => fs.readFileSync(p, "utf8");
const A = read("tmp/voucher-region-a.txt");
const B = read("tmp/voucher-region-b.txt");
const C = read("tmp/voucher-region-c.txt");
const D = read("tmp/voucher-region-d.txt");
const STATE = read("tmp/voucher-state-snippet.txt");

function replaceOnce(haystack, needle, replacement, label) {
  const i = haystack.indexOf(needle);
  if (i === -1) throw new Error(`missing: ${label}`);
  if (haystack.indexOf(needle, i + 1) !== -1) throw new Error(`not unique: ${label}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
}

// 1) icons
s = replaceOnce(
  s,
  `  Check\n} from "lucide-react";`,
  `  Check,\n  Wallet,\n  ChevronDown,\n  CalendarDays,\n  Clock,\n  Hash,\n  Users,\n  Banknote,\n  Landmark,\n  FileCheck2,\n  Save,\n  Loader2\n} from "lucide-react";`,
  "lucide imports",
);

// 2) helpers + draft logic
s = replaceOnce(
  s,
  "  const isSubmittingVoucherRef = useRef(false);\n",
  "  const isSubmittingVoucherRef = useRef(false);\n" + STATE,
  "state anchor",
);

// 3) modal regions (compute on the current string, apply from the end)
const formStart = s.indexOf(`          <form\n            onSubmit={handleCreateVoucher}`);
if (formStart === -1) throw new Error("form start not found");
const bodyMarker = `            <div className="space-y-4 text-xs">`;
const bodyStart = s.indexOf(bodyMarker, formStart);
if (bodyStart === -1) throw new Error("body marker not found");
const tabsMarker = `              {/* Party Type Tabs */}`;
const tabsStart = s.indexOf(tabsMarker, bodyStart);
if (tabsStart === -1) throw new Error("tabs marker not found");
const entityMarker = `              {/* Entity Selection & Autocomplete */}`;
const entityStart = s.indexOf(entityMarker, tabsStart);
if (entityStart === -1) throw new Error("entity marker not found");
const paymentMarker = `              {/* Payment Method */}`;
const paymentStart = s.indexOf(paymentMarker, entityStart);
if (paymentStart === -1) throw new Error("payment marker not found");
const formEnd = s.indexOf(`          </form>`, paymentStart);
if (formEnd === -1) throw new Error("form end not found");

s = s.slice(0, paymentStart) + D + s.slice(formEnd);
s = s.slice(0, tabsStart) + C + s.slice(entityStart);
s = s.slice(0, bodyStart) + B + s.slice(tabsStart);
s = s.slice(0, formStart) + A + s.slice(bodyStart);

fs.writeFileSync(file, s, "utf8");
console.log("voucher modal rebuilt:", s.length, "chars");

// sanity: the old body wrapper and old footer must be gone
for (const legacy of ['className="space-y-4 text-xs"', "حفظ وإصدار السند الآن", "{/* Payment Method */}"]) {
  const n = (s.match(new RegExp(legacy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  console.log(`legacy "${legacy}" occurrences:`, n);
}
