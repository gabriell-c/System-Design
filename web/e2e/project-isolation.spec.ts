/**
 * E2E Test: Project Data Isolation
 *
 * Auth: logs in as the seeded dev user (SENIOR/CHANGEPASSWORD) via the API
 * using `page.request` — the request context shares the browser cookie jar,
 * so no cross-origin fetch/CORS dance. Fails hard when auth or project
 * creation fails (no self-certifying SKIP paths).
 */

import { test, expect } from "@playwright/test";

const API = "http://localhost:4410/api/v1";

async function createProject(api: import("@playwright/test").APIRequestContext, name: string) {
  const resp = await api.post(`${API}/projects`, {
    data: { name, project_kind: "free" },
  });
  expect(resp.status(), `project "${name}" must be created (status ${resp.status()}: ${await resp.text()})`).toBeLessThan(300);
  return await resp.json();
}

async function fetchProjectDiagrams(api: import("@playwright/test").APIRequestContext, projectId: string) {
  const resp = await api.get(`${API}/projects/${projectId}/diagrams`);
  expect(resp.status(), `diagrams for project ${projectId} (status ${resp.status()}: ${await resp.text()})`).toBe(200);
  const body = await resp.json();
  // Endpoint may return a bare list or a wrapped {items} — normalize.
  return Array.isArray(body) ? body : body.items ?? [];
}

test("projects have independent diagram data", async ({ page }) => {
  // [1] Authenticate (seeded dev user; API only starts with dev seed in this env)
  const login = await page.request.post(`${API}/auth/login`, {
    data: { username: "SENIOR", password: "CHANGEPASSWORD" },
  });
  expect(login.status(), "SENIOR/CHANGEPASSWORD login must succeed").toBe(200);

  // [2] Create two projects
  const projectA = await createProject(page.request, "Test Isolation A");
  const projectB = await createProject(page.request, "Test Isolation B");
  expect(projectA.id).toBeTruthy();
  expect(projectB.id).toBeTruthy();
  expect(projectA.id).not.toBe(projectB.id);

  // [3] Both start with an empty diagram
  const [diagA, diagB] = await Promise.all([
    fetchProjectDiagrams(page.request, projectA.id),
    fetchProjectDiagrams(page.request, projectB.id),
  ]);
  expect(diagA[0]?.nodes?.length ?? 0, "project A should start empty").toBe(0);
  expect(diagB[0]?.nodes?.length ?? 0, "project B should start empty").toBe(0);

  // [4] Add a node to graph A only (optimistic-concurrency: If-Match from the GET etag)
  const nodeA = { id: `node-a-test-${Date.now()}`, type: "free-rectangle", position: { x: 100, y: 100 }, data: { label: "Node A Test" } };
  const putA = await page.request.put(`${API}/graphs/${diagA[0].id}`, {
    data: { nodes: [nodeA] },
    headers: { "If-Match": `W/"${diagA[0].id}:${diagA[0].updated_at}"` },
  });
  expect(putA.status(), `graph A update (status ${putA.status()}: ${await putA.text()})`).toBeLessThan(300);

  // [5] Same for graph B
  const nodeB = { id: `node-b-test-${Date.now()}`, type: "free-circle", position: { x: 200, y: 200 }, data: { label: "Node B Test" } };
  const putB = await page.request.put(`${API}/graphs/${diagB[0].id}`, {
    data: { nodes: [nodeB] },
    headers: { "If-Match": `W/"${diagB[0].id}:${diagB[0].updated_at}"` },
  });
  expect(putB.status(), `graph B update (status ${putB.status()}: ${await putB.text()})`).toBeLessThan(300);

  // [6] Verify isolation: each project still sees exactly its own node
  const [afterA, afterB] = await Promise.all([
    fetchProjectDiagrams(page.request, projectA.id),
    fetchProjectDiagrams(page.request, projectB.id),
  ]);
  expect(afterA[0].nodes.length).toBe(1);
  expect(afterB[0].nodes.length).toBe(1);
  expect(afterA[0].nodes[0].id).not.toBe(afterB[0].nodes[0].id);
  expect(afterA[0].nodes[0].data.label).not.toBe(afterB[0].nodes[0].data.label);
});
