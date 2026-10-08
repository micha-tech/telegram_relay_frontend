import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "production.spec.ts",
  workers: 2,
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
