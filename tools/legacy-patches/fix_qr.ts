import fs from 'fs';

let content = fs.readFileSync('src/components/SendEmployeeMessageModal.tsx', 'utf-8');

const replacement = `
  const [qrStatus, setQrStatus] = useState<"generating" | "ready" | "connected">("generating");
  const [realQrCode, setRealQrCode] = useState<string | null>(null);

  // Poll status from backend
  useEffect(() => {
    let interval: any;
    if (activeTab === "direct_web") {
      setQrStatus("generating");
      setRealQrCode(null);
      // start client
      api.post("/api/hr/whatsapp/client/start", {}).then(() => {
        interval = setInterval(async () => {
          try {
            const res = await api.get("/api/hr/whatsapp/client/status");
            const data = await res.json();
            if (data.status === "ready" && data.qr) {
              setQrStatus("ready");
              setRealQrCode(data.qr);
            } else if (data.status === "connected") {
              setQrStatus("connected");
              setRealQrCode(null);
              // auto config
              setWaConfig(prev => ({ ...prev, provider: "custom_gateway" }));
              api.post("/api/hr/whatsapp/config", { ...waConfig, provider: "custom_gateway" });
            } else if (data.status === "generating" || data.status === "idle") {
              setQrStatus("generating");
              setRealQrCode(null);
            }
          } catch(e) {}
        }, 3000);
      });
    }

    return () => {
      if (interval) clearInterval(interval);
    }
  }, [activeTab]);
`;

content = content.replace(/const \[qrStatus, setQrStatus\] = useState<"generating" \| "ready" \| "connected">.*?;/, replacement);

const replacementUi = `
                  {qrStatus === "generating" ? (
                    <div className="p-8 text-slate-400 font-bold text-xs flex flex-col items-center gap-2">
                      <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                      <span>جاري توليد كود QR للربط المباشر بالسيرفر...</span>
                    </div>
                  ) : qrStatus === "ready" && realQrCode ? (
                    <div className="space-y-3 flex flex-col items-center">
                      <div className="p-2.5 bg-white rounded-2xl shadow-xl flex flex-col items-center space-y-2">
                        {/* Real Scannable QR Code Image from Baileys */}
                        <img
                          src={realQrCode}
                          alt="Real Scannable WhatsApp QR Code"
                          className="w-44 h-44 rounded-xl border border-slate-200 object-contain"
                        />
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          امسح بجوالك لفتح الواتساب الحقيقي 📱
                        </span>
                      </div>
                      <div className="text-xs text-amber-300 font-bold bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-full animate-pulse">
                        باركود حقيقي متفاعل | يتجدد عند التحديث
                      </div>
                    </div>
                  ) : qrStatus === "connected" ? (
`;

// use string replace but more careful
content = content.replace(/\{qrStatus === "generating" \? \([\s\S]*?\) : qrStatus === "ready" \? \([\s\S]*?\) : \(/, replacementUi + '\n(');

// remove the extra condition that matched because I added ) : (
content = content.replace(/\) : \(\s*<div className="space-y-3 py-2 flex flex-col items-center">/, '                  ) : qrStatus === "connected" ? (\n                    <div className="space-y-3 py-2 flex flex-col items-center">');
fs.writeFileSync('src/components/SendEmployeeMessageModal.tsx', content);
