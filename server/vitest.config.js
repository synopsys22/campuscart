import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globalSetup: ['tests/support/globalSetup.js'],
    setupFiles: ['tests/support/env.js'],
    // All test files share one mongod, so they run one at a time.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 180000,
  },
});
