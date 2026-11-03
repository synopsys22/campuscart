import { defineConfig, devices } from '@playwright/test';

const PORT = 5055;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.js',
  // All tests share one database, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // A throwaway database, so tests never touch the saved demo data. The empty
    // MONGODB_URI stops the project's .env from sending the tests to Atlas.
    command: 'node server/src/server.js',
    url: `http://localhost:${PORT}/api/health`,
    timeout: 120000,
    reuseExistingServer: false,
    env: { PORT: String(PORT), DB_MODE: 'memory', NODE_ENV: 'production', MONGODB_URI: '' },
  },
});
