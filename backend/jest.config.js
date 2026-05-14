export default {
  // Tell Jest to use ES modules (your project uses "type": "module")
  transform: {},

  // Where to find test files
  testMatch: [
    '**/tests/**/*.test.js'
  ],

  // Load .env before tests run
  setupFiles: ['./tests/setup.js'],

  // Timeout for each test (integration tests hit DB, need more time)
  testTimeout: 10000,
};
