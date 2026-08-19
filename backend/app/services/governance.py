"""P0.4.1 / P0.4.3 — Governança: ADRs persistidos e matriz RACI."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_ROLES = ("Accountable", "Responsible", "Consulted", "Informed")


def build_raci_matrix(
    nodes: list[dict[str, Any]],
    owner_team: str | None = None,
) -> dict[str, Any]:
    """Gera RACI a partir de blocos/zonas e owner_team do grafo."""
    rows: list[dict[str, Any]] = []
    team = owner_team or "platform-team"

    for node in nodes:
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        kind = data.get("kind")
        label = str(data.get("label") or node.get("id") or "Component")
        if kind == "block":
            rows.append(
                {
                    "component": label,
                    "accountable": team,
                    "responsible": f"{team}-dev",
                    "consulted": "security-team",
                    "informed": "product",
                }
            )
        elif kind == "zone" and data.get("zoneKind") in ("vpc", "region", "security_boundary"):
            rows.append(
                {
                    "component": f"Zona · {label}",
                    "accountable": "infra-lead",
                    "responsible": team,
                    "consulted": "network-team",
                    "informed": "all-squads",
                }
            )
        elif kind not in ("zone", "swimlane", "note", "cidr", "tenant_boundary") and data.get("catalogId"):
            rows.append(
                {
                    "component": label,
                    "accountable": team,
                    "responsible": f"{team}-oncall",
                    "consulted": "architect",
                    "informed": "stakeholders",
                }
            )

    if not rows:
        rows.append(
            {
                "component": "Pacote de arquitetura",
                "accountable": team,
                "responsible": team,
                "consulted": "security-team",
                "informed": "leadership",
            }
        )

    return {"roles": list(DEFAULT_ROLES), "rows": rows[:40]}


def _slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:60] or "adr"


def persist_adrs_markdown(project_id: str, adrs: list[dict[str, Any]], base_dir: Path | None = None) -> list[str]:
    """Grava ADRs em docs/adr/{project_id}/."""
    root = base_dir or Path(__file__).resolve().parents[3] / "docs" / "adr"
    target = root / project_id
    target.mkdir(parents=True, exist_ok=True)
    written: list[str] = []
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    for adr in adrs:
        adr_id = str(adr.get("id") or "ADR-000")
        title = str(adr.get("title") or "Decisão")
        fname = f"{adr_id.lower().replace(' ', '-')}-{_slug(title)}.md"
        path = target / fname
        consequences = adr.get("consequences") or []
        if isinstance(consequences, list):
            cons_lines = "\n".join(f"- {c}" for c in consequences)
        else:
            cons_lines = str(consequences)
        body = f"""# {adr_id}: {title}

Status: {adr.get('status', 'proposed')}
Date: {now}

## Contexto

{adr.get('context', '')}

## Decisão

{adr.get('decision', '')}

## Consequências

{cons_lines}
"""
        path.write_text(body, encoding="utf-8")
        written.append(str(path.relative_to(root.parent.parent)))

    return written
