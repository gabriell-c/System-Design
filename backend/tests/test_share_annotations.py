"""Share + annotations API smoke (T13/T14)."""

from __future__ import annotations


def test_share_create_and_public_get(client, auth_headers):
    create = client.post(
        "/api/v1/graphs",
        headers=auth_headers,
        json={
            "name": "Share UX Graph",
            "context": "",
            "nodes": [
                {
                    "id": "n1",
                    "type": "free",
                    "position": {"x": 0, "y": 0},
                    "data": {"kind": "free-rectangle", "label": "A"},
                }
            ],
            "edges": [],
        },
    )
    assert create.status_code in (200, 201), create.text
    graph_id = create.json()["id"]

    share = client.post(f"/api/v1/share/graphs/{graph_id}", headers=auth_headers)
    assert share.status_code == 200, share.text
    token = share.json()["share_token"]
    assert token

    public = client.get(f"/api/v1/share/{token}")
    assert public.status_code == 200, public.text
    body = public.json()
    assert body["read_only"] is True
    assert body["name"] == "Share UX Graph"
    assert isinstance(body["nodes"], list)


def test_annotations_crud(client, auth_headers):
    create = client.post(
        "/api/v1/graphs",
        headers=auth_headers,
        json={
            "name": "Annot UX Graph",
            "context": "",
            "nodes": [],
            "edges": [],
        },
    )
    assert create.status_code in (200, 201), create.text
    graph_id = create.json()["id"]

    ann = client.post(
        f"/api/v1/graphs/{graph_id}/annotations",
        headers=auth_headers,
        json={"node_id": "node-1", "text": "nota de teste"},
    )
    assert ann.status_code == 201, ann.text
    ann_id = ann.json()["id"]

    listed = client.get(f"/api/v1/graphs/{graph_id}/annotations?node_id=node-1")
    assert listed.status_code == 200
    assert any(a["id"] == ann_id for a in listed.json())

    deleted = client.delete(
        f"/api/v1/graphs/{graph_id}/annotations/{ann_id}",
        headers=auth_headers,
    )
    assert deleted.status_code == 204
