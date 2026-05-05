module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  moduleNameMapper: {
    '^@sai-mahendra/shared-types$': '<rootDir>/../../shared/types/src/index.ts',
    '^@sai-mahendra/shared-utils$': '<rootDir>/../../shared/utils/src/index.ts',
    '^@sai-mahendra/shared-database$': '<rootDir>/../../shared/database/src/index.ts'
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  verbose: true,
  testTimeout: 10000
};
