import { chromium } from "@playwright/test";

const WEB = process.env.BASE_URL || "http://localhost:3015";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4410";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login via API
  const login = await page.request.post(`${API}/api/v1/auth/login`, {
    data: { username: "SENIOR", password: "CHANGEPASSWORD" },
  });
  const token = (await login.json()).access_token;

  // Create free project
  const create = await page.request.post(`${API}/api/v1/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: "Social Links Test", project_kind: "free" },
  });
  const { id } = await create.json();

  await page.goto(`${WEB}/project/${id}`);
  await page.waitForTimeout(6000);

  const hasContainer = await page.locator("[data-testid='excalidraw-container']").isVisible().catch(() => false);
  const hasExcal = await page.locator(".excalidraw").first().isVisible().catch(() => false);
  const hasNovo = await page.getByText("Novo projeto").isVisible().catch(() => false);
  const hasFreePalette = await page.getByLabel("Formas da paleta").isVisible().catch(() => false);
  const hasInspector = await page.getByText("INSPETOR").isVisible().catch(() => false);
  const hasArchiaChip = await page.getByRole("link", { name: /archia/i }).isVisible().catch(() => false);
  const btnCount = await page.locator(".excalidraw button").count();
  const hasLightCanvas = await page.locator(".excalidraw").evaluate((el) => {
    const bg = getComputedStyle(el).backgroundColor;
    return bg.includes("255") || bg === "rgba(0, 0, 0, 0)" || bg === "transparent";
  }).catch(() => true);

  // Check social links after opening menu
  const menuBtn = page.locator(".excalidraw .MainMenu button").first();
  if (await menuBtn.count()) {
    await menuBtn.click();
    await page.waitForTimeout(1000);
    
    const hasGitHub = await page.getByText("GitHub").isVisible({ timeout: 2000 }).catch(() => false);
    const hasDiscord = await page.getByText("Discord").isVisible({ timeout: 2000 }).catch(() => false);
    const hasFollow = await page.getByText("Follow us").isVisible({ timeout: 2000 }).catch(() => false);
    
    console.log("Social links after menu open:", { hasGitHub, hasDiscord, hasFollow });
  }

  console.log(JSON.stringify({
    hasContainer, hasExcal, hasNovo, hasFreePalette, hasInspector, hasArchiaChip, hasLightCanvas, btnCount
  }, null, 2));

  await page.screenshot({ path: "e2e/social-links-test.png", fullPage: true });
  console.log("Screenshot: e2e/social-links-test.png");

  if (hasContainer && hasExcal && !hasNovo && !hasFreePalette && !hasInspector && !hasArchiaChip) {
    console.log("✓ PASS: Pure Excalidraw experience");
  } else {
    console.log("✗ FAIL");
    process.exitCode = 1;
  }

  await browser.close();
}

main().catch(console.error);
