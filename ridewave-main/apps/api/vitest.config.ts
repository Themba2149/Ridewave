import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    setupFiles: ['src/tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'file:./test.db',
      SESSION_SECRET: 'test-secret-test-secret-test-secret-0123456789',
      WEB_ORIGIN: 'http://localhost:5173',
      STORAGE_DIR: path.join(os.tmpdir(), 'ridewave-test-storage'),
    },
  },
});
