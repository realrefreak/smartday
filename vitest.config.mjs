import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Same "@/" shortcut as jsconfig.json, so tests can import "@/lib/tasks".
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    // Our code runs on the server, so tests run in plain Node (no browser).
    environment: "node",
    include: ["tests/**/*.test.js"],
  },
});
