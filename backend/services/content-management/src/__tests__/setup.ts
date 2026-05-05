import { MongoClient, Db } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;
let mongoClient: MongoClient;
let testDb: Db;

export async function setupTestDatabase(): Promise<Db> {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  
  testDb = mongoClient.db('test_content_management');
  return testDb;
}

export async function teardownTestDatabase(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
}

export async function clearDatabase(db: Db): Promise<void> {
  const collections = await db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
}

export function getTestDb(): Db {
  return testDb;
}
