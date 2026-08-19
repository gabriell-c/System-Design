"""P3.3.4 — Wiki viva: Markdown com âncoras estáveis e links para nós."""

from __future__ import annotations

import re
from typing import Any


def _slug(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"[\s_]+", "-", s)
    return s[:64] or "section"


def _node_data(node: dict) -> dict[str, Any]:
    data = node.get("data") or {}
    return data if isinstance(data, dict) else {}


def build_live_doc(
    name: str,
    nodes: list[dict],
    edges: list[dict],
    *,
    context: str = "",
    nfr: dict | None = None,
) -> dict[str, Any]:
    """Gera Markdown com âncoras estáveis (#node-{id})."""
    nfr = nfr or {}
    lines: list[str] = [
        f"# {name or 'Arquitetura'}",
        "",
        "<!-- archia-live-doc -->",
        "",
        "## Índice",
        "",
        "- [Contexto](#contexto)",
        "- [Componentes](#componentes)",
        "- [Fluxos](#fluxos)",
        "- [NFRs](#nfrs)",
        "",
        "## Contexto {#contexto}",
        "",
        context.strip() or "_Sem contexto declarado._",
        "",
        "## Componentes {#componentes}",
        "",
    ]

    anchors: dict[str, str] = {}
    for node in nodes:
        data = _node_data(node)
        if data.get("kind") in {"zone", "block"}:
            continue
        nid = str(node.get("id"))
        label = str(data.get("label") or nid)
        anchor = f"node-{nid}"
        anchors[nid] = anchor
        kind = data.get("kind", "service")
        tech = data.get("tech", "")
        lines.append(f"### {label} {{#{anchor}}}")
        lines.append("")
        lines.append(f"- **ID:** `{nid}`")
        lines.append(f"- **Tipo:** {kind}")
        if tech:
            lines.append(f"- **Tech:** {tech}")
        if data.get("catalogId"):
            lines.append(f"- **Catálogo:** `{data['catalogId']}`")
        if data.get("owner_team"):
            lines.append(f"- **Owner:** {data['owner_team']}")
        lines.append("")

    lines.extend(["## Fluxos {#fluxos}", ""])
    for edge in edges:
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        data = edge.get("data") or {}
        src_anchor = anchors.get(src, _slug(src))
        tgt_anchor = anchors.get(tgt, _slug(tgt))
        label = data.get("label") or data.get("flowKind") or "fluxo"
        eid = str(edge.get("id") or "")
        lines.append(
            f"- [{label}](#edge-{eid}): "
            f"[{src}](#{src_anchor}) → [{tgt}](#{tgt_anchor})"
            + (f" `{data.get('protocol')}`" if data.get("protocol") else "")
        )
    lines.append("")

    lines.extend(["## NFRs {#nfrs}", ""])
    if nfr.get("users_per_day"):
        lines.append(f"- Usuários/dia: {nfr['users_per_day']}")
    avail = nfr.get("slo_availability_pct") or nfr.get("availability_pct")
    if avail:
        lines.append(f"- Disponibilidade: {avail}%")
    if nfr.get("compliance"):
        lines.append(f"- Compliance: {', '.join(nfr['compliance'])}")
    if len(lines) <= lines.index("## NFRs {#nfrs}") + 2:
        lines.append("_NFRs não preenchidos._")
    lines.append("")

    markdown = "\n".join(lines)
    return {
        "markdown": markdown,
        "anchors": anchors,
        "updated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    }
