# Sai Mahendra Platform - Infrastructure Deployment Guide

This guide provides step-by-step instructions for deploying the AWS infrastructure for the Sai Mahendra educational platform using Terraform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Deployment Steps](#deployment-steps)
4. [Post-Deployment Configuration](#post-deployment-configuration)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

Install the following tools before proceeding:

1. **AWS CLI** (version 2.x or later)
   ```bash
   # macOS
   brew install awscli
   
   # Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   
   # Verify installation
   aws --version
   ```

2. **Terraform** (version 1.0 or later)
   ```bash
   # macOS
   brew install terraform
   
   # Linux
   wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
   unzip terraform_1.6.0_linux_amd64.zip
   sudo mv terraform /usr/local/bin/
   
   # Verify installation
   terraform version
   ```

3. **kubectl** (for Kubernetes management)
   ```bash
   # macOS
   brew install kubectl
   
   # Linux
   curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
   sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
   
   # Verify installation
   kubectl version --client
   ```

### AWS Account Setup

1. **Create an AWS Account** (if you don't have one)
   - Visit https://aws.amazon.com/
   - Follow the account creation process

2. **Configure AWS CLI Credentials**
   ```bash
   aws configure
   ```
   
   Provide:
   - AWS Access Key ID
   - AWS Secret Access Key
   - Default region (e.g., us-east-1)
   - Default output format (json)

3. **Verify AWS Access**
   ```bash
   aws sts get-caller-identity
   ```

### Required AWS Permissions

Your AWS user/role needs the following permissions:
- VPC management (create VPCs, subnets, route tables, etc.)
- EKS cluster management
- RDS instance management
- ElastiCache management
- S3 bucket management
- CloudFront distribution management
- ALB/ELB management
- IAM role and policy management
- KMS key management
- Secrets Manager access
- CloudWatch logs and alarms

## Initial Setup

### 1. Create S3 Bucket for Terraform State

The Terraform state needs to be stored remotely for team collaboration and safety.

```bash
# Create S3 bucket for state storage
aws s3 mb s3://sai-mahendra-terraform-state --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket sai-mahendra-terraform-state \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket sai-mahendra-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Block public access
aws s3api put-public-access-block \
  --bucket sai-mahendra-terraform-state \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

### 2. Configure Variables

```bash
cd infrastructure/terraform

# Copy the example variables file
cp terraform.tfvars.example terraform.tfvars

# Edit the file with your values
nano terraform.tfvars  # or use your preferred editor
```

**Important variables to set:**

```hcl
# Basic Configuration
environment = "dev"
aws_region  = "us-east-1"

# Database Password (use a strong password!)
database_password = "your-very-secure-password-here"

# JWT Secret (use a strong random string)
jwt_secret = "your-jwt-secret-key-here"

# Payment Gateway Credentials
razorpay_key_id     = "your-razorpay-key"
razorpay_key_secret = "your-razorpay-secret"
stripe_secret_key   = "your-stripe-key"

# Email Service
sendgrid_api_key = "your-sendgrid-api-key"
```

**Security Best Practice**: Use environment variables for sensitive data:

```bash
export TF_VAR_database_password="your-secure-password"
export TF_VAR_jwt_secret="your-jwt-secret"
export TF_VAR_razorpay_key_id="your-razorpay-key"
export TF_VAR_razorpay_key_secret="your-razorpay-secret"
export TF_VAR_stripe_secret_key="your-stripe-key"
export TF_VAR_sendgrid_api_key="your-sendgrid-key"
```

## Deployment Steps

### Step 1: Initialize Terraform

```bash
cd infrastructure/terraform
terraform init
```

This will:
- Download required provider plugins (AWS, Kubernetes, Helm, Random)
- Initialize the S3 backend for state storage
- Prepare all modules

Expected output:
```
Terraform has been successfully initialized!
```

### Step 2: Validate Configuration

```bash
terraform validate
```

This checks for syntax errors and configuration issues.

### Step 3: Format Code (Optional)

```bash
terraform fmt -recursive
```

This ensures consistent formatting across all Terraform files.

### Step 4: Review the Plan

```bash
terraform plan -out=tfplan
```

This shows you exactly what resources will be created. Review carefully:
- Number of resources to be created
- Resource types and configurations
- Estimated costs (use AWS Cost Calculator)

Expected resources:
- ~80-100 resources will be created
- VPC with 9 subnets (3 public, 3 private, 3 database)
- EKS cluster with node groups
- RDS PostgreSQL instance
- ElastiCache Redis cluster
- Multiple S3 buckets
- CloudFront distribution
- Application Load Balancer
- Security groups, IAM roles, KMS keys, etc.

### Step 5: Apply the Configuration

```bash
terraform apply tfplan
```

Or apply directly (will prompt for confirmation):
```bash
terraform apply
```

Type `yes` when prompted.

**Deployment Time**: 15-25 minutes

The deployment process will:
1. Create VPC and networking (2-3 minutes)
2. Create security groups and IAM roles (1-2 minutes)
3. Create RDS instance (5-10 minutes)
4. Create ElastiCache cluster (3-5 minutes)
5. Create EKS cluster (10-15 minutes)
6. Create S3 buckets and CloudFront (2-3 minutes)
7. Create ALB (2-3 minutes)

### Step 6: Save Outputs

```bash
terraform output > infrastructure-outputs.txt
```

This saves important connection information for later use.

## Post-Deployment Configuration

### 1. Configure kubectl for EKS

```bash
# Get the kubectl config command from Terraform output
terraform output kubectl_config_command

# Run the command (example)
aws eks update-kubeconfig --region us-east-1 --name sai-mahendra-dev

# Verify connection
kubectl get nodes
```

Expected output: List of EKS worker nodes in "Ready" state.

### 2. Retrieve Database Credentials

```bash
# Get the secret ARN
DB_SECRET_ARN=$(terraform output -raw rds_password_secret_arn)

# Retrieve the password
aws secretsmanager get-secret-value \
  --secret-id $DB_SECRET_ARN \
  --query SecretString \
  --output text
```

Save this password securely - you'll need it for application configuration.

### 3. Retrieve Redis Auth Token

```bash
# Get the secret ARN
REDIS_SECRET_ARN=$(terraform output -raw redis_auth_token_secret_arn)

# Retrieve the auth token
aws secretsmanager get-secret-value \
  --secret-id $REDIS_SECRET_ARN \
  --query SecretString \
  --output text
```

### 4. Configure Application Environment Variables

Create a Kubernetes secret with the connection information:

```bash
# Get connection details
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
REDIS_ENDPOINT=$(terraform output -raw redis_endpoint)
REDIS_PORT=$(terraform output -raw redis_port)

# Create Kubernetes secret
kubectl create secret generic platform-secrets \
  --from-literal=DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@${RDS_ENDPOINT}/sai_mahendra" \
  --from-literal=REDIS_URL="rediss://:${REDIS_AUTH_TOKEN}@${REDIS_ENDPOINT}:${REDIS_PORT}" \
  --from-literal=JWT_SECRET="${JWT_SECRET}" \
  --from-literal=RAZORPAY_KEY_ID="${RAZORPAY_KEY_ID}" \
  --from-literal=RAZORPAY_KEY_SECRET="${RAZORPAY_KEY_SECRET}" \
  --from-literal=STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY}" \
  --from-literal=SENDGRID_API_KEY="${SENDGRID_API_KEY}"
```

### 5. Configure DNS (Optional)

If you have a custom domain:

```bash
# Get ALB DNS name
ALB_DNS=$(terraform output -raw alb_dns_name)

# Get CloudFront domain
CDN_DNS=$(terraform output -raw cloudfront_domain_name)
```

Create DNS records:
- **api.yourdomain.com** → CNAME to ALB DNS
- **cdn.yourdomain.com** → CNAME to CloudFront domain

### 6. Upload SSL Certificate (Optional)

If you want HTTPS on the ALB:

```bash
# Request certificate in ACM
aws acm request-certificate \
  --domain-name api.yourdomain.com \
  --validation-method DNS \
  --region us-east-1

# Get certificate ARN and update terraform.tfvars
ssl_certificate_arn = "arn:aws:acm:us-east-1:..."

# Re-apply Terraform
terraform apply
```

## Verification

### 1. Verify VPC and Networking

```bash
# List VPCs
aws ec2 describe-vpcs --filters "Name=tag:Project,Values=sai-mahendra-platform"

# List subnets
aws ec2 describe-subnets --filters "Name=tag:Project,Values=sai-mahendra-platform"

# Check NAT gateways
aws ec2 describe-nat-gateways --filter "Name=tag:Project,Values=sai-mahendra-platform"
```

### 2. Verify EKS Cluster

```bash
# Check cluster status
aws eks describe-cluster --name sai-mahendra-dev --query 'cluster.status'

# List node groups
aws eks list-nodegroups --cluster-name sai-mahendra-dev

# Check nodes via kubectl
kubectl get nodes -o wide
```

### 3. Verify RDS Instance

```bash
# Check RDS status
aws rds describe-db-instances \
  --db-instance-identifier sai-mahendra-db-dev \
  --query 'DBInstances[0].DBInstanceStatus'

# Test connection (from within VPC)
psql -h $(terraform output -raw rds_endpoint | cut -d: -f1) \
     -U postgres \
     -d sai_mahendra
```

### 4. Verify Redis Cluster

```bash
# Check Redis status
aws elasticache describe-replication-groups \
  --replication-group-id sai-mahendra-redis-dev \
  --query 'ReplicationGroups[0].Status'
```

### 5. Verify S3 Buckets

```bash
# List buckets
aws s3 ls | grep sai-mahendra

# Check bucket encryption
aws s3api get-bucket-encryption --bucket sai-mahendra-content-dev
```

### 6. Verify CloudFront Distribution

```bash
# Get distribution status
aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='Sai Mahendra Platform CDN - dev'].{Id:Id,Status:Status,DomainName:DomainName}"
```

### 7. Verify ALB

```bash
# Check ALB status
aws elbv2 describe-load-balancers \
  --names sai-mahendra-alb-dev \
  --query 'LoadBalancers[0].State'

# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw api_target_group_arn)
```

## Troubleshooting

### Issue: Terraform Init Fails

**Error**: "Error configuring the backend "s3""

**Solution**:
1. Verify S3 bucket exists: `aws s3 ls s3://sai-mahendra-terraform-state`
2. Check AWS credentials: `aws sts get-caller-identity`
3. Verify bucket region matches configuration

### Issue: EKS Cluster Creation Fails

**Error**: "Error creating EKS Cluster: InvalidParameterException"

**Solution**:
1. Check subnet configuration (need at least 2 subnets in different AZs)
2. Verify IAM permissions for EKS
3. Check service quotas: `aws service-quotas list-service-quotas --service-code eks`

### Issue: RDS Creation Fails

**Error**: "DB instance already exists"

**Solution**:
1. Check for existing instances: `aws rds describe-db-instances`
2. Use a different identifier or delete the existing instance
3. Check if it's in "deleting" state (wait for completion)

### Issue: Cannot Connect to EKS

**Error**: "error: You must be logged in to the server (Unauthorized)"

**Solution**:
```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name sai-mahendra-dev

# Verify AWS identity
aws sts get-caller-identity

# Check IAM permissions for EKS access
```

### Issue: High Costs

**Problem**: AWS bill is higher than expected

**Solution**:
1. Check running resources: `aws resourcegroupstaggingapi get-resources`
2. Stop unused EKS node groups
3. Use smaller instance types for dev/staging
4. Enable auto-scaling to scale down during off-hours
5. Review CloudWatch metrics for underutilized resources

### Issue: State Lock Error

**Error**: "Error acquiring the state lock"

**Solution**:
```bash
# Force unlock (use with caution!)
terraform force-unlock <LOCK_ID>

# Or wait for the lock to expire (usually 15 minutes)
```

## Next Steps

After successful deployment:

1. **Deploy Applications**: Use Helm charts in `infrastructure/helm/` to deploy microservices
2. **Configure Monitoring**: Set up CloudWatch dashboards and alarms
3. **Set Up CI/CD**: Configure GitHub Actions for automated deployments
4. **Run Database Migrations**: Apply database schemas from `backend/database/migrations/`
5. **Test End-to-End**: Verify all services are communicating correctly

## Cleanup

To destroy all infrastructure (use with caution!):

```bash
# Review what will be destroyed
terraform plan -destroy

# Destroy all resources
terraform destroy
```

**Warning**: This will permanently delete:
- All databases and their data
- All S3 buckets and their contents
- All Kubernetes workloads
- All networking infrastructure

Make sure you have backups before destroying production infrastructure!

## Support

For issues or questions:
1. Check the main [README.md](README.md) for detailed documentation
2. Review AWS service documentation
3. Check Terraform AWS provider documentation
4. Contact the platform team

## Additional Resources

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS EKS Documentation](https://docs.aws.amazon.com/eks/)
- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
- [AWS ElastiCache Documentation](https://docs.aws.amazon.com/elasticache/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
