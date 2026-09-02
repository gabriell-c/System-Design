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
  data: { name: "Free Sidebar Test", project_kind: "free" },
});
const { id } = await create.json();

// Navigate
await page.goto(`http://localhost:3015/project/${id}`);
await page.waitForTimeout(5000);

// Check URL and page content
console.log("URL:", page.url());
const body = await page.locator("body").innerText();
console.log("Has 'Novo projeto':", body.includes("Novo projeto"));
console.log("Has 'Editor':", body.includes("Editor"));
console.log("Has 'excalidraw-container':", await page.locator("[data-testid='excalidraw-container']").count() > 0);
console.log("Has '.excalidraw':", await page.locator(".excalidraw").count() > 0);

await page.screenshot({ path: "e2e/sidebar-debug.png", fullPage: true });
console.log("Screenshot saved");

// Check what elements are in the page
const sidebarCount = await page.locator("[class*='sidebar'], [class*='SidebarNav']").count();
console.log("Sidebar elements:", sidebarCount);

await browser.close();
