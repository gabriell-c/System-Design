import { chromium } from "@playwright/test";

const WEB = process.env.BASE_URL || "http://localhost:3015";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4410";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login
  const login = await page.request.post(`${API}/api/v1/auth/login`, {
    data: { username: "SENIOR", password: "CHANGEPASSWORD" },
  });
  if (login.status() !== 200) {
    console.log("LOGIN_FAILED");
    await browser.close();
    return;
  }
  const token = (await login.json()).access_token;

  // Create free project
  const create = await page.request.post(`${API}/api/v1/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: "Social Links CSS Test", project_kind: "free" },
  });
  const { id } = await create.json();

  await page.goto(`${WEB}/project/${id}`);
  await page.waitForTimeout(3000);

  // Click the hamburger menu button
  const menuBtn = page.locator(".excalidraw [aria-label='Menu'], .excalidraw button").first();
  await menuBtn.click();
  await page.waitForTimeout(1000);

  // Check for social links in the open menu
  const hasGitHub = await page.getByText("GitHub").isVisible().catch(() => false);
  const hasDiscord = await page.getByText("Discord").isVisible().catch(() => false);
  const hasFollow = await page.getByText("Follow us").isVisible().catch(() => false);

  // Screenshot with menu open
  await page.screenshot({ path: "e2e/menu-open-test.png", fullPage: true });
  console.log("Screenshot saved: e2e/menu-open-test.png");
  console.log(JSON.stringify({ hasGitHub, hasDiscord, hasFollow }, null, 2));

  // Close menu
  await menuBtn.click();
  await page.waitForTimeout(500);

  // Screenshot after closing
  await page.screenshot({ path: "e2e/menu-closed-test.png", fullPage: true });
  console.log("Screenshot saved: e2e/menu-closed-test.png");

  if (hasGitHub || hasDiscord || hasFollow) {
    process.exitCode = 1;
  }

  await browser.close();
}

main().catch(console.error);
