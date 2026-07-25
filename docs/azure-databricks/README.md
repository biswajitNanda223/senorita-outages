# Azure Databricks Study Hub

Use this folder as the short path into Azure Databricks. Start with the map
below, use the quick checks for revision, and open the deep dive only when you
need architecture or code detail.

## Study path

| Time | Resource | Outcome |
|:---|:---|:---|
| 5 minutes | [Quick checks](quick-checks.md) | Recall the core terms and production checks |
| 20 minutes | [Deep dive](deep-dive.md) | Understand VNet injection, Delta Lake, Mosaic AI, and Terraform |
| Hands-on | `terraform/azure/` | Future home of the deployable Databricks infrastructure |

## Mental model

```text
Sources
  -> Bronze (raw)
  -> Silver (clean and validated)
  -> Gold (business-ready)
  -> BI / ML / GenAI

Documents
  -> chunk
  -> embed
  -> Vector Search
  -> retrieve context
  -> model serving
  -> grounded answer
```

## What is implemented?

- Documentation and reference snippets: available in this folder.
- Deployable Databricks Terraform: not yet implemented.
- Production workspace, Unity Catalog, clusters, and endpoints: require
  environment-specific Azure and Databricks configuration.

This distinction prevents reference code from being mistaken for infrastructure
that is already wired into the repository.

