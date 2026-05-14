// ============================================================
// INTEGRATION TEST: Health & Misc Endpoints
// ============================================================

import request from 'supertest';
import app from '../../src/app.js';

describe('Health & Misc Endpoints', () => {

  it('GET / should return API running message', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.message).toContain('running');
  });

  it('GET /health should return server health info', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('status', 'healthy');
    expect(response.body.data).toHaveProperty('uptime');
    expect(response.body.data).toHaveProperty('memory');
    expect(response.body.data).toHaveProperty('timestamp');
  });

  it('GET /nonexistent should return 404', async () => {
    const response = await request(app)
      .get('/this-route-does-not-exist')
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
  });

});
