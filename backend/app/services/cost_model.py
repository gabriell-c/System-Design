"""P0.5.7 — Custo mensal estimado por serviço/região.

Tabela estática — ordem de grandeza, não orçamento: os valores vêm
SOMENTE de `knowledge.COST_USD_MONTH` (revisão 2025, list price de entrada);
o mapeamento catálogo→chave vive em `pricing.CATALOG_COST_KEY` (R1).
Sem `tier`/`by_tier` (R2/R3: tier real seria 2ª classe de preço por
serviço — fora de escopo). Nó fora do mapa (custom) → custo 0 +
`priced: false` (R4). Região: zona ancestor (`region`/`dr_region`) →
`config.region` → `"Não definida"` (R6), com `parent_map` construído 1×
(O(n), não O(n²)).
"""

from __future__ import annotations

from typing import Any

from app.services.knowledge import COST_USD_MONTH
from app.services.pricing import CATALOG_COST_KEY, PRICE_TABLE_VERSION

REGION_UNDEFINED = "Não definida"


def _node_data(node: dict) -> dict[str, Any]:
    data = node.get("data") or {}
    return data if isinstance(data, dict) else {}


def _build_parent_map(nodes: list[dict]) -> dict[str, str]:
    """id → parentId (uma vez por chamada — R6/O(n))."""
    return {str(n.get("id")): str(n.get("parentId") or "") for n in nodes}


def _region_for_node(node: dict, parent_map: dict[str, str], node_index: dict[str, dict]) -> str:
    """Sobe até zona region/dr_region (label); senão config.region; senão 'Não definida'."""
    current = parent_map.get(str(node.get("id")), "")
    while current:
        parent = node_index.get(current)
        if parent is None:
            break
        data = _node_data(parent)
        if data.get("kind") == "zone" and data.get("zoneKind") in {"region", "dr_region"}:
            return str(data.get("label") or REGION_UNDEFINED)
        current = parent_map.get(current, "")
    config = _node_data(node).get("config") or {}
    return str(config.get("region") or REGION_UNDEFINED)


def _fmt_usd_ptbr(value: float) -> str:
    """1234.56 → '1.234,56' (milhar ponto, vírgula decimal, 2 casas)."""
    return f"{value:,.2f}".replace(",", "@").replace(".", ",").replace("@", ".")


def estimate_cost_breakdown(nodes: list[dict]) -> dict[str, Any]:
    """Custo mensal estimado por nó e região (tabela estática, ordem de grandeza).

    Contrato (a): devolve {line_items, total_usd_month, by_region, node_count,
    priced_count, price_table_version, summary}. `line_items` tem
    {node_id, label, catalog_id, region, cost_key, cost_usd_month (2 casas),
    priced}. `total_usd_month` = soma dos line_items ARREDONDADOS, e
    `by_region` (arredondado por chave) soma exatamente o total — sem drift
    de centavos.
    """
    parent_map = _build_parent_map(nodes)
    node_index = {str(n.get("id")): n for n in nodes}

    line_items: list[dict[str, Any]] = []
    by_region: dict[str, float] = {}

    for node in nodes:
        data = _node_data(node)
        if data.get("kind") in {"zone", "block"}:
            continue
        catalog_id = str(data.get("catalogId") or "")
        label = str(data.get("label") or node.get("id"))
        node_id = str(node.get("id"))
        region = _region_for_node(node, parent_map, node_index)

        cost_key = CATALOG_COST_KEY.get(catalog_id, "")
        priced = catalog_id in CATALOG_COST_KEY
        # Custos da tabela já têm ≤2 casas; arredonda p/ 2 e acumula o
        # valor ARREDONDADO por região → soma(by_region) == total (exato).
        cost_usd = round(COST_USD_MONTH[cost_key] if priced else 0.0, 2)

        line_items.append(
            {
                "node_id": node_id,
                "label": label,
                "catalog_id": catalog_id,
                "region": region,
                "cost_key": cost_key,
                "cost_usd_month": cost_usd,
                "priced": priced,
            }
        )
        by_region[region] = round(by_region.get(region, 0.0) + cost_usd, 2)

    total = round(sum(item["cost_usd_month"] for item in line_items), 2)
    priced_count = sum(1 for item in line_items if item["priced"])

    summary = (
        f"Estimativa: US$ {_fmt_usd_ptbr(total)}/mês em {len(line_items)} "
        f"serviços ({len(by_region)} regiões)"
    )

    return {
        "line_items": line_items,
        "total_usd_month": total,
        "by_region": by_region,
        "node_count": len(line_items),
        "priced_count": priced_count,
        "price_table_version": PRICE_TABLE_VERSION,
        "summary": summary,
    }
