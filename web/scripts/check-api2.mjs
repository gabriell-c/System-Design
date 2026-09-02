import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Login
const login = await page.request.post("http://localhost:4410/api/v1/auth/login", {
  data: { username: "SENIOR", password: "CHANGEPASSWORD" },
});
const token = (await login.json()).access_token;

// List projects
const listResp = await page.request.get("http://localhost:4410/api/v1/projects", {
  headers: { Authorization: `Bearer ${token}` },
});
const listData = await listResp.json();

console.log("List response type:", typeof listData);
console.log("List response:", JSON.stringify(listData).substring(0, 500));

// Check for free projects
const items = listData.items || listData;
const freeProjects = Array.isArray(items) ? items.filter(p => p.project_kind === "free") : [];
console.log("Free projects:", freeProjects.length);
freeProjects.forEach(p => console.log(" -", p.id, p.name, "kind:", p.project_kind));

// Navigate to first free project
if (freeProjects.length > 0) {
  const projectId = freeProjects[0].id;
  await page.goto(`http://localhost:3015/project/${projectId}`);
  await page.waitForTimeout(8000);
  
  const hasNovo = await page.getByText("Novo projeto").isVisible().catch(() => false);
  const hasExcal = await page.locator(".excalidraw").count();
  const bodyText = await page.locator("body").innerText();
  
  console.log("Has Novo projeto:", hasNovo);
  console.log("Has Excalidraw:", hasExcal > 0);
  console.log("Body (first 300):", bodyText.slice(0, 300));
  
  await page.screenshot({ path: "e2e/project-check.png", fullPage: true });
  console.log("Screenshot: e2e/project-check.png");
}

await browser.close();
