"""Testes de riscos estruturais de zonas (arquitetura real)."""

from app.services.architecture_heuristics import (
    analyze_zone_structure,
    boost_style_from_zones,
    classify_architecture_style,
)


def test_db_in_public_subnet_is_critical():
    nodes = [
        {
            "id": "z-pub",
            "data": {"kind": "zone", "zoneKind": "subnet_public", "label": "Public"},
        },
        {
            "id": "db1",
            "parentId": "z-pub",
            "data": {"kind": "database", "label": "Postgres", "tech": "PostgreSQL", "catalogId": "db-postgres"},
        },
    ]
    findings = analyze_zone_structure(nodes, [])
    titles = [f.title for f in findings]
    assert "Dado em subnet pública" in titles
    assert any(f.severity == "critical" for f in findings)


def test_edge_compute_without_auth_warns():
    nodes = [
        {"id": "z-edge", "data": {"kind": "zone", "zoneKind": "plane", "label": "Edge"}},
        {
            "id": "gw",
            "parentId": "z-edge",
            "data": {"kind": "cloud", "label": "API Gateway", "tech": "API GW", "catalogId": "cloud-aws-apigw"},
        },
        {
            "id": "fn",
            "data": {"kind": "cloud", "label": "Lambda", "tech": "AWS Lambda", "catalogId": "cloud-aws-lambda"},
        },
    ]
    findings = analyze_zone_structure(nodes, [])
    assert any("AuthZ" in f.title for f in findings)


def test_boost_style_serverless_from_lambda():
    nodes = [
        {"id": "1", "data": {"kind": "cloud", "label": "Lambda", "tech": "AWS Lambda", "catalogId": "cloud-aws-lambda"}},
    ]
    style, conf = boost_style_from_zones(nodes, "monolithic", 0.2)
    assert style == "serverless"
    assert conf >= 0.65


def test_classify_still_returns_tuple():
    style, conf = classify_architecture_style(
        [{"id": "1", "data": {"kind": "backend", "label": "FastAPI", "tech": "FastAPI"}}],
        [],
        None,
    )
    assert isinstance(style, str)
    assert 0 <= conf <= 1


def test_edge_crossing_public_to_private_without_firewall_warns():
    """Aresta de subnet_public para subnet_private sem firewall deve gerar warning."""
    nodes = [
        {"id": "z-vpc", "data": {"kind": "zone", "zoneKind": "vpc", "label": "Main VPC"}},
        {"id": "z-pub", "data": {"kind": "zone", "zoneKind": "subnet_public", "label": "Public Subnet", "parentId": "z-vpc"}},
        {"id": "z-priv", "data": {"kind": "zone", "zoneKind": "subnet_private", "label": "Private Subnet", "parentId": "z-vpc"}},
        {"id": "web", "parentId": "z-pub", "data": {"kind": "cloud", "label": "Web Server", "catalogId": "cloud-aws-ec2"}},
        {"id": "db", "parentId": "z-priv", "data": {"kind": "database", "label": "Postgres", "catalogId": "db-postgres"}},
    ]
    edges = [
        {"id": "e1", "source": "web", "target": "db", "data": {"flowKind": "sync", "protocol": "sql"}},
    ]
    findings = analyze_zone_structure(nodes, edges)
    sg_findings = [f for f in findings if "Security Group" in f.title or "Security Group" in f.detail]
    assert len(sg_findings) >= 1, f"Expected firewall warning, got: {[f.title for f in findings]}"
    assert sg_findings[0].severity == "warning"


def test_edge_with_firewall_rules_passes():
    """Aresta entre zonas com firewallRules deve passar sem warning de SG."""
    nodes = [
        {"id": "z-vpc", "data": {"kind": "zone", "zoneKind": "vpc", "label": "Main VPC"}},
        {"id": "z-pub", "data": {"kind": "zone", "zoneKind": "subnet_public", "label": "Public", "parentId": "z-vpc"}},
        {"id": "z-priv", "data": {"kind": "zone", "zoneKind": "subnet_private", "label": "Private", "parentId": "z-vpc"}},
        {"id": "web", "parentId": "z-pub", "data": {"kind": "cloud", "label": "Web"}},
        {"id": "db", "parentId": "z-priv", "data": {"kind": "database", "label": "Postgres"}},
    ]
    edges = [
        {
            "id": "e1",
            "source": "web",
            "target": "db",
            "data": {
                "flowKind": "sync",
                "protocol": "sql",
                "firewallRules": [{"port": "5432", "protocol": "tcp", "direction": "inbound"}],
            },
        },
    ]
    findings = analyze_zone_structure(nodes, edges)
    sg_findings = [f for f in findings if "Security Group" in f.title or "Security Group" in f.detail]
    assert len(sg_findings) == 0, f"Unexpected SG findings: {[f.title for f in findings]}"

