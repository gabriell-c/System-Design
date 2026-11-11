"""Integridade das fix actions P1 com o snapshot do catálogo.

Garante que TODO payload emitido por p1_analysis.py (catalogId, zoneKind,
patternIds, action_type) resuelve em item REAL do catálogo web / zone kind
real — para que "Aplicar fix" nunca aponte para item fantasma.

Regenerando o snapshot (catálogo cresceu ou zone kinds mudaram):
    cd web && UPDATE_CATALOG_SNAPSHOT=1 \
      pnpm exec node --experimental-strip-types --test src/lib/catalog.integrity.test.ts
(o comando reescreve backend/app/services/catalog_snapshot.json; sem a flag,
o mesmo teste valida o snapshot contra o catálogo atual)
"""

from __future__ import annotations

from app.schemas.analysis import Finding, FixAction
from app.services.p1_analysis import (
    VALID_FIX_ACTION_TYPES,
    attach_fix_actions,
    check_bounded_context_vs_shared_db,
    check_pii_in_sensitive_flow,
    check_saga_for_distributed_tx,
    load_catalog_snapshot,
)


def _finding(title: str, node_id: str | None = None, **extra) -> Finding:
    return Finding(severity="warning", title=title, detail="x", node_id=node_id, **extra)


def _collect_refs(findings: list[Finding]) -> tuple[set[str], set[str], set[str], set[str]]:
    """Coleta (catalog_ids, zone_kinds, pattern_ids, action_types) de todos os payloads."""
    catalog_ids: set[str] = set()
    zone_kinds: set[str] = set()
    pattern_ids: set[str] = set()
    action_types: set[str] = set()
    for f in findings:
        action = f.fix_action
        if action is None:
            continue
        action_types.add(action.action_type)
        payload = dict(action.payload or {})
        if payload.get("catalogId") or payload.get("catalog_id"):
            catalog_ids.add(str(payload.get("catalogId") or payload.get("catalog_id")))
        if payload.get("zoneKind") or payload.get("zone_kind"):
            zone_kinds.add(str(payload.get("zoneKind") or payload.get("zone_kind")))
        for pid in payload.get("patternIds") or []:
            pattern_ids.add(str(pid))
    return catalog_ids, zone_kinds, pattern_ids, action_types


def _assert_refs_in_snapshot(catalog_ids, zone_kinds, pattern_ids, action_types) -> None:
    snapshot = load_catalog_snapshot()
    valid_catalog = set(snapshot["catalog_ids"])
    valid_zones = set(snapshot["zone_kinds"])
    for cid in catalog_ids:
        assert cid in valid_catalog, f"catalogId {cid!r} não existe no snapshot"
    for zk in zone_kinds:
        assert zk in valid_zones, f"zoneKind {zk!r} não existe no snapshot"
    for pid in pattern_ids:
        assert pid in valid_catalog, f"patternId {pid!r} não existe no snapshot"
    for at in action_types:
        assert at in VALID_FIX_ACTION_TYPES, f"action_type {at!r} fora do enum"


def test_snapshot_has_authoritative_sets():
    snapshot = load_catalog_snapshot()
    assert len(snapshot["catalog_ids"]) > 50
    assert len(set(snapshot["catalog_ids"])) == len(snapshot["catalog_ids"]), "ids duplicados"
    assert "availability_zone" in snapshot["zone_kinds"]
    assert "data_mesh" in snapshot["zone_kinds"]


def test_keyword_fix_payloads_resolve_in_snapshot():
    """Cada ramificação de palavra-chave de attach_fix_actions gera ids reais."""
    findings = [
        _finding("Gargalo no gateway", node_id="n1"),  # bottleneck → highlight_node
        _finding("cdn missing for streaming"),  # cdn → CloudFront
        _finding("Falta monitor de métricas"),  # monitor → prometheus
        _finding("redis cache ausente"),  # redis → db-redis
        _finding("queue sem kafka"),  # queue → int-kafka
        _finding("load balancer lb único"),  # lb → cloud-aws-alb
        _finding("security group open"),  # sg → sec-sg
        _finding("vpc single subnet"),  # subnet/zone → add_zone
        _finding("database único"),  # db → db-postgres
        _finding("multi sem redundancy"),  # multi → multi-AZ
        _finding("saga outbox transaction"),  # saga → apply_pattern
        _finding("pii sem lgpd", node_id="n2"),  # pii → update_node
        _finding("slo uptime baixo"),  # slo → set_nfr
        _finding("cost pricing alto"),  # cost → note
        _finding("Sintoma inexplorado no componente", node_id="n3"),  # fallback → select_node
    ]
    out = attach_fix_actions(findings)
    catalog_ids, zone_kinds, pattern_ids, action_types = _collect_refs(out)
    _assert_refs_in_snapshot(catalog_ids, zone_kinds, pattern_ids, action_types)
    # Cobertura efetiva: todos os ramos de add_catalog_node dispararam
    assert "dep-cloudfront" in catalog_ids, "ramo CDN deveria sugerir o id real do CloudFront"
    assert "pat-prometheus" in catalog_ids
    assert "availability_zone" in zone_kinds


def test_static_checker_payloads_resolve_in_snapshot():
    """Fix actions fixas dos verificadores PII/saga/bounded-context resolvem no catálogo."""
    pii_nodes = [
        {"id": "db", "data": {"kind": "database", "label": "Users", "piiSensitivity": "high"}},
        {"id": "b1", "data": {"kind": "backend", "label": "API"}},
        {"id": "b2", "data": {"kind": "backend", "label": "API2"}},
    ]
    pii_findings = check_pii_in_sensitive_flow(pii_nodes, [])
    saga_findings = check_saga_for_distributed_tx(
        [
            {"id": "b1", "data": {"kind": "backend", "label": "A"}},
            {"id": "b2", "data": {"kind": "backend", "label": "B"}},
        ],
        [
            {"source": "b1", "target": "b2", "data": {"flowKind": "sync"}},
            {"source": "b1", "target": "b2", "data": {"flow_kind": "sync"}},
        ],
        {"arch_style": "microservices"},
    )
    ctx_findings = check_bounded_context_vs_shared_db(
        [
            {"id": "b1", "data": {"kind": "backend", "label": "A"}},
            {"id": "b2", "data": {"kind": "backend", "label": "B"}},
            {"id": "db", "data": {"kind": "database", "label": "PG", "tech": "Postgres"}},
        ],
        [
            {"source": "b1", "target": "db", "data": {"flowKind": "data"}},
            {"source": "b2", "target": "db", "data": {"flowKind": "data"}},
        ],
    )
    all_findings = attach_fix_actions(pii_findings + saga_findings + ctx_findings)
    catalog_ids, zone_kinds, pattern_ids, action_types = _collect_refs(all_findings)
    _assert_refs_in_snapshot(catalog_ids, zone_kinds, pattern_ids, action_types)
    assert "pat-oidc" in catalog_ids
    assert "pat-kms" in catalog_ids
    assert "pat-saga" in pattern_ids
    assert "pat-outbox" in pattern_ids
    assert "data_mesh" in zone_kinds


def test_valid_llm_fix_action_is_preserved():
    """fix_action válida (catalogId real) do LLM é mantida como está."""
    finding = _finding("cdn missing", fix_action=FixAction(
        action_type="add_catalog_node",
        label="Adicionar CDN",
        payload={"catalogId": "dep-cloudfront"},
    ))
    out = attach_fix_actions([finding])
    assert out[0].fix_action is not None
    assert out[0].fix_action.payload["catalogId"] == "dep-cloudfront"


def test_invalid_catalog_id_falls_back_to_keyword(caplog):
    """catalogId fantasma (ex. o antigo 'aws-cloudfront') → warning + fallback por palavra-chave."""
    finding = _finding("cdn missing", fix_action=FixAction(
        action_type="add_catalog_node",
        label="Adicionar CDN",
        payload={"catalogId": "aws-cloudfront"},
    ))
    out = attach_fix_actions([finding])
    assert out[0].fix_action is not None
    assert out[0].fix_action.payload["catalogId"] == "dep-cloudfront"
    assert any("rejeitada" in r.message for r in caplog.records)


def test_invalid_zone_kind_falls_back(caplog):
    finding = _finding("vpc single subnet", fix_action=FixAction(
        action_type="add_zone",
        label="Zona",
        payload={"zoneKind": "gigafactory"},
    ))
    out = attach_fix_actions([finding])
    assert out[0].fix_action is not None
    assert out[0].fix_action.payload["zoneKind"] == "availability_zone"
    assert any("rejeitada" in r.message for r in caplog.records)


def test_invalid_action_type_falls_back(caplog):
    finding = _finding("saga outbox", fix_action=FixAction(
        action_type="time_travel",
        label="X",
        payload={},
    ))
    out = attach_fix_actions([finding])
    assert out[0].fix_action is not None
    assert out[0].fix_action.action_type == "apply_pattern"
    assert any("rejeitada" in r.message for r in caplog.records)


def test_unknown_pattern_ids_fall_back():
    finding = _finding("saga outbox", fix_action=FixAction(
        action_type="apply_pattern",
        label="X",
        payload={"patternIds": ["pat-time-machine"]},
    ))
    out = attach_fix_actions([finding])
    assert out[0].fix_action is not None
    assert out[0].fix_action.payload["patternIds"] == ["pat-saga", "pat-outbox"]


def test_add_catalog_node_without_id_falls_back():
    finding = _finding("cdn missing", fix_action=FixAction(
        action_type="add_catalog_node",
        label="Adicionar CDN",
        payload={},
    ))
    out = attach_fix_actions([finding])
    assert out[0].fix_action is not None
    assert out[0].fix_action.payload["catalogId"] == "dep-cloudfront"
