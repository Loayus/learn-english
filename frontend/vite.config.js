import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En dev, l'API Flask tourne sur le port 5000
    proxy: { "/api": "http://127.0.0.1:5000" },
  },
});
