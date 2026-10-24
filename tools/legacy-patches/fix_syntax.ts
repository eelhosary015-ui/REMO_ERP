import fs from 'fs';
let content = fs.readFileSync('src/components/SendEmployeeMessageModal.tsx', 'utf-8');
content = content.replace('                    </div>\n                  )}', '                    </div>\n                  ) : null}');
fs.writeFileSync('src/components/SendEmployeeMessageModal.tsx', content);
