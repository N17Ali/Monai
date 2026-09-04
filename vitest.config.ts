import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^zod$/, replacement: fileURLToPath(new URL("./node_modules/zod/index.cjs", import.meta.url)) },
      { find: /^@\//, replacement: `${fileURLToPath(new URL("./app/src", import.meta.url))}/` },
      { find: /^@shared\//, replacement: `${fileURLToPath(new URL("./shared", import.meta.url))}/` },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
