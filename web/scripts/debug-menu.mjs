import { chromium } from "@playwright/test";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("http://localhost:3015/project/97ffcd1d-b520-49bb-aec9-2ae29d114dbb", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // Print all buttons in excalidraw
  const buttons = await page.locator(".excalidraw button").allTextContents();
  console.log("Buttons:", buttons);

  // Print first few SVGs
  const svgs = await page.locator(".excalidraw svg").count();
  console.log("SVG count:", svgs);

  // Try clicking by aria-label
  const menuBtn = page.locator("[aria-label='Menu'], [aria-label*='menu'], [aria-label='menu']").first();
  if (await menuBtn.count()) {
    await menuBtn.click();
    await page.waitForTimeout(1000);
  } else {
    console.log("No menu button found by aria-label");
  }

  // Screenshot
  await page.screenshot({ path: "e2e/debug-menu.png", fullPage: true });
  console.log("Screenshot: e2e/debug-menu.png");

  await browser.close();
})();
