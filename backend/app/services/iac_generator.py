"""P3.2.1 — Mapeamento real de catalogId para recursos Terraform/CDK."""
from __future__ import annotations

from typing import Any

# Mapeamento de catalogId → tipo de recurso Terraform/CDK
TF_CATALOG_MAP: dict[str, dict[str, Any]] = {
    # AWS Compute
    "cloud-aws-ecs": {"provider": "aws", "resource": "aws_ecs_cluster", "module": "ecs"},
    "cloud-aws-eks": {"provider": "aws", "resource": "aws_eks_cluster", "module": "eks"},
    "cloud-aws-lambda": {"provider": "aws", "resource": "aws_lambda_function", "module": "lambda"},
    "cloud-aws-ec2": {"provider": "aws", "resource": "aws_instance", "module": "ec2"},
    "cloud-aws-fargate": {"provider": "aws", "resource": "aws_ecs_task_definition", "module": "ecs"},
    # AWS Database
    "db-postgres": {"provider": "aws", "resource": "aws_db_instance", "module": "rds"},
    "db-mysql": {"provider": "aws", "resource": "aws_db_instance", "module": "rds"},
    "db-redis": {"provider": "aws", "resource": "aws_elasticache_cluster", "module": "elasticache"},
    "db-dynamodb": {"provider": "aws", "resource": "aws_dynamodb_table", "module": "dynamodb"},
    "db-redshift": {"provider": "aws", "resource": "aws_redshift_cluster", "module": "redshift"},
    # AWS Network
    "cloud-aws-vpc": {"provider": "aws", "resource": "aws_vpc", "module": "vpc"},
    "cloud-aws-alb": {"provider": "aws", "resource": "aws_lb", "module": "lb"},
    "cloud-aws-nlb": {"provider": "aws", "resource": "aws_lb", "module": "lb"},
    "cloud-aws-cf": {"provider": "aws", "resource": "aws_cloudfront_distribution", "module": "cloudfront"},
    "net-aws-nat": {"provider": "aws", "resource": "aws_nat_gateway", "module": "vpc"},
    "net-aws-tgw": {"provider": "aws", "resource": "aws_ec2_transit_gateway", "module": "vgw"},
    # AWS Security
    "sec-sg": {"provider": "aws", "resource": "aws_security_group", "module": "security"},
    "sec-iam-role": {"provider": "aws", "resource": "aws_iam_role", "module": "iam"},
    "sec-kms-key": {"provider": "aws", "resource": "aws_kms_key", "module": "kms"},
    "sec-waf": {"provider": "aws", "resource": "aws_wafv2_web_acl", "module": "waf"},
    # AWS Storage
    "cloud-aws-s3": {"provider": "aws", "resource": "aws_s3_bucket", "module": "s3"},
    # Azure Compute
    "cloud-azure-vm": {"provider": "azurerm", "resource": "azurerm_linux_virtual_machine", "module": "compute"},
    "cloud-azure-appsvc": {"provider": "azurerm", "resource": "azurerm_linux_web_app", "module": "appservice"},
    "cloud-azure-containerapps": {"provider": "azurerm", "resource": "azurerm_container_app", "module": "containerapps"},
    # Azure Database
    "db-azure-sql": {"provider": "azurerm", "resource": "azurerm_sql_database", "module": "sql"},
    "db-azure-cache": {"provider": "azurerm", "resource": "azurerm_redis_cache", "module": "cache"},
    # GCP Compute
    "cloud-gcp-gce": {"provider": "google", "resource": "google_compute_instance", "module": "compute"},
    "cloud-gcp-gke": {"provider": "google", "resource": "google_container_cluster", "module": "container"},
    # Generic/Custom
    "be-fastapi": {"provider": "custom", "resource": "null_resource", "module": None, "note": "Custom implementation required"},
    "be-nest": {"provider": "custom", "resource": "null_resource", "module": None, "note": "Custom implementation required"},
    "int-kafka": {"provider": "custom", "resource": "null_resource", "module": None, "note": "Use MSK or Confluent"},
    "obs-prometheus": {"provider": "custom", "resource": "null_resource", "module": None, "note": "Use managed Prometheus or self-hosted"},
}


def map_catalog_to_tf(catalog_id: str) -> dict[str, Any] | None:
    """Mapeia catalogId para definição de recurso Terraform."""
    return TF_CATALOG_MAP.get(catalog_id)


def generate_tf_module(nodes: list[dict], edges: list[dict]) -> dict[str, Any]:
    """Gera módulo Terraform básico a partir do grafo."""
    resources: dict[str, Any] = {}
    imports: list[str] = []
    notes: list[str] = []

    for node in nodes:
        data = node.get("data") or {}
        catalog_id = data.get("catalogId") or ""
        mapping = map_catalog_to_tf(catalog_id)

        if not mapping:
            continue

        provider = mapping["provider"]
        resource_type = mapping["resource"]
        module = mapping.get("module")

        if provider == "custom":
            notes.append(f"[!] {data.get('label', node.get('id'))}: recurso personalizado — revisar implementação")
            continue

        # Add provider import
        if provider not in imports:
            imports.append(provider)

        # Generate resource block
        label = data.get("label") or node.get("id") or "resource"
        safe_label = label.replace(" ", "_").lower()
        resource_key = f"{resource_type}.{safe_label}"

        resources[resource_key] = {
            "type": resource_type,
            "label": label,
            "provider": provider,
            "module": module,
            "config": generate_tf_config(data, provider, mapping),
        }

    return {
        "imports": imports,
        "resources": resources,
        "notes": notes,
        "warning": "Este é um esboço automático. Revisar antes de aplicar em produção.",
    }


def generate_tf_config(data: dict, provider: str, mapping: dict) -> dict[str, Any]:
    """Gera configuração Terraform básica a partir dos dados do nó."""
    config: dict[str, Any] = {}
    cfg = data.get("config") or {}

    if provider == "aws":
        if "s3" in mapping["resource"]:
            config["bucket"] = f"{data.get('label', 'bucket').lower().replace(' ', '-')}-bucket"
            config["acl"] = "private"
        elif "lambda" in mapping["resource"]:
            config["function_name"] = data.get("label", "lambda-function")
            config["runtime"] = cfg.get("runtime", "python3.11")
            config["handler"] = cfg.get("handler", "index.handler")
        elif "db" in mapping["resource"] or "rds" in mapping["resource"]:
            config["identifier"] = data.get("label", "database").lower().replace(" ", "-")
            config["engine"] = cfg.get("engine", "postgres")
            config["allocated_storage"] = cfg.get("allocated_storage", 20)
        elif "ecs" in mapping["resource"]:
            config["name"] = data.get("label", "ecs-cluster")
        elif "eks" in mapping["resource"]:
            config["cluster_name"] = data.get("label", "eks-cluster")
            config["version"] = cfg.get("k8s_version", "1.28")
        elif "vpc" in mapping["resource"]:
            config["cidr_block"] = cfg.get("cidr", "10.0.0.0/16")
        elif "alb" in mapping["resource"] or "lb" in mapping["resource"]:
            config["name"] = data.get("label", "alb").lower()
            config["internal"] = cfg.get("internal", True)
        elif "sg" in mapping["resource"]:
            config["name"] = data.get("label", "security-group").lower()
            config["vpc_id"] = "${aws_vpc.main.id}"
        elif "kms" in mapping["resource"]:
            config["description"] = data.get("label", "kms-key")
        elif "waf" in mapping["resource"]:
            config["name"] = data.get("label", "waf-acl").lower()
            config["scope"] = "REGIONAL"
        elif "elasticache" in mapping["resource"]:
            config["cluster_id"] = data.get("label", "redis").lower()
            config["engine"] = "redis"
        elif "dynamodb" in mapping["resource"]:
            config["name"] = data.get("label", "table").lower()
            config["billing_mode"] = "PAY_PER_REQUEST"
        elif "cloudfront" in mapping["resource"]:
            config["aliases"] = cfg.get("aliases", [])
    elif provider == "azurerm":
        if "linux_virtual_machine" in mapping["resource"]:
            config["name"] = data.get("label", "vm").lower()
            config["resource_group_name"] = "${azurerm_resource_group.main.name}"
        elif "linux_web_app" in mapping["resource"]:
            config["name"] = data.get("label", "app").lower()
            config["resource_group_name"] = "${azurerm_resource_group.main.name}"
            config["location"] = "${azurerm_resource_group.main.location}"
        elif "sql_database" in mapping["resource"]:
            config["name"] = data.get("label", "sql-db").lower()
            config["resource_group_name"] = "${azurerm_resource_group.main.name}"
        elif "redis_cache" in mapping["resource"]:
            config["name"] = data.get("label", "redis").lower()
            config["resource_group_name"] = "${azurerm_resource_group.main.name}"

    return config


def generate_cdk_stack(nodes: list[dict], edges: list[dict]) -> dict[str, Any]:
    """Gera stack CDK (TypeScript) básica a partir do grafo."""
    imports: list[str] = ["aws_cdk as cdk", "aws_cdk.aws_ec2 as ec2", "aws_cdk.aws_eks as eks"]
    resources: list[dict] = []

    for node in nodes:
        data = node.get("data") or {}
        catalog_id = data.get("catalogId") or ""
        mapping = map_catalog_to_tf(catalog_id)

        if not mapping:
            continue

        label = data.get("label") or node.get("id") or "resource"
        safe_id = label.replace(" ", "_").title().replace("_", "")

        if mapping["provider"] == "aws":
            if "ecs" in mapping["resource"]:
                resources.append({
                    "type": "EcsCluster",
                    "id": safe_id,
                    "import": "aws_cdk.aws_ecs as ecs",
                    "config": f"new ecs.Cluster(this, '{safe_id}', {{ vpc }})",
                })
            elif "eks" in mapping["resource"]:
                resources.append({
                    "type": "EksCluster",
                    "id": safe_id,
                    "import": "aws_cdk.aws_eks as eks",
                    "config": f"new eks.Cluster(this, '{safe_id}', {{ vpc, version: Version.of({mapping.get('config', {}).get('k8s_version', '1.28')}) }})",
                })
            elif "s3" in mapping["resource"]:
                resources.append({
                    "type": "Bucket",
                    "id": safe_id,
                    "import": "aws_cdk.aws_s3 as s3",
                    "config": f"new s3.Bucket(this, '{safe_id}', {{ removalPolicy: cdk.RemovalPolicy.RETAIN }})",
                })
            elif "lambda" in mapping["resource"]:
                resources.append({
                    "type": "Function",
                    "id": safe_id,
                    "import": "aws_cdk.aws_lambda as lambda",
                    "config": f"new lambda.Function(this, '{safe_id}', {{ runtime: lambda.Runtime.PYTHON_3_11, handler: 'index.handler', code: lambda.Code.from_asset('lambda') }})",
                })

    return {
        "imports": list(set(imports)),
        "resources": resources,
        "warning": "Este é um esboço automático. Revisar antes de aplicar em produção.",
    }
