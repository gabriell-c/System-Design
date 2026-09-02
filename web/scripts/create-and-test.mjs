import { chromium } from "@playwright/test";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login via API
  const login = await page.request.post("http://localhost:4410/api/v1/auth/login", {
    data: { username: "SENIOR", password: "CHANGEPASSWORD" },
  });
  const token = (await login.json()).access_token;
  console.log("Login status:", login.status());

  // Create free project
  const create = await page.request.post("http://localhost:4410/api/v1/projects", {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: "Debug Free Project", project_kind: "free" },
  });
  const { id } = await create.json();
  console.log("Project created:", id);

  // Navigate to project
  await page.goto(`http://localhost:3015/project/${id}`);
  await page.waitForTimeout(6000);
  
  console.log("URL:", page.url());
  console.log("Title:", await page.title());
  
  // Check for Excalidraw
  const container = await page.locator("[data-testid='excalidraw-container']").count();
  const excalidraw = await page.locator(".excalidraw").count();
  console.log("Container:", container, ".excalidraw:", excalidraw);
  
  // Check body text
  const body = await page.locator("body").innerText();
  console.log("Body (first 300):", body.slice(0, 300));

  // Take screenshot
  await page.screenshot({ path: "e2e/project-created.png", fullPage: true });
  console.log("Screenshot: e2e/project-created.png");

  // Try to find and click menu
  const menuBtn = page.locator(".excalidraw .MainMenu button, .excalidraw button").first();
  const btnCount = await menuBtn.count();
  console.log("Menu buttons found:", btnCount);
  
  if (btnCount > 0) {
    await menuBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "e2e/menu-open.png", fullPage: true });
    console.log("Menu opened - screenshot: e2e/menu-open.png");
  }

  await browser.close();
})();
