import { chromium } from "@playwright/test";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login via page
  await page.goto("http://localhost:3015/login");
  await page.waitForTimeout(2000);
  
  // Fill login form
  await page.fill('input[name="username"]', "SENIOR");
  await page.fill('input[name="password"]', "CHANGEPASSWORD");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Create free project via API
  const sessionCookies = page.context().cookies();
  const tokenResponse = await page.request.post("http://localhost:4410/api/v1/auth/login", {
    data: { username: "SENIOR", password: "CHANGEPASSWORD" },
  });
  const token = (await tokenResponse.json()).access_token;

  const create = await page.request.post("http://localhost:4410/api/v1/projects", {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: "Test Social", project_kind: "free" },
  });
  const { id } = await create.json();

  // Navigate to project
  await page.goto(`http://localhost:3015/project/${id}`);
  await page.waitForTimeout(5000);

  // Check Excalidraw is loaded
  const container = await page.locator("[data-testid='excalidraw-container']").count();
  console.log("Container:", container);

  if (container === 0) {
    console.log("Excalidraw not loaded");
    await page.screenshot({ path: "e2e/error.png" });
    await browser.close();
    return;
  }

  // Open menu
  const menuBtn = page.locator(".excalidraw button").first();
  if (await menuBtn.count() > 0) {
    await menuBtn.click();
    await page.waitForTimeout(1500);
  }

  // Check social links
  const hasGitHub = await page.getByText("GitHub").isVisible({ timeout: 2000 }).catch(() => false);
  const hasDiscord = await page.getByText("Discord").isVisible({ timeout: 2000 }).catch(() => false);
  const hasFollow = await page.getByText("Follow us").isVisible({ timeout: 2000 }).catch(() => false);

  console.log("Social links:", { hasGitHub, hasDiscord, hasFollow });

  await page.screenshot({ path: "e2e/social-test.png", fullPage: true });
  console.log("Screenshot saved");

  await browser.close();
})();
