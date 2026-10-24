const fs = require('fs');
let c = fs.readFileSync('src/components/FingerprintSettings.tsx', 'utf8');

if (!c.includes('timezone_shift')) {
  // Add to state
  c = c.replace(/password: "",\s+device_type: "zkteco",\s+protocol: "tcp",/, 'password: "",\n    device_type: "zkteco",\n    protocol: "tcp",\n    timezone_shift: 0,');
  c = c.replace(/password: device\.password \|\| "",\s+device_type: device\.device_type \|\| "zkteco",\s+protocol: device\.protocol \|\| "tcp",/, 'password: device.password || "",\n      device_type: device.device_type || "zkteco",\n      protocol: device.protocol || "tcp",\n      timezone_shift: device.timezone_shift || 0,');

  // Add to UI form
  const tzField = `
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    إزاحة الوقت (بالساعات)
                  </label>
                  <input
                    type="number"
                    value={formData.timezone_shift || 0}
                    onChange={(e) => setFormData({ ...formData, timezone_shift: parseInt(e.target.value) || 0 })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="مثال: 3 لتزويد 3 ساعات"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">استخدمه إذا كان وقت الجهاز يختلف عن الوقت الفعلي (مثال: -3 أو 3)</p>
                </div>
`;

  c = c.replace(/<div className="grid grid-cols-1 md:grid-cols-2 gap-4">/, tzField + '\n<div className="grid grid-cols-1 md:grid-cols-2 gap-4">');
  fs.writeFileSync('src/components/FingerprintSettings.tsx', c);
  console.log("Patched UI TZ");
}
