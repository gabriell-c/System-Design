import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

register(new URL("../../test/ts-ext-hooks.mjs", import.meta.url));

import type { Edge, Node } from "@xyflow/react";
import type { CanvasNodeData } from "./types";

/** Fixture única: 2 nodes arch + 1 aresta. */
function fixture(): { nodes: Node<CanvasNodeData>[]; edges: Edge[] } {
  const nodes = [
    {
      id: "n1",
      type: "arch",
      position: { x: 0, y: 0 },
      data: { kind: "arch", label: "API", catalogId: "api", tech: "FastAPI", config: {} },
    },
    {
      id: "n2",
      type: "arch",
      position: { x: 300, y: 0 },
      data: { kind: "arch", label: "DB", catalogId: "db", tech: "Postgres", config: {} },
    },
  ] as unknown as Node<CanvasNodeData>[];
  const edges = [
    { id: "e1", source: "n1", target: "n2", data: { label: "queries", protocol: "tcp" } },
  ] as unknown as Edge[];
  return { nodes, edges };
}

test("exportToMermaid: 2 nodes 1 edge (string-contains)", async () => {
  const { exportToMermaid } = await import("./export-mermaid");
  const out = exportToMermaid(fixture().nodes, fixture().edges);
  assert.ok(out.includes("flowchart TB"));
  assert.ok(out.includes('node_n1["API<br/><sub>FastAPI</sub>"]'));
  assert.ok(out.includes('node_n2["DB<br/><sub>Postgres</sub>"]'));
  assert.ok(out.includes('node_n1 --|tcp| node_n2 : "queries"'));
  assert.ok(out.includes("classDef critical"));
});

test("exportToPlantuml: 2 nodes 1 edge (string-contains)", async () => {
  const { exportToPlantuml } = await import("./export-plantuml");
  const out = exportToPlantuml(fixture().nodes, fixture().edges, "Meu Sistema");
  assert.ok(out.includes("@startuml Meu Sistema"));
  assert.ok(out.includes("[API\\n(FastAPI)] as node_n1"));
  assert.ok(out.includes("[DB\\n(Postgres)] as node_n2"));
  assert.ok(out.includes("node_n1 -> node_n2 : queries [tcp]"));
  assert.ok(out.includes("@enduml"));
});

test("exportToDrawio: 2 nodes 1 edge (string-contains)", async () => {
  const { exportToDrawio } = await import("./export-drawio");
  const out = exportToDrawio(fixture().nodes, fixture().edges);
  assert.ok(out.startsWith('<?xml version="1.0"'));
  assert.ok(out.includes("<mxGraphModel"));
  assert.ok(out.includes('id="node_n1"'));
  assert.ok(out.includes('id="node_n2"'));
  assert.ok(out.includes('id="edge_e1"'));
  assert.ok(out.includes('source="node_n1"'));
  assert.ok(out.includes('target="node_n2"'));
  assert.ok(out.includes('value="API'));
});

// ————— SVG — DOM mínimo (createElementNS + XMLSerializer) via shim —————

class SvgEl {
  private tag: string;
  attrs: Record<string, string> = {};
  children: SvgEl[] = [];
  text = "";
  constructor(tag: string) {
    this.tag = tag;
  }
  setAttribute(k: string, v: string) {
    this.attrs[k] = v;
  }
  appendChild(c: SvgEl) {
    this.children.push(c);
    return c;
  }
  get textContent() {
    return this.text;
  }
  set textContent(v: string) {
    this.text = v;
  }
  toXml(): string {
    const attrs = Object.entries(this.attrs)
      .map(([k, v]) => ` ${k}="${v}"`)
      .join("");
    if (this.children.length === 0) {
      return this.text !== "" ? `<${this.tag}${attrs}>${this.text}</${this.tag}>` : `<${this.tag}${attrs}/>`;
    }
    const inner = this.children.map((c) => c.toXml()).join("");
    return `<${this.tag}${attrs}>${inner}${this.text}</${this.tag}>`;
  }
}

function installDomShim() {
  const g = globalThis as Record<string, unknown>;
  g.document = {
    createElementNS: (_ns: string, tag: string) => new SvgEl(tag),
    createElement: (tag: string) => new SvgEl(tag),
  };
  g.XMLSerializer = class {
    serializeToString(el: SvgEl) {
      return el.toXml();
    }
  };
}

test("renderSvg: 2 nodes 1 edge (string-contains, DOM shim)", async () => {
  installDomShim();
  const { renderSvg } = await import("./export-svg");
  const out = renderSvg(fixture().nodes, fixture().edges, { title: "Meu Projeto" });
  assert.ok(out.startsWith("<svg"));
  assert.ok(out.includes('viewBox="0 0 1600 900"'));
  assert.ok(out.includes(">API</text>"));
  assert.ok(out.includes(">DB</text>"));
  assert.ok(out.includes(">ARCH</text>"));
  assert.ok(out.includes(">Meu Projeto</text>"));
});
