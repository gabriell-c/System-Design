from app.services.heuristic import analyze_graph, compare_analyses


def _node(node_id: str, kind: str, tech: str, **config):
    return {
        "id": node_id,
        "data": {"kind": kind, "label": tech, "tech": tech, "catalogId": tech, "config": config},
    }


def test_django_tiny_graph_flags_overengineering():
    nodes = [
        _node("fe", "frontend", "React", framework="React"),
        _node("be", "backend", "Django", framework="Django"),
        _node("db", "database", "PostgreSQL", engine="PostgreSQL"),
        _node("ec2", "cloud", "AWS EC2", provider="AWS", service="EC2"),
    ]
    result = analyze_graph(nodes, [{"source": "fe", "target": "be"}])
    titles = [finding.title for finding in result.findings]
    assert any("Django" in title for title in titles)
    assert result.score < 8.5
    assert all(finding.metric.is_estimate for finding in result.findings if finding.metric)


def test_fastapi_postgres_has_rps_estimate_badge():
    nodes = [
        _node("be", "backend", "FastAPI", framework="FastAPI"),
        _node("db", "database", "PostgreSQL", engine="PostgreSQL"),
        _node("ec2", "cloud", "AWS EC2", provider="AWS", service="EC2"),
    ]
    result = analyze_graph(nodes, [])
    metrics = [finding.metric for finding in result.findings if finding.metric]
    assert metrics
    assert all(metric.is_estimate is True for metric in metrics)
    assert result.growth.small.ok is True
    assert result.growth.large.ok is False
    assert result.agents_used == ["heuristic"]


def test_compare_prefers_cheaper_when_costs_differ():
    left = analyze_graph(
        [_node("a", "cloud", "Hostinger VPS", provider="Hostinger VPS", service="VPS")],
        [],
    )
    right = analyze_graph(
        [
            _node("a", "cloud", "AWS EC2", provider="AWS", service="EC2"),
            _node("b", "cloud", "AWS ALB", provider="AWS", service="Load Balancer"),
            _node("c", "cloud", "AWS RDS", provider="AWS", service="RDS"),
        ],
        [],
    )
    cmp_ = compare_analyses(left, right)
    assert cmp_["cheaper"] in {"left", "right", "tie"}
    assert "score_delta" in cmp_


def test_fintech_payment_edge_uses_string_endpoint_ids():
    # Edge endpoints carry node-id strings; the domain-benchmark matcher must
    # resolve them to node dicts, not call .get on the string (crash).
    from app.services.architecture_heuristics import analyze_domain_benchmarks

    nodes = [
        _node("be", "backend", "FastAPI", service="Stripe Payment API"),
        _node("ledger", "database", "PostgreSQL ledger store", engine="PostgreSQL"),
    ]
    findings = analyze_domain_benchmarks(nodes, [{"source": "be", "target": "ledger", "data": {}}])
    titles = [f.title for f in findings]
    assert "Payment edge sem failure behavior" in titles
    payment = next(f for f in findings if f.title == "Payment edge sem failure behavior")
    assert "FastAPI" in payment.detail and "PostgreSQL ledger store" in payment.detail
    # 'ledger' contains the substring 'edge' — the IoT rule must not fire here.
    assert "IoT sem protocolo MQTT" not in titles
