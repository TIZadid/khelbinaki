/// <reference types="vitest/config" />
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  // three.js loads in its own lazy chunk (~140 KB gzipped) only when the hero ball can render.
  build: { chunkSizeWarningLimit: 600 },
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"] },
});
