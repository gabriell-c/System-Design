import { test, expect } from '@playwright/test';

test('basic navigation', async ({ page }) => {
  await page.goto('http://localhost:3015/');
  await expect(page).toHaveTitle(/.*archia.*/i);
});
