import { defineConfig } from 'vitest/config'
import 'dotenv/config';

export default defineConfig({
  test: {
    globals: true,
    timeout: 120000,
    testTimeout: 120000,
    hookTimeout: 120000,
    setupFiles: [],
    testMatch: ['**/tests/**/*.test.js'],
  },
})
