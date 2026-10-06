import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    server: { deps: { inline: ["spot-auth"] } },
    environment: "jsdom",
    restoreMocks: true,
    setupFiles: ["./tests/setup.js"],
    env: { VITE_DATA_MODE: "demo" },
  },
});
