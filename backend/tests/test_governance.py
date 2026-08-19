"""Tests for governance, policy, SLO, benchmark services."""

from app.services.benchmark import run_graph_benchmark
from app.services.diagram_consistency import analyze_project_consistency
from app.services.governance import build_raci_matrix, persist_adrs_markdown
from app.services.policy import evaluate_policies
from app.services.slo import compute_service_slos, error_budget_burn_rate


def test_diagram_consistency_detects_missing_service():
    graphs = [
        {
            "id": "g1",
            "name": "Context",
            "diagram_kind": "context",
            "nodes": [{"id": "n1", "data": {"label": "Orders API", "catalogId": "svc-orders"}}],
        },
        {
            "id": "g2",
            "name": "Runtime",
            "diagram_kind": "runtime",
            "nodes": [],
        },
    ]
    result = analyze_project_consistency(graphs)
    assert result["ok"] is False
    assert len(result["issues"]) >= 1


def test_policy_flags_public_rds():
    nodes = [
        {
            "id": "vpc-pub",
            "data": {"kind": "zone", "zoneKind": "subnet_public", "label": "Public"},
        },
        {
            "id": "db1",
            "parentId": "vpc-pub",
            "data": {"kind": "database", "catalogId": "cloud-aws-rds", "label": "RDS"},
        },
    ]
    findings = evaluate_policies(nodes, [])
    assert any(f["policy_id"] == "no-public-rds" for f in findings)


def test_raci_matrix_has_rows():
    nodes = [{"id": "b1", "data": {"kind": "block", "label": "Checkout"}}]
    matrix = build_raci_matrix(nodes, "payments-team")
    assert matrix["rows"]
    assert matrix["rows"][0]["accountable"] == "payments-team"


def test_slo_and_error_budget():
    nodes = [{"id": "api", "data": {"kind": "backend", "label": "API", "catalogId": "cloud-aws-alb"}}]
    cards = compute_service_slos(nodes, {"slo_availability_pct": 99.95})
    assert cards[0]["slo_availability_pct"] == 99.95
    budget = error_budget_burn_rate({"slo_availability_pct": 99.95})
    assert budget["status"] == "healthy"


def test_benchmark_500_nodes_projection():
    nodes = [{"id": f"n{i}", "data": {"kind": "backend", "label": f"S{i}"}} for i in range(20)]
    edges = [{"source": f"n{i}", "target": f"n{i+1}"} for i in range(19)]
    result = run_graph_benchmark(nodes, edges, target_nodes=500)
    assert "projected_ms_at_target" in result
    assert result["node_count"] == 20


def test_persist_adrs_writes_files(tmp_path):
    adrs = [{"id": "ADR-001", "title": "Use Postgres", "context": "Need SQL", "decision": "RDS", "consequences": ["Ops"]}]
    paths = persist_adrs_markdown("proj-1", adrs, base_dir=tmp_path)
    assert len(paths) == 1
    assert (tmp_path / "proj-1").exists()
