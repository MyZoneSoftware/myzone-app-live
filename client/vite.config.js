import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: Proxy all /api calls → http://localhost:5003
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5003",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
