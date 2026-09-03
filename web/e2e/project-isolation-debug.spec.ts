/**
 * E2E Test: Project Data Isolation - Debug
 */

import { test, expect } from "@playwright/test";

test("debug project isolation", async ({ page }) => {
  // Navigate to dashboard
  await page.goto("http://localhost:3015");
  await expect(page).toHaveTitle(/Archia/i);
  console.log("[1] Dashboard loaded");

  // Create two projects via API
  const project1 = await page.evaluate(async () => {
    const resp = await fetch("http://localhost:4410/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: "Test Isolation A", project_kind: "free" }),
    });
    const text = await resp.text();
    console.log("Project 1 status:", resp.status);
    console.log("Project 1 response:", text);
    return JSON.parse(text);
  });

  const project2 = await page.evaluate(async () => {
    const resp = await fetch("http://localhost:4410/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: "Test Isolation B", project_kind: "free" }),
    });
    const text = await resp.text();
    console.log("Project 2 status:", resp.status);
    console.log("Project 2 response:", text);
    return JSON.parse(text);
  });

  console.log(`[2] Project A: ${project1?.id}`);
  console.log(`[3] Project B: ${project2?.id}`);

  // Get graphs for each project
  const graph1 = await page.evaluate(async (id) => {
    const resp = await fetch(`http://localhost:4410/api/v1/projects/${id}/diagrams`, { credentials: "include" });
    const text = await resp.text();
    console.log(`Graph 1 (${id}) status:`, resp.status);
    console.log(`Graph 1 (${id}) response:`, text);
    return JSON.parse(text);
  }, project1.id);

  const graph2 = await page.evaluate(async (id) => {
    const resp = await fetch(`http://localhost:4410/api/v1/projects/${id}/diagrams`, { credentials: "include" });
    const text = await resp.text();
    console.log(`Graph 2 (${id}) status:`, resp.status);
    console.log(`Graph 2 (${id}) response:`, text);
    return JSON.parse(text);
  }, project2.id);

  console.log(`[4] Graph A: ${graph1[0]?.id}, type: ${typeof graph1}, isArray: ${Array.isArray(graph1)}`);
  console.log(`[5] Graph B: ${graph2[0]?.id}, type: ${typeof graph2}, isArray: ${Array.isArray(graph2)}`);

  // Test isolation
  if (graph1[0] && graph2[0]) {
    console.log(`[6] Graph A nodes: ${graph1[0].nodes.length}`);
    console.log(`[7] Graph B nodes: ${graph2[0].nodes.length}`);
    
    expect(graph1[0].nodes.length).toBe(0);
    expect(graph2[0].nodes.length).toBe(0);
    
    // Add node to Graph A
    const newNodeA = {
      id: `node-a-test-${Date.now()}`,
      type: "free-rectangle",
      position: { x: 100, y: 100 },
      data: { label: "Node A Test" },
    };

    await page.evaluate(async ({ graphId, node }) => {
      const resp = await fetch(`http://localhost:4410/api/v1/graphs/${graphId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nodes: [node] }),
      });
      const text = await resp.text();
      console.log("Update graph 1:", text);
    }, { graphId: graph1[0].id, node: newNodeA });

    // Add node to Graph B
    const newNodeB = {
      id: `node-b-test-${Date.now()}`,
      type: "free-circle",
      position: { x: 200, y: 200 },
      data: { label: "Node B Test" },
    };

    await page.evaluate(async ({ graphId, node }) => {
      const resp = await fetch(`http://localhost:4410/api/v1/graphs/${graphId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nodes: [node] }),
      });
      const text = await resp.text();
      console.log("Update graph 2:", text);
    }, { graphId: graph2[0].id, node: newNodeB });

    // Verify isolation
    const graph1After = await page.evaluate(async (id) => {
      const resp = await fetch(`http://localhost:4410/api/v1/projects/${id}/diagrams`, { credentials: "include" });
      const text = await resp.text();
      console.log(`Graph 1 after:`, text);
      return JSON.parse(text);
    }, project1.id);

    const graph2After = await page.evaluate(async (id) => {
      const resp = await fetch(`http://localhost:4410/api/v1/projects/${id}/diagrams`, { credentials: "include" });
      const text = await resp.text();
      console.log(`Graph 2 after:`, text);
      return JSON.parse(text);
    }, project2.id);

    console.log(`[8] Graph A after: ${graph1After[0].nodes.length} nodes`);
    console.log(`[9] Graph B after: ${graph2After[0].nodes.length} nodes`);

    expect(graph1After[0].nodes.length).toBe(1);
    expect(graph2After[0].nodes.length).toBe(1);
    expect(graph1After[0].nodes[0].id).not.toBe(graph2After[0].nodes[0].id);
    
    console.log("\n[PASS] Project data isolation verified!");
  } else {
    console.log("[FAIL] Could not get graphs");
  }
});
