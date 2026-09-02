import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Login
const login = await page.request.post("http://localhost:4410/api/v1/auth/login", {
  data: { username: "SENIOR", password: "CHANGEPASSWORD" },
});
const token = (await login.json()).access_token;

// Create free project
const create = await page.request.post("http://localhost:4410/api/v1/projects", {
  headers: { Authorization: `Bearer ${token}` },
  data: { name: "Free Debug", project_kind: "free" },
});
const { id } = await create.json();

console.log("Project ID:", id);

// Navigate directly to project
await page.goto(`http://localhost:3015/project/${id}`);
await page.waitForTimeout(6000);

console.log("URL:", page.url());
console.log("Title:", await page.title());

// Check DOM
const bodyText = await page.locator("body").innerText();
console.log("Body snippet:", bodyText.slice(0, 300));

const hasExcalidraw = await page.locator(".excalidraw").count();
const hasContainer = await page.locator("[data-testid='excalidraw-container']").count();
const hasSidebar = await page.locator("[class*='SidebarNav']").count();
const hasNovoProjeto = await page.getByText("Novo projeto").count();

console.log(".excalidraw:", hasExcalidraw);
console.log("Container:", hasContainer);
console.log("SidebarNav:", hasSidebar);
console.log("Novo projeto:", hasNovoProjeto);

await page.screenshot({ path: "e2e/final-debug.png", fullPage: true });
console.log("Screenshot saved: e2e/final-debug.png");

await browser.close();
