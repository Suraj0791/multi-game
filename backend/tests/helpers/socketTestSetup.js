import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import app, { setDebugIO } from '../../src/app.js';
import setupSocketEvents from '../../src/socket/socketEvents.js';
import { createUser, findByEmail } from '../../src/models/User.js';
import { createMatch, getMatchesByTournament } from '../../src/models/Match.js';
import { pool } from '../../src/config/database.js';
import { startTest, step, stepOk, stepFail, endTest } from './stepLogger.js';
import { clearEventLog, dumpEventLog } from './socketTracer.js';
import bcrypt from 'bcryptjs';

const TEST_PASSWORD = 'testpass123';

let serverCounter = 0;

export async function startSocketServer(port = 0) {
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });
  setupSocketEvents(io);

  // Register IO with debug endpoint for memory leak tests
  setDebugIO(io);

  await new Promise((resolve) => {
    httpServer.listen(port, () => {
      resolve(httpServer.address().port);
    });
  });

  return { httpServer, io };
}

export async function createTestUser(index = 1) {
  const ts = Date.now() + serverCounter++;
  const username = `socktest_user${index}_${ts}`;
  const email = `socktest_${index}_${ts}@test.com`;
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);

  const user = await createUser(username, email, hashedPassword);
  return { ...user, plainPassword: TEST_PASSWORD };
}

export async function createTestTournamentAndMatch(player1Id, player2Id, gameType = 'TRIVIA') {
  const ts = Date.now() + serverCounter++;
  const tournamentName = `SocketTestTourney_${ts}_${gameType}`;

  // Create tournament
  const tournamentRes = await pool.query(
    `INSERT INTO tournaments (name, game_type, host_id, max_players, entry_fee, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [tournamentName, gameType, player1Id, 2, 0, 'IN_PROGRESS']
  );
  const tournament = tournamentRes.rows[0];

  // Create match
  const match = await createMatch(tournament.id, player1Id, player2Id, 1, 1);

  return { tournament, match };
}

export async function cleanupTestData(identifiers) {
  if (!identifiers || identifiers.length === 0) return;
  for (const id of identifiers) {
    try {
      await pool.query('DELETE FROM matches WHERE id = $1', [id]);
    } catch {}
    try {
      await pool.query('DELETE FROM tournaments WHERE id = $1', [id]);
    } catch {}
    try {
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
    } catch {}
  }
}

export function connectSocket(serverPort, authToken = null) {
  const client = Client(`http://localhost:${serverPort}`, {
    transports: ['websocket'],
    forceNew: true,
    auth: authToken ? { token: authToken } : {},
  });
  return client;
}

export async function waitForEvent(socket, eventName, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(
        `Timeout waiting for event "${eventName}" (${timeoutMs}ms)\n` +
        `  Last events:\n    ${dumpEventLog()}`
      ));
    }, timeoutMs);

    socket.once(eventName, (...args) => {
      clearTimeout(timer);
      resolve(args.length <= 1 ? args[0] : args);
    });
  });
}

export async function waitForAnyEvent(socket, eventNames, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(
        `Timeout waiting for one of [${eventNames.join(', ')}] (${timeoutMs}ms)`
      ));
    }, timeoutMs);

    const handlers = {};
    eventNames.forEach((name) => {
      handlers[name] = (...args) => {
        clearTimeout(timer);
        eventNames.forEach(n => socket.off(n, handlers[n]));
        resolve({ event: name, data: args.length <= 1 ? args[0] : args });
      };
      socket.once(name, handlers[name]);
    });
  });
}

export { startTest, step, stepOk, stepFail, endTest, clearEventLog, dumpEventLog };
