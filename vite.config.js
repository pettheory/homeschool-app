import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Backend seam for the real voice/AI engines (see server/index.js).
      '/api': 'http://localhost:3001',
    },
  },
});
