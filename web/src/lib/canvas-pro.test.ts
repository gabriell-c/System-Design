import assert from "node:assert/strict";
import test from "node:test";

function edgeTouchesHandle(edge, nodeId, handleId) {
  const srcMatch = edge.source === nodeId && (edge.sourceHandle ?? null) === handleId;
  const tgtMatch = edge.target === nodeId && (edge.targetHandle ?? null) === handleId;
  return srcMatch || tgtMatch;
}

function disconnectByHandle(edges, nodeId, handleId) {
  return edges.filter((e) => !edgeTouchesHandle(e, nodeId, handleId));
}

test("disconnectHandle removes only edges on that anchor", () => {
  const edges = [
    { id: "e1", source: "a", target: "b", sourceHandle: "right-out", targetHandle: "left-in" },
    { id: "e2", source: "a", target: "c", sourceHandle: "bottom-out", targetHandle: "top-in" },
    { id: "e3", source: "d", target: "a", sourceHandle: "right-out", targetHandle: "left-in" },
  ];
  const next = disconnectByHandle(edges, "a", "right-out");
  assert.deepEqual(
    next.map((e) => e.id),
    ["e2", "e3"],
  );
});

test("disconnectHandle on target side clears inbound association", () => {
  const edges = [
    { id: "e1", source: "a", target: "b", sourceHandle: "right-out", targetHandle: "left-in" },
  ];
  const next = disconnectByHandle(edges, "b", "left-in");
  assert.equal(next.length, 0);
});

test("history stack undo/redo order", () => {
  const past = [];
  const future = [];
  const push = (snap, current) => {
    past.push(current);
    future.length = 0;
    return snap;
  };
  let current = { n: 1 };
  current = push({ n: 2 }, current);
  current = push({ n: 3 }, current);
  assert.equal(past.length, 2);
  // undo
  future.unshift(current);
  current = past.pop();
  assert.equal(current.n, 2);
  assert.equal(future[0].n, 3);
  // redo
  past.push(current);
  current = future.shift();
  assert.equal(current.n, 3);
});
