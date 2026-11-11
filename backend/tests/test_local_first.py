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


def test_embed_orphan_graph_is_denied(client, anonymous_client):
    """P1.6 — default-deny: grafo órfão (sem projeto) não tem embed público."""
    graph = client.post(
        "/api/v1/graphs",
        json={"name": "Orphan", "nodes": [], "edges": []},
    ).json()
    assert anonymous_client.get(f"/api/v1/embed/{graph['id']}").status_code == 403


def test_auto_init_returns_existing_primary(client):
    proj = client.post("/api/v1/projects", json={"name": "With Diagrams"}).json()
    diagrams = client.get(f"/api/v1/projects/{proj['id']}/diagrams").json()
    assert len(diagrams) >= 1
    resp = client.post(f"/api/v1/projects/{proj['id']}/diagrams/auto-init")
    assert resp.status_code == 201
    body = resp.json()
    assert body["project_id"] == proj["id"]
    assert body["id"] in {d["id"] for d in diagrams}


def test_auto_init_creates_when_project_has_no_diagrams(client):
    """Simula projeto legado sem diagramas: auto-init cria um associado."""
    from app.database import SessionLocal
    from app.models.graph import Project, new_uuid
    from app.models.user import User

    with SessionLocal() as db:
        # P1.2 — owner_id agora é obrigatório; projeto legado é atribuído ao SENIOR.
        senior = db.query(User).filter(User.role == "senior").first()
        project = Project(
            id=new_uuid(),
            name="Empty Legacy",
            owner_id=senior.id,
            description="",
            context="",
            nfr_json="{}",
            is_public=False,
            project_kind="architecture",
            archived=False,
            pinned=False,
        )
        db.add(project)
        db.commit()
        pid = project.id

    assert client.get(f"/api/v1/projects/{pid}/diagrams").json() == []
    resp = client.post(f"/api/v1/projects/{pid}/diagrams/auto-init")
    assert resp.status_code == 201
    body = resp.json()
    assert body["project_id"] == pid
    assert body["diagram_kind"] == "application"
    assert body["name"]
    listed = client.get(f"/api/v1/projects/{pid}/diagrams").json()
    assert len(listed) == 1
    assert listed[0]["id"] == body["id"]


def test_update_graph_keeps_project_association(client):
    proj = client.post("/api/v1/projects", json={"name": "Persist"}).json()
    diagrams = client.get(f"/api/v1/projects/{proj['id']}/diagrams").json()
    gid = diagrams[0]["id"]
    payload = {
        "name": "Persist",
        "nodes": [{"id": "n1", "type": "arch", "position": {"x": 0, "y": 0}, "data": {"kind": "backend", "label": "API"}}],
        "edges": [],
        "project_id": proj["id"],
        "excalidraw_elements": [{"id": "e1", "type": "rectangle", "x": 1, "y": 2}],
    }
    updated = client.put(f"/api/v1/graphs/{gid}", json=payload)
    assert updated.status_code == 200
    body = updated.json()
    assert body["project_id"] == proj["id"]
    assert len(body["nodes"]) == 1
    assert len(body.get("excalidraw_elements") or []) == 1
    again = client.get(f"/api/v1/graphs/{gid}").json()
    assert again["project_id"] == proj["id"]
    assert len(again["nodes"]) == 1
    assert len(again.get("excalidraw_elements") or []) == 1
