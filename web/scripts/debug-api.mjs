import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Login via API
const login = await page.request.post("http://localhost:4410/api/v1/auth/login", {
  data: { username: "SENIOR", password: "CHANGEPASSWORD" },
});
const loginData = await login.json();
const token = loginData.access_token;

// List all projects
const listResp = await page.request.get("http://localhost:4410/api/v1/projects", {
  headers: { Authorization: `Bearer ${token}` },
});
const listData = await listResp.json();

console.log("List response type:", typeof listData);
console.log("List response keys:", Object.keys(listData || {}));

if (Array.isArray(listData)) {
  const freeProjects = listData.filter(p => p.project_kind === "free");
  console.log("Free projects:", freeProjects.length);
  freeProjects.forEach(p => console.log(" -", p.id, p.name, p.project_kind));
} else if (listData.items) {
  const freeProjects = listData.items.filter(p => p.project_kind === "free");
  console.log("Free projects:", freeProjects.length);
  freeProjects.forEach(p => console.log(" -", p.id, p.name, p.project_kind));
}

// Get first project
const firstProject = Array.isArray(listData) ? listData[0] : (listData.items?.[0]);
if (firstProject) {
  console.log("First project:", firstProject.id, firstProject.project_kind);
  
  // Navigate to project
  await page.goto(`http://localhost:3015/project/${firstProject.id}`);
  await page.waitForTimeout(5000);
  
  // Check page content
  const title = await page.title();
  const bodyText = await page.locator("body").innerText();
  
  console.log("Page title:", title);
  console.log("Has 'Novo projeto':", bodyText.includes("Novo projeto"));
  console.log("Has 'Diagramas':", bodyText.includes("Diagramas"));
  console.log("Has 'excalidraw':", bodyText.includes("excalidraw"));
  
  // Check for sidebar elements
  const sidebarNav = await page.locator("[class*='SidebarNav'], [class*='sidebar-nav']").count();
  const novoProjeto = await page.getByText("Novo projeto").count();
  
  console.log("SidebarNav elements:", sidebarNav);
  console.log("Novo projeto elements:", novoProjeto);
  
  await page.screenshot({ path: "e2e/project-debug.png", fullPage: true });
  console.log("Screenshot: e2e/project-debug.png");
}

await browser.close();
