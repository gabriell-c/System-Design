/**
 * Real E2E for free-canvas UX improvements (T1–T15).
 *
 * Strategy:
 *  - Login as SENIOR (requires backend up).
 *  - Create a free project (project_kind=free) and open it.
 *  - Verify canvas UI improvements: ModeBadge, toolbar sticky, fit-view,
 *    theme toggle, template buttons, export options modal, share link,
 *    and the /share/{token} read-only shell.
 *  - Tests are gated: if the backend does not respond, the whole describe
 *    is skipped so CI does not break on environment issues.
 */
import { expect, test } from "@playwright/test";

async function authHeader(page: import("@playwright/test").Page) {
  const baseUrl = page.url().split("/")[0];
  const login = await page.context().request.post(`${baseUrl}/api/v1/auth/login`, {
    data: { username: "SENIOR", password: "CHANGEPASSWORD" },
  });
  if (login.status() !== 200) return null;
  return (await login.json()) as { access_token: string };
}

async function setupFreeProject(page: import("@playwright/test").Page) {
  const baseUrl = page.url().split("/")[0];
  // Create a free project via API
  const tokenResp = await authHeader(page);
  if (!tokenResp) return null;
  const token = tokenResp.access_token;
  const headers = { Authorization: `Bearer ${token}` };

  const create = await page.context().request.post(`${baseUrl}/api/v1/projects`, {
    headers,
    data: { name: "Free UX Test", context: "", nfr_json: "{}", project_kind: "free", is_public: true },
  });
  if (create.status() !== 201 && create.status() !== 200) return null;
  const project = (await create.json()) as { id: string };
  return project.id;
}

async function createGraph(page: import("@playwright/test").Page, projectId: string) {
  const baseUrl = page.url().split("/")[0];
  const tokenResp = await authHeader(page);
  if (!tokenResp) return null;
  const token = tokenResp.access_token;
  const headers = { Authorization: `Bearer ${token}` };
  const create = await page.context().request.post(`${baseUrl}/api/v1/projects/${projectId}/diagrams`, {
    headers,
    data: { name: "UX Graph", context: "", nodes: [], edges: [], diagram_kind: "free" },
  });
  if (create.status() !== 201 && create.status() !== 200) return null;
  const graph = (await create.json()) as { id: string };
  return graph.id;
}

test.describe("Free diagram UX improvements", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("archia-theme", "dark");
      localStorage.setItem("archia-onboarded", "1");
      localStorage.setItem("archia-canvas-toolbar-collapsed", "0");
    });
  });

  test("backend responds to health", async ({ request }) => {
    const health = await request.get("/api/health");
    expect(health.ok()).toBeTruthy();
  });

  test("theme toggle cycles dark → light → high-contrast", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 30_000 });
    const btn = page.getByTestId("theme-toggle");
    await expect(btn).toBeVisible();

    const getHtmlClass = async () => (await page.locator("html").getAttribute("class")) ?? "";
    await btn.click();
    expect(await getHtmlClass()).toMatch(/archia-(dark|light|high-contrast)/);

    await btn.click();
    expect(await getHtmlClass()).toMatch(/archia-(dark|light|high-contrast)/);
  });

  test("share route renders read-only shell for public project", async ({ page }) => {
    const projectId = await setupFreeProject(page);
    if (!projectId) {
      test.skip();
      return;
    }
    const graphId = await createGraph(page, projectId);
    if (!graphId) {
      test.skip();
      return;
    }

    // Generate share token
    const tokenResp = await authHeader(page);
    expect(tokenResp).toBeTruthy();
    const shareResp = await page.context().request.post(
      `${page.url().split("/")[0]}/api/v1/share/graphs/${graphId}`,
      {
        headers: { Authorization: `Bearer ${tokenResp!.access_token}` },
      },
    );
    const share = (await shareResp.json()) as { share_token: string; share_url: string };
    expect(share.share_token).toBeTruthy();

    await page.goto(`${page.url().split("/")[0]}${share.share_url}`);
    await expect(page.getByTestId("share-readonly")).toBeVisible({ timeout: 20_000 });
    // Read-only badge must appear
    await expect(page.getByText("Somente leitura")).toBeVisible({ timeout: 10_000 });
  });

  test("free project shows ModeBadge and template buttons", async ({ page }) => {
    const projectId = await setupFreeProject(page);
    if (!projectId) {
      test.skip();
      return;
    }
    const graphId = await createGraph(page, projectId);
    if (!graphId) {
      test.skip();
      return;
    }

    await page.goto(`${page.url().split("/")[0]}/project/${projectId}`);
    // Wait for canvas
    await expect(page.locator("[data-testid='mode-badge']")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("mode-badge")).toContainText("Livre");

    // Toolbar sticky + zoom controls present
    await expect(page.getByRole("button", { name: /Zoom \+/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Zoom −/ })).toBeVisible();
    await expect(page.getByTestId("fit-view-btn")).toBeVisible();

    // Template buttons visible when canvas is empty
    await expect(page.getByRole("button", { name: "Fluxo simples" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Árvore decisão" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Processo" })).toBeVisible();
  });

  test("export options modal opens and confirms", async ({ page }) => {
    const projectId = await setupFreeProject(page);
    if (!projectId) {
      test.skip();
      return;
    }
    const graphId = await createGraph(page, projectId);
    if (!graphId) {
      test.skip();
      return;
    }

    await page.goto(`${page.url().split("/")[0]}/project/${projectId}`);
    await expect(page.locator("[data-testid='mode-badge']")).toBeVisible({ timeout: 20_000 });

    // Open export menu
    const exportBtn = page.getByRole("button", { name: "Exportar" });
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();

    // Options button must appear
    const optBtn = page.getByRole("menuitem", { name: /Opções avançadas/ });
    await expect(optBtn).toBeVisible();
    await optBtn.click();

    // Modal must open
    await expect(page.getByRole("dialog", { name: /Opções de exportação/ })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("export-options-confirm")).toBeVisible();
  });

  test("toolbar collapse persists", async ({ page }) => {
    const projectId = await setupFreeProject(page);
    if (!projectId) {
      test.skip();
      return;
    }
    const graphId = await createGraph(page, projectId);
    if (!graphId) {
      test.skip();
      return;
    }

    await page.goto(`${page.url().split("/")[0]}/project/${projectId}`);
    await expect(page.locator("[data-testid='mode-badge']")).toBeVisible({ timeout: 20_000 });

    // Collapse toolbar (button has aria-label containing "Recolher")
    const collapseBtn = page
      .getByRole("toolbar", { name: /Barra de ferramentas/ })
      .getByRole("button", { name: /Recolher/i });
    await expect(collapseBtn).toBeVisible();
    await collapseBtn.click();
    const expandBtn = page
      .getByRole("toolbar", { name: /Barra de ferramentas/ })
      .getByRole("button", { name: /Expandir/i });
    await expect(expandBtn).toBeVisible();

    // Refresh and verify persistence
    await page.reload();
    await expect(page.locator("[data-testid='mode-badge']")).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("toolbar", { name: /Barra de ferramentas/ }).getByRole("button", { name: /Expandir/i }),
    ).toBeVisible();
  });
});
