"""Integração: analyze endpoint com zonas + finding estrutural."""


def test_analyze_flags_public_db_zone(client, no_omniroute):
    payload = {
        "name": "Zone risk fixture",
        "context": "API com dado em subnet pública",
        "nfr": {
            "users_per_day": 1000,
            "arch_style": "serverless",
            "business_processes": ["Servir API"],
            "data_entities": ["Records"],
        },
        "nodes": [
            {
                "id": "z-pub",
                "type": "zone",
                "data": {"kind": "zone", "zoneKind": "subnet_public", "label": "Public"},
            },
            {
                "id": "c-api",
                "type": "arch",
                "data": {
                    "kind": "cloud",
                    "label": "API Gateway",
                    "tech": "API GW",
                    "catalogId": "cloud-aws-apigw",
                    "config": {},
                },
            },
            {
                "id": "c-db",
                "type": "arch",
                "parentId": "z-pub",
                "data": {
                    "kind": "database",
                    "label": "DynamoDB",
                    "tech": "DynamoDB",
                    "catalogId": "mc-aws-dynamodb",
                    "config": {},
                },
            },
            {
                "id": "c-fn",
                "type": "arch",
                "data": {
                    "kind": "cloud",
                    "label": "Lambda",
                    "tech": "Lambda",
                    "catalogId": "cloud-aws-lambda",
                    "config": {},
                },
            },
        ],
        "edges": [
            {
                "id": "e1",
                "source": "c-api",
                "target": "c-fn",
                "data": {"flowKind": "sync", "flowNumber": 1},
            },
            {
                "id": "e2",
                "source": "c-fn",
                "target": "c-db",
                "data": {"flowKind": "data", "flowNumber": 2},
            },
        ],
    }
    res = client.post("/api/v1/analyze", json=payload)
    assert res.status_code == 200, res.text
    body = res.json()
    titles = [f["title"] for f in body.get("findings", [])] + [
        f["title"] for f in body.get("style_findings", [])
    ]
    assert any("subnet pública" in t.lower() or "Dado em subnet" in t for t in titles)
    assert body.get("arch_style")
