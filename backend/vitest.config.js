import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    timeout: 60000,
    testTimeout: 60000,
    hookTimeout: 60000,
    setupFiles: [],
    testMatch: ['**/tests/**/*.test.js'],
    // Increase per-test timeout for long-running socket tests
    // Individual test overrides can be set via test.extend
  },
})
