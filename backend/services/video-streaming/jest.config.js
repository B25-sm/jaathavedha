module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleNameMapper: {
    '^@sai-mahendra/types$': '<rootDir>/../../shared/types/src',
    '^@sai-mahendra/utils$': '<rootDir>/../../shared/utils/src',
    '^@sai-mahendra/database$': '<rootDir>/../../shared/database/src'
  },
  testTimeout: 30000, // Longer timeout for video processing tests
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  }
};
