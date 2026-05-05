/**
 * Database Module Index
 * Exports all database utilities and connection managers
 */

// PostgreSQL exports
export {
  PostgresDatabase,
  createDatabase,
  getDatabase,
  type DatabaseConfig,
  type QueryOptions as PostgresQueryOptions,
} from './postgres';

// Redis exports
export {
  RedisCache,
  createCache,
  getCache,
  type RedisConfig,
  type CacheOptions,
} from './redis';

// MongoDB exports
export {
  MongoDatabase,
  createMongo,
  getMongo,
  type MongoConfig,
  type QueryOptions as MongoQueryOptions,
} from './mongodb';

// Database initialization helper
export interface DatabaseConnections {
  postgres: PostgresDatabase;
  redis: RedisCache;
  mongo: MongoDatabase;
}

export async function initializeDatabases(config: {
  postgres: DatabaseConfig;
  redis: RedisConfig;
  mongo: MongoConfig;
}): Promise<DatabaseConnections> {
  const postgres = createDatabase(config.postgres);
  const redis = createCache(config.redis);
  const mongo = createMongo(config.mongo);

  // Connect to all databases
  await Promise.all([
    postgres.connect(),
    redis.connect(),
    mongo.connect(),
  ]);

  return { postgres, redis, mongo };
}

export async function disconnectDatabases(): Promise<void> {
  const promises: Promise<void>[] = [];

  try {
    const postgres = getDatabase();
    promises.push(postgres.disconnect());
  } catch (error) {
    // Database not initialized
  }

  try {
    const redis = getCache();
    promises.push(redis.disconnect());
  } catch (error) {
    // Cache not initialized
  }

  try {
    const mongo = getMongo();
    promises.push(mongo.disconnect());
  } catch (error) {
    // MongoDB not initialized
  }

  await Promise.all(promises);
}

export async function healthCheck(): Promise<{
  postgres: boolean;
  redis: boolean;
  mongo: boolean;
}> {
  const health = {
    postgres: false,
    redis: false,
    mongo: false,
  };

  try {
    const postgres = getDatabase();
    health.postgres = postgres.isHealthy();
  } catch (error) {
    // Database not initialized
  }

  try {
    const redis = getCache();
    health.redis = redis.isHealthy();
  } catch (error) {
    // Cache not initialized
  }

  try {
    const mongo = getMongo();
    health.mongo = mongo.isHealthy();
  } catch (error) {
    // MongoDB not initialized
  }

  return health;
}