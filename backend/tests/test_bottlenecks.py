"""Testes de detect_bottlenecks — card culpado, não o sintoma."""

from __future__ import annotations

from app.schemas.graph import ProjectNfr
from app.services.architecture_heuristics import detect_bottlenecks


def _card(nid: str, kind: str, label: str, catalog_id: str = "") -> dict:
    return {
        "id": nid,
        "data": {
            "kind": kind,
            "label": label,
            "tech": label,
            "catalogId": catalog_id or label.lower().replace(" ", "-"),
            "config": {},
        },
    }


def test_compute_overload_marks_ecs_not_frontend():
    nodes = [
        _card("fe", "frontend", "Next.js"),
        _card("ecs", "cloud", "ECS", "cloud-aws-ecs"),
        _card("pg", "database", "Postgres", "db-postgres"),
    ]
    nfr = ProjectNfr(users_per_day=150_000)
    findings = detect_bottlenecks(nodes, [], nfr)
    compute = [f for f in findings if f.title.startswith("Compute")]
    assert len(compute) == 1
    assert compute[0].node_id == "ecs"
    assert compute[0].severity == "critical"


def test_compute_with_alb_is_warning_not_critical():
    nodes = [
        _card("ecs", "cloud", "ECS", "cloud-aws-ecs"),
        _card("alb", "cloud", "ALB", "cloud-aws-alb"),
    ]
    nfr = ProjectNfr(users_per_day=200_000)
    findings = detect_bottlenecks(nodes, [], nfr)
    compute = [f for f in findings if f.title.startswith("Compute")]
    assert len(compute) == 1
    assert compute[0].severity == "warning"


def test_single_db_ha_marks_postgres_not_next():
    nodes = [
        _card("fe", "frontend", "Next.js"),
        _card("api", "backend", "FastAPI", "be-fastapi"),
        _card("pg", "database", "Postgres", "db-postgres"),
    ]
    nfr = ProjectNfr(users_per_day=10_000, availability_pct=99.95)
    findings = detect_bottlenecks(nodes, [], nfr)
    db = [f for f in findings if "Banco único" in f.title]
    assert len(db) == 1
    assert db[0].node_id == "pg"
    assert db[0].severity == "critical"


def test_multi_az_skips_single_db_rule():
    nodes = [
        _card("pg", "database", "Postgres", "db-postgres"),
        {
            "id": "aza",
            "data": {"kind": "zone", "zoneKind": "availability_zone", "label": "AZ-a"},
        },
        {
            "id": "azb",
            "data": {"kind": "zone", "zoneKind": "availability_zone", "label": "AZ-b"},
        },
    ]
    nfr = ProjectNfr(availability_pct=99.99)
    findings = detect_bottlenecks(nodes, [], nfr)
    assert not any("Banco único" in f.title for f in findings)


def test_no_redis_marks_backend_not_postgres():
    nodes = [
        _card("api", "backend", "Nest", "be-nest"),
        _card("pg", "database", "Postgres", "db-postgres"),
    ]
    nfr = ProjectNfr(users_per_day=80_000, latency_p99_ms=150)
    findings = detect_bottlenecks(nodes, [], nfr)
    cache = [f for f in findings if "cache" in f.title.lower() or "Redis" in f.title]
    assert len(cache) == 1
    assert cache[0].node_id == "api"


def test_s3_without_cdn_marks_s3():
    nodes = [
        _card("s3", "cloud", "S3", "cloud-aws-s3"),
        _card("api", "backend", "API", "be-fastapi"),
    ]
    nfr = ProjectNfr(users_per_day=60_000)
    findings = detect_bottlenecks(nodes, [], nfr)
    s3 = [f for f in findings if "CDN" in f.title or "Object storage" in f.title]
    assert len(s3) == 1
    assert s3[0].node_id == "s3"


def test_serverless_skips_queue_rule():
    nodes = [
        _card("l1", "cloud", "Lambda A", "cloud-aws-lambda"),
        _card("l2", "cloud", "Lambda B", "cloud-aws-lambda"),
        _card("api", "backend", "API", "be-fastapi"),
    ]
    nfr = ProjectNfr(users_per_day=200_000, arch_style="serverless")
    findings = detect_bottlenecks(nodes, [], nfr)
    assert not any("fila" in f.title.lower() or "messaging" in f.title.lower() for f in findings)
