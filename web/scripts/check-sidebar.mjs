import { chromium } from "@playwright/test";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login
  const login = await page.request.post("http://localhost:4410/api/v1/auth/login", {
    data: { username: "SENIOR", password: "CHANGEPASSWORD" },
  });
  const token = (await login.json()).access_token;

  // Create free project
  const create = await page.request.post("http://localhost:4410/api/v1/projects", {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: "Free Project Test", project_kind: "free" },
  });
  const created = await create.json();
  console.log("Created:", JSON.stringify(created, null, 2));

  // Get project details
  const get = await page.request.get(`http://localhost:4410/api/v1/projects/${created.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const project = await get.json();
  console.log("Project kind:", project.project_kind);

  // Navigate to project
  await page.goto(`http://localhost:3015/project/${created.id}`);
  await page.waitForTimeout(6000);

  // Check what's rendered
  const hasNovo = await page.getByText("Novo projeto").isVisible().catch(() => false);
  const hasSidebar = await page.getByRole("navigation").count();
  const container = await page.locator("[data-testid='excalidraw-container']").count();
  
  console.log("Visual check:", { hasNovo, hasSidebar, container });

  // Check AppShell content
  const bodyText = await page.locator("body").innerText();
  console.log("Body contains 'Novo projeto':", bodyText.includes("Novo projeto"));
  console.log("Body contains 'Editor':", bodyText.includes("Editor"));

  await page.screenshot({ path: "e2e/sidebar-check.png", fullPage: true });
  console.log("Screenshot saved");

  await browser.close();
})();
