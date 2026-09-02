import { chromium } from "@playwright/test";

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
  data: { name: "Free Debug 2", project_kind: "free" },
});
const { id } = await create.json();

console.log("Created project:", id);

// Get project details
const get = await page.request.get(`http://localhost:4410/api/v1/projects/${id}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const project = await get.json();
console.log("Project details:", JSON.stringify(project, null, 2));

// Now navigate and check what the page sees
await page.goto(`http://localhost:3015/project/${id}`);
await page.waitForTimeout(6000);

// Check what the page thinks the project_kind is
const projectKind = await page.evaluate(() => {
  // Try to get from Zustand store
  const store = window.__ZUSTAND_STORES__?.project;
  if (store) {
    const activeId = store.getState()?.activeProjectId;
    const projects = store.getState()?.projects;
    const active = projects?.find(p => p.id === activeId);
    return { activeId, projectKind: active?.project_kind };
  }
  return null;
});
console.log("Page store project_kind:", projectKind);

await browser.close();
