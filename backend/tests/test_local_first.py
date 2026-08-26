"""Local-first hardening: project auth, rate limits, payload caps, public embeds."""


def test_create_project_requires_auth(anonymous_client):
    resp = anonymous_client.post("/api/v1/projects", json={"name": "Secret"})
    assert resp.status_code == 401


def test_get_project_requires_auth(anonymous_client, client):
    created = client.post("/api/v1/projects", json={"name": "Mine"})
    assert created.status_code == 201
    pid = created.json()["id"]
    resp = anonymous_client.get(f"/api/v1/projects/{pid}")
    assert resp.status_code == 401


def test_authenticated_project_crud(client):
    created = client.post("/api/v1/projects", json={"name": "Local First"})
    assert created.status_code == 201
    pid = created.json()["id"]
    fetched = client.get(f"/api/v1/projects/{pid}")
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Local First"


def test_analyze_rate_limit(client, no_omniroute):
    payload = {
        "name": "RL",
        "nodes": [{"id": "n1", "data": {"kind": "backend", "label": "API"}}],
        "edges": [],
    }
    statuses = []
    for _ in range(12):
        statuses.append(client.post("/api/v1/analyze/heuristic", json=payload).status_code)
    assert 429 in statuses
    assert statuses.count(200) >= 10


def test_graph_payload_max_nodes(client):
    nodes = [{"id": f"n{i}", "data": {"kind": "backend"}} for i in range(501)]
    resp = client.post(
        "/api/v1/graphs",
        json={"name": "TooBig", "nodes": nodes, "edges": []},
    )
    assert resp.status_code == 422


def test_embed_blocks_private_project(client, anonymous_client):
    proj = client.post(
        "/api/v1/projects",
        json={"name": "Private", "is_public": False},
    ).json()
    diagrams = client.get(f"/api/v1/projects/{proj['id']}/diagrams").json()
    assert diagrams
    gid = diagrams[0]["id"]
    assert anonymous_client.get(f"/api/v1/embed/{gid}").status_code == 403
    token = client.get(f"/api/v1/embed/{gid}/token")
    assert token.status_code == 403


def test_embed_allows_public_project(client, anonymous_client):
    proj = client.post(
        "/api/v1/projects",
        json={"name": "Public", "is_public": True},
    ).json()
    diagrams = client.get(f"/api/v1/projects/{proj['id']}/diagrams").json()
    gid = diagrams[0]["id"]
    assert anonymous_client.get(f"/api/v1/embed/{gid}").status_code == 200
    assert client.get(f"/api/v1/embed/{gid}/token").status_code == 200


def test_embed_orphan_graph_is_public(client, anonymous_client):
    graph = client.post(
        "/api/v1/graphs",
        json={"name": "Orphan", "nodes": [], "edges": []},
    ).json()
    assert anonymous_client.get(f"/api/v1/embed/{graph['id']}").status_code == 200
