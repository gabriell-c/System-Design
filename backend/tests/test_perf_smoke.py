"""Smoke de latência local — health + analyze heuristic.

Não substitui k6; prova baseline de resposta sob carga leve.
"""

from __future__ import annotations

import math
import time


def test_health_latency_p95_under_500ms(client):
    samples: list[float] = []
    for _ in range(20):
        t0 = time.perf_counter()
        r = client.get("/api/health")
        samples.append((time.perf_counter() - t0) * 1000)
        assert r.status_code == 200
    samples.sort()
    p95 = samples[int(0.95 * (len(samples) - 1))]
    assert p95 < 500, f"p95={p95:.1f}ms samples={samples}"


def test_heuristic_analyze_latency_p95_under_2s(client, no_omniroute):
    payload = {
        "name": "perf",
        "nodes": [
            {"id": "1", "data": {"kind": "backend", "label": "API", "config": {"framework": "FastAPI"}}},
            {"id": "2", "data": {"kind": "database", "label": "PG", "config": {"engine": "PostgreSQL"}}},
        ],
        "edges": [{"id": "e1", "source": "1", "target": "2"}],
    }
    samples: list[float] = []
    for _ in range(10):
        t0 = time.perf_counter()
        r = client.post("/api/v1/analyze/heuristic", json=payload)
        samples.append((time.perf_counter() - t0) * 1000)
        assert r.status_code == 200
    samples.sort()
    p95 = samples[max(0, int(math.ceil(0.95 * len(samples)) - 1))]
    assert p95 < 2000, f"p95={p95:.1f}ms"
