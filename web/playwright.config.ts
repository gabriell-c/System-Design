import { defineConfig, devices } from "@playwright/test";

/** Portas dedicadas — evita colidir com `pnpm dev` / uvicorn locais. */
const WEB_PORT = 3021;
const API_PORT = 8021;

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
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "py -3.12 -m uvicorn app.main:app --host 127.0.0.1 --port 8021",
      cwd: "../backend",
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ...process.env,
        DATABASE_URL: "sqlite:///./data/playwright.db",
        CORS_ORIGINS: `http://127.0.0.1:${WEB_PORT},http://localhost:${WEB_PORT}`,
        ARCHIA_JWT_SECRET: "archia-playwright-secret-key-32b-min!!",
      },
    },
    {
      command: `pnpm exec next start -p ${WEB_PORT} -H 127.0.0.1`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${API_PORT}`,
      },
    },
  ],
});
