/**
 * P1.3.3 — Deep reference architectures (Well-Architected templates)
 */

import type { Node } from "@xyflow/react";
import type { CanvasNodeData } from "@/lib/types";

export type ReferenceEdge = {
  source: string;
  target: string;
  data?: {
    flowKind?: string;
    protocol?: string;
    label?: string;
  };
};

export type ReferenceArchitecture = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  nodes: CanvasNodeData[];
  edges: ReferenceEdge[];
};

export const REFERENCE_ARCHITECTURES: ReferenceArchitecture[] = [
  {
    id: "ref-aws-serverless-api",
    name: "AWS Serverless API",
    description: "Arquitetura serverless completa na AWS com API Gateway, Lambda, DynamoDB e CloudFront.",
    tags: ["aws", "serverless", "api"],
    nodes: [
      { kind: "frontend", label: "Web App", tech: "React", catalogId: "fe-react", config: { framework: "React", rendering: "SSR" } },
      { kind: "cloud", label: "CloudFront", tech: "CloudFront", catalogId: "cloud-cdn", config: { provider: "aws" } },
      { kind: "integration", label: "API Gateway", tech: "API Gateway", catalogId: "cloud-apigw", config: { provider: "aws" } },
      { kind: "backend", label: "Auth Lambda", tech: "Lambda", catalogId: "cloud-lambda", config: { provider: "aws" } },
      { kind: "backend", label: "API Lambda", tech: "Lambda", catalogId: "cloud-lambda", config: { provider: "aws" } },
      { kind: "database", label: "DynamoDB", tech: "DynamoDB", catalogId: "db-dynamodb", config: { provider: "aws" } },
      { kind: "identity", label: "Cognito", tech: "Cognito", catalogId: "id-cognito", config: { provider: "aws" } },
      { kind: "observability", label: "CloudWatch", tech: "CloudWatch", catalogId: "obs-cloudwatch", config: { provider: "aws" } },
    ],
    edges: [
      { source: "fe-react", target: "cloud-cdn", data: { flowKind: "sync", protocol: "https" } },
      { source: "cloud-cdn", target: "cloud-apigw", data: { flowKind: "sync", protocol: "https" } },
      { source: "cloud-apigw", target: "id-cognito", data: { flowKind: "sync", protocol: "https" } },
      { source: "cloud-apigw", target: "cloud-lambda", data: { flowKind: "sync", protocol: "https" } },
      { source: "cloud-lambda", target: "db-dynamodb", data: { flowKind: "data", protocol: "sdk" } },
      { source: "cloud-lambda", target: "obs-cloudwatch", data: { flowKind: "async", protocol: "sdk" } },
    ],
  },
  {
    id: "ref-azure-microservices",
    name: "Azure Microservices",
    description: "Arquitetura de microsserviços na Azure com AKS, Service Bus e Cosmos DB.",
    tags: ["azure", "microservices", "kubernetes"],
    nodes: [
      { kind: "frontend", label: "Portal", tech: "Next.js", catalogId: "fe-next", config: { framework: "Next.js" } },
      { kind: "cloud", label: "Azure CDN", tech: "Front Door", catalogId: "cloud-frontdoor", config: { provider: "azure" } },
      { kind: "integration", label: "API Management", tech: "APIM", catalogId: "cloud-apim", config: { provider: "azure" } },
      { kind: "backend", label: "User Service", tech: "Container App", catalogId: "cloud-containerapp", config: { provider: "azure" } },
      { kind: "backend", label: "Order Service", tech: "Container App", catalogId: "cloud-containerapp", config: { provider: "azure" } },
      { kind: "integration", label: "Service Bus", tech: "Service Bus", catalogId: "msg-servicebus", config: { provider: "azure" } },
      { kind: "database", label: "Cosmos DB", tech: "Cosmos DB", catalogId: "db-cosmos", config: { provider: "azure" } },
      { kind: "identity", label: "Entra ID", tech: "Entra ID", catalogId: "id-entra", config: { provider: "azure" } },
    ],
    edges: [
      { source: "fe-next", target: "cloud-frontdoor", data: { flowKind: "sync", protocol: "https" } },
      { source: "cloud-frontdoor", target: "cloud-apim", data: { flowKind: "sync", protocol: "https" } },
      { source: "cloud-apim", target: "id-entra", data: { flowKind: "sync", protocol: "oauth2" } },
      { source: "cloud-apim", target: "cloud-containerapp", data: { flowKind: "sync", protocol: "https" } },
      { source: "cloud-containerapp", target: "msg-servicebus", data: { flowKind: "async", protocol: "amqp" } },
      { source: "cloud-containerapp", target: "db-cosmos", data: { flowKind: "data", protocol: "sdk" } },
    ],
  },
  {
    id: "ref-gcp-data-pipeline",
    name: "GCP Data Pipeline",
    description: "Pipeline de dados na GCP com Dataflow, BigQuery e Pub/Sub.",
    tags: ["gcp", "data", "pipeline"],
    nodes: [
      { kind: "integration", label: "Pub/Sub", tech: "Pub/Sub", catalogId: "msg-pubsub", config: { provider: "gcp" } },
      { kind: "backend", label: "Dataflow", tech: "Dataflow", catalogId: "compute-dataflow", config: { provider: "gcp" } },
      { kind: "database", label: "BigQuery", tech: "BigQuery", catalogId: "db-bigquery", config: { provider: "gcp" } },
      { kind: "database", label: "Cloud Storage", tech: "GCS", catalogId: "storage-gcs", config: { provider: "gcp" } },
      { kind: "observability", label: "Cloud Monitoring", tech: "Monitoring", catalogId: "obs-monitoring", config: { provider: "gcp" } },
    ],
    edges: [
      { source: "msg-pubsub", target: "compute-dataflow", data: { flowKind: "async", protocol: "pubsub" } },
      { source: "compute-dataflow", target: "db-bigquery", data: { flowKind: "data", protocol: "sdk" } },
      { source: "compute-dataflow", target: "storage-gcs", data: { flowKind: "data", protocol: "sdk" } },
      { source: "compute-dataflow", target: "obs-monitoring", data: { flowKind: "async", protocol: "sdk" } },
    ],
  },
];

export function getReferenceArchById(id: string): ReferenceArchitecture | undefined {
  return REFERENCE_ARCHITECTURES.find((r) => r.id === id);
}
