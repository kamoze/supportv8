import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/local-only-network-guard.mjs", "./test/seed-password.setup.ts"],
    fileParallelism: false,
    // The suite exercises the Acme/Meridian demo fixtures, which exist only with
    // the explicit demo flag. test/demo-mode-gate.test.tsx covers the flag off.
    env: { SUPPORTV8_DEMO_MODE: "true" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@servicev8/agentic-runtime": path.resolve(__dirname, "./src/lib/agentic-runtime/index.ts"),
    },
  },
});
