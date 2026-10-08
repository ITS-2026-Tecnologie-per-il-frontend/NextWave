import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ["tests/responsive/**", "node_modules/**", "dist/**"],
    environment: "jsdom",
    restoreMocks: true,
    setupFiles: ["./tests/setup.js"],
    env: { VITE_DATA_MODE: "demo" },
  },
});
