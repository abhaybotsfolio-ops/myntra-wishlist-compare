import { defineConfig } from "@playwright/test";

// ACCEPTANCE.md rows are all annotated auto/manual; this config runs the
// auto rows against a real mobile viewport (RULES E7: 390x844 design
// target) so tap-target and swipe assertions mean something. Chromium
// only, with explicit mobile emulation rather than a `devices[...]`
// preset — the iPhone presets default to the WebKit engine, an extra
// browser download this project has no other reason to need.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  },
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
