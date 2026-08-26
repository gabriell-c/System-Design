def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_graph_crud(client):
    created = client.post(
        "/api/v1/graphs",
        json={"name": "MVP", "nodes": [{"id": "n1", "data": {"kind": "backend"}}], "edges": []},
    )
    assert created.status_code == 201
    graph_id = created.json()["id"]

    listed = client.get("/api/v1/graphs")
    assert listed.status_code == 200
    data = listed.json()
    assert "items" in data
    assert len(data["items"]) == 1
    assert data["total"] == 1

    fetched = client.get(f"/api/v1/graphs/{graph_id}")
    assert fetched.json()["name"] == "MVP"

    updated = client.put(f"/api/v1/graphs/{graph_id}", json={"name": "MVP v2"})
    assert updated.json()["name"] == "MVP v2"

    versions = client.get(f"/api/v1/graphs/{graph_id}/versions")
    assert versions.status_code == 200
    assert len(versions.json()) >= 2

    deleted = client.delete(f"/api/v1/graphs/{graph_id}")
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/graphs/{graph_id}").status_code == 404


def test_review_other_profile(client):
    created = client.post("/api/v1/graphs", json={"name": "Rev", "nodes": [], "edges": []})
    graph_id = created.json()["id"]
    reviewed = client.post(
        f"/api/v1/graphs/{graph_id}/review",
        json={"role": "other", "status": "approved", "comment": "Aprovado após checar IAM e backups."},
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["review_status"] == "approved"
    assert reviewed.json()["reviewer_role"] == "other"
