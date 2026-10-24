const fs = require('fs');
const iconv = require('iconv-lite');

const cp864Map = {};
for(let i=128; i<256; i++) {
  const buf = Buffer.from([i]);
  const str = iconv.decode(buf, 'cp864');
  if (str.length === 1 && str.charCodeAt(0) !== 0xFFFD) {
    cp864Map[str.charCodeAt(0)] = i;
  }
}

// Write it out as a module
let out = "export const cp864Map: Record<number, number> = {\n";
for (const [code, byte] of Object.entries(cp864Map)) {
  out += `  ${code}: 0x${byte.toString(16).padStart(2, '0')}, // ${String.fromCharCode(code)}\n`;
}
out += "};\n";

fs.writeFileSync('cp864_map.ts', out);
console.log("cp864_map.ts generated!");
