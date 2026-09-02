import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Login
const loginResp = await page.request.post("http://localhost:4410/api/v1/auth/login", {
  data: { username: "SENIOR", password: "CHANGEPASSWORD" },
});
console.log("Login status:", loginResp.status());
const loginData = await loginResp.json();
const token = loginData.access_token;

// Get project details directly
const projectId = "fa863995-0571-4c4d-878c-5368366bf7c3";
const getResp = await page.request.get(`http://localhost:4410/api/v1/projects/${projectId}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const project = await getResp.json();
console.log("Project kind:", project.project_kind);
console.log("Project name:", project.name);

// Navigate and check
await page.goto(`http://localhost:3015/project/${projectId}`);
await page.waitForTimeout(6000);

// Check what's on the page
const hasNovo = await page.getByText("Novo projeto").isVisible().catch(() => false);
const hasExcalidraw = await page.locator(".excalidraw").count();
const hasContainer = await page.locator("[data-testid='excalidraw-container']").count();

console.log("Has Novo projeto:", hasNovo);
console.log("Excalidraw elements:", hasExcalidraw);
console.log("Container elements:", hasContainer);

await page.screenshot({ path: "e2e/check-debug.png", fullPage: true });
console.log("Screenshot: e2e/check-debug.png");

await browser.close();
