/**
 * E2E Test: Project Data Isolation
 * 
 * Test verifies that each project has independent diagram data using direct API calls.
 */

import { test, expect } from "@playwright/test";

test("projects have independent diagram data", async ({ page }) => {
  // Navigate to dashboard
  await page.goto("http://localhost:3015");
  await expect(page).toHaveTitle(/Archia/i);
  console.log("[1] Dashboard loaded");

  // Test 1: Check existing graphs count
  const graphsBefore = await page.evaluate(async () => {
    try {
      const resp = await fetch("http://localhost:4410/api/v1/graphs?limit=100", { credentials: "include" });
      const data = await resp.json();
      return data.items ? data.items.length : 0;
    } catch (e) {
      console.error("Error fetching graphs:", e);
      return 0;
    }
  });
  console.log(`[2] Graphs before test: ${graphsBefore}`);

  // Test 2: Create two projects via API
  const project1 = await page.evaluate(async () => {
    try {
      const resp = await fetch("http://localhost:4410/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: "Test Isolation A", project_kind: "free" }),
      });
      const text = await resp.text();
      console.log("Project 1 response status:", resp.status);
      console.log("Project 1 response text:", text);
      return JSON.parse(text);
    } catch (e) {
      console.error("Error creating project 1:", e);
      return null;
    }
  });
  console.log(`[3] Created Project A: ${JSON.stringify(project1)}`);

  const project2 = await page.evaluate(async () => {
    try {
      const resp = await fetch("http://localhost:4410/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: "Test Isolation B", project_kind: "free" }),
      });
      const text = await resp.text();
      console.log("Project 2 response status:", resp.status);
      console.log("Project 2 response text:", text);
      return JSON.parse(text);
    } catch (e) {
      console.error("Error creating project 2:", e);
      return null;
    }
  });
  console.log(`[4] Created Project B: ${JSON.stringify(project2)}`);

  // Test 3: Get graphs for each project
  const graph1 = await page.evaluate(async (id) => {
    try {
      const resp = await fetch(`http://localhost:4410/api/v1/projects/${id}/diagrams`, { credentials: "include" });
      const text = await resp.text();
      console.log("Graph 1 response:", text);
      return JSON.parse(text);
    } catch (e) {
      console.error("Error fetching graph 1:", e);
      return [];
    }
  }, project1.id);

  const graph2 = await page.evaluate(async (id) => {
    try {
      const resp = await fetch(`http://localhost:4410/api/v1/projects/${id}/diagrams`, { credentials: "include" });
      const text = await resp.text();
      console.log("Graph 2 response:", text);
      return JSON.parse(text);
    } catch (e) {
      console.error("Error fetching graph 2:", e);
      return [];
    }
  }, project2.id);

  console.log(`[5] Graph A: ${graph1[0]?.id}, nodes: ${graph1[0]?.nodes?.length || 0}`);
  console.log(`[6] Graph B: ${graph2[0]?.id}, nodes: ${graph2[0]?.nodes?.length || 0}`);

  // Test 4: Verify both graphs exist and are empty
  expect(graph1).toHaveLength(1);
  expect(graph2).toHaveLength(1);
  expect(graph1[0].nodes.length).toBe(0);
  expect(graph2[0].nodes.length).toBe(0);
  console.log("[7] Both graphs are empty (PASS)");

  // Test 5: Add node to Graph A
  const newNodeA = {
    id: `node-a-test-${Date.now()}`,
    type: "free-rectangle",
    position: { x: 100, y: 100 },
    data: { label: "Node A Test" },
  };

  const updatedGraph1 = await page.evaluate(async ({ graphId, node }) => {
    try {
      const resp = await fetch(`http://localhost:4410/api/v1/graphs/${graphId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nodes: [node] }),
      });
      const text = await resp.text();
      console.log("Update graph 1 response:", text);
      return JSON.parse(text);
    } catch (e) {
      console.error("Error updating graph 1:", e);
      return null;
    }
  }, { graphId: graph1[0].id, node: newNodeA });

  console.log(`[8] Added node to Graph A: ${updatedGraph1?.nodes?.length} nodes`);
  expect(updatedGraph1).not.toBeNull();
  expect(updatedGraph1.nodes.length).toBe(1);

  // Test 6: Add node to Graph B
  const newNodeB = {
    id: `node-b-test-${Date.now()}`,
    type: "free-circle",
    position: { x: 200, y: 200 },
    data: { label: "Node B Test" },
  };

  const updatedGraph2 = await page.evaluate(async ({ graphId, node }) => {
    try {
      const resp = await fetch(`http://localhost:4410/api/v1/graphs/${graphId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nodes: [node] }),
      });
      const text = await resp.text();
      console.log("Update graph 2 response:", text);
      return JSON.parse(text);
    } catch (e) {
      console.error("Error updating graph 2:", e);
      return null;
    }
  }, { graphId: graph2[0].id, node: newNodeB });

  console.log(`[9] Added node to Graph B: ${updatedGraph2?.nodes?.length} nodes`);
  expect(updatedGraph2).not.toBeNull();
  expect(updatedGraph2.nodes.length).toBe(1);

  // Test 7: Verify isolation - fetch both graphs again
  const graph1After = await page.evaluate(async (id) => {
    try {
      const resp = await fetch(`http://localhost:4410/api/v1/projects/${id}/diagrams`, { credentials: "include" });
      const text = await resp.text();
      console.log("Graph 1 after response:", text);
      return JSON.parse(text);
    } catch (e) {
      console.error("Error fetching graph 1 after:", e);
      return [];
    }
  }, project1.id);

  const graph2After = await page.evaluate(async (id) => {
    try {
      const resp = await fetch(`http://localhost:4410/api/v1/projects/${id}/diagrams`, { credentials: "include" });
      const text = await resp.text();
      console.log("Graph 2 after response:", text);
      return JSON.parse(text);
    } catch (e) {
      console.error("Error fetching graph 2 after:", e);
      return [];
    }
  }, project2.id);

  console.log(`[10] Graph A after edits: ${graph1After[0].nodes.length} nodes`);
  console.log(`[11] Graph B after edits: ${graph2After[0].nodes.length} nodes`);

  // Test 8: VERIFY ISOLATION
  expect(graph1After).toHaveLength(1);
  expect(graph2After).toHaveLength(1);
  expect(graph1After[0].nodes.length).toBe(1);
  expect(graph2After[0].nodes.length).toBe(1);
  
  // Verify they are DIFFERENT nodes
  expect(graph1After[0].nodes[0].id).not.toBe(graph2After[0].nodes[0].id);
  expect(graph1After[0].nodes[0].data.label).not.toBe(graph2After[0].nodes[0].data.label);

  console.log("\n[PASS] Project data isolation verified!");
  console.log(`  - Graph A: ${graph1After[0].nodes.length} node(s), id=${graph1After[0].nodes[0].id}`);
  console.log(`  - Graph B: ${graph2After[0].nodes.length} node(s), id=${graph2After[0].nodes[0].id}`);
  console.log(`  - Nodes are different: ${graph1After[0].nodes[0].id} !== ${graph2After[0].nodes[0].id}`);
});
