# Azure Databricks Quick Checks

## 60-second recall

- **Control plane:** Databricks-managed workspace services and orchestration.
- **Compute plane:** clusters or serverless compute that process the data.
- **VNet injection:** places classic compute resources in customer-managed
  subnets.
- **NPIP:** removes public IP addresses from cluster nodes.
- **Unity Catalog:** centralized governance for data and AI assets.
- **Delta Lake:** transaction layer that adds ACID behavior and schema controls.
- **Bronze:** raw, append-oriented ingestion.
- **Silver:** cleaned, deduplicated, conformed data.
- **Gold:** aggregated, business-ready datasets.
- **Mosaic AI:** tooling for GenAI development, evaluation, retrieval, and
  serving.

## Architecture check

- [ ] Public and private Databricks subnets are dedicated and correctly delegated.
- [ ] Subnet CIDRs have enough space for expected cluster growth.
- [ ] No-public-IP or serverless network connectivity matches the chosen model.
- [ ] Storage, Key Vault, and dependent services use private connectivity where required.
- [ ] Egress routes, DNS, and firewall rules cover required Databricks endpoints.
- [ ] Unity Catalog is the governance boundary; workspace-local permissions are not the only control.
- [ ] Managed identities or service principals replace embedded credentials.

## Data pipeline check

- [ ] Bronze preserves source data and ingestion metadata.
- [ ] Silver applies schema validation, deduplication, and quality rules.
- [ ] Gold models serve a named business use case.
- [ ] Streaming checkpoints use durable storage and unique paths.
- [ ] Table names follow the `catalog.schema.table` hierarchy.
- [ ] Pipelines define expectations for bad records and replay.

## GenAI/RAG check

- [ ] Documents are chunked with source metadata.
- [ ] The embedding model and vector index dimensions agree.
- [ ] Retrieval quality is evaluated before model-answer quality.
- [ ] Prompts tell the model how to behave when context is insufficient.
- [ ] Responses retain citations or source identifiers.
- [ ] MLflow captures parameters, evaluation results, and model/prompt versions.
- [ ] Serving endpoints have authentication, rate limits, monitoring, and cost controls.

## Before deployment

```text
1. Confirm region and SKU availability.
2. Confirm network and private-DNS design.
3. Confirm Unity Catalog metastore and storage ownership.
4. Pin Terraform provider versions.
5. Run terraform fmt, validate, and plan.
6. Review the plan for public IPs, broad RBAC, and destructive changes.
7. Test with non-production data before promotion.
```

> The Terraform in the [deep dive](deep-dive.md) is a reference example. There
> is no deployable `terraform/azure/databricks.tf` in this repository yet.

