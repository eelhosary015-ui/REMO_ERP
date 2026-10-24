const fs = require('fs');
let c = fs.readFileSync('modules/fingerprint/services/fingerprint.service.ts', 'utf8');

const tzCode = `
        let punchDate: Date;
        if (rawTime instanceof Date) {
          punchDate = new Date(rawTime.getTime());
        } else if (rawTime) {
          punchDate = new Date(rawTime);
        } else {
          continue;
        }

        // Apply device timezone shift if configured (in hours)
        if (device.timezone_shift) {
          punchDate.setHours(punchDate.getHours() + Number(device.timezone_shift));
        }

        if (isNaN(punchDate.getTime())) {
`;

c = c.replace(/        let punchDate: Date;\n        if \(rawTime instanceof Date\) \{\n          punchDate = rawTime;\n        \} else if \(rawTime\) \{\n          punchDate = new Date\(rawTime\);\n        \} else \{\n          continue;\n        \}\n        if \(isNaN\(punchDate\.getTime\(\)\)\) \{/, tzCode);

fs.writeFileSync('modules/fingerprint/services/fingerprint.service.ts', c);
