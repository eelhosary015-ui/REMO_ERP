const fs = require('fs');
let content = fs.readFileSync('src/components/DatabaseManager.tsx', 'utf8');

// Remove the handleSeedDemoData function
content = content.replace(/const handleSeedDemoData = async \(\) => \{[\s\S]*?setTimeout\(\(\) => setActionStatus\(null\), 5000\);\n  \};\n/m, '');

// Remove the Seed Demo Data Card
content = content.replace(/\{\/\* Seed Demo Data Card \*\/\}[\s\S]*?<\/div>\n\n\s*\{\/\* Automatic Backups List \*\/\}/m, '{/* Automatic Backups List */}');

fs.writeFileSync('src/components/DatabaseManager.tsx', content);
