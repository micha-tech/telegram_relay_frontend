import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "site.spec.ts",
  fullyParallel: true,
  workers: 3,
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      // Keep browser tests deterministic and offline: run the dev server in
      // "not configured" mode even when a developer has a real backend URL in
      // .env.local. Existing process.env values take precedence over .env files.
      NEXT_PUBLIC_TELEGRAM_API_BASE_URL: "",
    },
  },
});
