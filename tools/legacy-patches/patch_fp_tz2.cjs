const fs = require('fs');
let c = fs.readFileSync('modules/fingerprint/services/fingerprint.service.ts', 'utf8');

const target = `        let punchDate: Date;
        if (rawTime instanceof Date) {
          punchDate = rawTime;
        } else if (rawTime) {
          punchDate = new Date(rawTime);
        } else {
          continue;
        }
        if (isNaN(punchDate.getTime())) {`;

const replacement = `        let punchDate: Date;
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

        if (isNaN(punchDate.getTime())) {`;

if (c.includes(target)) {
  c = c.replace(target, replacement);
  fs.writeFileSync('modules/fingerprint/services/fingerprint.service.ts', c);
  console.log("Patched successfully");
} else {
  console.log("Target not found");
}
