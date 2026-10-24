const fs = require('fs');
let content = fs.readFileSync('src/components/POS.tsx', 'utf8');

content = content.replace('<span className={`text-xs font-mono font-bold ${posTheme === "neobrutalist" ? "bg-black text-white px-2 py-0.5 border border-black" : "text-slate-400"}`}>{invoiceNumber}</span>', '<span className={`hidden sm:inline-block text-xs font-mono font-bold ${posTheme === "neobrutalist" ? "bg-black text-white px-2 py-0.5 border border-black" : "text-slate-400"}`}>{invoiceNumber}</span>');
content = content.replace('<span className="text-[10px] text-slate-300">|</span>\n          <span className={`text-xs font-bold', '<span className="hidden sm:inline-block text-[10px] text-slate-300">|</span>\n          <span className={`hidden sm:inline-block text-xs font-bold');

content = content.replace('<span className="text-[11px] font-bold">{cashierName}</span>\n          </div>\n          <span className="text-[10px] text-slate-300">|</span>\n          <span className={`text-xs font-mono font-bold ${posTheme === "neobrutalist" ? "text-black" : "text-slate-500"}`}>{currentTime.toLocaleTimeString()}</span>', '<span className="hidden sm:inline-block text-[11px] font-bold">{cashierName}</span>\n          </div>\n          <span className="hidden sm:inline-block text-[10px] text-slate-300">|</span>\n          <span className={`hidden sm:inline-block text-xs font-mono font-bold ${posTheme === "neobrutalist" ? "text-black" : "text-slate-500"}`}>{currentTime.toLocaleTimeString()}</span>');

// For neobrutalist REMO_PRO text
content = content.replace('<span className="font-mono tracking-widest font-black">REMO_PRO // PRO</span>', '<span className="hidden sm:inline-block font-mono tracking-widest font-black">REMO_PRO // PRO</span>');

fs.writeFileSync('src/components/POS.tsx', content, 'utf8');
