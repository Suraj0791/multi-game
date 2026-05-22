import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    timeout: 30000,
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: [],
  },
})
