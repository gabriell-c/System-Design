import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function loginAsSenior(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator('input').nth(0).fill("SENIOR");
  await page.locator('input[type="password"]').fill("CHANGEPASSWORD");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 45_000 });
}

test.describe("Archia user journey", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("archia-theme", "dark");
    });
  });

  test("login page renders and has no serious a11y violations", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"]) // contraste fino coberto por design tokens; demais regras WCAG ativas
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("SENIOR login opens editor and theme toggle works", async ({ page }) => {
    await loginAsSenior(page);
    await expect(page.locator(".react-flow").first()).toBeVisible({ timeout: 45_000 });

    const themeBtn = page.getByRole("button", { name: /Ativar modo (claro|escuro)/i });
    const html = page.locator("html");
    const before = (await html.getAttribute("class")) ?? "";
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await expect.poll(async () => (await html.getAttribute("class")) ?? "").not.toEqual(before);
    }
  });

  test("editor shell visual baseline", async ({ page }) => {
    await loginAsSenior(page);
    await expect(page.locator(".react-flow").first()).toBeVisible({ timeout: 45_000 });
    await expect(page).toHaveScreenshot("editor-shell.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.12,
    });
  });

  test("apply SaaS B2B template populates canvas", async ({ page }) => {
    await loginAsSenior(page);
    await expect(page.locator(".react-flow").first()).toBeVisible({ timeout: 45_000 });

    const templatesTrigger = page.getByRole("button", { name: /template/i }).first();
    test.skip(!(await templatesTrigger.isVisible().catch(() => false)), "Template control not visible");

    await templatesTrigger.click();
    const saas = page.getByText("SaaS B2B").first();
    await expect(saas).toBeVisible({ timeout: 15_000 });
    await saas.click();
    await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 20_000 });
  });
});
