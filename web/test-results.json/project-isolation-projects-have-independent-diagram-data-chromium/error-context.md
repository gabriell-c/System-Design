# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: project-isolation.spec.ts >> projects have independent diagram data
- Location: e2e\project-isolation.spec.ts:9:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Pular para conteúdo principal" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e3]:
    - complementary [ref=e4]:
      - navigation [ref=e9]:
        - generic [ref=e10]:
          - link "Dashboard" [ref=e11] [cursor=pointer]:
            - /url: /
          - link "Projetos" [ref=e17] [cursor=pointer]:
            - /url: /project
          - link "Perfil" [ref=e21] [cursor=pointer]:
            - /url: /profile
      - generic [ref=e26]:
        - button "Modo claro" [ref=e27]
        - button "Sair" [ref=e31]
        - link "U" [ref=e36] [cursor=pointer]:
          - /url: /profile
    - main [ref=e38]:
      - generic [ref=e39]:
        - generic [ref=e41]:
          - generic [ref=e49]:
            - heading "Dashboard" [level=1] [ref=e50]
            - paragraph [ref=e51]: Gerencie seus projetos de arquitetura
          - button "Novo projeto" [ref=e54]
        - generic [ref=e56]:
          - generic [ref=e57]:
            - generic [ref=e58]:
              - generic [ref=e59]: Projetos
              - paragraph [ref=e66]: "0"
              - paragraph [ref=e67]: 0 fixados
            - generic [ref=e70]:
              - generic [ref=e71]: Nós no total
              - paragraph [ref=e79]: "0"
              - paragraph [ref=e80]: diagramas
            - generic [ref=e85]:
              - generic [ref=e86]: Públicos
              - paragraph [ref=e94]: "0"
              - paragraph [ref=e95]: compartilháveis
            - generic [ref=e101]:
              - generic [ref=e102]: Arquivados
              - paragraph [ref=e110]: "0"
              - paragraph [ref=e111]: ocultos
          - generic [ref=e115]:
            - generic [ref=e116]:
              - textbox "Buscar projetos…" [ref=e118]
              - generic [ref=e119]:
                - button "Recentes" [ref=e121]
                - generic [ref=e125]:
                  - button "Ativos" [ref=e126]
                  - button "Arquivados" [ref=e129]
                - generic [ref=e133] [cursor=pointer]:
                  - checkbox "Fixados primeiro" [checked] [ref=e134]
                  - text: Fixados primeiro
                - generic "Dica de ordenação"
            - button "Ver arquivados" [ref=e137]
          - generic [ref=e144]:
            - generic [ref=e148]:
              - paragraph [ref=e149]: Nenhum projeto ainda.
              - paragraph [ref=e150]: Comece criando sua primeira arquitetura.
            - button "Criar projeto" [ref=e151]
  - generic [ref=e157] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e158]
    - generic [ref=e162]:
      - button "Open issues overlay" [ref=e163]:
        - generic [ref=e164]:
          - generic [ref=e165]: "1"
          - generic [ref=e166]: "2"
        - generic [ref=e167]:
          - text: Issue
          - generic [ref=e168]: s
      - button "Collapse issues badge" [ref=e169]
  - alert [ref=e172]
```

# Test source

```ts
  1   | /**
  2   |  * E2E Test: Project Data Isolation
  3   |  * 
  4   |  * Test verifies that each project has independent diagram data using direct API calls.
  5   |  */
  6   | 
  7   | import { test, expect } from "@playwright/test";
  8   | 
  9   | test("projects have independent diagram data", async ({ page }) => {
  10  |   // Navigate to dashboard
  11  |   await page.goto("http://localhost:3015");
  12  |   await expect(page).toHaveTitle(/Archia/i);
  13  |   console.log("[1] Dashboard loaded");
  14  | 
  15  |   // Test 1: Create two projects via API
  16  |   const project1 = await page.evaluate(async () => {
  17  |     try {
  18  |       const resp = await fetch("http://localhost:4410/api/v1/projects", {
  19  |         method: "POST",
  20  |         headers: { "Content-Type": "application/json" },
  21  |         credentials: "include",
  22  |         body: JSON.stringify({ name: "Test Isolation A", project_kind: "free" }),
  23  |       });
  24  |       const text = await resp.text();
  25  |       console.log("Project 1 response:", text);
  26  |       return JSON.parse(text);
  27  |     } catch (e) {
  28  |       console.error("Error creating project 1:", e);
  29  |       return null;
  30  |     }
  31  |   });
  32  |   console.log(`[2] Created Project A: ${project1?.id}`);
  33  | 
  34  |   const project2 = await page.evaluate(async () => {
  35  |     try {
  36  |       const resp = await fetch("http://localhost:4410/api/v1/projects", {
  37  |         method: "POST",
  38  |         headers: { "Content-Type": "application/json" },
  39  |         credentials: "include",
  40  |         body: JSON.stringify({ name: "Test Isolation B", project_kind: "free" }),
  41  |       });
  42  |       const text = await resp.text();
  43  |       console.log("Project 2 response:", text);
  44  |       return JSON.parse(text);
  45  |     } catch (e) {
  46  |       console.error("Error creating project 2:", e);
  47  |       return null;
  48  |     }
  49  |   });
  50  |   console.log(`[3] Created Project B: ${project2?.id}`);
  51  | 
  52  |   // Test 2: Get graphs for each project
  53  |   const graph1 = await page.evaluate(async (id) => {
  54  |     try {
  55  |       const resp = await fetch(`http://localhost:4410/api/v1/projects/${id}/diagrams`, { credentials: "include" });
  56  |       const text = await resp.text();
  57  |       console.log("Graph 1 response:", text);
  58  |       return JSON.parse(text);
  59  |     } catch (e) {
  60  |       console.error("Error fetching graph 1:", e);
  61  |       return [];
  62  |     }
  63  |   }, project1.id);
  64  | 
  65  |   const graph2 = await page.evaluate(async (id) => {
  66  |     try {
  67  |       const resp = await fetch(`http://localhost:4410/api/v1/projects/${id}/diagrams`, { credentials: "include" });
  68  |       const text = await resp.text();
  69  |       console.log("Graph 2 response:", text);
  70  |       return JSON.parse(text);
  71  |     } catch (e) {
  72  |       console.error("Error fetching graph 2:", e);
  73  |       return [];
  74  |     }
  75  |   }, project2.id);
  76  | 
  77  |   console.log(`[4] Graph A: ${graph1[0]?.id}, nodes: ${graph1[0]?.nodes?.length || 0}`);
  78  |   console.log(`[5] Graph B: ${graph2[0]?.id}, nodes: ${graph2[0]?.nodes?.length || 0}`);
  79  | 
  80  |   // Test 3: Verify both graphs exist and are empty
  81  |   expect(graph1).toBeTruthy();
  82  |   expect(graph2).toBeTruthy();
> 83  |   expect(Array.isArray(graph1)).toBe(true);
      |                                 ^ Error: expect(received).toBe(expected) // Object.is equality
  84  |   expect(Array.isArray(graph2)).toBe(true);
  85  |   expect(graph1.length).toBe(1);
  86  |   expect(graph2.length).toBe(1);
  87  |   expect(graph1[0].nodes.length).toBe(0);
  88  |   expect(graph2[0].nodes.length).toBe(0);
  89  |   console.log("[6] Both graphs are empty (PASS)");
  90  | 
  91  |   // Test 4: Add node to Graph A
  92  |   const newNodeA = {
  93  |     id: `node-a-test-${Date.now()}`,
  94  |     type: "free-rectangle",
  95  |     position: { x: 100, y: 100 },
  96  |     data: { label: "Node A Test" },
  97  |   };
  98  | 
  99  |   const updatedGraph1 = await page.evaluate(async ({ graphId, node }) => {
  100 |     try {
  101 |       const resp = await fetch(`http://localhost:4410/api/v1/graphs/${graphId}`, {
  102 |         method: "PUT",
  103 |         headers: { "Content-Type": "application/json" },
  104 |         credentials: "include",
  105 |         body: JSON.stringify({ nodes: [node] }),
  106 |       });
  107 |       const text = await resp.text();
  108 |       console.log("Update graph 1 response:", text);
  109 |       return JSON.parse(text);
  110 |     } catch (e) {
  111 |       console.error("Error updating graph 1:", e);
  112 |       return null;
  113 |     }
  114 |   }, { graphId: graph1[0].id, node: newNodeA });
  115 | 
  116 |   console.log(`[7] Added node to Graph A: ${updatedGraph1?.nodes?.length} nodes`);
  117 |   expect(updatedGraph1).not.toBeNull();
  118 |   expect(updatedGraph1.nodes.length).toBe(1);
  119 | 
  120 |   // Test 5: Add node to Graph B
  121 |   const newNodeB = {
  122 |     id: `node-b-test-${Date.now()}`,
  123 |     type: "free-circle",
  124 |     position: { x: 200, y: 200 },
  125 |     data: { label: "Node B Test" },
  126 |   };
  127 | 
  128 |   const updatedGraph2 = await page.evaluate(async ({ graphId, node }) => {
  129 |     try {
  130 |       const resp = await fetch(`http://localhost:4410/api/v1/graphs/${graphId}`, {
  131 |         method: "PUT",
  132 |         headers: { "Content-Type": "application/json" },
  133 |         credentials: "include",
  134 |         body: JSON.stringify({ nodes: [node] }),
  135 |       });
  136 |       const text = await resp.text();
  137 |       console.log("Update graph 2 response:", text);
  138 |       return JSON.parse(text);
  139 |     } catch (e) {
  140 |       console.error("Error updating graph 2:", e);
  141 |       return null;
  142 |     }
  143 |   }, { graphId: graph2[0].id, node: newNodeB });
  144 | 
  145 |   console.log(`[8] Added node to Graph B: ${updatedGraph2?.nodes?.length} nodes`);
  146 |   expect(updatedGraph2).not.toBeNull();
  147 |   expect(updatedGraph2.nodes.length).toBe(1);
  148 | 
  149 |   // Test 6: Verify isolation - fetch both graphs again
  150 |   const graph1After = await page.evaluate(async (id) => {
  151 |     try {
  152 |       const resp = await fetch(`http://localhost:4410/api/v1/projects/${id}/diagrams`, { credentials: "include" });
  153 |       const text = await resp.text();
  154 |       console.log("Graph 1 after response:", text);
  155 |       return JSON.parse(text);
  156 |     } catch (e) {
  157 |       console.error("Error fetching graph 1 after:", e);
  158 |       return [];
  159 |     }
  160 |   }, project1.id);
  161 | 
  162 |   const graph2After = await page.evaluate(async (id) => {
  163 |     try {
  164 |       const resp = await fetch(`http://localhost:4410/api/v1/projects/${id}/diagrams`, { credentials: "include" });
  165 |       const text = await resp.text();
  166 |       console.log("Graph 2 after response:", text);
  167 |       return JSON.parse(text);
  168 |     } catch (e) {
  169 |       console.error("Error fetching graph 2 after:", e);
  170 |       return [];
  171 |     }
  172 |   }, project2.id);
  173 | 
  174 |   console.log(`[9] Graph A after edits: ${graph1After[0].nodes.length} nodes`);
  175 |   console.log(`[10] Graph B after edits: ${graph2After[0].nodes.length} nodes`);
  176 | 
  177 |   // Test 7: VERIFY ISOLATION
  178 |   expect(graph1After).toBeTruthy();
  179 |   expect(graph2After).toBeTruthy();
  180 |   expect(Array.isArray(graph1After)).toBe(true);
  181 |   expect(Array.isArray(graph2After)).toBe(true);
  182 |   expect(graph1After.length).toBe(1);
  183 |   expect(graph2After.length).toBe(1);
```