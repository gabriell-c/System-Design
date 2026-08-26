import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3015",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "py -3.12 -m uvicorn app.main:app --host 127.0.0.1 --port 8021",
      cwd: "../backend",
      url: "http://127.0.0.1:8021/api/health",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        DATABASE_URL: "sqlite:///./data/playwright.db",
        CORS_ORIGINS: "http://localhost:3015",
        ARCHIA_JWT_SECRET: "archia-playwright-secret-key-32b-min!!",
      },
    },
    {
      command: "pnpm exec next start -p 3015 -H 127.0.0.1",
      url: "http://localhost:3015",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:8021",
      },
    },
  ],
});
