import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capture console logs
page.on("console", msg => console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`));
page.on("pageerror", err => console.log(`[PAGE ERROR] ${err.message}`));

// Login
const login = await page.request.post("http://localhost:4410/api/v1/auth/login", {
  data: { username: "SENIOR", password: "CHANGEPASSWORD" },
});
const token = (await login.json()).access_token;

// Create free project
const create = await page.request.post("http://localhost:4410/api/v1/projects", {
  headers: { Authorization: `Bearer ${token}` },
  data: { name: "Free Test Final", project_kind: "free" },
});
const { id } = await create.json();
console.log("Created project:", id);

// Navigate
await page.goto(`http://localhost:3015/project/${id}`);
await page.waitForTimeout(8000);

// Check state
const state = await page.evaluate(() => {
  return {
    url: window.location.href,
    pathname: window.location.pathname,
    hasNovo: document.body.innerText.includes("Novo projeto"),
    hasExcalidraw: document.querySelector(".excalidraw") !== null,
    hasContainer: document.querySelector("[data-testid='excalidraw-container']") !== null,
  };
});

console.log("Page state:", state);

await page.screenshot({ path: "e2e/final-debug.png", fullPage: true });
console.log("Screenshot saved");

await browser.close();
