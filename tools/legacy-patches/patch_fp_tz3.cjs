const fs = require('fs');
let c = fs.readFileSync('modules/fingerprint/services/fingerprint.service.ts', 'utf8');

c = c.replace(/if \(isNaN\(punchDate.getTime\(\)\)\) \{/, 
  "if (device.timezone_shift) {\n          punchDate.setHours(punchDate.getHours() + Number(device.timezone_shift));\n        }\n\n        if (isNaN(punchDate.getTime())) {");
c = c.replace(/punchDate = rawTime;/, "punchDate = new Date(rawTime.getTime());");

fs.writeFileSync('modules/fingerprint/services/fingerprint.service.ts', c);
console.log("Patched");
