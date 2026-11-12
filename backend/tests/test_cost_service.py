"""Testes do núcleo de modelagem de custo (R1/R2/R4/R6/R7 do PLAN).

Cobre: pricing (mapa catálogo → chave), cost_model (região R6, totais sem
drift, summary pt-BR, exclusão zone/block), knowledge (tabela), e o fix
falsy-0 de heuristic (R7).
"""

from __future__ import annotations

import inspect

from app.services import cost_model
from app.services.cost_model import estimate_cost_breakdown
from app.services.heuristic import estimate_monthly_cost
from app.services.knowledge import COST_USD_MONTH
from app.services.pricing import CATALOG_COST_KEY, PRICE_TABLE_VERSION


# ---------------------------------------------------------------------------
# Fixtures de grafo
# ---------------------------------------------------------------------------

def _zone(zone_id: str, zone_kind: str, label: str) -> dict:
    return {"id": zone_id, "data": {"kind": "zone", "zoneKind": zone_kind, "label": label}}


def _node(
    node_id: str,
    catalog_id: str = "",
    label: str | None = None,
    parent_id: str | None = None,
    config: dict | None = None,
) -> dict:
    data: dict = {"kind": "backend", "label": label or catalog_id}
    if catalog_id:
        data["catalogId"] = catalog_id
    if config is not None:
        data["config"] = config
    node: dict = {"id": node_id, "data": data}
    if parent_id is not None:
        node["parentId"] = parent_id
    return node


# ---------------------------------------------------------------------------
# Região (R6)
# ---------------------------------------------------------------------------

def test_region_nested_region_zone():
    """R6: sobe até zona region/dr_region → label; vpc intermediário não conta."""
    nodes = [
        _zone("r1", "region", "sa-east-1"),
        {"id": "v1", "data": {"kind": "zone", "zoneKind": "vpc", "label": "vpc-a"}, "parentId": "r1"},
        _node("n1", "cloud-aws-ec2", parent_id="v1"),
    ]
    result = estimate_cost_breakdown(nodes)
    assert result["line_items"][0]["region"] == "sa-east-1"


def test_region_dr_zone():
    """R6: zona dr_region também vale como região."""
    nodes = [
        _zone("dr1", "dr_region", "us-west-2"),
        _node("n1", "cloud-aws-ec2", parent_id="dr1"),
    ]
    result = estimate_cost_breakdown(nodes)
    assert result["line_items"][0]["region"] == "us-west-2"


def test_region_from_config_when_no_zone():
    """R6: sem zona ancestor → config.region."""
    nodes = [_node("n1", "cloud-aws-ec2", config={"region": "eu-west-1"})]
    result = estimate_cost_breakdown(nodes)
    assert result["line_items"][0]["region"] == "eu-west-1"


def test_region_undefined():
    """R6: nem zona nem config.region → 'Não definida' (fim do 'default' mágico)."""
    nodes = [_node("n1", "cloud-aws-ec2")]
    result = estimate_cost_breakdown(nodes)
    assert result["line_items"][0]["region"] == "Não definida"


# ---------------------------------------------------------------------------
# Preço (R4): mapa de catálogo, custom → priced False, zero → priced True
# ---------------------------------------------------------------------------

def test_aws_ids_keep_existing_values():
    """Itens já precificados mantêm valor: EC2 30, ALB 22, RDS micro 13, K8s 73."""
    nodes = [
        _node("a", "cloud-aws-ec2"),
        _node("b", "cloud-aws-alb"),
        _node("c", "db-postgres"),
        _node("d", "dep-k8s"),
    ]
    result = estimate_cost_breakdown(nodes)
    by_id = {li["node_id"]: li for li in result["line_items"]}
    assert by_id["a"]["cost_usd_month"] == 30.0 and by_id["a"]["cost_key"] == "EC2:t3.medium"
    assert by_id["b"]["cost_usd_month"] == 22.0
    assert by_id["c"]["cost_usd_month"] == 13.0 and by_id["c"]["cost_key"] == "RDS:db.t3.micro"
    assert by_id["d"]["cost_usd_month"] == 73.0 and by_id["d"]["cost_key"] == "Kubernetes:managed"


def test_lambda_uses_table_key_not_magic():
    """R7: cloud-aws-lambda sai do 8.0 mágico → chave 'Lambda:small-project'."""
    nodes = [_node("l", "cloud-aws-lambda")]
    result = estimate_cost_breakdown(nodes)
    item = result["line_items"][0]
    assert item["cost_key"] == "Lambda:small-project"
    assert item["cost_usd_month"] == 8.0
    assert item["priced"] is True


def test_multicloud_priced_via_keys():
    """R4/cobertura multi-cloud: GCP/Azure entram precificados, não custom."""
    nodes = [
        _node("g", "mc-gcp-cloudsql"),
        _node("z", "mc-azure-mysql"),
        _node("c", "mc-azure-containerapps"),
        _node("f", "mc-gcp-firestore"),
    ]
    result = estimate_cost_breakdown(nodes)
    by_id = {li["node_id"]: li for li in result["line_items"]}
    assert by_id["g"]["cost_key"] == "GCP:Cloud SQL small" and by_id["g"]["cost_usd_month"] == 15.0
    assert by_id["z"]["cost_key"] == "Azure:MySQL small" and by_id["z"]["cost_usd_month"] == 15.0
    assert by_id["c"]["cost_key"] == "Azure:Container Apps" and by_id["c"]["cost_usd_month"] == 15.0
    assert by_id["f"]["cost_key"] == "GCP Firestore" and by_id["f"]["cost_usd_month"] == 10.0
    assert all(li["priced"] for li in result["line_items"])


def test_framework_zero_cost_priced():
    """R4: framework/linguagem/padrão → custo 0 conhecido ('code'), priced=True."""
    nodes = [_node("f", "fe-react"), _node("p", "pat-circuit-breaker"), _node("l", "lang-python")]
    result = estimate_cost_breakdown(nodes)
    for item in result["line_items"]:
        assert item["cost_key"] == "code"
        assert item["cost_usd_month"] == 0.0
        assert item["priced"] is True
    assert result["priced_count"] == 3


def test_custom_node_unpriced():
    """R4: nó custom (sem catalogId ou id desconhecido) → custo 0, priced=False."""
    nodes = [
        _node("x", ""),  # sem catalogId
        _node("y", "ghost-custom-999"),  # id fora do catálogo
    ]
    result = estimate_cost_breakdown(nodes)
    for item in result["line_items"]:
        assert item["cost_usd_month"] == 0.0
        assert item["priced"] is False
        assert item["cost_key"] == ""
    assert result["priced_count"] == 0
    assert result["total_usd_month"] == 0.0


# ---------------------------------------------------------------------------
# Shape de contrato (a): chaves exatas, sem tier/by_tier/heuristic_total
# ---------------------------------------------------------------------------

def test_contract_shape_exact():
    nodes = [_node("a", "cloud-aws-ec2"), _node("b", "")]
    result = estimate_cost_breakdown(nodes)
    assert set(result.keys()) == {
        "line_items",
        "total_usd_month",
        "by_region",
        "node_count",
        "priced_count",
        "price_table_version",
        "summary",
    }
    for item in result["line_items"]:
        assert set(item.keys()) == {
            "node_id",
            "label",
            "catalog_id",
            "region",
            "cost_key",
            "cost_usd_month",
            "priced",
        }
    assert "tier" not in result and "by_tier" not in result
    assert "heuristic_total_usd_month" not in result
    assert result["price_table_version"] == PRICE_TABLE_VERSION == "2025-static-v1"
    assert result["node_count"] == 2 and result["priced_count"] == 1
    # R1/contrato (a): parâmetro `edges` REMOVIDO.
    assert "edges" not in inspect.signature(estimate_cost_breakdown).parameters


def test_priced_and_node_counts():
    nodes = [
        _node("a", "cloud-aws-ec2"),
        _node("b", "db-postgres"),
        _node("c", ""),
        _node("d", "fe-react"),  # priced (custo zero conhecido)
    ]
    result = estimate_cost_breakdown(nodes)
    assert result["node_count"] == 4
    assert result["priced_count"] == 3


# ---------------------------------------------------------------------------
# Totais: por precisão, sem drift de centavos; summary pt-BR
# ---------------------------------------------------------------------------

def test_by_region_exact_no_cents_drift():
    """Drift de centavos: soma dos line_items == total == soma(by_region)."""
    nodes = [
        _node("a", "cloud-aws-ec2", parent_id="r1"),  # 30.0
        _node("b", "db-postgres", parent_id="r1"),     # 13.0
        _node("c", "cloud-aws-s3", parent_id="r1"),     # 1.2
        _node("d", "cloud-aws-alb", parent_id="r2"),    # 22.0
        _node("e", "cloud-aws-cf", parent_id="r2"),     # 4.3
        _node("f", "cloud-aws-lambda", parent_id="r2"), # 8.0
        _zone("r1", "region", "us-east-1"),
        _zone("r2", "dr_region", "us-west-1"),
    ]
    result = estimate_cost_breakdown(nodes)
    line_sum = round(sum(li["cost_usd_month"] for li in result["line_items"]), 2)
    assert line_sum == result["total_usd_month"]
    assert round(sum(result["by_region"].values()), 2) == result["total_usd_month"]
    assert result["by_region"] == {"us-east-1": 44.2, "us-west-1": 34.3}
    assert result["total_usd_month"] == 78.5


def test_summary_ptbr_format():
    """2 casas, milhar ponto, vírgula decimal — 'Estimativa: US$ 1.234,56/mês em N serviços (M regiões)'."""
    from app.services.cost_model import _fmt_usd_ptbr

    assert _fmt_usd_ptbr(0.5) == "0,50"
    assert _fmt_usd_ptbr(1234.56) == "1.234,56"
    assert _fmt_usd_ptbr(78.5) == "78,50"

    nodes = [
        _node("a", "db-redshift", parent_id="r1"),   # 250
        _node("b", "net-aws-dx", parent_id="r1"),     # 300
        _node("c", "net-aws-privatelink", parent_id="r2"),  # 180
        _zone("r1", "region", "us-east-1"),
        _zone("r2", "dr_region", "us-west-1"),
    ]
    result = estimate_cost_breakdown(nodes)
    assert result["total_usd_month"] == 730.0
    assert result["summary"] == "Estimativa: US$ 730,00/mês em 3 serviços (2 regiões)"


def test_empty_graph_total_zero():
    """Grafo vazio → total 0 (e summary coerente)."""
    result = estimate_cost_breakdown([])
    assert result["line_items"] == []
    assert result["total_usd_month"] == 0.0
    assert result["by_region"] == {}
    assert result["node_count"] == 0
    assert result["priced_count"] == 0
    assert result["summary"] == "Estimativa: US$ 0,00/mês em 0 serviços (0 regiões)"


# ---------------------------------------------------------------------------
# Exclusão zone/block
# ---------------------------------------------------------------------------

def test_zone_and_block_excluded():
    nodes = [
        _zone("r1", "region", "us-east-1"),
        {"id": "b1", "data": {"kind": "block", "label": "Bloco"}},
        _node("n1", "cloud-aws-ec2", parent_id="r1"),
    ]
    result = estimate_cost_breakdown(nodes)
    ids = [li["node_id"] for li in result["line_items"]]
    assert "r1" not in ids and "b1" not in ids
    assert result["node_count"] == 1


# ---------------------------------------------------------------------------
# O(n): parent_map construído 1× por chamada (R6)
# ---------------------------------------------------------------------------

def test_parent_map_built_once(monkeypatch):
    """R6/O(n): _build_parent_map roda UMA vez — não por nó (era O(n²).)"""
    calls: list[int] = []

    def counting_builder(nodes):
        calls.append(1)
        return {str(n.get("id")): str(n.get("parentId") or "") for n in nodes}

    monkeypatch.setattr(cost_model, "_build_parent_map", counting_builder)
    nodes = [_zone("r1", "region", "us-east-1")] + [
        _node(f"n{i}", "cloud-aws-ec2", parent_id="r1") for i in range(50)
    ]
    estimate_cost_breakdown(nodes)
    assert len(calls) == 1


# ---------------------------------------------------------------------------
# R7: fix do falsy-0 em heuristic.estimate_monthly_cost
# ---------------------------------------------------------------------------

def test_heuristic_zero_graph_costs_zero():
    """R7: `cost or 12.0` morre — sem nada precificável, custo é 0, não 12."""
    assert estimate_monthly_cost([]) == 0.0
    # Grafo com techs fora da tabela de heurística → também 0 (antes: 12.0).
    nodes = [{"id": "x", "data": {"kind": "backend", "tech": "TotallyUnknown"}}]
    assert estimate_monthly_cost(nodes) == 0.0


def test_heuristic_lambda_uses_table_key():
    """R7: lambda some a chave de tabela (8.0), não literal solto."""
    nodes = [{"id": "l", "data": {"kind": "cloud", "tech": "Lambda"}}]
    assert estimate_monthly_cost(nodes) == COST_USD_MONTH["Lambda:small-project"] == 8.0


# ---------------------------------------------------------------------------
# Integridade do mapa (cobertura total do catálogo + chaves válidas)
# ---------------------------------------------------------------------------

def test_map_covers_all_catalog_ids():
    """Todo id dos 4 catálogos (160 base + 38 mc + 20 rede + 32 padrões = 250) está no map.
    Se este count quebrar, o catálogo mudou → re-sincronizar pricing."""
    assert len(CATALOG_COST_KEY) == 250
    assert len([k for k in CATALOG_COST_KEY if k.startswith("mc-")]) == 38
    assert len([k for k in CATALOG_COST_KEY if k.startswith("pat-")]) == 32
    assert len([k for k in CATALOG_COST_KEY if k.startswith("net-")]) == 15
    assert len([k for k in CATALOG_COST_KEY if k.startswith("sec-")]) == 13


def test_map_keys_all_exist_in_cost_table():
    """Toda chave do map precisa existir em COST_USD_MONTH (fonte única R1)."""
    missing = [k for k in CATALOG_COST_KEY.values() if k not in COST_USD_MONTH]
    assert missing == []


def test_free_network_security_items_are_zero_key():
    """NACL/prefix list/IAM/encryption settings são grátis → chave 'code' (0.0)."""
    for item in ("net-nacl", "net-prefix", "sec-iam-role", "sec-iam-policy", "sec-encryption", "sec-config"):
        assert CATALOG_COST_KEY[item] == "code"
