const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/components/FingerprintSettings.tsx');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('DeviceUsersModal')) {
  // Add state for the modal
  content = content.replace(/const \[syncingId, setSyncingId\] = useState<number \| null>\(null\);/, 
    `const [syncingId, setSyncingId] = useState<number | null>(null);\n  const [showDeviceUsersModal, setShowDeviceUsersModal] = useState<number | null>(null);\n  const [deviceUsers, setDeviceUsers] = useState<any[]>([]);\n  const [loadingDeviceUsers, setLoadingDeviceUsers] = useState(false);`);

  // Add handler function
  const handlerCode = `
  const handleFetchDeviceUsers = async (deviceId: number) => {
    setLoadingDeviceUsers(true);
    setShowDeviceUsersModal(deviceId);
    setDeviceUsers([]);
    try {
      const res = await api.get(\`/api/fingerprint-devices/\${deviceId}/users\`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.users) {
          setDeviceUsers(data.users);
        } else {
          alert(data.error || "حدث خطأ أثناء سحب المستخدمين");
        }
      } else {
        const err = await res.json();
        alert(err.error || "خطأ في الاتصال");
      }
    } catch (err: any) {
      alert("خطأ في الاتصال بالجهاز");
    } finally {
      setLoadingDeviceUsers(false);
    }
  };
`;
  content = content.replace(/const handleConvertFingerprints = async \(\) => \{/, handlerCode + '\n  const handleConvertFingerprints = async () => {');

  // Add the button in the devices table rows
  content = content.replace(/<button\s+onClick=\{\(\) => handleSyncSingleDevice\(device\.id\)\}/, 
    `<button
                        onClick={() => handleFetchDeviceUsers(device.id)}
                        className="text-xs bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-100 font-bold transition-colors flex items-center gap-1 border border-purple-200"
                        title="استيراد المستخدمين من الجهاز"
                      >
                        <Users className="w-3.5 h-3.5" />
                        سحب الموظفين
                      </button>
                      <button
                        onClick={() => handleSyncSingleDevice(device.id)}`);

  // Add the modal JSX at the end of the component return
  const modalJsx = `
      {/* Device Users Modal */}
      {showDeviceUsersModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">مستخدمي جهاز البصمة</h3>
                  <p className="text-xs text-slate-500">استيراد وعرض الموظفين المسجلين على الجهاز</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeviceUsersModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-0 overflow-y-auto flex-1">
              {loadingDeviceUsers ? (
                <div className="p-12 flex flex-col items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mb-4" />
                  <p className="text-slate-600 font-medium">جاري سحب بيانات الموظفين من الجهاز...</p>
                  <p className="text-sm text-slate-400 mt-2">قد يستغرق هذا بضع ثواني</p>
                </div>
              ) : deviceUsers.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">لا يوجد مستخدمين على هذا الجهاز أو فشل الاتصال.</p>
                </div>
              ) : (
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 font-semibold">كود البصمة (UID)</th>
                      <th className="px-4 py-3 font-semibold">رقم الموظف (ID)</th>
                      <th className="px-4 py-3 font-semibold">الاسم على الجهاز</th>
                      <th className="px-4 py-3 font-semibold">الصلاحية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deviceUsers.map((u, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-800">{u.uid}</td>
                        <td className="px-4 py-3 text-slate-600">{u.userId}</td>
                        <td className="px-4 py-3 text-slate-800">{u.name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={\`px-2 py-1 rounded-md text-xs font-bold \${u.role === 14 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}\`}>
                            {u.role === 14 ? 'مدير (Admin)' : 'موظف عادي'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowDeviceUsersModal(null)}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 font-bold transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
`;

  content = content.replace(/\{showSettingsModal && \(/, modalJsx + '\n      {showSettingsModal && (');
  fs.writeFileSync(file, content);
  console.log("Added device users modal UI");
}
