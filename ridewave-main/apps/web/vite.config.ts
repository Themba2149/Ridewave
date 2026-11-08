/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Read the shared root .env; only VITE_-prefixed values ever reach the browser bundle.
  const envDir = path.resolve(__dirname, '../..');
  const env = loadEnv(mode, envDir, 'VITE_');
  return {
    envDir,
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: env.VITE_API_PROXY_TARGET || 'http://localhost:4000', changeOrigin: true },
        // Real-time channel (WebSocket). The browser's Origin header is preserved, which the API checks against WEB_ORIGIN.
        '/socket.io': { target: env.VITE_API_PROXY_TARGET || 'http://localhost:4000', changeOrigin: true, ws: true },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
