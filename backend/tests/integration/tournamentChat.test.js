// ============================================================
// INTEGRATION TEST: Tournament & Chat API
// ============================================================
import request from 'supertest';
import app from '../../src/app.js';
import { saveMessage, getMessageHistory } from '../../src/models/ChatMessage.js';

const timestamp = Date.now();
const testHost = {
  username: `host_${timestamp}`,
  email: `host_${timestamp}@test.com`,
  password: 'password123'
};
const testPlayer = {
  username: `player_${timestamp}`,
  email: `player_${timestamp}@test.com`,
  password: 'password123'
};

describe('Tournament & Chat API', () => {
  let hostToken;
  let hostId;
  let playerToken;
  let playerId;
  let tournamentId;

  // 1. Setup host and player users
  beforeAll(async () => {
    // Register host
    let res = await request(app)
      .post('/auth/register')
      .send(testHost)
      .expect(201);
    hostToken = res.body.token;
    hostId = res.body.userId;

    // Register player
    res = await request(app)
      .post('/auth/register')
      .send(testPlayer)
      .expect(201);
    playerToken = res.body.token;
    playerId = res.body.userId;
  });

  // ==========================================
  // Tournament Creation & Management Tests
  // ==========================================
  describe('Tournament CRUD & Registration', () => {
    it('should create a new tournament when authenticated', async () => {
      const res = await request(app)
        .post('/tournaments')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          name: `Test Cup ${timestamp}`,
          game_type: 'TRIVIA',
          max_players: 8,
          entry_fee: 0
        })
        .expect(201);

      expect(res.body).toHaveProperty('tournamentId');
      expect(res.body.name).toContain('Test Cup');
      tournamentId = res.body.tournamentId;
    });

    it('should retrieve tournament details by ID', async () => {
      const res = await request(app)
        .get(`/tournaments/${tournamentId}`)
        .expect(200);

      expect(res.body).toHaveProperty('name');
      expect(res.body.hostId).toBe(Number(hostId));
    });

    it('should allow a player to join the tournament', async () => {
      await request(app)
        .post(`/tournaments/${tournamentId}/join`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(201);

      // Verify player list
      const res = await request(app)
        .get(`/tournaments/${tournamentId}/players`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const joined = res.body.some(p => p.playerId === Number(playerId));
      expect(joined).toBe(true);
    });
  });

  // ==========================================
  // Chat History & Persistence Tests
  // ==========================================
  describe('Chat System Persistence & Retrieval', () => {
    it('should retrieve empty chat history for a new tournament', async () => {
      const res = await request(app)
        .get(`/tournaments/${tournamentId}/chat`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('should save and retrieve chat messages from database', async () => {
      // 1. Directly save messages using model to test database write
      const savedMsg1 = await saveMessage(tournamentId, hostId, 'Hello from the host!');
      const savedMsg2 = await saveMessage(tournamentId, playerId, 'Hi, I am ready!');

      expect(savedMsg1).toHaveProperty('id');
      expect(savedMsg1.message).toBe('Hello from the host!');
      expect(savedMsg2.message).toBe('Hi, I am ready!');

      // 2. Fetch via the GET HTTP endpoint
      const res = await request(app)
        .get(`/tournaments/${tournamentId}/chat`)
        .expect(200);

      expect(res.body.length).toBe(2);
      expect(res.body[0].message).toBe('Hello from the host!');
      expect(res.body[0].username).toBe(testHost.username);
      expect(res.body[1].message).toBe('Hi, I am ready!');
      expect(res.body[1].username).toBe(testPlayer.username);
    });

    it('should enforce limits and constraints on chat retrieval', async () => {
      // Get chat history through model helper directly
      const history = await getMessageHistory(tournamentId);
      expect(history.length).toBe(2);
    });
  });
});
