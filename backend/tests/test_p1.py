"""Tests for P1 fortalecedores services."""

from app.schemas.analysis import AnalysisResult, Finding, GrowthReport, GrowthScenario
from app.services.lineage import build_lineage
from app.services.p1_analysis import (
    attach_fix_actions,
    check_pii_in_sensitive_flow,
    enrich_analysis,
)
from app.services.polyglot_map import build_polyglot_map


def _node(nid: str, kind: str, label: str, **extra) -> dict:
    return {"id": nid, "data": {"kind": kind, "label": label, **extra}}


def test_polyglot_map_shared_db():
    nodes = [
        _node("b1", "backend", "Orders API"),
        _node("b2", "backend", "Billing API"),
        _node("db1", "database", "Shared PG", tech="Postgres"),
    ]
    edges = [
        {"source": "b1", "target": "db1", "data": {"flowKind": "data"}},
        {"source": "b2", "target": "db1", "data": {"flowKind": "data"}},
    ]
    result = build_polyglot_map(nodes, edges)
    assert result["summary"]["shared_db_count"] == 1
    assert len(result["shared_databases"][0]["services"]) == 2


def test_lineage_from_data_edges():
    nodes = [_node("db", "database", "Warehouse"), _node("svc", "backend", "ETL")]
    edges = [{"source": "db", "target": "svc", "data": {"flowKind": "data", "label": "sync"}}]
    result = build_lineage(nodes, edges)
    assert result["edge_count"] >= 1


def test_pii_finding_without_identity():
    nodes = [_node("db", "database", "Users DB", piiSensitivity="high")]
    findings = check_pii_in_sensitive_flow(nodes, [])
    assert any("identidade" in f.title.lower() for f in findings)


def test_fix_action_attached():
    findings = [
        Finding(severity="warning", title="CDN missing for streaming", detail="need cdn"),
    ]
    out = attach_fix_actions(findings)
    assert out[0].fix_action is not None
    assert out[0].fix_action.action_type == "add_catalog_node"


def test_enrich_analysis_adds_score_breakdown():
    base = AnalysisResult(
        score=6.2,
        summary="ok",
        strengths=["a"],
        risks=["b"],
        suggestions=["c"],
        findings=[Finding(severity="critical", title="x", detail="y", node_id="n1")],
        node_scores={"n1": 4.0},
        growth=GrowthReport(
            small=GrowthScenario(ok=True),
            medium=GrowthScenario(ok=True),
            large=GrowthScenario(ok=False, issues=["scale"]),
        ),
        ia_ok=False,
        ia_unavailable=True,
        agents_used=[],
    )
    enriched = enrich_analysis(base, [_node("n1", "backend", "API")], [], None)
    assert enriched.score_breakdown is not None
    assert enriched.score_breakdown.base_score == 6.2
