"""Server-side SVG renderer for live embeds (P3.2.2)."""

from __future__ import annotations

from typing import Any, Literal

NODE_WIDTH = 210
NODE_HEIGHT = 80

_COLORS: dict[str, dict[str, str]] = {
    "backend": {"bg": "#1e293b", "border": "#3b82f6", "text": "#e2e8f0"},
    "frontend": {"bg": "#1e293b", "border": "#8b5cf6", "text": "#e2e8f0"},
    "database": {"bg": "#1e293b", "border": "#10b981", "text": "#e2e8f0"},
    "cloud": {"bg": "#1e293b", "border": "#f59e0b", "text": "#e2e8f0"},
    "identity": {"bg": "#1e293b", "border": "#ef4444", "text": "#e2e8f0"},
    "observability": {"bg": "#1e293b", "border": "#06b6d4", "text": "#e2e8f0"},
    "integration": {"bg": "#1e293b", "border": "#a855f7", "text": "#e2e8f0"},
    "security": {"bg": "#1e293b", "border": "#f43f5e", "text": "#e2e8f0"},
    "deploy": {"bg": "#1e293b", "border": "#22c55e", "text": "#e2e8f0"},
    "zone": {"bg": "transparent", "border": "#475569", "text": "#94a3b8"},
}


def _esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _kind_of(node: dict[str, Any]) -> str:
    data = node.get("data") or {}
    if isinstance(data, dict):
        return str(data.get("kind") or "backend")
    return "backend"


def _label_of(node: dict[str, Any]) -> str:
    data = node.get("data") or {}
    if isinstance(data, dict):
        return str(data.get("label") or data.get("tech") or node.get("id") or "nó")
    return str(node.get("id") or "nó")


def _sub_of(node: dict[str, Any]) -> str:
    data = node.get("data") or {}
    if isinstance(data, dict):
        return str(data.get("tech") or data.get("kind") or "")
    return ""


def render_embed_svg(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    *,
    theme: Literal["light", "dark"] = "light",
    width: int = 1200,
    height: int = 800,
) -> str:
    is_light = theme == "light"
    if not nodes:
        bg = "#f8fafc" if is_light else "#0f172a"
        fg = "#64748b" if is_light else "#94a3b8"
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}">'
            f'<rect width="100%" height="100%" fill="{bg}"/>'
            f'<text x="50%" y="50%" text-anchor="middle" fill="{fg}" '
            f'font-family="system-ui,sans-serif" font-size="14">Diagrama vazio</text>'
            f"</svg>"
        )

    min_x = min(float(n.get("position", {}).get("x", 0)) for n in nodes)
    min_y = min(float(n.get("position", {}).get("y", 0)) for n in nodes)
    max_x = max(
        float(n.get("position", {}).get("x", 0)) + float(n.get("width") or NODE_WIDTH)
        for n in nodes
    )
    max_y = max(
        float(n.get("position", {}).get("y", 0)) + float(n.get("height") or NODE_HEIGHT)
        for n in nodes
    )
    padding = 40
    svg_w = max(width, int(max_x - min_x + padding * 2))
    svg_h = max(height, int(max_y - min_y + padding * 2))

    bg = "#f8fafc" if is_light else "#0f172a"
    edge_stroke = "#94a3b8" if is_light else "#475569"
    parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_w}" height="{svg_h}" '
        f'viewBox="0 0 {svg_w} {svg_h}">',
        f'<rect width="{svg_w}" height="{svg_h}" fill="{bg}"/>',
    ]

    by_id = {str(n.get("id")): n for n in nodes if n.get("id")}

    for edge in edges:
        source = by_id.get(str(edge.get("source")))
        target = by_id.get(str(edge.get("target")))
        if not source or not target:
            continue
        sx = float(source.get("position", {}).get("x", 0)) + NODE_WIDTH / 2 + padding - min_x
        sy = float(source.get("position", {}).get("y", 0)) + NODE_HEIGHT / 2 + padding - min_y
        tx = float(target.get("position", {}).get("x", 0)) + NODE_WIDTH / 2 + padding - min_x
        ty = float(target.get("position", {}).get("y", 0)) + NODE_HEIGHT / 2 + padding - min_y
        parts.append(
            f'<line x1="{sx}" y1="{sy}" x2="{tx}" y2="{ty}" stroke="{edge_stroke}" '
            f'stroke-width="1.5" stroke-dasharray="4,2"/>'
        )

    for node in nodes:
        kind = _kind_of(node)
        colors = _COLORS.get(kind, _COLORS["backend"])
        x = float(node.get("position", {}).get("x", 0)) + padding - min_x
        y = float(node.get("position", {}).get("y", 0)) + padding - min_y
        w = float(node.get("width") or NODE_WIDTH)
        h = float(node.get("height") or NODE_HEIGHT)
        fill = "#ffffff" if is_light and colors["bg"] == "#1e293b" else colors["bg"]
        label_fill = "#1e293b" if is_light else "#f1f5f9"
        sub_fill = "#64748b" if is_light else "#94a3b8"
        label = _esc(_label_of(node))
        sub = _esc(_sub_of(node))
        parts.append(f'<g transform="translate({x}, {y})">')
        parts.append(
            f'<rect width="{w}" height="{h}" rx="8" fill="{fill}" '
            f'stroke="{colors["border"]}" stroke-width="1.5"/>'
        )
        parts.append(
            f'<circle cx="24" cy="{h / 2}" r="12" fill="{colors["border"]}" fill-opacity="0.2"/>'
        )
        parts.append(
            f'<text x="48" y="{h / 2 - 6}" fill="{label_fill}" font-size="12" '
            f'font-weight="600" font-family="system-ui,sans-serif">{label}</text>'
        )
        if sub:
            parts.append(
                f'<text x="48" y="{h / 2 + 10}" fill="{sub_fill}" font-size="10" '
                f'font-family="system-ui,sans-serif">{sub}</text>'
            )
        parts.append("</g>")

    parts.append("</svg>")
    return "".join(parts)
