import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { LanguageProvider } from "./contexts/LanguageContext.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";

// Intercept all fetch requests globally to resolve relative paths inside mobile/Capacitor webviews
const originalFetch = window.fetch;
const customFetch = function (this: any, input: any, init: any) {
  let urlStr = "";
  if (typeof input === "string") {
    urlStr = input;
  } else if (input instanceof Request) {
    urlStr = input.url;
  }

  try {
    // Resolve the URL against the current origin to safely parse it
    const parsedUrl = new URL(urlStr, window.location.origin);
    
    // Check if it's a relative API request (directly starting with /api/ or resolving to current localhost/file origin with /api/)
    const isRelativeApi = 
      urlStr.startsWith("/api/") || 
      ((parsedUrl.origin === window.location.origin || 
        parsedUrl.hostname === 'localhost' || 
        parsedUrl.hostname === '127.0.0.1' || 
        parsedUrl.protocol === 'file:' ||
        parsedUrl.protocol === 'capacitor:') && parsedUrl.pathname.startsWith("/api/"));

    if (isRelativeApi) {
      let saved = localStorage.getItem("API_BASE_URL");
      let base = "";
      if (saved) {
        if (saved.includes("epjrso3jhkco2k2ejlqcll")) {
          saved = null;
          localStorage.removeItem("API_BASE_URL");
        } else {
          saved = saved.trim();
          if (saved && !saved.startsWith("http://") && !saved.startsWith("https://")) {
            saved = "http://" + saved;
          }
          base = saved.replace(/\/$/, "");
        }
      }
      
      if (!saved) {
        const isCapacitor =
          (window as any).Capacitor !== undefined ||
          window.location.protocol === "file:" ||
          window.location.protocol === "capacitor:";

        if (isCapacitor) {
          base = "https://ais-dev-z2lbf3y66pjx4leaj6ciat-162171170465.europe-west2.run.app";
        } else {
          base = window.location.origin;
        }
      }

      // Reconstruct target URL combining custom server base with path and query
      const resolvedUrl = `${base}${parsedUrl.pathname}${parsedUrl.search}`;
      
      init = init || {};
      if (!init.headers) {
        init.headers = {};
      }
      
      if (init.headers instanceof Headers) {
        init.headers.set('Bypass-Tunnel-Reminder', 'true');
        init.headers.set('ngrok-skip-browser-warning', 'true');
      } else if (Array.isArray(init.headers)) {
        init.headers.push(['Bypass-Tunnel-Reminder', 'true']);
        init.headers.push(['ngrok-skip-browser-warning', 'true']);
      } else {
        init.headers = {
          ...init.headers,
          'Bypass-Tunnel-Reminder': 'true',
          'ngrok-skip-browser-warning': 'true'
        };
      }

      if (typeof input === "string") {
        input = resolvedUrl;
      } else {
        // Re-create Request with the resolved URL to preserve headers, body, etc.
        // We also need to inject headers into the Request object if it is one, but init takes precedence.
        const originalHeaders = new Headers((input as any).headers);
        originalHeaders.set('Bypass-Tunnel-Reminder', 'true');
        originalHeaders.set('ngrok-skip-browser-warning', 'true');
        
        input = new Request(resolvedUrl, input as any);
        // Request headers are immutable in constructor if they conflict sometimes, but init.headers overrides them anyway.
      }
    }
  } catch (e) {
    // Fallback to original if URL parsing fails
  }

  return originalFetch.call(this, input, init);
};

// Safely attempt to override window.fetch to prevent "TypeError: Cannot set property fetch of #<Window> which has only a getter"
try {
  Object.defineProperty(window, "fetch", {
    value: customFetch,
    writable: true,
    configurable: true,
    enumerable: true,
  });
} catch (e) {
  console.warn("Could not redefine window.fetch via Object.defineProperty, trying direct assignment:", e);
  try {
    (window as any).fetch = customFetch;
  } catch (err) {
    console.error("Critical: Failed to override window.fetch globally:", err);
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="حدث خطأ في واجهة النظام">
      <AuthProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);