const fs = require('fs');
const path = require('path');

// Windows-safe, idempotent postinstall patch. Never fail npm install.
try {
  const pkgPath = path.join(__dirname, 'node_modules', 'whatsapp-rust-bridge', 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.log('whatsapp-rust-bridge not installed; skipping patch.');
    process.exit(0);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.exports && pkg.exports['.']) {
    pkg.exports['.'] = {
      require: './dist/index.js',
      import: './dist/index.js',
      default: './dist/index.js',
      types: './dist/index.d.ts'
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('Patched whatsapp-rust-bridge package.json');
  } else {
    console.log('whatsapp-rust-bridge exports entry not found; no patch needed.');
  }
} catch (error) {
  console.warn('WhatsApp postinstall patch skipped:', error.message);
}
process.exit(0);
