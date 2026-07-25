# Azure Databricks Study Hub

Use this folder as the short path into Azure Databricks. Start with the map
below, use the quick checks for revision, and open the deep dive only when you
need architecture or code detail.

## Study path

| Time | Resource | Outcome |
|:---|:---|:---|
| 5 minutes | [Quick checks](quick-checks.md) | Recall the core terms and production checks |
| 20 minutes | [Deep dive](deep-dive.md) | Understand VNet injection, Delta Lake, Mosaic AI, and Terraform |
| 45 minutes | [Apps + MCP + Genie + AI Search](apps-mcp-genie-vector-search.md) | Deploy an app and connect governed analytics and RAG end to end |
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
  -> AI Search
  -> retrieve context
  -> model serving
  -> grounded answer

Business question
  -> Genie Agent
  -> governed SQL
  -> structured result

MCP client
  -> managed MCP URL
  -> OAuth + Unity Catalog permissions
  -> Genie / AI Search / SQL / UC function
```

## What is implemented?

- Documentation and reference snippets: available in this folder.
- End-to-end Apps, MCP, Genie, and AI Search implementation guide: available.
- Deployable Databricks Terraform: not yet implemented.
- Production workspace, Unity Catalog, clusters, and endpoints: require
  environment-specific Azure and Databricks configuration.

This distinction prevents reference code from being mistaken for infrastructure
that is already wired into the repository.
