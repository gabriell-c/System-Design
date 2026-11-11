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

  test("P4 — any tablist on the route is well-formed (aria-selected on every tab)", async ({ page }) => {
    // Guard de invariantes ARIA para tabs (ContextPanel/P4.4d). Roda na rota
    // mais barata (dashboard) porque o caso axe completo do editor depende de
    // fixture de projeto — reportado como DEFERRED (ver relatório do P4).
    await page.goto("http://localhost:3015");

    const tablists = await page.$$("[role='tablist']");
    for (const list of tablists) {
      const tabs = await list.$$("button[role='tab']");
      expect(tabs.length).toBeGreaterThan(0);
      for (const tab of tabs) {
        const selected = await tab.getAttribute("aria-selected");
        expect(["true", "false"]).toContain(selected);
      }
      // Exatamente um tab selecionado.
      const selectedCount = await list.$$eval(
        "button[role='tab'][aria-selected='true']",
        (els) => els.length,
      );
      expect(selectedCount).toBe(1);
    }
  });
});
