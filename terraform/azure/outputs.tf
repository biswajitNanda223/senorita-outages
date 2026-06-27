output "resource_group_name" {
  description = "The Resource Group name."
  value       = azurerm_resource_group.rg.name
}

output "acr_login_server" {
  description = "The login server URI for the Azure Container Registry."
  value       = azurerm_container_registry.acr.login_server
}

output "aks_cluster_name" {
  description = "The name of the private AKS cluster."
  value       = azurerm_kubernetes_cluster.aks.name
}

output "aks_oidc_issuer_url" {
  description = "The OIDC issuer URL for the AKS cluster (useful for setting up workload identity)."
  value       = azurerm_kubernetes_cluster.aks.oidc_issuer_url
}

output "sso_client_id" {
  description = "The Client ID of the registered Azure AD SSO Application."
  value       = azuread_application.sso_app.client_id
}

output "sso_client_secret" {
  description = "The secret for the registered Azure AD SSO Application."
  value       = azuread_application_password.sso_app_secret.value
  sensitive   = true
}

output "web_app_url" {
  description = "The default URL of the App Service."
  value       = azurerm_linux_web_app.app.default_hostname
}

output "redis_hostname" {
  description = "The private hostname of the Redis instance."
  value       = azurerm_redis_cache.redis.hostname
}

output "key_vault_uri" {
  description = "The URI of the Azure Key Vault for secrets retrieval."
  value       = azurerm_key_vault.kv.vault_uri
}

output "blob_storage_endpoint" {
  description = "The primary endpoint URL for Blob Storage."
  value       = azurerm_storage_account.blob_store.primary_blob_endpoint
}

output "vm_private_ip" {
  description = "The internal IP address of the GitLab Runner VM."
  value       = azurerm_network_interface.vm_nic.ip_configuration[0].private_ip_address
}

output "log_analytics_workspace_id" {
  description = "The ID of the Log Analytics Workspace for diagnostics collection."
  value       = azurerm_log_analytics_workspace.law.workspace_id
}
