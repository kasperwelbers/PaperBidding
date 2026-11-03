import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // A fixed port: BETTER_AUTH_URL (apps/api/.dev.vars) must match it, or
    // sign-in fails the origin check. strictPort: fail instead of switching
    port: 5180,
    strictPort: true,
    // in development, the API runs separately with `wrangler dev`
    proxy: { "/api": "http://localhost:8787" },
  },
});
