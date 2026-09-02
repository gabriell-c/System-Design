import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Login via API
const login = await page.request.post("http://localhost:4410/api/v1/auth/login", {
  data: { username: "SENIOR", password: "CHANGEPASSWORD" },
});
const token = (await login.json()).access_token;

// Create free project
const create = await page.request.post("http://localhost:4410/api/v1/projects", {
  headers: { Authorization: `Bearer ${token}` },
  data: { name: "Social Links Test", project_kind: "free" },
});
const { id } = await create.json();

// Navigate to project
await page.goto(`http://localhost:3015/project/${id}`);
await page.waitForTimeout(5000);

// Open menu by clicking the first button in .excalidraw
const menuBtn = page.locator(".excalidraw button").first();
await menuBtn.click();
await page.waitForTimeout(1500);

// Check for social links
const hasGitHub = await page.getByText("GitHub").isVisible({ timeout: 2000 }).catch(() => false);
const hasDiscord = await page.getByText("Discord").isVisible({ timeout: 2000 }).catch(() => false);
const hasFollow = await page.getByText("Follow us").isVisible({ timeout: 2000 }).catch(() => false);
const hasExcalidrawLinks = await page.getByText("Excalidraw links").isVisible({ timeout: 2000 }).catch(() => false);

console.log("Social links after menu open:", { hasGitHub, hasDiscord, hasFollow, hasExcalidrawLinks });

// Check what's visible
const menuItems = await page.locator("[class*='dropdown-menu-item']").allTextContents();
console.log("Menu items:", menuItems);

await page.screenshot({ path: "e2e/social-links-fixed.png", fullPage: true });
console.log("Screenshot: e2e/social-links-fixed.png");

if (hasGitHub || hasDiscord || hasFollow || hasExcalidrawLinks) {
  console.log("FAIL: Social links still visible");
  process.exitCode = 1;
} else {
  console.log("PASS: Social links hidden");
}

await browser.close();
