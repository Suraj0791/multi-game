// ============================================================
// INTEGRATION TEST: Auth API
// ============================================================
// This tests the FULL flow: HTTP request → route → controller → service → DB
// Uses Supertest to make real HTTP requests to your Express app.
//
// IMPORTANT: These tests hit your REAL database.
// In production projects, you'd use a separate test database.
// For now, we'll create test users and clean them up after.
// ============================================================

import request from 'supertest';
import app from '../../src/app.js';

// Generate unique test data for each run (prevents duplicate email errors)
const timestamp = Date.now();
const testUser = {
  username: `testuser_${timestamp}`,
  email: `test_${timestamp}@test.com`,
  password: 'testpassword123'
};

describe('Auth API', () => {

  // ==========================================
  // POST /auth/register
  // ==========================================
  describe('POST /auth/register', () => {

    it('should register a new user and return a token', async () => {
      const response = await request(app)   // supertest wraps your Express app
        .post('/auth/register')             // make a POST request
        .send(testUser)                     // send this body
        .expect(201);                       // expect 201 status

      // Check response body matches what YOUR controller returns:
      // { userId, token, message }
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('userId');
      expect(response.body.message).toBe('User registered');
      // Token should be a non-empty string
      expect(response.body.token).toBeTruthy();
    });

    it('should reject registration with missing fields', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({ username: 'john' })     // missing email and password
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          username: 'john',
          email: 'not-an-email',
          password: 'secret123'
        })
        .expect(400);

      expect(response.body.errors).toContain('email must be a valid email address');
    });

    it('should reject registration with short password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          username: 'john',
          email: 'valid@email.com',
          password: '123'                // too short (min 6)
        })
        .expect(400);

      expect(response.body.errors).toContain('password must be at least 6 characters');
    });

    it('should reject duplicate email registration', async () => {
      // Try to register with the same email as the first test
      const response = await request(app)
        .post('/auth/register')
        .send(testUser)  // same email as above
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

  });

  // ==========================================
  // POST /auth/login
  // ==========================================
  describe('POST /auth/login', () => {

    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.token).toBeTruthy();
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nobody@exists.com',
          password: 'whatever'
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should reject login with missing fields', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({})
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

  });

  // ==========================================
  // Protected Routes (using token from login)
  // ==========================================
  describe('Protected Routes', () => {

    let token;

    // beforeAll runs ONCE before all tests in this describe block
    // We login to get a valid token
    beforeAll(async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password });
      token = response.body.token;
    });

    it('should access tournaments when authenticated', async () => {
      const response = await request(app)
        .get('/tournaments')
        .set('Authorization', `Bearer ${token}`)  // set header
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject when no token provided', async () => {
      const response = await request(app)
        .post('/tournaments')
        .send({ name: 'Test', game_type: 'trivia', max_players: 8 })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should reject with invalid token', async () => {
      const response = await request(app)
        .post('/tournaments')
        .send({ name: 'Test', game_type: 'trivia', max_players: 8 })
        .set('Authorization', 'Bearer fake.invalid.token')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

  });

});
