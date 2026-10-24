const fs = require('fs');
const content = fs.readFileSync('tsconfig.json', 'utf8');
const data = JSON.parse(content);
data.include = data.compilerOptions.include;
data.exclude = data.compilerOptions.exclude;
delete data.compilerOptions.include;
delete data.compilerOptions.exclude;
fs.writeFileSync('tsconfig.json', JSON.stringify(data, null, 2));
