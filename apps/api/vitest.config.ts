import { defineConfig } from 'vitest/config';

const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgresql://cim:cim_dev_pass@localhost:5432/cim_test';
export default defineConfig({
  test: {
    globalSetup: './tests/global-setup.ts',
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
    env: { NODE_ENV: 'test', DATABASE_URL: TEST_DB, JWT_SECRET: 'test-secret-0123456789abcdef0123456789', RUN_SCHEDULER: 'false', BCRYPT_ROUNDS: '4', STORAGE_DIR: './storage-test', LOG_LEVEL: 'silent', STORAGE_DRIVER: 'database', CRON_SECRET: 'test-cron-secret-0123456789abcdef' },
  },
});
