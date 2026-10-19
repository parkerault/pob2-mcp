/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  watchman: false,
  roots: ['<rootDir>/tests'],
  // C-18: scrub cookies, temp builds/state dirs and a one-time engine probe before any worker
  // starts; live fetch disabled in every test file.
  globalSetup: '<rootDir>/tests/setup/global.ts',
  setupFiles: ['<rootDir>/tests/setup/env.ts'],
  testTimeout: 60000,
  // Half the machine's threads: each worker can start a PoB engine, and a full run at the default (threads - 1)
  // saturated a 32-thread box and starved the terminal (2026-10-18).
  maxWorkers: '50%',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },
  testMatch: [
    '**/tests/**/*.test.ts',
  ],
  // C-19, review S17: the timing NFR tests, compile time (AC-P37, fixed 100 s threshold) and trade-query
  // generation (AC-T22, 8 s per slot), run alone, in the `mise run test` task's own --runInBand step after
  // the parallel run, never inside it.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/integration/compilePlanNfr.test.ts',
    '<rootDir>/tests/integration/tradeQueryNfr.test.ts',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
