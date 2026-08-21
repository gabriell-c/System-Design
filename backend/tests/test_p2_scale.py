"""P2: subsystems, semantic diff, owner_team, DR heuristics."""

from app.schemas.graph import ProjectNfr
from app.services.architecture_heuristics import analyze_trust_and_dr
from app.services.diff import semantic_diff
from app.services.subsystems import get_subsystem, list_subsystems, prefix_graph


def test_subsystem_catalog_has_cdn_and_identity():
    ids = {s["id"] for s in list_subsystems()}
    assert "cdn-global" in ids
    assert "identity" in ids
    assert "cicd" in ids
    spec = get_subsystem("cdn-global")
    assert len(spec["nodes"]) >= 3
    assert spec["edges"]


def test_prefix_graph_rewrites_ids_and_parents():
    spec = get_subsystem("identity")
    nodes, edges = prefix_graph(spec, "x-", offset_x=10, offset_y=20)
    ids = {n["id"] for n in nodes}
    assert all(i.startswith("x-") for i in ids)
    child = next(n for n in nodes if n.get("parentId"))
    assert child["parentId"].startswith("x-")
    assert child["position"]["x"] >= 10


def test_semantic_diff_detects_added_and_removed_nodes():
    left_nodes = [{"id": "a", "data": {"kind": "backend", "label": "API"}}]
    right_nodes = [
        {"id": "a", "data": {"kind": "backend", "label": "API v2"}, "parentId": "z1"},
        {"id": "b", "data": {"kind": "database", "label": "PG"}},
    ]
    left_edges = [{"id": "e1", "source": "a", "target": "gone"}]
    right_edges = [{"id": "e2", "source": "a", "target": "b"}]
    diff = semantic_diff(left_nodes, left_edges, right_nodes, right_edges)
    assert {n["id"] for n in diff["added_nodes"]} == {"b"}
    assert diff["removed_nodes"] == []
    assert any(n["id"] == "a" for n in diff["changed_nodes"])
    assert {e["id"] for e in diff["added_edges"]} == {"e2"}
    assert {e["id"] for e in diff["removed_edges"]} == {"e1"}


def test_import_subsystem_creates_diagram(client):
    proj = client.post("/api/v1/projects", json={"name": "Plat", "context": "x"}).json()
    resp = client.post(
        f"/api/v1/projects/{proj['id']}/subsystems/import",
        json={"subsystem_id": "cdn-global", "owner_team": "media"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["owner_team"] == "media"
    assert body["project_id"] == proj["id"]
    assert any(n.get("id") == "z-cdn" for n in body["nodes"])


def test_import_subsystem_merge_into_graph(client):
    proj = client.post("/api/v1/projects", json={"name": "Plat"}).json()
    created = client.post(
        f"/api/v1/projects/{proj['id']}/subsystems/import",
        json={"subsystem_id": "identity"},
    ).json()
    merged = client.post(
        f"/api/v1/projects/{proj['id']}/subsystems/import",
        json={"subsystem_id": "search", "merge_into_graph_id": created["id"]},
    ).json()
    ids = {n["id"] for n in merged["nodes"]}
    assert any("search" in i for i in ids)
    assert any("z-id" == i or i.endswith("z-id") for i in ids)


def test_graph_diff_endpoint(client):
    created = client.post(
        "/api/v1/graphs",
        json={"name": "v1", "nodes": [{"id": "a", "data": {"kind": "backend", "label": "A"}}], "edges": []},
    ).json()
    versions = client.get(f"/api/v1/graphs/{created['id']}/versions").json()
    assert versions
    client.put(
        f"/api/v1/graphs/{created['id']}",
        json={"nodes": [{"id": "a", "data": {"kind": "backend", "label": "A"}}, {"id": "b", "data": {"kind": "database", "label": "B"}}]},
    )
    diff = client.get(f"/api/v1/graphs/{created['id']}/diff/{versions[0]['id']}").json()
    assert any(n["id"] == "b" for n in diff["added_nodes"])


def test_owner_team_persists(client):
    created = client.post(
        "/api/v1/graphs",
        json={"name": "owned", "owner_team": "platform", "nodes": [], "edges": []},
    ).json()
    assert created["owner_team"] == "platform"
    updated = client.put(f"/api/v1/graphs/{created['id']}", json={"owner_team": "sre"}).json()
    assert updated["owner_team"] == "sre"


def test_dr_missing_rpo_warns():
    nfr = ProjectNfr(availability_pct=99.95)
    findings = analyze_trust_and_dr([], [], nfr)
    assert any("RPO/RTO" in f.title for f in findings)


def test_pii_public_subnet_is_critical():
    nodes = [
        {"id": "z-pub", "data": {"kind": "zone", "zoneKind": "subnet_public", "label": "Public"}},
        {"id": "db", "parentId": "z-pub", "data": {"kind": "database", "label": "Users DB", "tech": "Postgres"}},
    ]
    nfr = ProjectNfr(data_ownership=[{"entity": "users", "pii": True}])
    findings = analyze_trust_and_dr(nodes, [], nfr)
    titles = [f.title for f in findings]
    assert "Dado sensível fora do trust boundary" in titles
