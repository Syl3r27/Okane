import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/env.setup.ts'],
  setupFilesAfterEach: [],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: ['**/tests/**/*.test.ts'],
  clearMocks: true,
  coverageThreshold: {
    global: { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
  // Thin bootstrap/wiring files excluded deliberately — index.ts (process.listen
  // + signal handlers) and the db singletons are exercised indirectly by the
  // integration tests and by the manual s1-s10 verification, not worth
  // contriving unit tests around process.exit()/real connections just to hit
  // a number. Business logic (middleware, worker, routes) stays fully covered.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/db/client.ts',
    '!src/db/redis.ts',
  ],
};

export default config;