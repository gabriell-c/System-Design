import { chromium } from "@playwright/test";

const API = "http://localhost:4410";
const WEB = "http://localhost:3015";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  let login = await page.request.post(`${API}/api/v1/auth/login`, {
    data: { username: "SENIOR", password: "CHANGEPASSWORD" },
  });
  console.log("login", login.status());
  if (login.status() !== 200) {
    throw new Error("login failed: " + login.status());
  }
  const tokenBody = await login.json();
  const token = tokenBody.access_token || tokenBody.token;

  const create = await page.request.post(`${API}/api/v1/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: "Visual Free Test", project_kind: "free" },
  });
  console.log("create", create.status());
  const { id } = await create.json();

  await page.goto(`${WEB}/login`);
  await page.locator('input[name="username"], input#username, input[type="text"]').first().fill("SENIOR");
  await page.locator('input[name="password"], input#password, input[type="password"]').first().fill("CHANGEPASSWORD");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2000);

  await page.goto(`${WEB}/project/${id}`);
  await page.waitForTimeout(8000);

  const bodyText = await page.locator("body").innerText().catch(() => "");
  const hasError = /Algo deu errado|Minified React error/i.test(bodyText);
  const hasContainer = await page.locator("[data-testid='excalidraw-container']").isVisible().catch(() => false);
  const hasExcal = await page.locator(".excalidraw").first().isVisible().catch(() => false);
  const hasNovo = await page.getByText("Novo projeto").isVisible().catch(() => false);
  const hasFreePalette = await page.getByLabel("Formas da paleta").isVisible().catch(() => false);
  const hasInspector = await page.getByText("INSPETOR").isVisible().catch(() => false);
  const hasArchiaChip = await page.getByRole("link", { name: /archia/i }).isVisible().catch(() => false);
  const btnCount = await page.locator(".excalidraw button").count();
  const hasLightCanvas = await page
    .locator(".excalidraw")
    .evaluate((el) => {
      const bg = getComputedStyle(el).backgroundColor;
      return bg.includes("255") || bg === "rgba(0, 0, 0, 0)" || bg === "transparent";
    })
    .catch(() => true);

  console.log(
    JSON.stringify({
      hasContainer,
      hasExcal,
      hasNovo,
      hasFreePalette,
      hasInspector,
      hasArchiaChip,
      hasError,
      hasLightCanvas,
      btnCount,
      url: page.url(),
      bodySnippet: bodyText.slice(0, 220).replace(/\s+/g, " "),
    }),
  );

  const shotPath = new URL("../e2e/visual-free-check.png", import.meta.url).pathname;
  const shot = shotPath.replace(/^\/([A-Za-z]:)/, "$1");
  await page.screenshot({ path: shot, fullPage: true });
  console.log("screenshot saved", shot);

  if (
    hasError ||
    !hasContainer ||
    !hasExcal ||
    hasNovo ||
    hasFreePalette ||
    hasInspector ||
    hasArchiaChip ||
    btnCount < 5
  ) {
    process.exitCode = 1;
  }
} catch (e) {
  console.error("FAIL", e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
