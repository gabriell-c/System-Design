import { chromium } from "@playwright/test";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("http://localhost:3015/project/97ffcd1d-b520-49bb-aec9-2ae29d114dbb");
  await page.waitForTimeout(5000);
  
  // Take screenshot immediately
  await page.screenshot({ path: "e2e/project-direct.png", fullPage: true });
  console.log("Screenshot: e2e/project-direct.png");
  
  // Get page title and URL
  console.log("Title:", await page.title());
  console.log("URL:", page.url());

  await browser.close();
})();
