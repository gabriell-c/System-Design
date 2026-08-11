SAMPLE = {
    "name": "Loja",
    "nodes": [
        {
            "id": "fe",
            "data": {
                "kind": "frontend",
                "label": "Next.js",
                "tech": "Next.js",
                "catalogId": "fe-next",
                "config": {"framework": "Next.js", "uiLib": "Tailwind", "state": "Zustand", "rendering": "SSR"},
            },
        },
        {
            "id": "be",
            "data": {
                "kind": "backend",
                "label": "FastAPI",
                "tech": "FastAPI",
                "catalogId": "be-fastapi",
                "config": {"framework": "FastAPI"},
            },
        },
        {
            "id": "db",
            "data": {
                "kind": "database",
                "label": "PostgreSQL",
                "tech": "PostgreSQL",
                "catalogId": "db-postgres",
                "config": {"engine": "PostgreSQL"},
            },
        },
        {
            "id": "ec2",
            "data": {
                "kind": "cloud",
                "label": "EC2",
                "tech": "AWS EC2",
                "catalogId": "cloud-aws-ec2",
                "config": {"provider": "AWS", "service": "EC2"},
            },
        },
    ],
    "edges": [
        {"id": "e1", "source": "fe", "target": "be"},
        {"id": "e2", "source": "be", "target": "db"},
        {"id": "e3", "source": "be", "target": "ec2"},
    ],
}


def test_e2e_create_analyze_version_restore_review(client, no_omniroute):
    created = client.post("/api/v1/graphs", json=SAMPLE)
    assert created.status_code == 201
    graph_id = created.json()["id"]

    analyzed = client.post("/api/v1/analyze", json={**SAMPLE, "persist_id": graph_id})
    assert analyzed.status_code == 200
    body = analyzed.json()
    assert "score" in body
    assert body["ia_ok"] is False
    assert "heuristic" in body["agents_used"]
    assert set(body["growth"]) == {"small", "medium", "large"}

    saved = client.get(f"/api/v1/graphs/{graph_id}")
    assert saved.json()["analysis"]["score"] == body["score"]

    client.put(f"/api/v1/graphs/{graph_id}", json={"name": "Loja v2", "nodes": SAMPLE["nodes"], "edges": SAMPLE["edges"]})
    versions = client.get(f"/api/v1/graphs/{graph_id}/versions").json()
    oldest = versions[-1]
    restored = client.post(f"/api/v1/graphs/{graph_id}/versions/{oldest['id']}/restore")
    assert restored.status_code == 200

    reviewed = client.post(
        f"/api/v1/graphs/{graph_id}/review",
        json={"role": "senior", "status": "approved", "comment": "Sênior valida a análise heurística."},
    )
    assert reviewed.json()["review_status"] == "approved"

    compared = client.post("/api/v1/compare", json={"left": SAMPLE, "right": SAMPLE})
    assert compared.status_code == 200
    assert compared.json()["comparison"]["score_delta"] == 0
