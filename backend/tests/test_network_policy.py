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
