import assert from "node:assert/strict";
import test from "node:test";
import { parseImportPayload, toArchitectureMarkdown, toExportPayload } from "./export.ts";

test("export roundtrip preserves nodes and edges", () => {
  const nodes = [
    {
      id: "n1",
      type: "arch",
      position: { x: 10, y: 20 },
      data: {
        kind: "backend" as const,
        label: "FastAPI",
        catalogId: "be-fastapi",
        tech: "FastAPI",
        config: { framework: "FastAPI" },
      },
    },
  ];
  const edges = [{ id: "e1", source: "n1", target: "n1" }];
  const exported = toExportPayload("Demo", nodes, edges, null);
  const parsed = parseImportPayload(JSON.parse(JSON.stringify(exported)));
  assert.equal(parsed.name, "Demo");
  assert.equal(parsed.nodes.length, 1);
  assert.equal(parsed.edges.length, 1);
});

test("parseImportPayload rejects unknown format", () => {
  assert.throws(() => parseImportPayload({ format: "other" }), /não é um export/);
});

test("toArchitectureMarkdown includes components, edges and NFRs", () => {
  const nodes = [
    {
      id: "b1",
      type: "block",
      position: { x: 0, y: 0 },
      data: {
        kind: "block" as const,
        label: "Backend",
        domain: "backend" as const,
        description: "APIs",
      },
    },
    {
      id: "n1",
      type: "arch",
      position: { x: 40, y: 40 },
      parentId: "b1",
      data: {
        kind: "backend" as const,
        label: "FastAPI",
        catalogId: "be-fastapi",
        tech: "FastAPI",
        config: {},
      },
    },
    {
      id: "n2",
      type: "arch",
      position: { x: 200, y: 40 },
      data: {
        kind: "database" as const,
        label: "Postgres",
        catalogId: "db-pg",
        tech: "PostgreSQL",
        config: {},
      },
    },
  ];
  const edges = [{ id: "e1", source: "n1", target: "n2" }];
  const nfr = {
    users_per_day: 1000,
    budget_usd_month: null,
    availability_pct: null,
    latency_p99_ms: null,
    compliance: ["LGPD"],
    team_size: null,
    deadline_weeks: null,
    environments: {
      has_dev: true,
      has_staging: false,
      has_prod: false,
      has_ci_cd: false,
      has_backups: false,
      has_monitoring_plan: false,
    },
  };
  const md = toArchitectureMarkdown("Loja", nodes, edges, {
    context: "Checkout B2C",
    nfr,
    exportedAt: "2026-08-10T12:00:00.000Z",
  });
  assert.match(md, /^# Loja/m);
  assert.match(md, /## Contexto/);
  assert.match(md, /Checkout B2C/);
  assert.match(md, /## NFRs/);
  assert.match(md, /LGPD/);
  assert.match(md, /## Componentes/);
  assert.match(md, /FastAPI/);
  assert.match(md, /Postgres/);
  assert.match(md, /## Conexões/);
  assert.match(md, /FastAPI → Postgres/);
});
