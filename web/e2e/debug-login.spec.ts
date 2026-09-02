import { test, expect } from '@playwright/test';

test.describe('Debug Login Flow', () => {
  test('should show login page and print debug info', async ({ page }) => {
    await page.goto('http://localhost:3015/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'debug-login.png' });
    
    // Check what's on the page
    const title = await page.title();
    console.log('Page title:', title);
    
    // Look for form elements
    const inputs = await page.locator('input').all();
    console.log('Found', inputs.length, 'inputs');
    for (let i = 0; i < inputs.length; i++) {
      const type = await inputs[i].getAttribute('type');
      const placeholder = await inputs[i].getAttribute('placeholder');
      console.log(`Input ${i}: type=${type}, placeholder=${placeholder}`);
    }
    
    // Look for buttons
    const buttons = await page.locator('button').all();
    console.log('Found', buttons.length, 'buttons');
    for (let i = 0; i < buttons.length; i++) {
      const text = await buttons[i].innerText();
      console.log(`Button ${i}: ${text}`);
    }
    
    // Try to fill and submit
    const usernameInput = page.locator('input[type="text"], input[placeholder*="user"], input[placeholder*="name"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Sign in")').first();
    
    console.log('Username input visible:', await usernameInput.isVisible());
    console.log('Password input visible:', await passwordInput.isVisible());
    console.log('Submit btn visible:', await submitBtn.isVisible());
    
    if (await usernameInput.isVisible()) {
      await usernameInput.fill('SENIOR');
      console.log('Filled username');
    }
    
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('CHANGEPASSWORD');
      console.log('Filled password');
    }
    
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      console.log('Clicked submit');
      
      // Wait and check URL
      await page.waitForTimeout(3000);
      console.log('Current URL after submit:', page.url());
      
      // Take screenshot of result
      await page.screenshot({ path: 'debug-after-login.png' });
    }
  });
});
