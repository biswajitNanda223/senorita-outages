variable "location" {
  description = "The Azure region to deploy resources."
  type        = string
  default     = "eastus"
}

variable "resource_group_name" {
  description = "The name of the resource group."
  type        = string
  default     = "rg-enterprise-devops"
}

variable "environment" {
  description = "The deployment environment (e.g., dev, prod)."
  type        = string
  default     = "dev"
}

variable "vnet_address_space" {
  description = "Address space for the Hub VNet."
  type        = list(string)
  default     = ["10.0.0.0/16"]
}

variable "spoke_address_space" {
  description = "Address space for the Spoke VNet."
  type        = list(string)
  default     = ["10.1.0.0/16"]
}

variable "sso_app_name" {
  description = "Name of the Azure Active Directory SSO App Registration."
  type        = string
  default     = "enterprise-sso-app"
}
