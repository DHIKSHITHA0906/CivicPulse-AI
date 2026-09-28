import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// CivicPulse AI frontend — build output goes to dist/, which Firebase Hosting serves.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // In real-backend mode, local dev proxies /api to the backend.
      // Mock mode (default) never hits this — see src/api/client.js.
      "/api": "http://localhost:8080",
    },
  },
  build: {
    outDir: "dist",
  },
});
