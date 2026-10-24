const fs = require('fs');
const file = 'src/components/FingerprintSettings.tsx';
let c = fs.readFileSync(file, 'utf8');
if (!c.includes(' Users,')) {
  c = c.replace(/import \{/, 'import { Users,');
  fs.writeFileSync(file, c);
}
