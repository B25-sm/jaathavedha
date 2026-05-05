# Sai Mahendra Platform - Terraform Infrastructure

This directory contains Terraform Infrastructure as Code (IaC) for provisioning and managing AWS infrastructure for the Sai Mahendra educational platform.

## Architecture Overview

The infrastructure includes:

- **VPC**: Multi-AZ VPC with public, private, and database subnets
- **EKS**: Kubernetes cluster for microservices orchestration
- **RDS**: PostgreSQL database with encryption and automated backups
- **ElastiCache**: Redis cluster for caching and session management
- **S3**: Multiple buckets for content, uploads, backups, and logs
- **CloudFront**: CDN for global content delivery
- **ALB**: Application Load Balancer for traffic distribution
- **Security**: KMS encryption, security groups, IAM roles, and VPC flow logs

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** >= 1.0 installed
3. **kubectl** for Kubernetes management
4. **AWS Account** with appropriate permissions

## Directory Structure

```
terraform/
├── main.tf                 # Main configuration and module calls
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── cdn.tf                  # CloudFront CDN configuration
├── terraform.tfvars.example # Example variable values
├── modules/
│   ├── vpc/               # VPC and networking
│   ├── eks/               # EKS cluster and node groups
│   ├── rds/               # PostgreSQL database
│   ├── redis/             # ElastiCache Redis
│   ├── s3/                # S3 buckets
│   ├── cloudfront/        # CloudFront distribution
│   └── alb/               # Application Load Balancer
└── README.md              # This file
```

## Getting Started

### 1. Configure Variables

Copy the example variables file and customize it:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your specific values:

```hcl
environment = "dev"
aws_region  = "us-east-1"

# Database credentials (use strong passwords)
database_password = "your-secure-password"
jwt_secret       = "your-jwt-secret"

# Payment gateway credentials
razorpay_key_id     = "your-razorpay-key"
razorpay_key_secret = "your-razorpay-secret"
stripe_secret_key   = "your-stripe-key"

# Email service
sendgrid_api_key = "your-sendgrid-key"
```

**Important**: Never commit `terraform.tfvars` to version control. It's already in `.gitignore`.

### 2. Initialize Terraform

```bash
terraform init
```

This will:
- Download required provider plugins
- Initialize the backend (S3 for state storage)
- Prepare modules

### 3. Review the Plan

```bash
terraform plan
```

Review the resources that will be created. Ensure everything looks correct before applying.

### 4. Apply the Configuration

```bash
terraform apply
```

Type `yes` when prompted to create the infrastructure. This process takes 15-20 minutes.

## Module Details

### VPC Module

Creates a multi-AZ VPC with:
- 3 public subnets (for ALB and NAT gateways)
- 3 private subnets (for EKS nodes and application workloads)
- 3 database subnets (for RDS and ElastiCache)
- NAT gateways for private subnet internet access
- VPC flow logs for network monitoring

**CIDR Allocation**:
- VPC: `10.0.0.0/16`
- Public subnets: `10.0.0.0/24`, `10.0.1.0/24`, `10.0.2.0/24`
- Private subnets: `10.0.10.0/24`, `10.0.11.0/24`, `10.0.12.0/24`
- Database subnets: `10.0.20.0/24`, `10.0.21.0/24`, `10.0.22.0/24`

### EKS Module

Creates an EKS cluster with:
- Kubernetes version 1.27
- Managed node groups with auto-scaling
- OIDC provider for IAM roles for service accounts
- Essential add-ons (VPC CNI, CoreDNS, kube-proxy, EBS CSI driver)
- Encryption at rest for secrets
- CloudWatch logging for control plane

**Node Groups**:
- General purpose: t3.medium instances (1-10 nodes)
- Configurable via `node_groups` variable

### RDS Module

Creates a PostgreSQL database with:
- PostgreSQL 15.3
- Encryption at rest with KMS
- Automated backups (7-30 days retention)
- Multi-AZ deployment for production
- Performance Insights enabled
- Enhanced monitoring
- Read replica for production environment

**Security**:
- Password stored in AWS Secrets Manager
- Security group restricting access to VPC only
- SSL/TLS encryption in transit

### Redis Module

Creates an ElastiCache Redis cluster with:
- Redis 7.0
- Encryption at rest and in transit
- Auth token for authentication
- Automatic failover (multi-node clusters)
- CloudWatch alarms for CPU, memory, and evictions
- Slow log and engine log delivery to CloudWatch

**Configuration**:
- Single node for dev/staging
- Multi-node with automatic failover for production

### S3 Module

Creates multiple S3 buckets:

1. **Content Bucket**: Course materials, videos, images
   - Versioning enabled
   - Lifecycle policies for cost optimization
   - KMS encryption

2. **User Uploads Bucket**: Student assignments, profile pictures
   - CORS configuration for direct uploads
   - Versioning enabled

3. **Backups Bucket**: Database and application backups
   - Lifecycle transition to Glacier
   - Long-term retention

4. **Logs Bucket**: Application and access logs
   - 90-day retention
   - Automatic cleanup

### CloudFront Module

Creates a CDN distribution with:
- Global edge locations
- HTTPS enforcement
- Custom cache behaviors for different content types
- Security headers via CloudFront Functions
- Access logging to S3
- CloudWatch alarms for error rates

**Cache Policies**:
- Images: 30 days
- Videos: 1 day (with range request support)
- Course materials: 7 days
- Default: 1 day

### ALB Module

Creates an Application Load Balancer with:
- HTTP to HTTPS redirect
- SSL/TLS termination
- Target group for API Gateway
- Health checks
- Access logging to S3
- CloudWatch alarms for response time and errors

## Post-Deployment Configuration

### 1. Configure kubectl

```bash
aws eks update-kubeconfig --region us-east-1 --name sai-mahendra-dev
```

Verify connection:
```bash
kubectl get nodes
```

### 2. Retrieve Database Credentials

```bash
aws secretsmanager get-secret-value \
  --secret-id sai-mahendra-db-password-dev \
  --query SecretString \
  --output text
```

### 3. Retrieve Redis Auth Token

```bash
aws secretsmanager get-secret-value \
  --secret-id sai-mahendra-redis-auth-dev \
  --query SecretString \
  --output text
```

### 4. Configure DNS

Point your domain to:
- **ALB**: For API traffic
- **CloudFront**: For static content

Get the DNS names:
```bash
terraform output alb_dns_name
terraform output cloudfront_domain_name
```

## Environment Management

### Development Environment

```bash
terraform workspace select dev
terraform apply -var="environment=dev"
```

### Staging Environment

```bash
terraform workspace select staging
terraform apply -var="environment=staging"
```

### Production Environment

```bash
terraform workspace select prod
terraform apply -var="environment=prod"
```

Production includes:
- Multi-AZ RDS with read replica
- Increased backup retention (30 days)
- Deletion protection enabled
- Higher resource limits

## Monitoring and Maintenance

### CloudWatch Alarms

The infrastructure includes CloudWatch alarms for:
- RDS CPU and memory utilization
- Redis CPU, memory, and evictions
- ALB response time and error rates
- CloudFront error rates

Configure SNS topics to receive notifications.

### Cost Optimization

1. **Right-size instances**: Monitor usage and adjust instance types
2. **Use Spot instances**: For non-critical workloads
3. **S3 lifecycle policies**: Automatically transition old data to cheaper storage
4. **Reserved instances**: For production workloads with predictable usage

### Backup and Disaster Recovery

- **RDS**: Automated daily backups with point-in-time recovery
- **S3**: Versioning enabled for data protection
- **Infrastructure**: State stored in S3 with versioning

## Security Best Practices

1. **Secrets Management**: All sensitive data stored in AWS Secrets Manager
2. **Encryption**: KMS encryption for all data at rest
3. **Network Security**: Private subnets for databases and applications
4. **IAM**: Least privilege access with specific roles
5. **Monitoring**: VPC flow logs and CloudWatch logging enabled

## Troubleshooting

### Terraform State Lock

If you encounter a state lock error:
```bash
terraform force-unlock <LOCK_ID>
```

### EKS Node Group Issues

Check node group status:
```bash
aws eks describe-nodegroup \
  --cluster-name sai-mahendra-dev \
  --nodegroup-name sai-mahendra-dev-general
```

### RDS Connection Issues

1. Verify security group rules
2. Check VPC routing
3. Ensure application is in the same VPC
4. Verify credentials from Secrets Manager

## Cleanup

To destroy all infrastructure:

```bash
terraform destroy
```

**Warning**: This will delete all resources including databases and S3 buckets. Ensure you have backups before proceeding.

## Support and Documentation

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

## Contributing

When making changes to the infrastructure:

1. Create a new branch
2. Make changes and test in dev environment
3. Run `terraform fmt` to format code
4. Run `terraform validate` to check syntax
5. Create a pull request with detailed description
6. Apply changes to staging, then production

## License

This infrastructure code is part of the Sai Mahendra platform project.
