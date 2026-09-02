import { chromium } from "@playwright/test";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("http://localhost:3015/project/97ffcd1d-b520-49bb-aec9-2ae29d114dbb");
  await page.waitForTimeout(8000);
  
  // Check what's on the page
  const container = await page.locator("[data-testid='excalidraw-container']").count();
  console.log("Container count:", container);
  
  const excalidraw = await page.locator(".excalidraw").count();
  console.log(".excalidraw count:", excalidraw);
  
  const body = await page.locator("body").innerText();
  console.log("Body text:", body.slice(0, 200));
  
  // Try to find the menu button by class
  const menuBtn = await page.locator(".MainMenu__button, .MainMenu button, [class*='MainMenu']").first();
  console.log("MainMenu button count:", await menuBtn.count());
  
  await page.screenshot({ path: "e2e/project-debug2.png", fullPage: true });
  console.log("Screenshot saved");
  
  // Also check viewport
  console.log("Viewport:", await page.viewportSize());

  await browser.close();
})();
