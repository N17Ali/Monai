import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { devApi } from "./scripts/dev-api";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "");
  const aiApiKey = process.env.GOOGLE_API_KEY ?? environment.GOOGLE_API_KEY;
  return {
  root: fileURLToPath(new URL("./app", import.meta.url)),
  plugins: [react(), tailwindcss(), devApi({ aiApiKey })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./app/src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    chunkSizeWarningLimit: 550,
  },
  };
});
