/**
 * Mock database module for testing
 */

export const getDatabase = jest.fn(() => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  query: jest.fn(),
}));

export const getCache = jest.fn(() => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
}));
