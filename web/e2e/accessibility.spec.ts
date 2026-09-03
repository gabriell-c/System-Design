/**
 * Accessibility Tests for Archia
 * Uses axe-core to check WCAG 2.1 AA compliance
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility Tests - WCAG 2.1 AA", () => {
  test("login page has no critical a11y violations", async ({ page }) => {
    await page.goto("http://localhost:3015/login");
    
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    
    const critical = results.violations.filter((v) => v.impact === "critical");
    const serious = results.violations.filter((v) => v.impact === "serious");
    
    console.log(`Login - Critical: ${critical.length}, Serious: ${serious.length}`);
    expect(critical).toEqual([]);
    expect(serious).toEqual([]);
  });

  test("dashboard has no critical a11y violations", async ({ page }) => {
    await page.goto("http://localhost:3015");
    
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    
    const critical = results.violations.filter((v) => v.impact === "critical");
    const serious = results.violations.filter((v) => v.impact === "serious");
    
    console.log(`Dashboard - Critical: ${critical.length}, Serious: ${serious.length}`);
    expect(critical).toEqual([]);
    expect(serious).toEqual([]);
  });

  test("profile page has no critical a11y violations", async ({ page }) => {
    await page.goto("http://localhost:3015/profile");
    
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    
    const critical = results.violations.filter((v) => v.impact === "critical");
    const serious = results.violations.filter((v) => v.impact === "serious");
    
    console.log(`Profile - Critical: ${critical.length}, Serious: ${serious.length}`);
    expect(critical).toEqual([]);
    expect(serious).toEqual([]);
  });
});
