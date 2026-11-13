"""Testes P2.3 — network policy e deployment flows dev/user."""

from app.services.deployment import analyze_deployment_flows
from app.services.network_policy import analyze_network_policy


def _network_graph():
    nodes = [
        {"id": "z-pub", "type": "zone", "data": {"kind": "zone", "zoneKind": "subnet_public", "label": "Public"}},
        {"id": "z-priv", "type": "zone", "data": {"kind": "zone", "zoneKind": "subnet_private", "label": "Private"}},
        {"id": "sg1", "type": "securityGroup", "data": {"catalogId": "sec-sg", "label": "App SG", "securityGroupRules": []}},
        {
            "id": "nacl1",
            "type": "nacl",
            "data": {
                "catalogId": "net-nacl",
                "label": "Private NACL",
                "naclRules": [
                    {"rule_number": 100, "action": "allow", "protocol": "tcp", "direction": "inbound"},
                    {"rule_number": 32767, "action": "deny", "protocol": "all", "direction": "inbound"},
                ],
            },
        },
        {
            "id": "tgw1",
            "type": "transitGateway",
            "data": {
                "catalogId": "net-tgw",
                "label": "Hub TGW",
                "tgwAttachments": [
                    {"vpc_id": "vpc-a", "vpc_label": "App"},
                    {"vpc_id": "vpc-b", "vpc_label": "Data"},
                ],
            },
        },
        {"id": "alb", "parentId": "z-pub", "data": {"label": "ALB", "kind": "cloud"}},
        {"id": "ecs", "parentId": "z-priv", "data": {"label": "ECS", "kind": "cloud"}},
    ]
    edges = [
        {"id": "e1", "source": "alb", "target": "ecs", "data": {"flowKind": "sync", "firewallRules": [{"port": "443"}]}},
    ]
    return nodes, edges


def test_network_policy_detects_empty_sg():
    nodes, edges = _network_graph()
    result = analyze_network_policy(nodes, edges)
    assert result["ok"] is True
    assert result["summary"]["security_groups"] == 1
    assert any("SG sem regras" in f["title"] for f in result["findings"])


def test_network_policy_scores_nacl_with_deny():
    nodes, edges = _network_graph()
    result = analyze_network_policy(nodes, edges)
    assert result["summary"]["nacls"] == 1
    assert result["score"] >= 70


def test_tgw_single_attachment_fires_info():
    """TGW com 1 attachment (< TGW_MIN_ATTACHMENTS) → finding info."""
    nodes, _ = _network_graph()
    nodes[4]["data"]["tgwAttachments"] = [{"vpc_id": "vpc-a", "vpc_label": "App"}]
    result = analyze_network_policy(nodes, [])
    assert any(f["severity"] == "info" and "TGW hub subutilizado" in f["title"] for f in result["findings"])


def test_edge_public_to_private_without_firewall_rules_warning():
    """Tráfego public→private sem firewallRules documentado → warning."""
    nodes, _ = _network_graph()
    edges = [{"id": "e-x", "source": "alb", "target": "ecs"}]
    result = analyze_network_policy(nodes, edges)
    assert any(f["severity"] == "warning" and "public→private" in f["title"] for f in result["findings"])


def test_tgw_zone_without_card_warning():
    """Zona zoneKind=tgw sem nenhum card net-tgw no grafo → warning."""
    nodes, _ = _network_graph()
    nodes = [n for n in nodes if n["id"] != "tgw1"]
    nodes.append({"id": "z-tgw", "type": "zone", "data": {"kind": "zone", "zoneKind": "tgw", "label": "TGW"}})
    result = analyze_network_policy(nodes, [])
    assert any(f["severity"] == "warning" and "Zona TGW sem nó Transit Gateway" in f["title"] for f in result["findings"])


def test_parent_id_cycle_does_not_raise():
    """Ciclo parentId (a→b→a) não pode lançar RecursionError/500."""
    nodes = [
        {"id": "a", "parentId": "b", "data": {"label": "A", "kind": "cloud"}},
        {"id": "b", "parentId": "a", "data": {"label": "B", "kind": "cloud"}},
    ]
    edges = [{"id": "e1", "source": "a", "target": "b"}]
    result = analyze_network_policy(nodes, edges)
    assert result["ok"] is True
    assert isinstance(result["score"], int)


def test_score_bounds_zero_to_hundred():
    """Score sempre 0-100 (clamp: muitos críticos não vão para negativo)."""
    empty = analyze_network_policy([], [])
    assert empty["score"] == 100
    many_nacls = [
        {"id": f"n{i}", "type": "nacl", "data": {"catalogId": "net-nacl", "label": f"NACL {i}", "naclRules": []}}
        for i in range(8)
    ]
    result = analyze_network_policy(many_nacls, [])
    assert 0 <= result["score"] <= 100


def _cicd_graph():
    nodes = [
        {"id": "lane-dev", "type": "swimlane", "data": {"kind": "swimlane", "swimlaneKind": "dev_flow", "label": "Dev"}},
        {"id": "lane-user", "type": "swimlane", "data": {"kind": "swimlane", "swimlaneKind": "user_flow", "label": "User"}},
        {"id": "git", "parentId": "lane-dev", "data": {"catalogId": "int-github", "label": "Git", "kind": "integration"}},
        {"id": "jenkins", "parentId": "lane-dev", "data": {"catalogId": "dep-jenkins", "label": "Jenkins", "kind": "deploy"}},
        {"id": "cf", "parentId": "lane-user", "data": {"catalogId": "cloud-aws-cf", "label": "CloudFront", "kind": "cloud"}},
        {"id": "ecs", "parentId": "lane-user", "data": {"catalogId": "cloud-aws-ecs", "label": "ECS", "kind": "cloud"}},
    ]
    edges = [
        {"id": "e1", "source": "git", "target": "jenkins", "data": {"flowKind": "control", "flowNumber": 1}},
        {"id": "e2", "source": "cf", "target": "ecs", "data": {"flowKind": "sync", "flowNumber": 2, "isCriticalPath": True}},
        {"id": "e3", "source": "jenkins", "target": "ecs", "data": {"flowKind": "control", "flowNumber": 3, "label": "rollout"}},
    ]
    return nodes, edges


def test_deployment_flows_split_dev_user():
    nodes, edges = _cicd_graph()
    result = analyze_deployment_flows(nodes, edges)
    assert result["ok"] is True
    assert result["dev_flow"]["edge_count"] >= 1
    assert result["user_flow"]["edge_count"] >= 1
    assert result["cross_flow"]["edge_count"] >= 1
