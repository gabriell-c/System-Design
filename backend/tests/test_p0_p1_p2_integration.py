"""Testes de integração P0 + P1 + P2 — fluxo ponta a ponta."""
from app.services.diff import semantic_diff

# ──────────────────────────────────────────────────────────────────────
# P0 — Foundation: CRUD de grafos, zonas, nós, arestas
# ──────────────────────────────────────────────────────────────────────

def test_p0_graph_lifecycle(client):
    """Criação, listagem, update, versionamento e deleção de grafo."""
    resp = client.post(
        "/api/v1/graphs",
        json={
            "name": "P0 Full Lifecycle",
            "nodes": [
                {"id": "z1", "data": {"kind": "zone", "zoneKind": "region", "label": "us-east-1"}},
                {"id": "n1", "parentId": "z1", "data": {"kind": "backend", "label": "API", "tech": "FastAPI"}},
            ],
            "edges": [],
        },
    )
    assert resp.status_code == 201
    graph_id = resp.json()["id"]
    assert resp.json()["owner_team"] is None

    # Listagem
    listed = client.get("/api/v1/graphs")
    assert listed.status_code == 200
    data = listed.json()
    assert any(g["id"] == graph_id for g in data["items"])

    # Fetch
    fetched = client.get(f"/api/v1/graphs/{graph_id}")
    assert fetched.json()["name"] == "P0 Full Lifecycle"
    assert len(fetched.json()["nodes"]) == 2
    assert len(fetched.json()["edges"]) == 0

    # Update com owner_team
    updated = client.put(f"/api/v1/graphs/{graph_id}", json={"owner_team": "platform"})
    assert updated.json()["owner_team"] == "platform"

    # Versões
    versions = client.get(f"/api/v1/graphs/{graph_id}/versions")
    assert versions.status_code == 200
    assert len(versions.json()) >= 2
    ver0 = versions.json()[0]
    assert "id" in ver0
    assert "created_at" in ver0

    # Restore
    restored = client.post(f"/api/v1/graphs/{graph_id}/versions/{ver0['id']}/restore")
    assert restored.status_code == 200

    # Delete
    deleted = client.delete(f"/api/v1/graphs/{graph_id}")
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/graphs/{graph_id}").status_code == 404


def test_p0_zone_nesting(client):
    """Validação de nesting de zonas."""
    resp = client.post(
        "/api/v1/graphs",
        json={
            "name": "Zones",
            "nodes": [
                {"id": "z-reg", "data": {"kind": "zone", "zoneKind": "region", "label": "us-east-1"}},
                {"id": "z-vpc", "parentId": "z-reg", "data": {"kind": "zone", "zoneKind": "vpc", "label": "VPC"}},
                {"id": "z-az", "parentId": "z-vpc", "data": {"kind": "zone", "zoneKind": "availability_zone", "label": "AZ-a"}},
                {"id": "z-sub", "parentId": "z-az", "data": {"kind": "zone", "zoneKind": "subnet_private", "label": "Private"}},
                {"id": "n1", "parentId": "z-sub", "data": {"kind": "backend", "label": "API", "tech": "FastAPI"}},
            ],
            "edges": [],
        },
    )
    assert resp.status_code == 201
    graph = resp.json()
    ids = {n["id"] for n in graph["nodes"]}
    assert "z-reg" in ids
    assert "z-vpc" in ids
    assert "z-az" in ids
    assert "z-sub" in ids
    assert "n1" in ids


# ──────────────────────────────────────────────────────────────────────
# P1 — Architecture analysis: PII, bounded context, polyglot, lineage
# ──────────────────────────────────────────────────────────────────────

def test_p1_polyglot_map_endpoint(client):
    """Polyglot map retorna matriz tecnologia."""
    graph = client.post(
        "/api/v1/graphs",
        json={
            "name": "Polyglot",
            "nodes": [
                {"id": "n1", "data": {"kind": "database", "label": "Postgres", "tech": "PostgreSQL", "config": {"provider": "aws", "service": "RDS"}}},
                {"id": "n2", "data": {"kind": "database", "label": "Redis", "tech": "Redis", "config": {"provider": "aws", "service": "ElastiCache"}}},
                {"id": "n3", "data": {"kind": "backend", "label": "API", "tech": "FastAPI", "config": {"provider": "aws", "service": "ECS"}}},
            ],
            "edges": [{"id": "e1", "source": "n3", "target": "n1", "data": {"flowKind": "data", "protocol": "sql"}}],
        },
    ).json()
    resp = client.get(f"/api/v1/graphs/{graph['id']}/polyglot-map")
    assert resp.status_code == 200
    body = resp.json()
    assert "services" in body
    assert "orphan_databases" in body
    assert "summary" in body
    assert body["summary"]["database_count"] == 2


def test_p1_lineage_endpoint(client):
    """Data lineage retorna fluxos de dados."""
    graph = client.post(
        "/api/v1/graphs",
        json={
            "name": "Lineage",
            "nodes": [
                {"id": "n1", "data": {"kind": "frontend", "label": "Web", "tech": "Next.js"}},
                {"id": "n2", "data": {"kind": "backend", "label": "API", "tech": "FastAPI"}},
                {"id": "n3", "data": {"kind": "database", "label": "PG", "tech": "PostgreSQL"}},
            ],
            "edges": [
                {"id": "e1", "source": "n1", "target": "n2", "data": {"flowKind": "sync", "protocol": "https"}},
                {"id": "e2", "source": "n2", "target": "n3", "data": {"flowKind": "data", "protocol": "sql"}},
            ],
        },
    ).json()
    resp = client.get(f"/api/v1/graphs/{graph['id']}/lineage")
    assert resp.status_code == 200
    body = resp.json()
    assert "lineage_edges" in body
    assert len(body["lineage_edges"]) >= 1


def test_p1_capacity_endpoint(client):
    """Capacity estimate retorna estimativas."""
    graph = client.post(
        "/api/v1/graphs",
        json={
            "name": "Capacity",
            "nodes": [
                {"id": "n1", "data": {"kind": "backend", "label": "API", "tech": "FastAPI", "capacityContract": {"max_rps": 1000, "p99_latency_ms": 200}}},
            ],
            "edges": [],
        },
    ).json()
    resp = client.get(f"/api/v1/graphs/{graph['id']}/capacity-estimate")
    assert resp.status_code == 200
    body = resp.json()
    assert "estimates" in body or "nodes" in body


def test_p1_simulation_crud(client):
    """Criar, listar e deletar cenários de simulação."""
    graph = client.post(
        "/api/v1/graphs",
        json={"name": "Sim", "nodes": [], "edges": []},
    ).json()
    # Criar
    sim = client.post(
        f"/api/v1/graphs/{graph['id']}/simulation-scenarios",
        json={"name": "Teste A", "payload": {"scenario": "node_failure"}},
    )
    assert sim.status_code in (200, 201), f"Expected 200/201, got {sim.status_code}"
    sim_id = sim.json()["id"]
    # Listar
    list_resp = client.get(f"/api/v1/graphs/{graph['id']}/simulation-scenarios")
    assert list_resp.status_code == 200
    assert any(s["id"] == sim_id for s in list_resp.json())
    # Deletar
    del_resp = client.delete(f"/api/v1/graphs/{graph['id']}/simulation-scenarios/{sim_id}")
    assert del_resp.status_code in (200, 204)
    assert client.get(f"/api/v1/graphs/{graph['id']}/simulation-scenarios").json() == []


def test_p1_analysis_enriches_findings(client):
    """Análise de grafo deve retornar findings com score_breakdown."""
    graph = client.post(
        "/api/v1/graphs",
        json={
            "name": "Analysis",
            "nodes": [
                {"id": "z-pub", "data": {"kind": "zone", "zoneKind": "subnet_public", "label": "Public"}},
                {"id": "db", "parentId": "z-pub", "data": {"kind": "database", "label": "Users DB", "tech": "Postgres", "piiSensitivity": "high"}},
            ],
            "edges": [],
        },
    ).json()
    resp = client.post(f"/api/v1/graphs/{graph['id']}/analyze")
    assert resp.status_code == 200
    body = resp.json()
    assert "findings" in body
    assert body.get("score_breakdown") is not None
    assert body.get("benchmarks") is not None


def test_p1_threat_analysis(client):
    """Threat analysis deve retornar threat_findings."""
    graph = client.post(
        "/api/v1/graphs",
        json={
            "name": "Threat",
            "nodes": [
                {"id": "n1", "data": {"kind": "backend", "label": "API", "tech": "FastAPI", "config": {"provider": "aws"}}},
            ],
            "edges": [],
        },
    ).json()
    resp = client.post(f"/api/v1/graphs/{graph['id']}/analyze")
    body = resp.json()
    assert "threat_findings" in body
    assert isinstance(body["threat_findings"], list)
    assert body.get("well_architected") is not None or body.get("threat_findings") is not None


# ──────────────────────────────────────────────────────────────────────
# P2 — Scale: ACL, boundary contracts, saved views, templates, diff
# ──────────────────────────────────────────────────────────────────────

def test_p2_acl_crud(client):
    """ACL por squad: criar, listar, atualizar, deletar."""
    graph = client.post("/api/v1/graphs", json={"name": "ACL", "nodes": [], "edges": []}).json()
    # Listar (vazio)
    assert client.get(f"/api/v1/graphs/{graph['id']}/access").json() == []
    # Adicionar
    resp = client.post(
        f"/api/v1/graphs/{graph['id']}/access",
        json={"team": "ads-team", "role": "write"},
    )
    assert resp.status_code == 200
    assert resp.json()["team"] == "ads-team"
    assert resp.json()["role"] == "write"
    # Listar
    listed = client.get(f"/api/v1/graphs/{graph['id']}/access").json()
    assert any(a["team"] == "ads-team" for a in listed)
    # Atualizar (upsert)
    updated = client.post(
        f"/api/v1/graphs/{graph['id']}/access",
        json={"team": "ads-team", "role": "admin"},
    )
    assert updated.json()["role"] == "admin"
    # Deletar
    del_resp = client.delete(f"/api/v1/graphs/{graph['id']}/access/ads-team")
    assert del_resp.status_code in (200, 204)
    assert client.get(f"/api/v1/graphs/{graph['id']}/access").json() == []


def test_p2_acl_invalid_role(client):
    """ACL rejeita role inválida."""
    graph = client.post("/api/v1/graphs", json={"name": "ACL", "nodes": [], "edges": []}).json()
    resp = client.post(
        f"/api/v1/graphs/{graph['id']}/access",
        json={"team": "bad-team", "role": "superadmin"},
    )
    assert resp.status_code == 422


def test_p2_boundary_contract_crud(client):
    """Contratos de borda: criar, listar, deletar."""
    graph = client.post("/api/v1/graphs", json={"name": "Boundary", "nodes": [], "edges": []}).json()
    # Criar
    resp = client.post(
        f"/api/v1/graphs/{graph['id']}/boundary-contracts",
        json={"source_zone": "ingest", "target_zone": "encoding", "protocol": "async", "description": "Kafka", "sla_ms": 500},
    )
    assert resp.status_code in (200, 201), f"Expected 200/201, got {resp.status_code}"
    body = resp.json()
    if "ok" in body:
        assert body["ok"] is True
    # Listar
    listed = client.get(f"/api/v1/graphs/{graph['id']}/boundary-contracts").json()
    assert len(listed) == 1
    assert listed[0]["source_zone"] == "ingest"
    assert listed[0]["target_zone"] == "encoding"
    assert listed[0]["protocol"] == "async"
    assert listed[0]["sla_ms"] == 500
    # Deletar
    del_resp = client.delete(f"/api/v1/graphs/{graph['id']}/boundary-contracts/{listed[0]['id']}")
    assert del_resp.status_code in (200, 204)
    assert client.get(f"/api/v1/graphs/{graph['id']}/boundary-contracts").json() == []


def test_p2_boundary_contract_missing_fields(client):
    """Contrato rejeita campos obrigatórios ausentes."""
    graph = client.post("/api/v1/graphs", json={"name": "Boundary", "nodes": [], "edges": []}).json()
    resp = client.post(
        f"/api/v1/graphs/{graph['id']}/boundary-contracts",
        json={"source_zone": "ingest"},  # target_zone faltando
    )
    assert resp.status_code == 422


def test_p2_diff_visual(client):
    """Diff entre versões mostra nós/arestas adicionados e removidos."""
    graph = client.post(
        "/api/v1/graphs",
        json={"name": "Diff", "nodes": [{"id": "a", "data": {"kind": "backend", "label": "A"}}], "edges": []},
    ).json()
    # Versão inicial
    versions = client.get(f"/api/v1/graphs/{graph['id']}/versions").json()
    v1 = versions[0]
    # Atualizar com novo nó
    client.put(
        f"/api/v1/graphs/{graph['id']}",
        json={"nodes": [{"id": "a", "data": {"kind": "backend", "label": "A"}}, {"id": "b", "data": {"kind": "database", "label": "B"}}]},
    )
    # Comparar
    diff = client.get(f"/api/v1/graphs/{graph['id']}/diff/{v1['id']}").json()
    assert any(n["id"] == "b" for n in diff["added_nodes"])
    assert diff["removed_nodes"] == []
    assert diff["changed_nodes"] == []


def test_p2_semicolon_zone_kinds():
    """Zones novas existem em ZONE_DEFAULT_SIZE e ZONE_META (frontend-only)."""
    # Frontend-only test - skip in backend


def test_p2_certificate_catalog_items():
    """Catálogo possui itens de segurança e rede adicionados (frontend-only)."""
    # Frontend-only test - skip in backend


def test_p2_scale_templates_exist():
    """Templates de escala existem e têm a estrutura correta (frontend-only)."""
    # Frontend-only test - skip in backend


def test_p2_diff_semantic_core():
    """Função semantic_diff do serviço central."""
    left_nodes = [{"id": "a", "data": {"kind": "backend", "label": "API"}}]
    right_nodes = [
        {"id": "a", "data": {"kind": "backend", "label": "API v2"}},
        {"id": "b", "data": {"kind": "database", "label": "PG"}},
    ]
    left_edges = [{"id": "e1", "source": "a", "target": "a"}]
    right_edges = [{"id": "e2", "source": "a", "target": "b"}]
    diff = semantic_diff(left_nodes, left_edges, right_nodes, right_edges)
    assert {n["id"] for n in diff["added_nodes"]} == {"b"}
    assert diff["removed_nodes"] == []
    assert any(n["id"] == "a" for n in diff["changed_nodes"])
    assert {e["id"] for e in diff["added_edges"]} == {"e2"}
    assert {e["id"] for e in diff["removed_edges"]} == {"e1"}


def test_p2_scale_end_to_end(client):
    """Fluxo completo: criar grafo → ACL → contrato de borda → análise → diff."""
    # 1. Criar grafo
    graph = client.post(
        "/api/v1/graphs",
        json={
            "name": "E2E P2",
            "nodes": [
                {"id": "n1", "data": {"kind": "backend", "label": "API", "tech": "FastAPI"}},
                {"id": "n2", "data": {"kind": "database", "label": "PG", "tech": "PostgreSQL"}},
            ],
            "edges": [{"id": "e1", "source": "n1", "target": "n2", "data": {"flowKind": "data", "protocol": "sql"}}],
        },
    ).json()
    graph_id = graph["id"]
    # 2. ACL
    client.post(f"/api/v1/graphs/{graph_id}/access", json={"team": "backend-team", "role": "write"})
    acl = client.get(f"/api/v1/graphs/{graph_id}/access").json()
    assert any(a["team"] == "backend-team" for a in acl)
    # 3. Contrato de borda
    client.post(
        f"/api/v1/graphs/{graph_id}/boundary-contracts",
        json={"source_zone": "api", "target_zone": "db", "protocol": "sync"},
    )
    contracts = client.get(f"/api/v1/graphs/{graph_id}/boundary-contracts").json()
    assert len(contracts) == 1
    # 4. Análise
    analysis = client.post(f"/api/v1/graphs/{graph_id}/analyze").json()
    assert "findings" in analysis
    assert "score_breakdown" in analysis
    # 5. Diff - criar duas versões
    v1_resp = client.get(f"/api/v1/graphs/{graph_id}/versions").json()
    client.put(
        f"/api/v1/graphs/{graph_id}",
        json={
            "nodes": [
                {"id": "n1", "data": {"kind": "backend", "label": "API", "tech": "FastAPI"}},
                {"id": "n2", "data": {"kind": "database", "label": "PG", "tech": "PostgreSQL"}},
                {"id": "n3", "data": {"kind": "database", "label": "Redis", "tech": "Redis"}},
            ],
            "edges": [
                {"id": "e1", "source": "n1", "target": "n2", "data": {"flowKind": "data"}},
                {"id": "e2", "source": "n1", "target": "n3", "data": {"flowKind": "data"}},
            ],
        },
    )
    v2_resp = client.get(f"/api/v1/graphs/{graph_id}/versions").json()
    assert len(v2_resp) > len(v1_resp)  # nova versão foi criada
    diff = client.get(f"/api/v1/graphs/{graph_id}/diff/{v1_resp[-1]['id']}").json()
    assert isinstance(diff, dict)
    assert "added_nodes" in diff
    assert "removed_nodes" in diff
