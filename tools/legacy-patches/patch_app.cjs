const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const newEffect = `
  useEffect(() => {
    const handleAiAction = (e: Event) => {
      const ce = e as CustomEvent;
      const { actionType, payload } = ce.detail;
      
      if (actionType === "NAVIGATE") {
        if (payload.view) setView(payload.view);
        if (payload.subView) setActiveSubView(payload.subView);
        setIsAIChatOpen(false); // Close chat if we navigate
      }
    };
    window.addEventListener("ai_action", handleAiAction);
    return () => window.removeEventListener("ai_action", handleAiAction);
  }, []);
`;

content = content.replace(
  'const [deferredPrompt, setDeferredPrompt] = useState<any>(null);',
  'const [deferredPrompt, setDeferredPrompt] = useState<any>(null);' + newEffect
);

fs.writeFileSync('src/App.tsx', content);
