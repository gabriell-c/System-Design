import { chromium } from "@playwright/test";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("http://localhost:3015/project/97ffcd1d-b520-49bb-aec9-2ae29d114dbb", { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);

  // Get page content
  const body = await page.content();
  console.log("Page HTML length:", body.length);
  
  // Look for excalidraw-related content
  const excalidrawCount = (body.match(/excalidraw/g) || []).length;
  console.log("excalidraw mentions:", excalidrawCount);
  
  // Find all iframes
  const iframes = await page.locator("iframe").count();
  console.log("Iframes:", iframes);

  // Check if Excalidraw is rendering
  const excalidrawRoot = await page.locator(".excalidraw").count();
  console.log(".excalidraw elements:", excalidrawRoot);
  
  // Check canvas
  const canvas = await page.locator("canvas").count();
  console.log("canvas elements:", canvas);

  // Get visible text
  const text = await page.locator("body").innerText();
  console.log("Body text (first 500):", text.slice(0, 500));

  await page.screenshot({ path: "e2e/page-debug.png", fullPage: true });
  console.log("Screenshot: e2e/page-debug.png");

  await browser.close();
})();
