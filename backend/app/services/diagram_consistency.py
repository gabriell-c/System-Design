"""P0.1.6 — Validação de consistência entre diagramas de um projeto."""

from __future__ import annotations

from typing import Any


def _stable_ref(node: dict[str, Any]) -> str:
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    return str(data.get("stableRef") or data.get("catalogId") or data.get("label") or node.get("id") or "").lower().strip()


def analyze_project_consistency(graphs: list[dict[str, Any]]) -> dict[str, Any]:
    """graphs: list of {id, name, diagram_kind, nodes}."""
    if len(graphs) < 2:
        return {"ok": True, "issues": [], "graph_count": len(graphs)}

    by_ref: dict[str, dict[str, Any]] = {}
    for g in graphs:
        gid = str(g.get("id"))
        gname = str(g.get("name") or gid)
        for node in g.get("nodes") or []:
            ref = _stable_ref(node)
            if not ref:
                continue
            entry = by_ref.setdefault(ref, {"label": (node.get("data") or {}).get("label", ref), "graphs": {}})
            entry["graphs"][gid] = gname

    all_ids = {str(g.get("id")) for g in graphs}
    issues: list[dict[str, Any]] = []

    for ref, entry in by_ref.items():
        present = set(entry["graphs"].keys())
        if present == all_ids:
            continue
        missing = all_ids - present
        issues.append(
            {
                "severity": "critical" if len(missing) >= len(all_ids) - 1 else "warning",
                "stable_ref": ref,
                "label": entry["label"],
                "present_in": list(entry["graphs"].values()),
                "missing_in": [str(next(g["name"] for g in graphs if str(g["id"]) == mid)) for mid in missing],
                "detail": f"Serviço «{entry['label']}» inconsistente entre vistas do pacote.",
            }
        )

    return {"ok": len(issues) == 0, "issues": issues, "graph_count": len(graphs)}
