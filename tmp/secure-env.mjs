import fs from "node:fs";
let s = fs.readFileSync(".env", "utf8");
s = s.replace(/^DEV_AUTH_BYPASS=.*$/m, "DEV_AUTH_BYPASS=false");
fs.writeFileSync(".env", s, "utf8");
console.log("DEV_AUTH_BYPASS=false (الوصول بدون توكن مغلق)");
