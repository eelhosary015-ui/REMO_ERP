const fs = require('fs');
const path = require('path');
const pkgPath = path.join(__dirname, 'node_modules', 'whatsapp-rust-bridge', 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.exports && pkg.exports['.']) {
    pkg.exports['.'] = {
      require: './dist/index.js',
      import: './dist/index.js',
      default: './dist/index.js',
      types: './dist/index.d.ts'
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log('Patched whatsapp-rust-bridge package.json');
  }
}
