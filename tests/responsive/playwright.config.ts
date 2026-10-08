import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const testPort = Number(process.env.RESPONSIVE_TEST_PORT ?? 4174);
if (!Number.isInteger(testPort) || testPort < 1024 || testPort > 65535) {
  throw new Error("RESPONSIVE_TEST_PORT deve essere una porta valida.");
}
const testUrl = `http://127.0.0.1:${testPort}`;

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
    baseURL: testUrl,
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
    command: `node node_modules/vite/bin/vite.js --config tests/responsive/vite.config.ts --port ${testPort}`,
    url: testUrl,
    // Un server Vite dell'app reale può occupare la stessa porta: non riutilizzarlo.
    reuseExistingServer: false,
  },
});
