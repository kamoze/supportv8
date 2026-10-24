import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/local-only-network-guard.mjs"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@servicev8/agentic-runtime": path.resolve(__dirname, "./src/lib/agentic-runtime/index.ts"),
    },
  },
});
