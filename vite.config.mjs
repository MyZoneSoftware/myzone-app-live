import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5177,
    strictPort: true,
    hmr: { host: 'localhost' }
  },
  preview: {
    host: true,
    port: 4177,
    strictPort: true
  }
});
