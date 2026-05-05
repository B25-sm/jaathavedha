/**
 * Database Migration Integration Tests
 * Tests database migrations and rollbacks
 * 
 * Validates: Requirements 15.2, 15.8
 */

const { testDbManager } = require('./setup');
const MigrationRunner = require('../migrate');
const fs = require('fs').promises;
const path = require('path');

describe('Database Migrations', () => {
  let migrationRunner;
  let pgClient;

  beforeAll(async () => {
    await testDbManager.connect();
    pgClient = testDbManager.getPostgresClient();
    
    // Create a migration runner instance with test config
    migrationRunner = new MigrationRunner();
    migrationRunner.client = pgClient;
  });

  afterAll(async () => {
    await testDbManager.disconnect();
  });

  beforeEach(async () => {
    await testDbManager.cleanup();
  });

  describe('Migration Table Management', () => {
    test('should create migrations table if not exists', async () => {
      await migrationRunner.createMigrationsTable();

      const result = await pgClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'migrations'
        )
      `);

      expect(result.rows[0].exists).toBe(true);
    });

    test('should track executed migrations', async () => {
      await migrationRunner.createMigrationsTable();

      await pgClient.query(`
        INSERT INTO migrations (filename) VALUES ($1)
      `, ['001_initial_schema.sql']);

      const executedMigrations = await migrationRunner.getExecutedMigrations();
      expect(executedMigrations).toContain('001_initial_schema.sql');
    });
  });

  describe('Migration Execution', () => {
    test('should execute pending migrations in order', async () => {
      await migrationRunner.createMigrationsTable();

      // Get migration files
      const migrationFiles = await migrationRunner.getMigrationFiles();
      expect(migrationFiles.length).toBeGreaterThan(0);

      // Execute first migration
      if (migrationFiles.length > 0) {
        await migrationRunner.executeMigration(migrationFiles[0]);

        // Verify migration was recorded
        const executedMigrations = await migrationRunner.getExecutedMigrations();
        expect(executedMigrations).toContain(migrationFiles[0]);
      }
    });

    test('should create all required tables from initial schema', async () => {
      await migrationRunner.createMigrationsTable();
      await migrationRunner.runMigrations();

      // Check that key tables exist
      const tables = [
        'users',
        'programs',
        'courses',
        'enrollments',
        'payments',
        'subscriptions',
        'contact_inquiries',
      ];

      for (const table of tables) {
        const result = await pgClient.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          )
        `, [table]);

        expect(result.rows[0].exists).toBe(true);
      }
    });

    test('should create all required custom types', async () => {
      await migrationRunner.createMigrationsTable();
      await migrationRunner.runMigrations();

      const types = [
        'user_role',
        'user_status',
        'program_category',
        'enrollment_status',
        'payment_gateway',
        'payment_status',
      ];

      for (const type of types) {
        const result = await pgClient.query(`
          SELECT EXISTS (
            SELECT FROM pg_type 
            WHERE typname = $1
          )
        `, [type]);

        expect(result.rows[0].exists).toBe(true);
      }
    });

    test('should create indexes for performance', async () => {
      await migrationRunner.createMigrationsTable();
      await migrationRunner.runMigrations();

      // Check for key indexes
      const result = await pgClient.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename IN ('users', 'enrollments', 'payments')
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      
      const indexNames = result.rows.map(row => row.indexname);
      expect(indexNames).toContain('idx_users_email');
      expect(indexNames).toContain('idx_enrollments_user_id');
      expect(indexNames).toContain('idx_payments_user_id');
    });

    test('should not execute already-run migrations', async () => {
      await migrationRunner.createMigrationsTable();
      await migrationRunner.runMigrations();

      const executedBefore = await migrationRunner.getExecutedMigrations();
      const countBefore = executedBefore.length;

      // Run migrations again
      await migrationRunner.runMigrations();

      const executedAfter = await migrationRunner.getExecutedMigrations();
      const countAfter = executedAfter.length;

      // Count should be the same (no duplicates)
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('Migration Rollback', () => {
    test('should rollback last migration', async () => {
      await migrationRunner.createMigrationsTable();
      
      // Insert a test migration record
      await pgClient.query(`
        INSERT INTO migrations (filename) VALUES ($1)
      `, ['test_migration.sql']);

      const beforeRollback = await migrationRunner.getExecutedMigrations();
      expect(beforeRollback).toContain('test_migration.sql');

      // Rollback
      await migrationRunner.rollbackLastMigration();

      const afterRollback = await migrationRunner.getExecutedMigrations();
      expect(afterRollback).not.toContain('test_migration.sql');
    });

    test('should handle rollback when no migrations exist', async () => {
      await migrationRunner.createMigrationsTable();

      // Should not throw error
      await expect(migrationRunner.rollbackLastMigration()).resolves.not.toThrow();
    });
  });

  describe('Migration Status', () => {
    test('should show correct migration status', async () => {
      await migrationRunner.createMigrationsTable();
      await migrationRunner.runMigrations();

      const executedMigrations = await migrationRunner.getExecutedMigrations();
      const migrationFiles = await migrationRunner.getMigrationFiles();

      expect(executedMigrations.length).toBeGreaterThan(0);
      expect(migrationFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Transaction Handling', () => {
    test('should rollback migration on error', async () => {
      await migrationRunner.createMigrationsTable();

      // Create a migration file with invalid SQL
      const invalidMigration = 'INVALID SQL STATEMENT;';
      const testMigrationPath = path.join(__dirname, '../migrations/999_test_invalid.sql');
      
      try {
        await fs.writeFile(testMigrationPath, invalidMigration);

        // Attempt to execute invalid migration
        await expect(
          migrationRunner.executeMigration('999_test_invalid.sql')
        ).rejects.toThrow();

        // Verify migration was not recorded
        const executedMigrations = await migrationRunner.getExecutedMigrations();
        expect(executedMigrations).not.toContain('999_test_invalid.sql');
      } finally {
        // Cleanup test migration file
        try {
          await fs.unlink(testMigrationPath);
        } catch (error) {
          // Ignore if file doesn't exist
        }
      }
    });
  });

  describe('Data Integrity After Migrations', () => {
    test('should maintain referential integrity constraints', async () => {
      await migrationRunner.createMigrationsTable();
      await migrationRunner.runMigrations();

      // Try to insert enrollment without valid user (should fail)
      await expect(
        pgClient.query(`
          INSERT INTO enrollments (user_id, program_id)
          VALUES ($1, $2)
        `, ['00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'])
      ).rejects.toThrow();
    });

    test('should enforce unique constraints', async () => {
      await migrationRunner.createMigrationsTable();
      await migrationRunner.runMigrations();

      // Insert first user
      await pgClient.query(`
        INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES ($1, $2, $3, $4)
      `, ['unique@test.com', 'hash', 'Test', 'User']);

      // Try to insert duplicate email (should fail)
      await expect(
        pgClient.query(`
          INSERT INTO users (email, password_hash, first_name, last_name)
          VALUES ($1, $2, $3, $4)
        `, ['unique@test.com', 'hash', 'Test', 'User'])
      ).rejects.toThrow();
    });

    test('should enforce enum constraints', async () => {
      await migrationRunner.createMigrationsTable();
      await migrationRunner.runMigrations();

      // Try to insert user with invalid role (should fail)
      await expect(
        pgClient.query(`
          INSERT INTO users (email, password_hash, first_name, last_name, role)
          VALUES ($1, $2, $3, $4, $5)
        `, ['test@test.com', 'hash', 'Test', 'User', 'invalid_role'])
      ).rejects.toThrow();
    });
  });

  describe('Trigger Functionality', () => {
    test('should automatically update updated_at timestamp', async () => {
      await migrationRunner.createMigrationsTable();
      await migrationRunner.runMigrations();

      // Insert user
      const insertResult = await pgClient.query(`
        INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES ($1, $2, $3, $4)
        RETURNING id, created_at, updated_at
      `, ['trigger@test.com', 'hash', 'Test', 'User']);

      const userId = insertResult.rows[0].id;
      const originalUpdatedAt = insertResult.rows[0].updated_at;

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update user
      await pgClient.query(`
        UPDATE users SET first_name = $1 WHERE id = $2
      `, ['Updated', userId]);

      // Check updated_at changed
      const selectResult = await pgClient.query(`
        SELECT updated_at FROM users WHERE id = $1
      `, [userId]);

      const newUpdatedAt = selectResult.rows[0].updated_at;
      expect(new Date(newUpdatedAt).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      );
    });
  });
});
