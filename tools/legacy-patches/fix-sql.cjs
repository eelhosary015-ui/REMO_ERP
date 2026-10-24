const fs = require('fs');
let file = 'modules/fingerprint/services/fingerprint.service.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  "        `(${idx * 5 + 1}, ${idx * 5 + 2}, ${idx * 5 + 3}, ${idx * 5 + 4}, ${idx * 5 + 5})`",
  "        `($${idx * 5 + 1}, $${idx * 5 + 2}, $${idx * 5 + 3}, $${idx * 5 + 4}, $${idx * 5 + 5})`"
);
fs.writeFileSync(file, content);
console.log("Fixed placeholders");
