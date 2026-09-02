const http = require("http");

const options = {
  hostname: "localhost",
  port: 4410,
  path: "/api/v1/auth/login",
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  }
};

const body = JSON.stringify({ username: "SENIOR", password: "CHANGEPASSWORD" });
const req = http.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => data += chunk);
  res.on("end", () => {
    const loginData = JSON.parse(data);
    const token = loginData.access_token;
    
    // Get project
    const getOptions = {
      hostname: "localhost",
      port: 4410,
      path: "/api/v1/projects",
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    };
    
    const getReq = http.request(getOptions, (res2) => {
      let data2 = "";
      res2.on("data", (chunk) => data2 += chunk);
      res2.on("end", () => {
        const projects = JSON.parse(data2);
        const freeProjects = projects.items?.filter(p => p.project_kind === "free") || [];
        console.log("Free projects:", freeProjects.length);
        freeProjects.forEach(p => console.log("ID:", p.id, "Kind:", p.project_kind, "Name:", p.name));
        
        // Navigate with Playwright
        const { chromium } = require("@playwright/test");
        (async () => {
          const browser = await chromium.launch({ headless: true });
          const page = await browser.newPage();
          
          if (freeProjects.length > 0) {
            const projectId = freeProjects[0].id;
            await page.goto(`http://localhost:3015/project/${projectId}`);
            await page.waitForTimeout(6000);
            
            const hasNovo = await page.getByText("Novo projeto").isVisible().catch(() => false);
            const hasExcal = await page.locator(".excalidraw").count();
            const bodyText = await page.locator("body").innerText();
            
            console.log("Has Novo projeto:", hasNovo);
            console.log("Has Excalidraw:", hasExcal > 0);
            console.log("Body snippet:", bodyText.slice(0, 200));
            
            await page.screenshot({ path: "e2e/api-check.png" });
          }
          
          await browser.close();
        })();
      });
    });
    getReq.end();
  });
});
req.write(body);
req.end();
