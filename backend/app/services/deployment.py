"""P2.3.2 — Separação de fluxos CI/CD dev vs user em diagramas."""

from __future__ import annotations

from typing import Any


def _node_data(node: dict[str, Any]) -> dict[str, Any]:
    data = node.get("data")
    return data if isinstance(data, dict) else {}


def _swimlane_kind(node: dict[str, Any]) -> str | None:
    data = _node_data(node)
    if data.get("kind") == "swimlane":
        return str(data.get("swimlaneKind") or "")
    return None


def _edge_data(edge: dict[str, Any]) -> dict[str, Any]:
    data = edge.get("data")
    return data if isinstance(data, dict) else {}


def analyze_deployment_flows(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> dict[str, Any]:
    """Classifica arestas e nós em fluxo dev (CI/CD) vs user (runtime)."""
    by_id = {str(n.get("id")): n for n in nodes if n.get("id")}

    dev_lane_ids = {nid for nid, n in by_id.items() if _swimlane_kind(n) == "dev_flow"}
    user_lane_ids = {nid for nid, n in by_id.items() if _swimlane_kind(n) == "user_flow"}

    dev_nodes: set[str] = set(dev_lane_ids)
    user_nodes: set[str] = set(user_lane_ids)

    for nid, node in by_id.items():
        parent = node.get("parentId")
        while parent:
            pid = str(parent)
            if pid in dev_lane_ids:
                dev_nodes.add(nid)
                break
            if pid in user_lane_ids:
                user_nodes.add(nid)
                break
            parent = by_id.get(pid, {}).get("parentId")
        label = str(_node_data(node).get("label") or "").lower()
        catalog = str(_node_data(node).get("catalogId") or "")
        if any(k in catalog for k in ("dep-", "int-github", "obs-jest")) or "jenkins" in label or "argocd" in label:
            dev_nodes.add(nid)
        if any(k in catalog for k in ("cloud-aws-cf", "cloud-aws-apigw", "cloud-aws-ecs", "db-postgres", "db-redis")):
            user_nodes.add(nid)

    dev_edges: list[dict[str, Any]] = []
    user_edges: list[dict[str, Any]] = []
    cross_edges: list[dict[str, Any]] = []

    for edge in edges:
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        ed = _edge_data(edge)
        entry = {
            "id": edge.get("id"),
            "source": src,
            "target": tgt,
            "flow_number": ed.get("flowNumber"),
            "label": ed.get("label"),
            "flow_kind": ed.get("flowKind"),
        }
        src_dev = src in dev_nodes
        tgt_dev = tgt in dev_nodes
        src_user = src in user_nodes
        tgt_user = tgt in user_nodes

        if src_dev and tgt_dev:
            dev_edges.append(entry)
        elif src_user and tgt_user:
            user_edges.append(entry)
        elif (src_dev and tgt_user) or (src_user and tgt_dev):
            cross_edges.append(entry)
        elif ed.get("flowKind") == "control":
            dev_edges.append(entry)
        else:
            user_edges.append(entry)

    gaps: list[dict[str, str]] = []
    if not dev_nodes and not dev_edges:
        gaps.append({"severity": "warning", "detail": "Nenhum nó/aresta identificado no fluxo Dev (CI/CD)."})
    if not user_nodes and not user_edges:
        gaps.append({"severity": "warning", "detail": "Nenhum nó/aresta identificado no fluxo User (runtime)."})
    if not cross_edges:
        gaps.append({"severity": "info", "detail": "Sem arestas cross-flow (ex.: rollout deploy → runtime)."})

    return {
        "ok": True,
        "dev_flow": {
            "node_count": len(dev_nodes),
            "edge_count": len(dev_edges),
            "edges": dev_edges,
        },
        "user_flow": {
            "node_count": len(user_nodes),
            "edge_count": len(user_edges),
            "edges": user_edges,
        },
        "cross_flow": {
            "edge_count": len(cross_edges),
            "edges": cross_edges,
        },
        "gaps": gaps,
    }
