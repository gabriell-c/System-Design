"""P2.3.1 — Análise de políticas de rede (SG, NACL, TGW) em diagramas Archia."""

from __future__ import annotations

from typing import Any


def _node_data(node: dict[str, Any]) -> dict[str, Any]:
    data = node.get("data")
    return data if isinstance(data, dict) else {}


def _catalog_id(node: dict[str, Any]) -> str:
    return str(_node_data(node).get("catalogId") or "")


def _label(node: dict[str, Any]) -> str:
    return str(_node_data(node).get("label") or node.get("id") or "?")


def _is_zone(node: dict[str, Any], zone_kind: str | None = None) -> bool:
    data = _node_data(node)
    if data.get("kind") != "zone":
        return False
    if zone_kind is None:
        return True
    return data.get("zoneKind") == zone_kind


def analyze_network_policy(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> dict[str, Any]:
    """Valida SG/NACL/TGW e tráfego entre zonas."""
    by_id = {str(n.get("id")): n for n in nodes if n.get("id")}
    findings: list[dict[str, Any]] = []
    sg_nodes: list[dict[str, Any]] = []
    nacl_nodes: list[dict[str, Any]] = []
    tgw_nodes: list[dict[str, Any]] = []
    tgw_zones: list[dict[str, Any]] = []

    for node in nodes:
        cid = _catalog_id(node)
        data = _node_data(node)
        if cid == "sec-sg" or node.get("type") == "securityGroup":
            sg_nodes.append(node)
            rules = data.get("securityGroupRules") or []
            if not rules:
                findings.append(
                    {
                        "severity": "warning",
                        "node_id": node.get("id"),
                        "title": f"SG sem regras: {_label(node)}",
                        "detail": "Security Group stateful sem regras inbound/outbound explícitas.",
                    }
                )
        elif cid == "net-nacl" or node.get("type") == "nacl":
            nacl_nodes.append(node)
            rules = data.get("naclRules") or []
            deny_default = any(r.get("action") == "deny" for r in rules)
            if not deny_default:
                findings.append(
                    {
                        "severity": "critical",
                        "node_id": node.get("id"),
                        "title": f"NACL sem deny explícito: {_label(node)}",
                        "detail": "NACLs são stateless — recomenda-se regra deny explícita (ex.: #32767).",
                    }
                )
        elif cid == "net-tgw" or node.get("type") == "transitGateway":
            tgw_nodes.append(node)
            attachments = data.get("tgwAttachments") or []
            if len(attachments) < 2:
                findings.append(
                    {
                        "severity": "info",
                        "node_id": node.get("id"),
                        "title": f"TGW hub subutilizado: {_label(node)}",
                        "detail": "Transit Gateway com menos de 2 VPC attachments — hub não agrega tráfego.",
                    }
                )
        if _is_zone(node, "tgw"):
            tgw_zones.append(node)

    # Tráfego entre subnets públicas/privadas
    for edge in edges:
        src = by_id.get(str(edge.get("source")))
        tgt = by_id.get(str(edge.get("target")))
        if not src or not tgt:
            continue
        data = edge.get("data") if isinstance(edge.get("data"), dict) else {}
        fw = data.get("firewallRules") or []
        src_zone = _zone_kind_of_node(src, by_id)
        tgt_zone = _zone_kind_of_node(tgt, by_id)
        if src_zone == "subnet_public" and tgt_zone == "subnet_private" and not fw:
            findings.append(
                {
                    "severity": "warning",
                    "edge_id": edge.get("id"),
                    "title": "Tráfego public→private sem regra SG/NACL",
                    "detail": f"{_label(src)} → {_label(tgt)}: documente portas em firewallRules.",
                }
            )

    # TGW zone sem attachment card
    if tgw_zones and not tgw_nodes:
        findings.append(
            {
                "severity": "warning",
                "title": "Zona TGW sem nó Transit Gateway",
                "detail": "Existe zona tgw mas nenhum card net-tgw — adicione hub visual.",
            }
        )

    score = max(0, 100 - len([f for f in findings if f["severity"] == "critical"]) * 15
                - len([f for f in findings if f["severity"] == "warning"]) * 5)

    return {
        "ok": True,
        "score": score,
        "summary": {
            "security_groups": len(sg_nodes),
            "nacls": len(nacl_nodes),
            "transit_gateways": len(tgw_nodes) + len(tgw_zones),
            "edges_analyzed": len(edges),
        },
        "findings": findings,
    }


def _zone_kind_of_node(node: dict[str, Any], by_id: dict[str, dict[str, Any]]) -> str | None:
    if _is_zone(node):
        return str(_node_data(node).get("zoneKind") or "")
    parent_id = node.get("parentId")
    if parent_id and str(parent_id) in by_id:
        return _zone_kind_of_node(by_id[str(parent_id)], by_id)
    return None
