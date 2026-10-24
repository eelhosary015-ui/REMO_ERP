import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const plugins = [
    react(),
    tailwindcss(),
  ];

  return {
    plugins,
    optimizeDeps: {
      include: ['motion', 'motion/react', 'framer-motion'],
    },
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    // === Code splitting: split large vendor libs into separate chunks ===
    // This makes the main bundle smaller and lets the browser cache vendor code separately.
    // It also speeds up rebuilds and reduces memory usage during build.
    //
    // ⚠️ NOTE: firebase and firebase-admin are EXCLUDED from manualChunks because they
    // use package.json "exports" maps with subpath exports only (no "." entry point).
    // Vite/Rollup throws "Failed to resolve entry for package 'firebase'" when you try
    // to bundle them as a single chunk. Let Vite's default code-splitting handle them.
    build: {
      chunkSizeWarningLimit: 20000, // 20 MB — silence the 500kB warning for our big ERP bundle
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Function-based manualChunks — more flexible and safer than the object form
            // because we can skip problematic packages like firebase
            if (id.includes('node_modules')) {
              // React core
              if (id.includes('react/') || id.includes('react-dom/') || id.includes('scheduler/')) return 'react-vendor';
              // Animation libraries (big — keep separate)
              if (id.includes('/motion/') || id.includes('/framer-motion/')) return 'motion-vendor';
              // Charts + Excel + PDF libs (very big — keep separate)
              if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-')) return 'charts-vendor';
              if (id.includes('/xlsx/') || id.includes('xlsx.mjs')) return 'excel-vendor';
              if (id.includes('jspdf') || id.includes('html2pdf') || id.includes('canvg') || id.includes('pdf-lib')) return 'pdf-vendor';
              // Google AI (big — keep separate)
              if (id.includes('@google/genai')) return 'ai-vendor';
              // Socket.IO + realtime — must include its deps (engine.io, socket.io-parser, etc.)
              // to avoid circular chunk warnings
              if (id.includes('socket.io') || id.includes('engine.io') || id.includes('socket.io-parser')) return 'socket-vendor';
              // Capacitor mobile
              if (id.includes('@capacitor/')) return 'capacitor-vendor';
              // Other heavy deps
              if (id.includes('date-fns') || id.includes('lucide-react') || id.includes('/swr/')) return 'utils-vendor';

              // ⚠️ EXPLICITLY EXCLUDE firebase packages — let Vite split them naturally.
              // firebase v12+ uses subpath exports only (no "." specifier) which breaks
              // manualChunks. Same for firebase-admin.
              if (id.includes('/firebase/') || id.includes('/firebase-admin/') || id.includes('/@firebase/')) {
                // Return undefined → Vite puts this in the default chunk for that import
                return undefined;
              }

              // Default: bundle other small deps into a generic vendor chunk
              return 'vendor';
            }
            // App code → default chunk
            return undefined;
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      // Allow the sandbox preview gateway (and any *.fcapp.run / *.z.ai host) to access Vite dev server.
      allowedHosts: true,
      // Disable HMR to avoid websocket disconnects in the preview iframe (sandbox)
      hmr: false,
      // Disable file watching - background jobs (backup scheduler, fingerprint autosync)
      // write to backups/offline-db.json every few minutes and trigger full page reloads,
      // which causes a white screen loop for the end user.
      watch: null,
    },
  };
});
