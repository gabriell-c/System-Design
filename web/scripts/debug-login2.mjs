import { chromium } from "@playwright/test";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("http://localhost:3015/login");
  await page.waitForTimeout(3000);
  
  // Get all inputs
  const inputs = await page.locator("input").all();
  console.log("Input count:", inputs.length);
  for (let i = 0; i < inputs.length; i++) {
    const name = await inputs[i].getAttribute("name");
    const placeholder = await inputs[i].getAttribute("placeholder");
    console.log(`Input ${i}: name=${name}, placeholder=${placeholder}`);
  }
  
  // Get all buttons
  const buttons = await page.locator("button").all();
  console.log("Button count:", buttons.length);
  for (let i = 0; i < buttons.length; i++) {
    const text = await buttons[i].innerText();
    console.log(`Button ${i}: ${text}`);
  }
  
  await page.screenshot({ path: "e2e/login-debug.png", fullPage: true });
  console.log("Screenshot: e2e/login-debug.png");

  await browser.close();
})();
