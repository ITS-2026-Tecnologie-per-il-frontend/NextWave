import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  workers: 3,
  timeout: 60000,
  outputDir: "../../test-results/responsive",
  reporter: [
    ["list"],
    ["html", { outputFolder: "../../playwright-report", open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4174",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
    {
      name: "mobile-touch",
      use: {
        browserName: "chromium",
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    command:
      "node node_modules/vite/bin/vite.js --config tests/responsive/vite.config.ts",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
  },
});
