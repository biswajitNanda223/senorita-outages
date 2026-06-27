# 🌐 Virtual Private Cloud (VPC) Mapping Guide: AWS, Azure, and GCP

A comprehensive breakdown of how private isolated networking works across the three major cloud providers: **AWS VPC**, **Azure VNet**, and **GCP VPC**.

---

## 🗺️ Core Concept Equivalency Table

| Conceptual Component | AWS | Microsoft Azure | Google Cloud Platform (GCP) |
| :--- | :--- | :--- | :--- |
| **Private IP Network** | VPC (Virtual Private Cloud) | VNet (Virtual Network) | VPC (Global VPC Network) |
| **Network Boundaries** | Regional (Requires peering) | Regional (VNet Peering) | Global (Subnets are Regional) |
| **Subnet Types** | Public (has IGW route) / Private | Subnet (Routing defined by UDRs/NAT) | Subnet (Regional subnets) |
| **Internet Egress Gateway** | Internet Gateway (IGW) | Internet Gateway (Implicit) / NAT Gateway | Cloud NAT |
| **Route Controls** | Route Tables | Route Tables & User Defined Routes (UDR) | VPC Routes |
| **Stateful Firewall** | Security Groups (Instance level) | Network Security Groups (NSG) | VPC Firewall Rules (Tags/SAs) |
| **Stateless Firewall** | Network ACLs (Subnet level) | *N/A* (NSGs are stateful) | *N/A* (Hierarchical rules stateful) |
| **Private Service Links** | Interface / Gateway Endpoints (PrivateLink) | Private Endpoints (Private Link) | Private Service Connect (PSC) |
| **VPC-to-VPC Links** | VPC Peering / Transit Gateway | VNet Peering / Virtual WAN | VPC Network Peering / Shared VPC |

---

## 🏗️ 1. Amazon Web Services (AWS) VPC

In AWS, a **Virtual Private Cloud (VPC)** is locked to a single AWS region. It is subdivided into Availability Zones (AZs) using subnets.

```text
AWS Region
└── VPC (e.g., 10.0.0.0/16)
    ├── Subnet AZ-A (10.0.1.0/24) ── Route Table ── Internet Gateway (Public Subnet)
    └── Subnet AZ-B (10.0.2.0/24) ── Route Table ── NAT Gateway (Private Subnet)
```

### Key Operations:
*   **Public vs. Private Subnets:** A subnet is "public" if its route table has a route `0.0.0.0/0` pointing to an **Internet Gateway (IGW)**. Otherwise, it is "private" and routes egress through a **NAT Gateway** located in a public subnet.
*   **Security Groups vs. NACLs:**
    *   *Security Groups (Stateful):* Applied to network interfaces (ENIs). If you allow inbound traffic on port 80, outbound response is automatically allowed.
    *   *Network ACLs (Stateless):* Applied at the subnet boundary. You must explicitly write both ingress and egress rules.
*   **VPC Endpoints (PrivateLink):** Allow ECS/EKS pods to securely talk to AWS systems (like S3 or SSM) over private channels, bypassing the public internet.

---

## 🔒 2. Microsoft Azure VNet

Azure uses **Virtual Networks (VNets)** instead of VPCs. Similar to AWS, VNets are regional.

```text
Azure Region
└── VNet (e.g., 10.0.0.0/16)
    ├── snet-web (10.0.1.0/24) ── Route Table (UDR) ── Azure Firewall / NAT Gateway
    └── snet-db  (10.0.2.0/24) ── Private Endpoint ── Private Link Database
```

### Key Operations:
*   **Subnet Routing:** Subnets have no public/private flag. Outgoing internet traffic is handled automatically by Azure unless overridden by:
    *   A **NAT Gateway** bound to the subnet for dedicated outbound IP addresses.
    *   **User Defined Routes (UDRs)** in a Route Table that send all traffic (`0.0.0.0/0`) through a centralized **Azure Firewall** in a Hub VNet.
*   **Network Security Groups (NSGs):** Stateful firewalls applied directly to subnets or individual Network Interfaces (NICs).
*   **Private Endpoints:** Azure's mechanism to inject private IP addresses of PaaS services (like Key Vault, Azure Redis, Azure SQL) directly into your private VNet subnets.

---

## 🌍 3. Google Cloud Platform (GCP) VPC

GCP's networking architecture is radically different: **VPCs are Global, not Regional.**

```text
GCP Global VPC
├── Subnet Region-A (US-East) ── Cloud NAT (Egress Gateway)
└── Subnet Region-B (Europe-West) ── Private Service Connect (PSC Database Link)
```

### Key Operations:
*   **Global Scope:** You create a single VPC network, and then declare regional subnets within it (e.g., one subnet in `us-central1` and another in `europe-west1`). These subnets can communicate with each other privately out-of-the-box without peering!
*   **Shared VPC:** Allows an organization to dedicate a single VPC network in a host project, and let other "service projects" deploy VMs and GKE clusters directly into its subnets, keeping network controls centralized.
*   **Private Service Connect (PSC):** GCP's system for mapping external managed databases (like Cloud SQL) or third-party APIs directly onto internal VPC IP addresses.
*   **Firewall Targets:** GCP applies firewall rules using network **Tags** or **Service Accounts** assigned to VMs, instead of classic security group wrappers.
