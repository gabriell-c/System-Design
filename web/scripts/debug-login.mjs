import { chromium } from "@playwright/test";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login first
  await page.goto("http://localhost:3015/login");
  await page.waitForTimeout(1000);
  
  await page.fill('input[name="username"]', "SENIOR");
  await page.fill('input[name="password"]', "CHANGEPASSWORD");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  console.log("After login, URL:", page.url());
  console.log("Body text:", (await page.locator("body").innerText()).slice(0, 300));

  // Now go to project
  await page.goto("http://localhost:3015/project/97ffcd1d-b520-49bb-aec9-2ae29d114dbb");
  await page.waitForTimeout(5000);
  
  console.log("After project, URL:", page.url());
  
  const excalidrawCount = await page.locator(".excalidraw").count();
  console.log(".excalidraw elements:", excalidrawCount);
  
  const buttons = await page.locator(".excalidraw button").count();
  console.log("Buttons in .excalidraw:", buttons);
  
  await page.screenshot({ path: "e2e/project-debug.png", fullPage: true });
  console.log("Screenshot: e2e/project-debug.png");

  await browser.close();
})();
