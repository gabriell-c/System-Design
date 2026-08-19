"""P1.1.7 — Data lineage from canvas edges and NFR metadata."""

from __future__ import annotations

from typing import Any


def _node_data(node: dict) -> dict:
    return node.get("data") or {}


def build_lineage(
    nodes: list[dict],
    edges: list[dict],
    nfr: dict | None = None,
) -> dict[str, Any]:
    """Compute data lineage edges from data-flow connections + NFR data_lineage."""
    nfr = nfr or {}
    id_to_label: dict[str, str] = {}
    for n in nodes:
        nid = str(n.get("id") or "")
        d = _node_data(n)
        id_to_label[nid] = str(d.get("label") or nid)

    lineage_edges: list[dict[str, str]] = []

    # From canvas: data-flow edges between database/backend/integration nodes
    data_kinds = {"database", "backend", "integration", "cloud"}
    for edge in edges:
        ed = edge.get("data") or {}
        flow = ed.get("flowKind") or ed.get("flow_kind") or "sync"
        if flow not in {"data", "async"} and ed.get("protocol") not in {"sql", "kafka", "s3"}:
            continue
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        src_node = next((n for n in nodes if str(n.get("id")) == src), None)
        tgt_node = next((n for n in nodes if str(n.get("id")) == tgt), None)
        if not src_node or not tgt_node:
            continue
        sk = _node_data(src_node).get("kind")
        tk = _node_data(tgt_node).get("kind")
        if sk in data_kinds or tk in data_kinds:
            lineage_edges.append(
                {
                    "source_id": src,
                    "source_label": id_to_label.get(src, src),
                    "target_id": tgt,
                    "target_label": id_to_label.get(tgt, tgt),
                    "transform": ed.get("label") or flow,
                    "frequency": "streaming" if flow == "async" else "batch",
                    "origin": "canvas",
                }
            )

    # From NFR explicit lineage
    for entry in nfr.get("data_lineage") or []:
        if not isinstance(entry, dict):
            continue
        lineage_edges.append(
            {
                "source_id": "",
                "source_label": str(entry.get("source_entity") or ""),
                "target_id": "",
                "target_label": str(entry.get("target_entity") or ""),
                "transform": str(entry.get("transform") or ""),
                "frequency": str(entry.get("frequency") or ""),
                "origin": "nfr",
            }
        )

    # Dedupe
    seen: set[tuple[str, str, str]] = set()
    unique: list[dict[str, str]] = []
    for le in lineage_edges:
        key = (le["source_label"], le["target_label"], le.get("transform", ""))
        if key in seen:
            continue
        seen.add(key)
        unique.append(le)

    entities = sorted(
        {le["source_label"] for le in unique if le["source_label"]}
        | {le["target_label"] for le in unique if le["target_label"]}
    )

    return {
        "lineage_edges": unique,
        "entities": entities,
        "edge_count": len(unique),
    }
