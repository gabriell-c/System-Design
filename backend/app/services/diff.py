"""Diff semântico entre duas versões de grafo (nós/arestas)."""

from __future__ import annotations


def _nid(item: dict) -> str:
    return str(item.get("id") or "")


def _label(item: dict) -> str:
    data = item.get("data") if isinstance(item.get("data"), dict) else {}
    return str(data.get("label") or item.get("id") or "")


def _kind(item: dict) -> str:
    data = item.get("data") if isinstance(item.get("data"), dict) else {}
    return str(data.get("kind") or item.get("type") or "")


def semantic_diff(left_nodes: list[dict], left_edges: list[dict], right_nodes: list[dict], right_edges: list[dict]) -> dict:
    left_n = { _nid(n): n for n in left_nodes if _nid(n) }
    right_n = { _nid(n): n for n in right_nodes if _nid(n) }
    left_e = { _nid(e): e for e in left_edges if _nid(e) }
    right_e = { _nid(e): e for e in right_edges if _nid(e) }

    added_nodes = [
        {"id": nid, "label": _label(right_n[nid]), "kind": _kind(right_n[nid])}
        for nid in right_n.keys() - left_n.keys()
    ]
    removed_nodes = [
        {"id": nid, "label": _label(left_n[nid]), "kind": _kind(left_n[nid])}
        for nid in left_n.keys() - right_n.keys()
    ]
    changed_nodes = []
    for nid in left_n.keys() & right_n.keys():
        if left_n[nid].get("data") != right_n[nid].get("data") or left_n[nid].get("parentId") != right_n[nid].get(
            "parentId"
        ):
            changed_nodes.append(
                {
                    "id": nid,
                    "label": _label(right_n[nid]),
                    "kind": _kind(right_n[nid]),
                    "from_parent": left_n[nid].get("parentId"),
                    "to_parent": right_n[nid].get("parentId"),
                }
            )

    added_edges = [
        {
            "id": eid,
            "source": right_e[eid].get("source"),
            "target": right_e[eid].get("target"),
        }
        for eid in right_e.keys() - left_e.keys()
    ]
    removed_edges = [
        {
            "id": eid,
            "source": left_e[eid].get("source"),
            "target": left_e[eid].get("target"),
        }
        for eid in left_e.keys() - right_e.keys()
    ]

    return {
        "added_nodes": added_nodes,
        "removed_nodes": removed_nodes,
        "changed_nodes": changed_nodes,
        "added_edges": added_edges,
        "removed_edges": removed_edges,
        "summary": (
            f"+{len(added_nodes)} nós / -{len(removed_nodes)} nós / ~{len(changed_nodes)} alterados; "
            f"+{len(added_edges)} arestas / -{len(removed_edges)} arestas"
        ),
    }
