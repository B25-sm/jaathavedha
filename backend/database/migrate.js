#!/usr/bin/env node

/**
 * Database Migration Tool for Sai Mahendra Platform
 * Handles PostgreSQL schema migrations and seeding
 */

const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

class MigrationRunner {
  constructor() {
    this.client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'sai_mahendra_dev',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });
    
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  async connect() {
    try {
      await this.client.connect();
      console.log('✅ Connected to PostgreSQL database');
    } catch (error) {
      console.error('❌ Failed to connect to database:', error.message);
      process.exit(1);
    }
  }

  async disconnect() {
    await this.client.end();
    console.log('✅ Disconnected from database');
  }

  async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT NOW()
      );
    `;
    
    await this.client.query(query);
    console.log('✅ Migrations table ready');
  }

  async getExecutedMigrations() {
    const result = await this.client.query('SELECT filename FROM migrations ORDER BY id');
    return result.rows.map(row => row.filename);
  }

  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsDir);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort();
    } catch (error) {
      console.error('❌ Failed to read migrations directory:', error.message);
      return [];
    }
  }

  async executeMigration(filename) {
    const filePath = path.join(this.migrationsDir, filename);
    
    try {
      const sql = await fs.readFile(filePath, 'utf8');
      
      // Begin transaction
      await this.client.query('BEGIN');
      
      // Execute migration SQL
      await this.client.query(sql);
      
      // Record migration as executed
      await this.client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [filename]
      );
      
      // Commit transaction
      await this.client.query('COMMIT');
      
      console.log(`✅ Executed migration: ${filename}`);
    } catch (error) {
      // Rollback on error
      await this.client.query('ROLLBACK');
      console.error(`❌ Failed to execute migration ${filename}:`, error.message);
      throw error;
    }
  }

  async runMigrations() {
    console.log('🚀 Starting database migrations...');
    
    await this.createMigrationsTable();
    
    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = await this.getMigrationFiles();
    
    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }
    
    console.log(`📋 Found ${pendingMigrations.length} pending migrations`);
    
    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }
    
    console.log('✅ All migrations completed successfully');
  }

  async rollbackLastMigration() {
    console.log('🔄 Rolling back last migration...');
    
    const result = await this.client.query(
      'SELECT filename FROM migrations ORDER BY id DESC LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No migrations to rollback');
      return;
    }
    
    const lastMigration = result.rows[0].filename;
    console.log(`⚠️  Rolling back migration: ${lastMigration}`);
    
    // Remove from migrations table
    await this.client.query(
      'DELETE FROM migrations WHERE filename = $1',
      [lastMigration]
    );
    
    console.log('⚠️  Migration record removed. Manual schema rollback may be required.');
  }

  async resetDatabase() {
    console.log('🗑️  Resetting database...');
    
    const confirmation = process.env.CONFIRM_RESET;
    if (confirmation !== 'yes') {
      console.log('❌ Database reset cancelled. Set CONFIRM_RESET=yes to proceed.');
      return;
    }
    
    // Drop all tables
    await this.client.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);
    
    console.log('✅ Database reset completed');
  }

  async showStatus() {
    console.log('📊 Migration Status:');
    
    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = await this.getMigrationFiles();
    
    console.log(`\nTotal migration files: ${migrationFiles.length}`);
    console.log(`Executed migrations: ${executedMigrations.length}`);
    
    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    );
    
    if (pendingMigrations.length > 0) {
      console.log(`\n⏳ Pending migrations:`);
      pendingMigrations.forEach(file => console.log(`  - ${file}`));
    }
    
    if (executedMigrations.length > 0) {
      console.log(`\n✅ Executed migrations:`);
      executedMigrations.forEach(file => console.log(`  - ${file}`));
    }
  }
}

async function main() {
  const command = process.argv[2] || 'migrate';
  const runner = new MigrationRunner();
  
  try {
    await runner.connect();
    
    switch (command) {
      case 'migrate':
        await runner.runMigrations();
        break;
      case 'rollback':
        await runner.rollbackLastMigration();
        break;
      case 'reset':
        await runner.resetDatabase();
        break;
      case 'status':
        await runner.showStatus();
        break;
      default:
        console.log(`
Usage: node migrate.js [command]

Commands:
  migrate   - Run pending migrations (default)
  rollback  - Rollback last migration
  reset     - Reset entire database (requires CONFIRM_RESET=yes)
  status    - Show migration status

Environment Variables:
  DB_HOST     - Database host (default: localhost)
  DB_PORT     - Database port (default: 5432)
  DB_NAME     - Database name (default: sai_mahendra_dev)
  DB_USER     - Database user (default: postgres)
  DB_PASSWORD - Database password (default: postgres)
        `);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await runner.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = MigrationRunner;