"""Testes do review scorecard (diagrama review-ready)."""

from __future__ import annotations

from app.schemas.graph import ProjectNfr
from app.services.architecture_heuristics import (
    build_review_scorecard,
    score_diagram_narrative,
    score_flow_continuity,
    score_placement,
)


def _edge(eid: str, src: str, tgt: str, **data):
    return {"id": eid, "source": src, "target": tgt, "data": data}


def _zone(zid: str, zone_kind: str, label: str, parent: str | None = None):
    n = {
        "id": zid,
        "data": {"kind": "zone", "zoneKind": zone_kind, "label": label},
    }
    if parent:
        n["parentId"] = parent
    return n


def _card(cid: str, kind: str, label: str, parent: str | None = None, **extra):
    n = {
        "id": cid,
        "data": {"kind": kind, "label": label, "tech": label, "catalogId": cid, **extra},
    }
    if parent:
        n["parentId"] = parent
    return n


def test_narrative_penalizes_missing_numbers():
    nodes = [_card("a", "backend", "API"), _card("b", "database", "DB")]
    edges = [_edge("e1", "a", "b", protocol="https")]
    score, gaps = score_diagram_narrative(nodes, edges)
    assert score < 7
    assert any("numeração" in g.lower() or "número" in g.lower() or "numera" in g.lower() for g in gaps)


def test_narrative_rewards_continuous_flow():
    nodes = [_card("a", "cloud", "GW"), _card("b", "backend", "API"), _card("c", "database", "DB")]
    edges = [
        _edge("e1", "a", "b", flowNumber=1, protocol="https", label="HTTPS"),
        _edge("e2", "b", "c", flowNumber=2, protocol="sql", label="SQL"),
        _edge("e3", "a", "b", flowNumber=3, protocol="https", label="retry"),
    ]
    score, _ = score_diagram_narrative(nodes, edges)
    assert score >= 7.5


def test_flow_continuity_flags_storage_to_storage():
    nodes = [
        _card("d", "database", "DynamoDB"),
        _card("s", "cloud", "S3", config={"service": "S3"}),
    ]
    edges = [_edge("e1", "d", "s", flowNumber=1, protocol="other")]
    score, gaps = score_flow_continuity(nodes, edges)
    assert score < 7
    assert any("storage" in g.lower() or "Dynamo" in g or "hop" in g.lower() for g in gaps)


def test_placement_flags_db_in_public_subnet():
    nodes = [
        _zone("z-pub", "subnet_public", "Public"),
        _card("db", "database", "Postgres", parent="z-pub"),
    ]
    score, gaps = score_placement(nodes)
    assert score < 7
    assert any("pública" in g.lower() or "public" in g.lower() for g in gaps)


def test_build_review_scorecard_senior_ish_graph():
    nodes = [
        _zone("z-edge", "plane", "Edge"),
        _zone("z-vpc", "vpc", "VPC"),
        _zone("z-priv", "subnet_private", "Private", parent="z-vpc"),
        _zone("z-aza", "availability_zone", "AZ-a", parent="z-vpc"),
        _zone("z-azb", "availability_zone", "AZ-b", parent="z-vpc"),
        _card("gw", "cloud", "API Gateway", parent="z-edge"),
        _card("api", "backend", "Lambda", parent="z-priv", config={"service": "Lambda"}),
        _card("db", "database", "DynamoDB", parent="z-priv"),
        _card("cw", "observability", "CloudWatch"),
    ]
    edges = [
        _edge("e1", "gw", "api", flowNumber=1, protocol="https", label="invoke", isCriticalPath=True, failureBehavior="retry"),
        _edge("e2", "api", "db", flowNumber=2, protocol="other", label="Dynamo", isCriticalPath=True, failureBehavior="retry"),
        _edge("e3", "api", "cw", flowNumber=3, protocol="https", label="metrics", flowKind="async"),
    ]
    nfr = ProjectNfr(
        users_per_day=10000,
        availability_pct=99.9,
        latency_p99_ms=300,
        arch_style="serverless",
        business_processes=["Autenticar", "Processar"],
        data_entities=["Session", "Record"],
        data_governance=["LGPD"],
        critical_path_edge_ids=["e1", "e2"],
        failure_modes=[
            {
                "component_id": "api",
                "mode": "timeout",
                "impact": "5xx",
                "mitigation": "retry",
            }
        ],
        environments={
            "has_dev": True,
            "has_staging": True,
            "has_prod": True,
            "has_ci_cd": True,
            "has_backups": True,
            "has_monitoring_plan": True,
        },
    )
    sc = build_review_scorecard(nodes, edges, nfr, trade_offs=[])
    assert sc.overall >= 6.5
    assert sc.narrative >= 7
    assert sc.views_completeness >= 7
    assert isinstance(sc.review_ready, bool)
    assert isinstance(sc.gaps, list)


def test_empty_graph_low_score():
    sc = build_review_scorecard([], [], None)
    assert sc.overall < 5
    assert sc.review_ready is False


def test_analyze_pipeline_includes_review_scorecard():
    """Integração leve: analyze_architecture devolve review_scorecard."""
    import asyncio

    from app.agents.runner import analyze_architecture

    nodes = [
        {"id": "gw", "data": {"kind": "cloud", "label": "API GW", "tech": "API Gateway", "catalogId": "gw"}},
        {"id": "api", "data": {"kind": "backend", "label": "Lambda", "tech": "Lambda", "catalogId": "api"}},
        {"id": "db", "data": {"kind": "database", "label": "DynamoDB", "tech": "DynamoDB", "catalogId": "db"}},
        {"id": "obs", "data": {"kind": "observability", "label": "CloudWatch", "tech": "CW", "catalogId": "obs"}},
    ]
    edges = [
        {
            "id": "e1",
            "source": "gw",
            "target": "api",
            "data": {
                "flowNumber": 1,
                "protocol": "https",
                "label": "invoke",
                "isCriticalPath": True,
                "failureBehavior": "retry",
            },
        },
        {
            "id": "e2",
            "source": "api",
            "target": "db",
            "data": {
                "flowNumber": 2,
                "protocol": "other",
                "label": "Dynamo",
                "isCriticalPath": True,
                "failureBehavior": "retry",
            },
        },
        {
            "id": "e3",
            "source": "api",
            "target": "obs",
            "data": {"flowNumber": 3, "protocol": "https", "flowKind": "async", "label": "metrics"},
        },
    ]
    nfr = {
        "users_per_day": 10000,
        "availability_pct": 99.9,
        "latency_p99_ms": 300,
        "arch_style": "serverless",
        "business_processes": ["Autenticar", "Processar"],
        "data_entities": ["Session"],
        "critical_path_edge_ids": ["e1", "e2"],
        "failure_modes": [
            {"component_id": "api", "mode": "timeout", "impact": "5xx", "mitigation": "retry"}
        ],
        "environments": {
            "has_dev": True,
            "has_staging": True,
            "has_prod": True,
            "has_ci_cd": True,
            "has_backups": True,
            "has_monitoring_plan": True,
        },
    }

    result = asyncio.run(
        analyze_architecture(nodes, edges, context="API serverless de produção.", nfr=nfr)
    )
    assert result.review_scorecard is not None
    assert result.review_scorecard.overall >= 6.0
    assert isinstance(result.review_scorecard.gaps, list)
