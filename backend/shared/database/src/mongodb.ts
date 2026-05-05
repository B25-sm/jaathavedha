/**
 * MongoDB Connection and Document Management Utilities
 * Provides connection management for analytics, content, and audit logging
 */

import { MongoClient, Db, Collection, MongoClientOptions } from 'mongodb';
import { logger } from '@sai-mahendra/utils';

export interface MongoConfig {
  uri: string;
  database: string;
  options?: MongoClientOptions;
}

export interface QueryOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  projection?: Record<string, 1 | 0>;
}

export class MongoDatabase {
  private client: MongoClient;
  private db: Db | null = null;
  private isConnected = false;
  private config: MongoConfig;

  constructor(config: MongoConfig) {
    this.config = config;
    
    const defaultOptions: MongoClientOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
    };

    this.client = new MongoClient(config.uri, {
      ...defaultOptions,
      ...config.options,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connectionPoolCreated', () => {
      logger.debug('MongoDB connection pool created');
    });

    this.client.on('connectionPoolClosed', () => {
      logger.debug('MongoDB connection pool closed');
    });

    this.client.on('error', (error) => {
      logger.error('MongoDB client error:', error);
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db(this.config.database);
      
      // Test connection
      await this.db.admin().ping();
      
      this.isConnected = true;
      logger.info('MongoDB connected successfully');
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.close();
      this.isConnected = false;
      logger.info('MongoDB disconnected');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  getDatabase(): Db {
    if (!this.db) {
      throw new Error('MongoDB not connected. Call connect() first.');
    }
    return this.db;
  }

  getCollection<T = any>(name: string): Collection<T> {
    return this.getDatabase().collection<T>(name);
  }

  // Document operations
  async insertOne<T = any>(
    collectionName: string,
    document: T
  ): Promise<string> {
    try {
      const collection = this.getCollection<T>(collectionName);
      const result = await collection.insertOne({
        ...document,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      
      return result.insertedId.toString();
    } catch (error) {
      logger.error('MongoDB insertOne error:', { collectionName, error });
      throw error;
    }
  }

  async insertMany<T = any>(
    collectionName: string,
    documents: T[]
  ): Promise<string[]> {
    try {
      const collection = this.getCollection<T>(collectionName);
      const now = new Date();
      
      const documentsWithTimestamps = documents.map(doc => ({
        ...doc,
        createdAt: now,
        updatedAt: now,
      })) as any[];
      
      const result = await collection.insertMany(documentsWithTimestamps);
      return Object.values(result.insertedIds).map(id => id.toString());
    } catch (error) {
      logger.error('MongoDB insertMany error:', { collectionName, error });
      throw error;
    }
  }

  async findOne<T = any>(
    collectionName: string,
    filter: Record<string, any>,
    options?: QueryOptions
  ): Promise<T | null> {
    try {
      const collection = this.getCollection<T>(collectionName);
      const result = await collection.findOne(filter, {
        projection: options?.projection,
      });
      
      return result;
    } catch (error) {
      logger.error('MongoDB findOne error:', { collectionName, filter, error });
      return null;
    }
  }

  async findMany<T = any>(
    collectionName: string,
    filter: Record<string, any> = {},
    options: QueryOptions = {}
  ): Promise<T[]> {
    try {
      const collection = this.getCollection<T>(collectionName);
      let cursor = collection.find(filter);
      
      if (options.projection) {
        cursor = cursor.project(options.projection);
      }
      
      if (options.sort) {
        cursor = cursor.sort(options.sort);
      }
      
      if (options.skip) {
        cursor = cursor.skip(options.skip);
      }
      
      if (options.limit) {
        cursor = cursor.limit(options.limit);
      }
      
      return await cursor.toArray();
    } catch (error) {
      logger.error('MongoDB findMany error:', { collectionName, filter, error });
      return [];
    }
  }

  async updateOne<T = any>(
    collectionName: string,
    filter: Record<string, any>,
    update: Record<string, any>
  ): Promise<boolean> {
    try {
      const collection = this.getCollection<T>(collectionName);
      const result = await collection.updateOne(filter, {
        $set: {
          ...update,
          updatedAt: new Date(),
        },
      });
      
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('MongoDB updateOne error:', { collectionName, filter, update, error });
      return false;
    }
  }

  async updateMany<T = any>(
    collectionName: string,
    filter: Record<string, any>,
    update: Record<string, any>
  ): Promise<number> {
    try {
      const collection = this.getCollection<T>(collectionName);
      const result = await collection.updateMany(filter, {
        $set: {
          ...update,
          updatedAt: new Date(),
        },
      });
      
      return result.modifiedCount;
    } catch (error) {
      logger.error('MongoDB updateMany error:', { collectionName, filter, update, error });
      return 0;
    }
  }

  async deleteOne<T = any>(
    collectionName: string,
    filter: Record<string, any>
  ): Promise<boolean> {
    try {
      const collection = this.getCollection<T>(collectionName);
      const result = await collection.deleteOne(filter);
      return result.deletedCount > 0;
    } catch (error) {
      logger.error('MongoDB deleteOne error:', { collectionName, filter, error });
      return false;
    }
  }

  async deleteMany<T = any>(
    collectionName: string,
    filter: Record<string, any>
  ): Promise<number> {
    try {
      const collection = this.getCollection<T>(collectionName);
      const result = await collection.deleteMany(filter);
      return result.deletedCount || 0;
    } catch (error) {
      logger.error('MongoDB deleteMany error:', { collectionName, filter, error });
      return 0;
    }
  }

  async count(
    collectionName: string,
    filter: Record<string, any> = {}
  ): Promise<number> {
    try {
      const collection = this.getCollection(collectionName);
      return await collection.countDocuments(filter);
    } catch (error) {
      logger.error('MongoDB count error:', { collectionName, filter, error });
      return 0;
    }
  }

  async exists(
    collectionName: string,
    filter: Record<string, any>
  ): Promise<boolean> {
    try {
      const collection = this.getCollection(collectionName);
      const result = await collection.findOne(filter, { projection: { _id: 1 } });
      return result !== null;
    } catch (error) {
      logger.error('MongoDB exists error:', { collectionName, filter, error });
      return false;
    }
  }

  // Aggregation operations
  async aggregate<T = any>(
    collectionName: string,
    pipeline: Record<string, any>[]
  ): Promise<T[]> {
    try {
      const collection = this.getCollection(collectionName);
      const cursor = collection.aggregate<T>(pipeline);
      return await cursor.toArray();
    } catch (error) {
      logger.error('MongoDB aggregate error:', { collectionName, pipeline, error });
      return [];
    }
  }

  // Analytics-specific methods
  async logEvent(event: {
    type: string;
    userId?: string;
    sessionId?: string;
    data: Record<string, any>;
    timestamp?: Date;
  }): Promise<string> {
    const eventDocument = {
      ...event,
      timestamp: event.timestamp || new Date(),
    };
    
    return this.insertOne('analytics_events', eventDocument);
  }

  async getEventsByUser(
    userId: string,
    eventType?: string,
    options: QueryOptions = {}
  ): Promise<any[]> {
    const filter: Record<string, any> = { userId };
    if (eventType) {
      filter.type = eventType;
    }
    
    return this.findMany('analytics_events', filter, {
      sort: { timestamp: -1 },
      ...options,
    });
  }

  async getEventsByTimeRange(
    startDate: Date,
    endDate: Date,
    eventType?: string,
    options: QueryOptions = {}
  ): Promise<any[]> {
    const filter: Record<string, any> = {
      timestamp: {
        $gte: startDate,
        $lte: endDate,
      },
    };
    
    if (eventType) {
      filter.type = eventType;
    }
    
    return this.findMany('analytics_events', filter, {
      sort: { timestamp: -1 },
      ...options,
    });
  }

  // Content management methods
  async saveContent(content: {
    type: string;
    title: string;
    content: any;
    status: 'draft' | 'published' | 'archived';
    authorId?: string;
    version?: number;
  }): Promise<string> {
    return this.insertOne('content', {
      ...content,
      version: content.version || 1,
    });
  }

  async getContentByType(
    type: string,
    status: 'draft' | 'published' | 'archived' = 'published',
    options: QueryOptions = {}
  ): Promise<any[]> {
    return this.findMany('content', { type, status }, {
      sort: { createdAt: -1 },
      ...options,
    });
  }

  // Audit logging
  async logAudit(audit: {
    action: string;
    userId: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<string> {
    return this.insertOne('audit_logs', audit);
  }

  async getAuditLogs(
    userId?: string,
    action?: string,
    options: QueryOptions = {}
  ): Promise<any[]> {
    const filter: Record<string, any> = {};
    if (userId) filter.userId = userId;
    if (action) filter.action = action;
    
    return this.findMany('audit_logs', filter, {
      sort: { createdAt: -1 },
      ...options,
    });
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      await this.getDatabase().admin().ping();
      return true;
    } catch (error) {
      logger.error('MongoDB ping error:', error);
      return false;
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  getClient(): MongoClient {
    return this.client;
  }
}

// Singleton instance
let mongoInstance: MongoDatabase | null = null;

export function createMongo(config: MongoConfig): MongoDatabase {
  if (!mongoInstance) {
    mongoInstance = new MongoDatabase(config);
  }
  return mongoInstance;
}

export function getMongo(): MongoDatabase {
  if (!mongoInstance) {
    throw new Error('MongoDB not initialized. Call createMongo() first.');
  }
  return mongoInstance;
}