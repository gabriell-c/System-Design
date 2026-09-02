import { chromium } from "@playwright/test";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Inject CSS to hide Excalidraw social links
  await page.addStyleTag({
    content: `
      .excalidraw .MainMenu__socialLinks,
      .excalidraw [class*="social"],
      .excalidraw [class*="GitHub"],
      .excalidraw [class*="Discord"],
      .excalidraw [class*="github"],
      .excalidraw [class*="discord"],
      .excalidraw [class*="menu-social"],
      .excalidraw [class*="footer"],
      .excalidraw [class*="about"],
      .excalidraw .excalidraw__embeddable,
      .excalidraw [class*="Excalidraw__social"] {
        display: none !important;
      }
      /* also try to hide via data-testid */
      [data-testid*="social"], [data-testid*="github"], [data-testid*="discord"] {
        display: none !important;
      }
    `
  });

  await page.goto("http://localhost:3015/project/97ffcd1d-b520-49bb-aec9-2ae29d114dbb", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // Open menu
  const menuBtn = page.locator(".excalidraw .MainMenu button, .excalidraw button").first();
  await menuBtn.click();
  await page.waitForTimeout(1000);

  // Try more aggressive JS hiding
  await page.evaluate(() => {
    document.querySelectorAll("*").forEach(el => {
      const text = (el.textContent || "").trim();
      if (text.includes("GitHub") || text.includes("Discord") || text.includes("Follow us") || text.includes("Excalidraw")) {
        el.style.display = "none";
      }
    });
    // Also hide by class patterns
    document.querySelectorAll("[class*='social'], [class*='footer'], [class*='about']").forEach(el => {
      el.style.display = "none";
    });
  });

  await page.waitForTimeout(500);
  await page.screenshot({ path: "e2e/menu-hidden-final.png", fullPage: true });
  console.log("Done - screenshot saved to e2e/menu-hidden-final.png");

  await browser.close();
})();
