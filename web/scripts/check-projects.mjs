import { chromium } from "@playwright/test";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login
  const login = await page.request.post("http://localhost:4410/api/v1/auth/login", {
    data: { username: "SENIOR", password: "CHANGEPASSWORD" },
  });
  const token = (await login.json()).access_token;

  // List projects
  const list = await page.request.get("http://localhost:4410/api/v1/projects", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const projects = await list.json();
  console.log("Projects:", JSON.stringify(projects, null, 2));

  // Find a free project
  const freeProject = projects.items?.find((p) => p.project_kind === "free") || projects.find((p) => p.project_kind === "free");
  console.log("Free project:", freeProject?.id, freeProject?.project_kind);

  await browser.close();
})();
