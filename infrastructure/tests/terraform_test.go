package test

import (
	"testing"
	"time"

	"github.com/gruntwork-io/terratest/modules/aws"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

func TestTerraformInfrastructure(t *testing.T) {
	t.Parallel()

	// Configure Terraform options
	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../terraform",
		Vars: map[string]interface{}{
			"environment":        "test",
			"aws_region":        "us-east-1",
			"vpc_cidr":          "10.1.0.0/16",
			"database_password": "test-password-123",
			"jwt_secret":        "test-jwt-secret-key",
		},
		EnvVars: map[string]string{
			"AWS_DEFAULT_REGION": "us-east-1",
		},
	})

	// Clean up resources with "terraform destroy" at the end of the test
	defer terraform.Destroy(t, terraformOptions)

	// Run "terraform init" and "terraform apply"
	terraform.InitAndApply(t, terraformOptions)

	// Test VPC creation
	t.Run("VPC", func(t *testing.T) {
		vpcId := terraform.Output(t, terraformOptions, "vpc_id")
		assert.NotEmpty(t, vpcId)

		// Verify VPC exists in AWS
		vpc := aws.GetVpcById(t, vpcId, "us-east-1")
		assert.Equal(t, "10.1.0.0/16", vpc.CidrBlock)
		assert.Equal(t, "available", vpc.State)
	})

	// Test EKS cluster creation
	t.Run("EKS", func(t *testing.T) {
		clusterName := terraform.Output(t, terraformOptions, "eks_cluster_name")
		assert.NotEmpty(t, clusterName)
		assert.Contains(t, clusterName, "sai-mahendra-test")

		clusterEndpoint := terraform.Output(t, terraformOptions, "eks_cluster_endpoint")
		assert.NotEmpty(t, clusterEndpoint)
		assert.Contains(t, clusterEndpoint, "https://")
	})

	// Test RDS instance creation
	t.Run("RDS", func(t *testing.T) {
		rdsEndpoint := terraform.Output(t, terraformOptions, "rds_endpoint")
		assert.NotEmpty(t, rdsEndpoint)
		assert.Contains(t, rdsEndpoint, "rds.amazonaws.com")

		rdsPort := terraform.Output(t, terraformOptions, "rds_port")
		assert.Equal(t, "5432", rdsPort)
	})

	// Test Redis cluster creation
	t.Run("Redis", func(t *testing.T) {
		redisEndpoint := terraform.Output(t, terraformOptions, "redis_endpoint")
		assert.NotEmpty(t, redisEndpoint)
		assert.Contains(t, redisEndpoint, "cache.amazonaws.com")

		redisPort := terraform.Output(t, terraformOptions, "redis_port")
		assert.Equal(t, "6379", redisPort)
	})

	// Test S3 buckets creation
	t.Run("S3", func(t *testing.T) {
		contentBucket := terraform.Output(t, terraformOptions, "s3_content_bucket")
		assert.NotEmpty(t, contentBucket)
		assert.Contains(t, contentBucket, "sai-mahendra-content")

		backupBucket := terraform.Output(t, terraformOptions, "s3_backup_bucket")
		assert.NotEmpty(t, backupBucket)
		assert.Contains(t, backupBucket, "sai-mahendra-backup")
	})
}

func TestTerraformValidation(t *testing.T) {
	t.Parallel()

	terraformOptions := &terraform.Options{
		TerraformDir: "../terraform",
	}

	// Test terraform validate
	terraform.Validate(t, terraformOptions)
}

func TestTerraformFormat(t *testing.T) {
	t.Parallel()

	terraformOptions := &terraform.Options{
		TerraformDir: "../terraform",
	}

	// Test terraform fmt
	terraform.Format(t, terraformOptions)
}

func TestInfrastructureScaling(t *testing.T) {
	t.Parallel()

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../terraform",
		Vars: map[string]interface{}{
			"environment": "test-scaling",
			"node_groups": map[string]interface{}{
				"general": map[string]interface{}{
					"instance_types": []string{"t3.small"},
					"min_size":      2,
					"max_size":      5,
					"desired_size":  3,
					"disk_size":     30,
				},
			},
			"database_password": "test-password-123",
			"jwt_secret":        "test-jwt-secret-key",
		},
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	// Test that EKS node group has correct scaling configuration
	t.Run("NodeGroupScaling", func(t *testing.T) {
		clusterName := terraform.Output(t, terraformOptions, "eks_cluster_name")
		assert.NotEmpty(t, clusterName)

		// Additional validation can be added here to check node group scaling
		// This would require AWS SDK calls to verify the actual node group configuration
	})
}

func TestDisasterRecovery(t *testing.T) {
	t.Parallel()

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../terraform",
		Vars: map[string]interface{}{
			"environment":        "test-dr",
			"rds_allocated_storage": 200,
			"database_password":  "test-password-123",
			"jwt_secret":         "test-jwt-secret-key",
		},
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	// Test backup configuration
	t.Run("BackupConfiguration", func(t *testing.T) {
		rdsBackupRetention := terraform.Output(t, terraformOptions, "rds_backup_retention_period")
		assert.Equal(t, "7", rdsBackupRetention)

		s3BackupBucket := terraform.Output(t, terraformOptions, "s3_backup_bucket")
		assert.NotEmpty(t, s3BackupBucket)
	})
}

func TestSecurityConfiguration(t *testing.T) {
	t.Parallel()

	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../terraform",
		Vars: map[string]interface{}{
			"environment":       "test-security",
			"database_password": "test-password-123",
			"jwt_secret":        "test-jwt-secret-key",
		},
	})

	defer terraform.Destroy(t, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)

	// Test security group configuration
	t.Run("SecurityGroups", func(t *testing.T) {
		eksSecurityGroupId := terraform.Output(t, terraformOptions, "eks_security_group_id")
		assert.NotEmpty(t, eksSecurityGroupId)

		rdsSecurityGroupId := terraform.Output(t, terraformOptions, "rds_security_group_id")
		assert.NotEmpty(t, rdsSecurityGroupId)

		// Verify security groups have proper rules
		// Additional AWS SDK calls can be added here to validate security group rules
	})

	// Test encryption configuration
	t.Run("Encryption", func(t *testing.T) {
		rdsEncrypted := terraform.Output(t, terraformOptions, "rds_encrypted")
		assert.Equal(t, "true", rdsEncrypted)

		s3Encryption := terraform.Output(t, terraformOptions, "s3_encryption_enabled")
		assert.Equal(t, "true", s3Encryption)
	})
}