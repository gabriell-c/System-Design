import { chromium } from "@playwright/test";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Inject CSS to hide Excalidraw social links
  await page.addStyleTag({
    content: `
      /* Target the social links section in Excalidraw menu */
      .excalidraw .MainMenu {
        max-height: 60vh;
        overflow: hidden;
      }
      .excalidraw .MainMenu li:last-child,
      .excalidraw .MainMenu li:nth-last-child(2),
      .excalidraw .MainMenu li:nth-last-child(3),
      .excalidraw [class*="Menu"] [class*="social"],
      .excalidraw [class*="Menu"] a[href*="github"],
      .excalidraw [class*="Menu"] a[href*="discord"] {
        display: none !important;
      }
    `
  });

  await page.goto("http://localhost:3015/project/97ffcd1d-b520-49bb-aec9-2ae29d114dbb", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // Open menu - try the hamburger icon
  const hamburger = page.locator(".excalidraw svg path").first();
  await hamburger.click({ force: true });
  await page.waitForTimeout(1000);

  // Check visibility
  const hasGitHub = await page.getByText("GitHub", { exact: true }).isVisible({ timeout: 2000 }).catch(() => false);
  const hasDiscord = await page.getByText("Discord", { exact: true }).isVisible({ timeout: 2000 }).catch(() => false);
  const hasFollow = await page.getByText("Follow us", { exact: true }).isVisible({ timeout: 2000 }).catch(() => false);

  console.log(JSON.stringify({ hasGitHub, hasDiscord, hasFollow }, null, 2));
  await page.screenshot({ path: "e2e/menu-css-test.png", fullPage: true });
  console.log("Screenshot: e2e/menu-css-test.png");

  await browser.close();
})();
