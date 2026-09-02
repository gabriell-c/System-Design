import { chromium } from "@playwright/test";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login
  await page.goto("http://localhost:3015/login");
  await page.waitForTimeout(2000);
  
  // Fill login - try different selectors
  await page.fill('input[placeholder*="usuário"], input[placeholder*="username"], input[type="text"]', "SENIOR");
  await page.fill('input[placeholder*="senha"], input[placeholder*="password"], input[type="password"]', "CHANGEPASSWORD");
  await page.click('button[type="submit"], button:has-text("Entrar")');
  await page.waitForTimeout(3000);
  
  console.log("After login, URL:", page.url());
  
  // Get token from localStorage or cookies
  const cookies = await page.context().cookies();
  console.log("Cookies:", cookies.map(c => c.name).join(", "));
  
  // Try to get auth token
  const token = await page.evaluate(() => {
    // Check localStorage for auth token
    return localStorage.getItem('auth-token') || document.cookie;
  });
  console.log("Auth token:", token?.substring(0, 50));
  
  // Create free project via browser
  const createResp = await page.evaluate(async () => {
    const token = localStorage.getItem('auth-token');
    if (!token) return null;
    
    const resp = await fetch('http://localhost:4410/api/v1/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: 'Free Browser Test', project_kind: 'free' })
    });
    return await resp.json();
  });
  
  console.log("Create response:", createResp);
  
  if (createResp?.id) {
    await page.goto(`http://localhost:3015/project/${createResp.id}`);
    await page.waitForTimeout(5000);
    
    console.log("URL after project:", page.url());
    const bodyText = await page.locator("body").innerText();
    console.log("Body contains 'Novo projeto':", bodyText.includes("Novo projeto"));
    console.log("Body contains 'excalidraw':", bodyText.includes("excalidraw"));
    
    await page.screenshot({ path: "e2e/browser-test.png", fullPage: true });
    console.log("Screenshot saved");
  }
  
  await browser.close();
})();
