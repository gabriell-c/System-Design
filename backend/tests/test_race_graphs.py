"""Race real: criações paralelas no SQLite (UUID explícito + write guard)."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed

from app.database import SessionLocal, sqlite_write_guard
from app.models.graph import Graph, GraphVersion, new_uuid
from app.schemas.graph import ProjectNfr


def test_parallel_graph_creates_are_consistent(client):
    """N creates concorrentes devem persistir N graphs distintos (sem FlushError)."""
    # client fixture sobe schema + seed; o race é no ORM (mesmo caminho do create_graph).
    n = 12

    def create_one(i: int) -> str:
        db = SessionLocal()
        try:
            graph_id = new_uuid()
            graph = Graph(
                id=graph_id,
                name=f"race-{i}",
                context_text="",
                nfr_json=ProjectNfr().model_dump_json(),
                nodes_json="[]",
                edges_json="[]",
                review_status="draft",
            )
            with sqlite_write_guard():
                db.add(graph)
                db.flush()
                db.add(
                    GraphVersion(
                        id=new_uuid(),
                        graph_id=graph.id,
                        name=graph.name,
                        nodes_json=graph.nodes_json,
                        edges_json=graph.edges_json,
                    )
                )
                db.commit()
            return graph_id
        finally:
            db.close()

    ids: list[str] = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(create_one, i) for i in range(n)]
        for fut in as_completed(futures):
            ids.append(fut.result())

    assert len(ids) == n
    assert len(set(ids)) == n

    listed = client.get("/api/v1/graphs")
    assert listed.status_code == 200
    data = listed.json()
    names = {row["name"] for row in data["items"]}
    assert {f"race-{i}" for i in range(n)}.issubset(names)


def test_http_create_graph_assigns_uuid(client):
    resp = client.post(
        "/api/v1/graphs",
        json={"name": "uuid-http", "nodes": [], "edges": []},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert isinstance(body["id"], str) and len(body["id"]) == 36
