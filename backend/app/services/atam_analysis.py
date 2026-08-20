"""P3.1.4 — ATAM quality scenarios linked to nodes/edges with finding generation."""
from __future__ import annotations

from typing import Any

from app.schemas.analysis import Finding


def _node_data(node: dict) -> dict:
    return node.get("data") or {}


# ATAM quality scenarios with their expected node/edge patterns
ATAM_SCENARIOS: dict[str, dict[str, Any]] = {
    "high_availability": {
        "label": "Alta Disponibilidade",
        "stimulus": "Falha em nó crítico",
        "response": "Sistema continua operacional",
        "measure": "RTO < 5min, RPO < 1min",
        "expected_patterns": {
            "nodes": ["subnet_private", "security_boundary", "availability_zone"],
            "edges": ["failover", "replica", "sync"],
        },
    },
    "scalability": {
        "label": "Escalabilidade",
        "stimulus": "Pico de 10x tráfego",
        "response": "Auto-scaling ativa",
        "measure": "P99 < 500ms sob carga",
        "expected_patterns": {
            "nodes": ["ecs", "eks", "lambda", "alb", "nlb"],
            "edges": ["async", "kafka"],
        },
    },
    "security_audit": {
        "label": "Auditoria de Segurança",
        "stimulus": "Tentativa de acesso não autorizado",
        "response": "Bloqueio e log de evento",
        "measure": "100% das tentativas registradas",
        "expected_patterns": {
            "nodes": ["security_boundary", "waf", "iam", "kms"],
            "edges": ["auth", "https"],
        },
    },
    "data_integrity": {
        "label": "Integridade de Dados",
        "stimulus": "Falha durante transação",
        "response": "Rollback automático",
        "measure": "Zero dados corrompidos",
        "expected_patterns": {
            "nodes": ["postgres", "mysql", "transaction"],
            "edges": ["sql", "replication"],
        },
    },
    "deployment_speed": {
        "label": "Velocidade de Deploy",
        "stimulus": "Commit em main",
        "response": "Deploy em staging em < 10min",
        "measure": "CI/CD pipeline verde",
        "expected_patterns": {
            "nodes": ["github", "actions", "docker", "k8s", "ecs"],
            "edges": ["control"],
        },
    },
    "disaster_recovery": {
        "label": "Disaster Recovery",
        "stimulus": "Falha de região inteira",
        "response": "Failover para região B",
        "measure": "RTO < 30min, RPO < 15min",
        "expected_patterns": {
            "nodes": ["region", "dr_region", "vpn", "tgw"],
            "edges": ["failover", "replication"],
        },
    },
}


def analyze_atam_scenarios(
    nodes: list[dict],
    edges: list[dict],
    nfr: dict | None = None,
) -> list[Finding]:
    """Analisa cenários ATAM e gera findings quando padrões não são encontrados."""
    findings: list[Finding] = []

    nfr = nfr or {}
    {_node_data(n).get("kind") for n in nodes}
    node_ids_by_kind: dict[str, list[str]] = {}
    for n in nodes:
        kind = _node_data(n).get("kind") or _node_data(n).get("zoneKind")
        if kind:
            node_ids_by_kind.setdefault(kind, []).append(str(n.get("id")))

    edge_kinds = set()
    edge_protocols = set()
    for e in edges:
        ed = e.get("data") or {}
        fk = ed.get("flowKind") or ed.get("flow_kind")
        proto = ed.get("protocol")
        if fk:
            edge_kinds.add(fk)
        if proto:
            edge_protocols.add(proto)

    for scenario_id, scenario in ATAM_SCENARIOS.items():
        patterns = scenario["expected_patterns"]
        missing_nodes = []
        missing_edges = []

        # Check node patterns
        for expected_node in patterns.get("nodes", []):
            # Look for matching node kind or label
            found = False
            for node in nodes:
                nd = _node_data(node)
                if expected_node in str(nd.get("label", "")).lower():
                    found = True
                    break
                if nd.get("kind") == expected_node:
                    found = True
                    break
                if nd.get("zoneKind") == expected_node:
                    found = True
                    break
            if not found:
                missing_nodes.append(expected_node)

        # Check edge patterns
        for expected_edge in patterns.get("edges", []):
            found = False
            for e in edges:
                ed = e.get("data") or {}
                label = str(ed.get("label", "")).lower()
                fk = str(ed.get("flowKind") or ed.get("flow_kind", "")).lower()
                proto = str(ed.get("protocol", "")).lower()
                if expected_edge in label or expected_edge in fk or expected_edge in proto:
                    found = True
                    break
            if not found:
                missing_edges.append(expected_edge)

        # Generate finding if patterns are missing
        if missing_nodes or missing_edges:
            severity = "critical" if len(missing_nodes) > 2 else "warning"
            detail_parts = []
            if missing_nodes:
                detail_parts.append(f"Faltam nós: {', '.join(missing_nodes)}")
            if missing_edges:
                detail_parts.append(f"Faltam fluxos: {', '.join(missing_edges)}")

            findings.append(
                Finding(
                    severity=severity,
                    title=f"ATAM: {scenario['label']} não coberto",
                    detail=(
                        f"Estímulo: {scenario['stimulus']}. "
                        f"Resposta esperada: {scenario['response']}. "
                        f"Métrica: {scenario['measure']}. "
                        + " ".join(detail_parts)
                    ),
                )
            )

    return findings


def link_atam_to_nodes(
    nodes: list[dict],
    edges: list[dict],
    scenario_ids: list[str],
) -> dict[str, Any]:
    """Liga cenários ATAM a nós e arestas específicos."""
    links: dict[str, dict[str, list[str]]] = {}

    for scenario_id in scenario_ids:
        scenario = ATAM_SCENARIOS.get(scenario_id)
        if not scenario:
            continue

        links[scenario_id] = {"nodes": [], "edges": []}

        # Match nodes
        for pattern_node in scenario["expected_patterns"].get("nodes", []):
            for node in nodes:
                nd = _node_data(node)
                label = str(nd.get("label", "")).lower()
                kind = str(nd.get("kind", "")).lower()
                zone_kind = str(nd.get("zoneKind", "")).lower()
                if pattern_node in label or pattern_node in kind or pattern_node in zone_kind:
                    links[scenario_id]["nodes"].append(str(node.get("id")))

        # Match edges
        for pattern_edge in scenario["expected_patterns"].get("edges", []):
            for edge in edges:
                ed = edge.get("data") or {}
                label = str(ed.get("label", "")).lower()
                fk = str(ed.get("flowKind") or ed.get("flow_kind", "")).lower()
                proto = str(ed.get("protocol", "")).lower()
                if pattern_edge in label or pattern_edge in fk or pattern_edge in proto:
                    links[scenario_id]["edges"].append(str(edge.get("id")))

    return links
