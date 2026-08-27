import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function loginAsSenior(page: import("@playwright/test").Page) {
  await page.goto("/login");
  // Wait for inputs to be available
  await expect(page.locator('input[type="text"]')).toBeVisible({ timeout: 30_000 });
  await page.locator('input[type="text"]').fill("SENIOR");
  await page.locator('input[type="password"]').fill("CHANGEPASSWORD");
  await page.getByRole("button", { name: "Entrar" }).click();
  // Wait for redirect - either dashboard or project page
  await page.waitForURL((url) => url.pathname === "/" || url.pathname.startsWith("/project/"), { timeout: 45_000 });
}

test.describe("Archia user journey", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("archia-theme", "dark");
      localStorage.setItem("archia-onboarded", "1");
    });
  });

  test("login page renders and has no serious a11y violations", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("SENIOR login succeeds and reaches dashboard", async ({ page }) => {
    await loginAsSenior(page);
    // After login, should be on dashboard (root path)
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 30_000 });
  });

  test("theme toggle works from dashboard", async ({ page }) => {
    await loginAsSenior(page);
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 30_000 });

    const themeBtn = page.getByRole("button", { name: /Ativar modo (claro|escuro)/i });
    const html = page.locator("html");
    const before = (await html.getAttribute("class")) ?? "";
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await expect.poll(async () => (await html.getAttribute("class")) ?? "").not.toEqual(before);
    }
  });
});
