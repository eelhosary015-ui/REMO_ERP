import fs from 'fs';
let content = fs.readFileSync('src/components/SendEmployeeMessageModal.tsx', 'utf-8');

const targetState = 'const [qrStatus, setQrStatus] = useState<"idle" | "generating" | "ready" | "connected">("connected");';
const replacementState = `const [qrStatus, setQrStatus] = useState<"idle" | "generating" | "ready" | "connected">("connected");
  const [realQrCode, setRealQrCode] = useState<string | null>(null);

  useEffect(() => {
    let interval: any;
    if (activeTab === "qr_sync") {
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
  }, [activeTab]);`;

content = content.replace(targetState, replacementState);
fs.writeFileSync('src/components/SendEmployeeMessageModal.tsx', content);
