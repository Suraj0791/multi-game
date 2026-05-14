// ============================================================
// UNIT TEST: Validation Middleware
// ============================================================
// Tests the validate() factory function.
// We create fake req/res/next objects to test middleware without HTTP.
// This technique is called "mocking" — we create fake versions of things.
// ============================================================

import { validate, registerRules } from '../../src/middleware/validate.middleware.js';

// Helper: create fake Express req/res/next objects
function createMockReqRes(body = {}) {
  const req = { body };

  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;  // allows chaining: res.status(400).json(...)
    },
    json(data) {
      this.body = data;
    }
  };

  // next() tracks if it was called
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  return { req, res, next, wasNextCalled: () => nextCalled };
}

describe('Validation Middleware', () => {

  describe('Register validation', () => {

    it('should pass with valid data', () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({
        username: 'john',
        email: 'john@test.com',
        password: 'secret123'
      });

      // Call the middleware
      const middleware = validate(registerRules);
      middleware(req, res, next);

      // next() should be called — data is valid, continue to controller
      expect(wasNextCalled()).toBe(true);
    });

    it('should reject when username is missing', () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({
        email: 'john@test.com',
        password: 'secret123'
        // username missing!
      });

      const middleware = validate(registerRules);
      middleware(req, res, next);

      // next() should NOT be called — request should be rejected
      expect(wasNextCalled()).toBe(false);
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toContain('username is required');
    });

    it('should reject when username is too short', () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({
        username: 'ab',  // less than 3 chars
        email: 'john@test.com',
        password: 'secret123'
      });

      validate(registerRules)(req, res, next);

      expect(wasNextCalled()).toBe(false);
      expect(res.body.errors).toContain('username must be at least 3 characters');
    });

    it('should reject invalid email format', () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({
        username: 'john',
        email: 'not-an-email',
        password: 'secret123'
      });

      validate(registerRules)(req, res, next);

      expect(wasNextCalled()).toBe(false);
      expect(res.body.errors).toContain('email must be a valid email address');
    });

    it('should reject short password', () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({
        username: 'john',
        email: 'john@test.com',
        password: '123'  // less than 6 chars
      });

      validate(registerRules)(req, res, next);

      expect(wasNextCalled()).toBe(false);
      expect(res.body.errors).toContain('password must be at least 6 characters');
    });

    it('should return ALL errors at once, not just the first one', () => {
      const { req, res, next } = createMockReqRes({});
      // completely empty body — all fields missing

      validate(registerRules)(req, res, next);

      // Should have 3 errors (username, email, password all required)
      expect(res.body.errors).toHaveLength(3);
    });

  });

});
