/**
 * E2E Tests for Archia - Core UI Tests
 * Tests UI components without requiring backend
 */
import { test, expect } from "@playwright/test";

test.describe("Archia E2E Tests", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("http://localhost:3015/login");
    // Just check page loaded - don't assert specific elements
    await expect(page).toHaveTitle(/Archia/i);
  });

  test("dashboard page loads", async ({ page }) => {
    await page.goto("http://localhost:3015");
    // Just check page loaded
    await expect(page).toHaveTitle(/Archia/i);
  });

  test("profile page loads", async ({ page }) => {
    await page.goto("http://localhost:3015/profile");
    // Just check page loaded
    await expect(page).toHaveTitle(/Archia/i);
  });
});
