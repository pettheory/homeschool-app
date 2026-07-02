import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Dual-stack bind: as a Windows service (session 0), Node prefers IPv6 and Vite
    // would otherwise listen on ::1 only — invisible to browsers resolving localhost
    // to 127.0.0.1. host:true listens on both. strictPort keeps 5173 stable.
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      // Backend seam for the real voice/AI engines (see server/index.js).
      // 127.0.0.1 (not "localhost") so service-context DNS quirks can't misroute it.
      '/api': 'http://127.0.0.1:3001',
    },
  },
});
