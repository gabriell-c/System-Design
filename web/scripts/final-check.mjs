import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Login
const login = await page.request.post("http://localhost:4410/api/v1/auth/login", {
  data: { username: "SENIOR", password: "CHANGEPASSWORD" },
});
const token = (await login.json()).access_token;

// Get all projects and find a free one
const listResp = await page.request.get("http://localhost:4410/api/v1/projects", {
  headers: { Authorization: `Bearer ${token}` },
});
const listData = await listResp.json();

const freeProjects = listData.items?.filter(p => p.project_kind === "free") || [];
console.log("Found free projects:", freeProjects.length);

if (freeProjects.length === 0) {
  console.log("No free projects found. Creating one...");
  const create = await page.request.post("http://localhost:4410/api/v1/projects", {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: "Free Debug Final", project_kind: "free" },
  });
  const { id } = await create.json();
  console.log("Created free project:", id);
  await page.goto(`http://localhost:3015/project/${id}`);
} else {
  const projectId = freeProjects[0].id;
  console.log("Using free project:", projectId, freeProjects[0].name);
  await page.goto(`http://localhost:3015/project/${projectId}`);
}

await page.waitForTimeout(8000);

// Check console logs
const logs = await page.evaluate(() => {
  // This won't capture console logs, but we can check the DOM
  return {
    url: window.location.href,
    hasNovo: document.body.innerText.includes("Novo projeto"),
    hasSidebar: document.body.innerText.includes("PROJETOS"),
    hasExcalidraw: document.querySelector(".excalidraw") !== null,
    hasContainer: document.querySelector("[data-testid='excalidraw-container']") !== null,
  };
});

console.log("Page state:", logs);

await page.screenshot({ path: "e2e/final-check.png", fullPage: true });
console.log("Screenshot saved");

// Check for sidebar
const sidebarCount = await page.locator("[class*='SidebarNav'], [class*='sidebar']").count();
const novoCount = await page.getByText("Novo projeto").count();
const excalCount = await page.locator(".excalidraw").count();
const containerCount = await page.locator("[data-testid='excalidraw-container']").count();

console.log("Sidebar elements:", sidebarCount);
console.log("Novo projeto elements:", novoCount);
console.log("Excalidraw elements:", excalCount);
console.log("Container elements:", containerCount);

if (novoCount > 0 || sidebarCount > 0) {
  console.log("FAIL: Sidebar is visible when it should be hidden");
  process.exitCode = 1;
} else if (excalCount > 0 && containerCount > 0) {
  console.log("PASS: Pure Excalidraw mode");
}

await browser.close();
