# Video Processor - Terraform Infrastructure

GCP infrastructure for the Video Processor application using Terraform.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Google Cloud Platform                          │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                           VPC Network                            │   │
│  │                                                                   │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │   │
│  │  │   Cloud     │    │  Serverless │    │     Cloud NAT       │  │   │
│  │  │    Run      │───▶│     VPC     │───▶│  (External Access)  │  │   │
│  │  │   Service   │    │  Connector  │    │                     │  │   │
│  │  └─────────────┘    └─────────────┘    └─────────────────────┘  │   │
│  │         │                                                        │   │
│  │         │ Private IP                                             │   │
│  │         ▼                                                        │   │
│  │  ┌─────────────┐                                                 │   │
│  │  │  Cloud SQL  │                                                 │   │
│  │  │ PostgreSQL  │                                                 │   │
│  │  └─────────────┘                                                 │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
infrastructure/terraform/
├── modules/
│   ├── cloud-run/          # Cloud Run service module
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── cloud-sql/          # Cloud SQL PostgreSQL module
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── networking/         # VPC, Subnet, Cloud NAT, VPC Connector
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── iam/                # Service accounts and IAM bindings
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── environments/
│   └── prod/               # Production environment
│       ├── main.tf
│       ├── variables.tf
│       ├── terraform.tfvars.example
│       ├── outputs.tf
│       └── backend.tf
└── README.md
```

## Requirements

- Terraform >= 1.5.0
- Google Cloud SDK (`gcloud`)
- GCP Project with billing enabled

## Quick Start

### 1. Prerequisites

```bash
# Install Terraform (macOS)
brew install terraform

# Or download from https://www.terraform.io/downloads

# Authenticate with GCP
gcloud auth application-default login

# Set your project
gcloud config set project YOUR_PROJECT_ID
```

### 2. Create Terraform State Bucket

```bash
PROJECT_ID=$(gcloud config get-value project)

# Create GCS bucket for Terraform state
gcloud storage buckets create gs://${PROJECT_ID}-terraform-state \
  --project=${PROJECT_ID} \
  --location=asia-northeast1 \
  --uniform-bucket-level-access

# Enable versioning
gcloud storage buckets update gs://${PROJECT_ID}-terraform-state \
  --versioning
```

### 3. Configure Variables

```bash
cd infrastructure/terraform/environments/prod

# Copy example variables file
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your values
vim terraform.tfvars
```

### 4. Update Backend Configuration

Edit `backend.tf` to use your GCS bucket:

```hcl
terraform {
  backend "gcs" {
    bucket = "YOUR_PROJECT_ID-terraform-state"
    prefix = "terraform/state/prod"
  }
}
```

### 5. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply changes
terraform apply
```

## Modules

### Networking Module

Creates VPC, subnet, Cloud NAT, and Serverless VPC Access Connector.

| Resource | Purpose |
|----------|---------|
| VPC | Private network for resources |
| Subnet | IP range allocation (default: 10.0.0.0/24) |
| Cloud Router | Router for Cloud NAT |
| Cloud NAT | Outbound internet access for private resources |
| VPC Connector | Serverless VPC Access for Cloud Run |
| Private Services Access | VPC peering for Cloud SQL |

### Cloud SQL Module

Creates PostgreSQL 15 instance with private IP.

| Feature | Configuration |
|---------|---------------|
| Version | PostgreSQL 15 |
| Machine | db-custom-2-4096 (prod) / db-f1-micro (dev) |
| Storage | SSD with autoresize |
| Backup | Automated daily backups |
| Recovery | Point-in-time recovery enabled |
| Access | Private IP only |

### Cloud Run Module

Creates Cloud Run service for the API.

| Feature | Configuration |
|---------|---------------|
| CPU | 2 |
| Memory | 2Gi |
| Timeout | 3600s (1 hour) |
| Scaling | 0-10 instances |
| Network | VPC Connector for private access |
| Database | Cloud SQL via Unix socket |

### IAM Module

Creates service accounts and IAM bindings.

| Service Account | Roles |
|-----------------|-------|
| Cloud Run SA | Cloud SQL Client, Secret Manager Accessor, Logging Writer, Trace Agent |

## Environment Configuration

### Production vs Development

Key differences between environments:

| Setting | Production | Development |
|---------|------------|-------------|
| `database_tier` | db-custom-2-4096 | db-f1-micro |
| `database_deletion_protection` | true | false |
| `database_availability_type` | REGIONAL (optional) | ZONAL |
| `cloud_run_min_instances` | 1 | 0 |

To create a dev environment:

```bash
# Copy prod to dev
cp -r environments/prod environments/dev

# Update dev/backend.tf prefix
prefix = "terraform/state/dev"

# Update dev/terraform.tfvars
environment  = "dev"
database_tier = "db-f1-micro"
database_deletion_protection = false
```

## Security

- All resources use private IPs where possible
- Cloud SQL accessible only from VPC
- Database password stored in Secret Manager
- Service accounts follow principle of least privilege

### Sensitive Files

Add to `.gitignore`:

```
*.tfvars
!*.tfvars.example
*.tfstate
*.tfstate.*
.terraform/
```

## Outputs

After deployment, these outputs are available:

```bash
# Get Cloud Run URL
terraform output cloud_run_service_uri

# Get Cloud SQL connection name
terraform output cloud_sql_connection_name

# Get database info
terraform output database_name
terraform output database_user
```

## Troubleshooting

### Common Issues

1. **API not enabled**
   ```bash
   gcloud services enable compute.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable sqladmin.googleapis.com
   ```

2. **Insufficient permissions**
   ```bash
   # Grant owner role (for initial setup)
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="user:YOUR_EMAIL" \
     --role="roles/owner"
   ```

3. **VPC connector creation fails**
   - Ensure the connector CIDR doesn't overlap with existing ranges
   - Check that Serverless VPC Access API is enabled

4. **Cloud SQL private IP not working**
   - Verify private services connection is established
   - Check VPC peering status

## Cleanup

To destroy all resources:

```bash
cd infrastructure/terraform/environments/prod

# Disable deletion protection first
terraform apply -var="database_deletion_protection=false"

# Destroy all resources
terraform destroy
```

## License

MIT License
