"""Catálogo de subsystems reutilizáveis para composição de projetos grandes."""

from __future__ import annotations

SUBSYSTEMS: dict[str, dict] = {
    "cdn-global": {
        "name": "CDN global",
        "owner_team": "media",
        "nodes": [
            {"id": "z-cdn", "type": "zone", "position": {"x": 40, "y": 40}, "width": 420, "height": 320, "data": {"kind": "zone", "zoneKind": "plane", "label": "CDN / Edge", "provider": "aws"}},
            {"id": "c-waf", "type": "arch", "parentId": "z-cdn", "position": {"x": 24, "y": 48}, "data": {"kind": "security", "label": "WAF", "catalogId": "sec-waf", "tech": "WAF", "config": {"provider": "aws"}}},
            {"id": "c-cf", "type": "arch", "parentId": "z-cdn", "position": {"x": 24, "y": 140}, "data": {"kind": "cloud", "label": "CloudFront", "catalogId": "cloud-aws-cf", "tech": "CloudFront", "config": {"provider": "aws"}}},
            {"id": "c-s3", "type": "arch", "parentId": "z-cdn", "position": {"x": 24, "y": 232}, "data": {"kind": "cloud", "label": "S3 origin", "catalogId": "cloud-aws-s3", "tech": "S3", "config": {"provider": "aws"}}},
        ],
        "edges": [
            {"id": "e-cdn-1", "source": "c-waf", "target": "c-cf", "data": {"flowKind": "sync", "protocol": "https", "flowNumber": 1, "label": "HTTPS"}},
            {"id": "e-cdn-2", "source": "c-cf", "target": "c-s3", "data": {"flowKind": "data", "protocol": "s3", "flowNumber": 2, "label": "origin"}},
        ],
    },
    "identity": {
        "name": "Identity",
        "owner_team": "identity",
        "nodes": [
            {"id": "z-id", "type": "zone", "position": {"x": 40, "y": 40}, "width": 360, "height": 260, "data": {"kind": "zone", "zoneKind": "security_boundary", "label": "Identity", "provider": "aws"}},
            {"id": "c-cog", "type": "arch", "parentId": "z-id", "position": {"x": 24, "y": 48}, "data": {"kind": "identity", "label": "Cognito", "catalogId": "id-cognito", "tech": "Cognito", "config": {"provider": "aws"}}},
            {"id": "c-jwt", "type": "arch", "parentId": "z-id", "position": {"x": 24, "y": 140}, "data": {"kind": "identity", "label": "JWT Authorizer", "catalogId": "id-jwt", "tech": "JWT", "config": {}}},
        ],
        "edges": [
            {"id": "e-id-1", "source": "c-cog", "target": "c-jwt", "data": {"flowKind": "control", "protocol": "https", "flowNumber": 1, "label": "tokens"}},
        ],
    },
    "ingest": {
        "name": "Ingest",
        "owner_team": "media",
        "nodes": [
            {"id": "z-ing", "type": "zone", "position": {"x": 40, "y": 40}, "width": 420, "height": 280, "data": {"kind": "zone", "zoneKind": "plane", "label": "Ingest", "provider": "aws"}},
            {"id": "c-apigw", "type": "arch", "parentId": "z-ing", "position": {"x": 24, "y": 48}, "data": {"kind": "cloud", "label": "API Gateway", "catalogId": "cloud-aws-apigw", "tech": "API GW", "config": {"provider": "aws"}}},
            {"id": "c-kinesis", "type": "arch", "parentId": "z-ing", "position": {"x": 24, "y": 140}, "data": {"kind": "integration", "label": "Kafka ingest", "catalogId": "int-kafka", "tech": "Kafka", "config": {}}},
        ],
        "edges": [
            {"id": "e-ing-1", "source": "c-apigw", "target": "c-kinesis", "data": {"flowKind": "async", "protocol": "kafka", "flowNumber": 1, "label": "upload events"}},
        ],
    },
    "search": {
        "name": "Search",
        "owner_team": "discovery",
        "nodes": [
            {"id": "z-search", "type": "zone", "position": {"x": 40, "y": 40}, "width": 360, "height": 240, "data": {"kind": "zone", "zoneKind": "layer", "label": "Search", "provider": "aws"}},
            {"id": "c-es", "type": "arch", "parentId": "z-search", "position": {"x": 24, "y": 48}, "data": {"kind": "database", "label": "Elasticsearch", "catalogId": "db-elasticsearch", "tech": "Elasticsearch", "config": {}}},
        ],
        "edges": [],
    },
    "cicd": {
        "name": "CI/CD Pipeline",
        "owner_team": "platform",
        "nodes": [
            {"id": "z-cicd", "type": "zone", "position": {"x": 40, "y": 40}, "width": 520, "height": 280, "data": {"kind": "zone", "zoneKind": "plane", "label": "CI/CD", "provider": "generic"}},
            {"id": "c-gh", "type": "arch", "parentId": "z-cicd", "position": {"x": 24, "y": 48}, "data": {"kind": "integration", "label": "GitHub", "catalogId": "int-github", "tech": "GitHub", "config": {}}},
            {"id": "c-gha", "type": "arch", "parentId": "z-cicd", "position": {"x": 240, "y": 48}, "data": {"kind": "deploy", "label": "GitHub Actions", "catalogId": "dep-ghactions", "tech": "GitHub Actions", "config": {}}},
            {"id": "c-tf", "type": "arch", "parentId": "z-cicd", "position": {"x": 24, "y": 140}, "data": {"kind": "deploy", "label": "Terraform", "catalogId": "dep-terraform", "tech": "Terraform", "config": {}}},
            {"id": "c-k8s", "type": "arch", "parentId": "z-cicd", "position": {"x": 240, "y": 140}, "data": {"kind": "deploy", "label": "Kubernetes", "catalogId": "dep-k8s", "tech": "Kubernetes", "config": {}}},
        ],
        "edges": [
            {"id": "e-ci-1", "source": "c-gh", "target": "c-gha", "data": {"flowKind": "control", "flowNumber": 1, "label": "push"}},
            {"id": "e-ci-2", "source": "c-gha", "target": "c-tf", "data": {"flowKind": "control", "flowNumber": 2, "label": "plan/apply"}},
            {"id": "e-ci-3", "source": "c-gha", "target": "c-k8s", "data": {"flowKind": "control", "flowNumber": 3, "label": "deploy"}},
        ],
    },
    "encoding": {
        "name": "Encoding (multi-bitrate + DRM)",
        "owner_team": "media",
        "nodes": [
            {"id": "z-enc", "type": "zone", "position": {"x": 40, "y": 40}, "width": 480, "height": 320, "data": {"kind": "zone", "zoneKind": "layer", "label": "Encoding farm", "provider": "aws"}},
            {"id": "c-kafka", "type": "arch", "parentId": "z-enc", "position": {"x": 24, "y": 48}, "data": {"kind": "integration", "label": "Job queue", "catalogId": "int-kafka", "tech": "Kafka", "config": {}}},
            {"id": "c-ecs", "type": "arch", "parentId": "z-enc", "position": {"x": 200, "y": 48}, "data": {"kind": "cloud", "label": "Transcode workers", "catalogId": "cloud-aws-ecs", "tech": "ECS", "config": {"provider": "aws"}}},
            {"id": "c-s3", "type": "arch", "parentId": "z-enc", "position": {"x": 200, "y": 160}, "data": {"kind": "cloud", "label": "Renditions", "catalogId": "cloud-aws-s3", "tech": "S3", "config": {"provider": "aws"}}},
            {"id": "c-drm", "type": "arch", "parentId": "z-enc", "position": {"x": 24, "y": 160}, "data": {"kind": "security", "label": "DRM keys", "catalogId": "sec-secrets", "tech": "Secrets Manager", "config": {}}},
            {"id": "c-thumbs", "type": "arch", "parentId": "z-enc", "position": {"x": 360, "y": 48}, "data": {"kind": "backend", "label": "Thumbnails", "catalogId": "be-fastapi", "tech": "FastAPI", "config": {}}},
        ],
        "edges": [
            {"id": "e-enc-1", "source": "c-kafka", "target": "c-ecs", "data": {"flowKind": "async", "protocol": "kafka", "flowNumber": 1, "label": "jobs"}},
            {"id": "e-enc-2", "source": "c-ecs", "target": "c-s3", "data": {"flowKind": "data", "protocol": "s3", "flowNumber": 2, "label": "renditions"}},
            {"id": "e-enc-3", "source": "c-ecs", "target": "c-drm", "data": {"flowKind": "control", "flowNumber": 3, "label": "license"}},
            {"id": "e-enc-4", "source": "c-ecs", "target": "c-thumbs", "data": {"flowKind": "async", "flowNumber": 4, "label": "thumbs"}},
        ],
    },
    "recommendations": {
        "name": "Recommendations",
        "owner_team": "discovery",
        "nodes": [
            {"id": "z-rec", "type": "zone", "position": {"x": 40, "y": 40}, "width": 400, "height": 260, "data": {"kind": "zone", "zoneKind": "layer", "label": "Recs", "provider": "aws"}},
            {"id": "c-rec", "type": "arch", "parentId": "z-rec", "position": {"x": 24, "y": 48}, "data": {"kind": "backend", "label": "Ranking API", "catalogId": "be-fastapi", "tech": "FastAPI", "config": {}}},
            {"id": "c-redis", "type": "arch", "parentId": "z-rec", "position": {"x": 200, "y": 48}, "data": {"kind": "database", "label": "Feature cache", "catalogId": "db-redis", "tech": "Redis", "config": {}}},
            {"id": "c-kafka", "type": "arch", "parentId": "z-rec", "position": {"x": 24, "y": 140}, "data": {"kind": "integration", "label": "Watch events", "catalogId": "int-kafka", "tech": "Kafka", "config": {}}},
        ],
        "edges": [
            {"id": "e-rec-1", "source": "c-kafka", "target": "c-rec", "data": {"flowKind": "async", "protocol": "kafka", "flowNumber": 1}},
            {"id": "e-rec-2", "source": "c-rec", "target": "c-redis", "data": {"flowKind": "data", "flowNumber": 2, "label": "features"}},
        ],
    },
    "ads": {
        "name": "Ads auction",
        "owner_team": "monetization",
        "nodes": [
            {"id": "z-ads", "type": "zone", "position": {"x": 40, "y": 40}, "width": 400, "height": 260, "data": {"kind": "zone", "zoneKind": "layer", "label": "Ads", "provider": "aws"}},
            {"id": "c-ads", "type": "arch", "parentId": "z-ads", "position": {"x": 24, "y": 48}, "data": {"kind": "backend", "label": "Auction", "catalogId": "be-nest", "tech": "NestJS", "config": {}}},
            {"id": "c-redis", "type": "arch", "parentId": "z-ads", "position": {"x": 200, "y": 48}, "data": {"kind": "database", "label": "Bid cache", "catalogId": "db-redis", "tech": "Redis", "config": {}}},
        ],
        "edges": [
            {"id": "e-ads-1", "source": "c-ads", "target": "c-redis", "data": {"flowKind": "data", "flowNumber": 1, "isCriticalPath": True}},
        ],
    },
    "live": {
        "name": "Live streaming",
        "owner_team": "media",
        "nodes": [
            {"id": "z-live", "type": "zone", "position": {"x": 40, "y": 40}, "width": 440, "height": 280, "data": {"kind": "zone", "zoneKind": "plane", "label": "Live", "provider": "aws"}},
            {"id": "c-api", "type": "arch", "parentId": "z-live", "position": {"x": 24, "y": 48}, "data": {"kind": "backend", "label": "Live API", "catalogId": "be-fastapi", "tech": "FastAPI", "config": {}}},
            {"id": "c-media", "type": "arch", "parentId": "z-live", "position": {"x": 200, "y": 48}, "data": {"kind": "cloud", "label": "MediaLive", "catalogId": "cloud-aws-media", "tech": "MediaLive", "config": {"provider": "aws"}}},
            {"id": "c-s3", "type": "arch", "parentId": "z-live", "position": {"x": 200, "y": 140}, "data": {"kind": "cloud", "label": "Archive", "catalogId": "cloud-aws-s3", "tech": "S3", "config": {"provider": "aws"}}},
        ],
        "edges": [
            {"id": "e-live-1", "source": "c-api", "target": "c-media", "data": {"flowKind": "data", "flowNumber": 1, "label": "RTMP", "isCriticalPath": True}},
            {"id": "e-live-2", "source": "c-media", "target": "c-s3", "data": {"flowKind": "data", "protocol": "s3", "flowNumber": 2, "label": "archive"}},
        ],
    },
}


def list_subsystems() -> list[dict]:
    return [
        {"id": key, "name": spec["name"], "owner_team": spec.get("owner_team"), "node_count": len(spec["nodes"])}
        for key, spec in SUBSYSTEMS.items()
    ]


def get_subsystem(subsystem_id: str) -> dict:
    spec = SUBSYSTEMS.get(subsystem_id)
    if not spec:
        raise KeyError(subsystem_id)
    return spec


def prefix_graph(spec: dict, prefix: str, offset_x: float = 0, offset_y: float = 0) -> tuple[list[dict], list[dict]]:
    """Copia nós/arestas com prefixo de id para merge em outro diagrama."""
    nodes: list[dict] = []
    id_map: dict[str, str] = {}
    for node in spec["nodes"]:
        old = str(node.get("id"))
        new = f"{prefix}{old}"
        id_map[old] = new
        cloned = dict(node)
        cloned["id"] = new
        pos = dict(node.get("position") or {})
        cloned["position"] = {"x": float(pos.get("x") or 0) + offset_x, "y": float(pos.get("y") or 0) + offset_y}
        if node.get("parentId"):
            cloned["parentId"] = f"{prefix}{node['parentId']}"
        nodes.append(cloned)
    edges: list[dict] = []
    for edge in spec["edges"]:
        cloned = dict(edge)
        cloned["id"] = f"{prefix}{edge.get('id')}"
        cloned["source"] = id_map.get(str(edge.get("source")), edge.get("source"))
        cloned["target"] = id_map.get(str(edge.get("target")), edge.get("target"))
        edges.append(cloned)
    return nodes, edges
