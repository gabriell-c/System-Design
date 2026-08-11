import assert from "node:assert/strict";
import test from "node:test";

const BLOCK_DEFAULT_SIZE = { width: 420, height: 280 };

function absolutePosition(node, nodes) {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;
  while (parentId) {
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

function nestInsideBlock(node, block, nodes) {
  const abs = absolutePosition(node, nodes);
  const blockAbs = absolutePosition(block, nodes);
  return {
    ...node,
    parentId: block.id,
    extent: "parent",
    position: {
      x: Math.max(16, abs.x - blockAbs.x),
      y: Math.max(48, abs.y - blockAbs.y),
    },
  };
}

function detachFromParent(node, nodes) {
  if (!node.parentId) return node;
  const abs = absolutePosition(node, nodes);
  return { ...node, position: abs, parentId: undefined, extent: undefined };
}

function findBlockAtPoint(nodes, point) {
  for (const block of [...nodes].reverse()) {
    if (block.type !== "block") continue;
    const abs = absolutePosition(block, nodes);
    const width = Number(block.style?.width ?? BLOCK_DEFAULT_SIZE.width);
    const height = Number(block.style?.height ?? BLOCK_DEFAULT_SIZE.height);
    if (point.x >= abs.x && point.x <= abs.x + width && point.y >= abs.y && point.y <= abs.y + height) {
      return block;
    }
  }
  return null;
}

test("nest and detach keep absolute placement", () => {
  const block = {
    id: "block-1",
    type: "block",
    position: { x: 100, y: 50 },
    style: { ...BLOCK_DEFAULT_SIZE },
    data: { kind: "block", domain: "frontend", label: "Bloco Frontend" },
  };
  const card = {
    id: "n1",
    type: "arch",
    position: { x: 160, y: 120 },
    data: { kind: "frontend", label: "React" },
  };
  const nested = nestInsideBlock(card, block, [block, card]);
  assert.equal(nested.parentId, "block-1");
  assert.equal(nested.position.x, 60);
  assert.equal(nested.position.y, 70);

  const detached = detachFromParent(nested, [block, nested]);
  assert.equal(detached.parentId, undefined);
  assert.equal(detached.position.x, 160);
  assert.equal(detached.position.y, 120);
});

test("findBlockAtPoint detects hit inside block bounds", () => {
  const block = {
    id: "block-1",
    type: "block",
    position: { x: 0, y: 0 },
    style: { ...BLOCK_DEFAULT_SIZE },
    data: { kind: "block", domain: "backend", label: "Back" },
  };
  assert.equal(findBlockAtPoint([block], { x: 40, y: 40 })?.id, "block-1");
  assert.equal(findBlockAtPoint([block], { x: 900, y: 900 }), null);
});

function canNestCardInBlock(cardKind, blockDomain) {
  return cardKind === blockDomain;
}

function nestDeniedMessage(cardLabel, cardKind, blockLabel, blockDomain) {
  const labels = { frontend: "Frontend", backend: "Backend", database: "Banco", cloud: "Infra" };
  return `${cardLabel} é ${labels[cardKind]} e não pode entrar em “${blockLabel}” (${labels[blockDomain]}). Use um bloco ${labels[cardKind]}.`;
}

test("domain rule allows same kind", () => {
  assert.equal(canNestCardInBlock("frontend", "frontend"), true);
  assert.equal(canNestCardInBlock("backend", "backend"), true);
});

test("domain rule denies backend card in frontend block", () => {
  assert.equal(canNestCardInBlock("backend", "frontend"), false);
  const msg = nestDeniedMessage("FastAPI", "backend", "Bloco Frontend", "frontend");
  assert.match(msg, /FastAPI/);
  assert.match(msg, /Backend/);
  assert.match(msg, /Frontend/);
});
