import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // in development, the API runs separately with `wrangler dev`
    proxy: { "/api": "http://localhost:8787" },
  },
});
