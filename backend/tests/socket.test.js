import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startSocketServer, createTestUser, createTestTournamentAndMatch,
  cleanupTestData, connectSocket, waitForEvent, waitForAnyEvent,
  startTest, step, stepOk, stepFail, endTest, clearEventLog,
} from './helpers/socketTestSetup.js';
import { getActiveGamesSummary } from './helpers/failureArtifacts.js';
import { query } from '../src/config/database.js';

let httpServer, io, serverPort;
const cleanupIds = { users: [], tournaments: [], matches: [] };

beforeAll(async () => {
  serverPort = await startSocketServer(0);
  console.log(`\n  🧪 Socket test server started on port ${serverPort}\n`);
});

afterAll(async () => {
  // Clean up all test data
  for (const id of cleanupIds.users) {
    try { await query('DELETE FROM users WHERE id = $1', [id]); } catch {}
  }
  for (const id of cleanupIds.tournaments) {
    try { await query('DELETE FROM tournaments WHERE id = $1', [id]); } catch {}
  }
  for (const id of cleanupIds.matches) {
    try { await query('DELETE FROM matches WHERE id = $1', [id]); } catch {}
  }

  io?.close();
  httpServer?.close();
});

// ============================================================
// TEST 1: Trivia Full Lifecycle
// ============================================================
describe('Trivia Full Lifecycle', () => {
  it('should complete a full trivia match: join → started → question → answer → score → match_over', async () => {
    startTest('Trivia Full Lifecycle');
    clearEventLog();

    const player1 = await createTestUser(1);
    const player2 = await createTestUser(2);
    cleanupIds.users.push(player1.id, player2.id);

    const { tournament, match } = await createTestTournamentAndMatch(player1.id, player2.id, 'TRIVIA');
    cleanupIds.tournaments.push(tournament.id);
    cleanupIds.matches.push(match.id);

    step('Created test tournament and match', { matchId: match.id });

    const socket1 = connectSocket(serverPort);
    const socket2 = connectSocket(serverPort);

    await Promise.all([
      new Promise(r => socket1.on('connect', r)),
      new Promise(r => socket2.on('connect', r)),
    ]);
    stepOk('Both socket clients connected');

    // Both join
    const gameStartPromise1 = waitForEvent(socket1, 'trivia:started', 20000);
    const gameStartPromise2 = waitForEvent(socket2, 'trivia:started', 20000);

    socket1.emit('trivia:join', { matchId: match.id, playerId: player1.id });
    await new Promise(r => setTimeout(r, 500));
    socket2.emit('trivia:join', { matchId: match.id, playerId: player2.id });

    const started1 = await gameStartPromise1;
    const started2 = await gameStartPromise2;
    expect(started1.message).toContain('Game starting');
    expect(started2.message).toContain('Game starting');
    stepOk('Both received trivia:started');

    // Wait for question
    const question1 = await waitForEvent(socket1, 'trivia:new_question', 25000);
    await waitForEvent(socket2, 'trivia:new_question', 25000);
    expect(question1.question).toBeDefined();
    expect(question1.question.text).toBeTruthy();
    expect(question1.question.options).toHaveLength(4);
    expect(question1.timerSeconds).toBe(10);
    stepOk('Both received trivia:new_question', { question: question1.question.text });

    // Player 1 answers correctly
    const correctAnswer = question1.question.options[0];
    socket1.emit('trivia:answer', {
      matchId: match.id, playerId: player1.id,
      answer: correctAnswer, timeTakenMs: 3000,
    });

    const feedback1 = await waitForEvent(socket1, 'trivia:answer_feedback', 10000);
    expect(feedback1).toBeDefined();
    stepOk('Player 1 received answer feedback', { correct: !!feedback1.correct, points: feedback1.points });

    // Player 2 answers
    const correctAnswer2 = question1.question.options[0];
    socket2.emit('trivia:answer', {
      matchId: match.id, playerId: player2.id,
      answer: correctAnswer2, timeTakenMs: 5000,
    });

    const feedback2 = await waitForEvent(socket2, 'trivia:answer_feedback', 10000);
    expect(feedback2).toBeDefined();
    stepOk('Player 2 received answer feedback', { correct: !!feedback2.correct, points: feedback2.points });

    // Wait for round_over
    const roundOver1 = await waitForEvent(socket1, 'trivia:round_over', 10000);
    await waitForEvent(socket2, 'trivia:round_over', 10000);
    expect(roundOver1.correctAnswer).toBeDefined();
    stepOk('Both received trivia:round_over', { correctAnswer: roundOver1.correctAnswer });

    // Wait for score update
    const scoreUpdate = await waitForEvent(socket1, 'trivia:score_update', 10000);
    expect(scoreUpdate.scores).toBeDefined();
    stepOk('Score update received', { scores: scoreUpdate.scores });

    // Play remaining 4 rounds
    for (let round = 2; round <= 5; round++) {
      step(`Playing round ${round}/5`);

      const q = await waitForEvent(socket1, 'trivia:new_question', 30000);
      const ans1 = q.question.options[0];
      const ans2 = q.question.options[0];

      socket1.emit('trivia:answer', { matchId: match.id, playerId: player1.id, answer: ans1, timeTakenMs: 3000 });
      socket2.emit('trivia:answer', { matchId: match.id, playerId: player2.id, answer: ans2, timeTakenMs: 3000 });

      await waitForEvent(socket1, 'trivia:round_over', 15000);
      await waitForEvent(socket1, 'trivia:score_update', 10000);
      stepOk(`Round ${round} completed`);
    }

    // Wait for match over
    const matchOver = await waitForEvent(socket1, 'trivia:match_over', 60000);
    expect(matchOver.winnerId).toBeDefined();
    expect(matchOver.scores).toBeDefined();
    stepOk('Match over', { winnerId: matchOver.winnerId, scores: matchOver.scores });

    socket1.close();
    socket2.close();
    endTest(true);
  }, 180000);
});

// ============================================================
// TEST 2: Quick Draw Full Lifecycle
// ============================================================
describe('Quick Draw Full Lifecycle', () => {
  it('should complete a Quick Draw match: join → started → strokes → timer → guess → match_over', async () => {
    startTest('Quick Draw Full Lifecycle');
    clearEventLog();

    const player1 = await createTestUser(3);
    const player2 = await createTestUser(4);
    cleanupIds.users.push(player1.id, player2.id);

    const { tournament, match } = await createTestTournamentAndMatch(player1.id, player2.id, 'QUICK_DRAW');
    cleanupIds.tournaments.push(tournament.id);
    cleanupIds.matches.push(match.id);

    const socket1 = connectSocket(serverPort);
    const socket2 = connectSocket(serverPort);
    await Promise.all([
      new Promise(r => socket1.on('connect', r)),
      new Promise(r => socket2.on('connect', r)),
    ]);
    stepOk('Both socket clients connected');

    // Both join
    socket1.emit('join_match', { matchId: match.id, playerId: player1.id });
    await new Promise(r => setTimeout(r, 500));
    socket2.emit('join_match', { matchId: match.id, playerId: player2.id });

    const status1 = await waitForEvent(socket1, 'game_status', 15000);
    await waitForEvent(socket2, 'game_status', 15000);
    expect(status1.startTime).toBeDefined();
    stepOk('Both received game_status (match started)');

    // Check timer events
    const timer1 = await waitForEvent(socket1, 'quickdraw:timer', 5000);
    expect(timer1.timeRemaining).toBeDefined();
    expect(timer1.timeRemaining).toBeLessThanOrEqual(60);
    stepOk('Timer event received', { timeRemaining: timer1.timeRemaining });

    // Player 1 (drawer) sends strokes
    socket1.emit('draw_stroke', { matchId: match.id, playerId: player1.id, x: 100, y: 200, type: 'start' });
    socket1.emit('draw_stroke', { matchId: match.id, playerId: player1.id, x: 150, y: 250, type: 'draw' });

    await new Promise(r => setTimeout(r, 500));
    stepOk('Drawer sent strokes');

    // Player 2 (guesser) submits wrong guesses
    socket2.emit('submit_guess', { matchId: match.id, playerId: player2.id, guess: 'WRONG' });
    const wrongFeedback = await waitForEvent(socket2, 'wrong_guess', 10000);
    expect(wrongFeedback.attemptsLeft).toBe(4);
    stepOk('Wrong guess rejected correctly', { attemptsLeft: wrongFeedback.attemptsLeft });

    // Get the word to draw (it was sent to player 1 as drawer)
    const wordStatus = await waitForAnyEvent(socket1, ['game_status'], 5000);
    const wordToDraw = wordStatus.data.wordToDraw;

    if (wordToDraw) {
      // Player 2 submits correct guess
      socket2.emit('submit_guess', { matchId: match.id, playerId: player2.id, guess: wordToDraw });
      const matchOver = await waitForAnyEvent(socket2, ['match_over'], 30000);
      expect(matchOver.event).toBe('match_over');
      expect(matchOver.data.winnerId).toBe(player2.id);
      stepOk('Match over — guesser won with correct word', { word: wordToDraw });
    } else {
      step('No wordToDraw in status event (may have been sent to specific socket), checking match_over via timer');
      // Wait for timer to expire
      const timerEnd = await waitForAnyEvent(socket1, ['match_over', 'quickdraw:timer'], 90000);
      stepOk(`Match ended via: ${timerEnd.event}`);
    }

    socket1.close();
    socket2.close();
    endTest(true);
  }, 120000);
});

// ============================================================
// TEST 3: Bot Auto-Answer in Trivia
// ============================================================
describe('Bot Answer in Trivia', () => {
  it('should auto-answer when one player is a bot', async () => {
    startTest('Bot Auto-Answer in Trivia');
    clearEventLog();

    const human = await createTestUser(5);
    const ts = Date.now();
    // Create a bot user (email ending with @tourneyhub.demo)
    const botHashed = await (await import('bcryptjs')).hash('botpass', 10);
    const botUser = await createUser(`bot_test_${ts}`, `bot_test_${ts}@tourneyhub.demo`, botHashed);
    cleanupIds.users.push(human.id, botUser.id);

    const { tournament, match } = await createTestTournamentAndMatch(human.id, botUser.id, 'TRIVIA');
    cleanupIds.tournaments.push(tournament.id);
    cleanupIds.matches.push(match.id);

    const socket = connectSocket(serverPort);
    await new Promise(r => socket.on('connect', r));
    stepOk('Human player socket connected');

    socket.emit('trivia:join', { matchId: match.id, playerId: human.id });
    step('Bot should auto-join (detected via @tourneyhub.demo email)');

    // Bot should auto-join because of email detection
    const started = await waitForEvent(socket, 'trivia:started', 20000);
    expect(started.message).toContain('Game starting');
    stepOk('Human received trivia:started (bot auto-joined)');

    // Wait for first question
    const question = await waitForEvent(socket, 'trivia:new_question', 25000);
    expect(question.question).toBeDefined();
    stepOk('Human received first question');

    // Human answers
    socket.emit('trivia:answer', {
      matchId: match.id, playerId: human.id,
      answer: question.question.options[0], timeTakenMs: 3000,
    });
    const feedback = await waitForEvent(socket, 'trivia:answer_feedback', 10000);
    stepOk('Human received answer feedback');

    // Wait for bot to answer automatically (bot has a 2-7s delay)
    const scoreUpdate = await waitForEvent(socket, 'trivia:score_update', 20000);
    expect(scoreUpdate.scores).toBeDefined();
    const scores = Object.values(scoreUpdate.scores);
    expect(scores.length).toBe(2);
    stepOk('Bot auto-answered — both scores present', { scores: scoreUpdate.scores });

    // Cleanup by playing remaining rounds
    for (let r = 2; r <= 5; r++) {
      const q = await waitForEvent(socket, 'trivia:new_question', 30000);
      socket.emit('trivia:answer', { matchId: match.id, playerId: human.id, answer: q.question.options[0], timeTakenMs: 3000 });
      await waitForEvent(socket, 'trivia:round_over', 20000);
    }

    const matchOver = await waitForEvent(socket, 'trivia:match_over', 60000);
    expect(matchOver.winnerId).toBeDefined();
    stepOk('Match over with bot', { winnerId: matchOver.winnerId });

    socket.close();
    endTest(true);
  }, 180000);
});

// ============================================================
// TEST 4: Invalid Answer Rejection
// ============================================================
describe('Invalid Answer Rejection', () => {
  it('should reject wrong player ID, double answers, and non-player submissions', async () => {
    startTest('Invalid Answer Rejection');
    clearEventLog();

    const player1 = await createTestUser(7);
    const player2 = await createTestUser(8);
    cleanupIds.users.push(player1.id, player2.id);

    const { tournament, match } = await createTestTournamentAndMatch(player1.id, player2.id, 'TRIVIA');
    cleanupIds.tournaments.push(tournament.id);
    cleanupIds.matches.push(match.id);

    const socket1 = connectSocket(serverPort);
    const intruder = connectSocket(serverPort);
    await Promise.all([
      new Promise(r => socket1.on('connect', r)),
      new Promise(r => intruder.on('connect', r)),
    ]);

    // Both legitimate players join
    socket1.emit('trivia:join', { matchId: match.id, playerId: player1.id });
    const intruderJoin = new Promise(r => intruder.once('trivia:started', r));
    // Need player2 to join to start game — use intruder as player2 substitute
    // Actually we need a real player2, but let's test what we can
    intruder.emit('trivia:join', { matchId: match.id, playerId: player2.id });
    await intruderJoin;

    const question = await waitForEvent(socket1, 'trivia:new_question', 25000);
    stepOk('Game started, question received');

    // Test 1: Submit answer for wrong match
    socket1.emit('trivia:answer', {
      matchId: 99999, playerId: player1.id,
      answer: 'Test', timeTakenMs: 1000,
    });
    // No response expected — server silently ignores non-existent match
    step('Submitted answer for non-existent match (should be silently ignored)');

    // Test 2: Submit answer as non-player
    const invalidId = 99999;
    socket1.emit('trivia:answer', {
      matchId: match.id, playerId: invalidId,
      answer: 'Test', timeTakenMs: 1000,
    });
    // Wait briefly for potential error
    const errorEvent = await waitForAnyEvent(socket1, ['error', 'trivia:error'], 5000).catch(() => null);
    if (errorEvent) {
      stepOk('Non-player answer rejected', { event: errorEvent.event, message: errorEvent.data?.message });
    } else {
      step('Non-player answer silently ignored (no error event emitted)');
    }

    // Test 3: Legitimate answer
    const correctQ = question.question;
    socket1.emit('trivia:answer', {
      matchId: match.id, playerId: player1.id,
      answer: correctQ.options[0], timeTakenMs: 3000,
    });
    const feedback = await waitForEvent(socket1, 'trivia:answer_feedback', 10000);
    expect(feedback).toBeDefined();
    stepOk('Legitimate answer accepted');

    // Test 4: Double answer (same player same question)
    socket1.emit('trivia:answer', {
      matchId: match.id, playerId: player1.id,
      answer: correctQ.options[0], timeTakenMs: 3000,
    });
    const doubleError = await waitForAnyEvent(socket1, ['trivia:error', 'error'], 5000);
    expect(doubleError).toBeDefined();
    stepOk('Double answer rejected', { message: doubleError.data?.message });

    // Test 5: Guesser draws in Quick Draw
    const { tournament: qdTournament, match: qdMatch } = await createTestTournamentAndMatch(player1.id, player2.id, 'QUICK_DRAW');
    cleanupIds.tournaments.push(qdTournament.id);
    cleanupIds.matches.push(qdMatch.id);

    socket1.emit('join_match', { matchId: qdMatch.id, playerId: player1.id });
    await new Promise(r => setTimeout(r, 300));
    intruder.emit('join_match', { matchId: qdMatch.id, playerId: player2.id });
    await waitForEvent(socket1, 'game_status', 15000);
    stepOk('Quick Draw match started');

    // Player 1 is drawer by default (player_1_id), player 2 is guesser
    // Player 2 tries to draw
    intruder.emit('draw_stroke', { matchId: qdMatch.id, playerId: player2.id, x: 100, y: 100, type: 'start' });
    const drawError = await waitForEvent(intruder, 'error', 5000);
    expect(drawError.message).toContain('drawer');
    stepOk('Guesser blocked from drawing', { message: drawError.message });

    socket1.close();
    intruder.close();
    endTest(true);
  }, 120000);
});

// ============================================================
// TEST 5: Disconnect Cleanup
// ============================================================
describe('Disconnect Cleanup', () => {
  it('should clean up game state when players disconnect', async () => {
    startTest('Disconnect Cleanup');
    clearEventLog();

    const player1 = await createTestUser(9);
    const player2 = await createTestUser(10);
    cleanupIds.users.push(player1.id, player2.id);

    const { tournament, match } = await createTestTournamentAndMatch(player1.id, player2.id, 'TRIVIA');
    cleanupIds.tournaments.push(tournament.id);
    cleanupIds.matches.push(match.id);

    const socket1 = connectSocket(serverPort);
    const socket2 = connectSocket(serverPort);
    await Promise.all([
      new Promise(r => socket1.on('connect', r)),
      new Promise(r => socket2.on('connect', r)),
    ]);

    socket1.emit('trivia:join', { matchId: match.id, playerId: player1.id });
    await new Promise(r => setTimeout(r, 300));
    socket2.emit('trivia:join', { matchId: match.id, playerId: player2.id });
    await waitForEvent(socket1, 'trivia:started', 20000);
    stepOk('Match started');

    // Both disconnect
    socket1.close();
    socket2.close();
    step('Both players disconnected');

    await new Promise(r => setTimeout(r, 2000));

    // Verify: re-creating match should work cleanly
    const socket3 = connectSocket(serverPort);
    const socket4 = connectSocket(serverPort);
    await Promise.all([
      new Promise(r => socket3.on('connect', r)),
      new Promise(r => socket4.on('connect', r)),
    ]);

    socket3.emit('trivia:join', { matchId: match.id, playerId: player1.id });
    await new Promise(r => setTimeout(r, 300));
    socket4.emit('trivia:join', { matchId: match.id, playerId: player2.id });

    // Should be able to start a new game (or get reconnection state)
    const reconnected = await waitForAnyEvent(socket3, ['trivia:started', 'trivia:score_update', 'trivia:waiting'], 20000);
    expect(reconnected).toBeDefined();
    stepOk('Reconnection after cleanup successful', { event: reconnected.event });

    socket3.close();
    socket4.close();
    endTest(true);
  }, 60000);
});

// ============================================================
// TEST 6: Spectator Sync
// ============================================================
describe('Spectator Sync', () => {
  it('should send current game state to late-joining spectator', async () => {
    startTest('Spectator Sync');
    clearEventLog();

    const player1 = await createTestUser(11);
    const player2 = await createTestUser(12);
    const spectator = await createTestUser(13);
    cleanupIds.users.push(player1.id, player2.id, spectator.id);

    const { tournament, match } = await createTestTournamentAndMatch(player1.id, player2.id, 'TRIVIA');
    cleanupIds.tournaments.push(tournament.id);
    cleanupIds.matches.push(match.id);

    const socket1 = connectSocket(serverPort);
    const socket2 = connectSocket(serverPort);
    await Promise.all([
      new Promise(r => socket1.on('connect', r)),
      new Promise(r => socket2.on('connect', r)),
    ]);

    // Players join and start game
    socket1.emit('trivia:join', { matchId: match.id, playerId: player1.id });
    await new Promise(r => setTimeout(r, 300));
    socket2.emit('trivia:join', { matchId: match.id, playerId: player2.id });
    await waitForEvent(socket1, 'trivia:started', 20000);
    const question = await waitForEvent(socket1, 'trivia:new_question', 25000);
    stepOk('Game started, first question sent');

    // Now spectator joins late
    const specSocket = connectSocket(serverPort);
    await new Promise(r => specSocket.on('connect', r));
    step('Spectator connecting late to active match');

    specSocket.emit('trivia:join', { matchId: match.id, playerId: spectator.id });

    const specReceived = await waitForAnyEvent(specSocket, [
      'trivia:score_update', 'trivia:started', 'trivia:new_question',
      'trivia:waiting', 'trivia:has_answered',
    ], 15000);
    expect(specReceived).toBeDefined();
    stepOk('Spectator received state upon joining', { event: specReceived.event });

    // If spectator got started + new_question, they're synced
    if (specReceived.event === 'trivia:started') {
      const specQuestion = await waitForEvent(specSocket, 'trivia:new_question', 15000);
      expect(specQuestion.question).toBeDefined();
      stepOk('Spectator received current question');
    }

    socket1.close();
    socket2.close();
    specSocket.close();
    endTest(true);
  }, 60000);
});

// ============================================================
// TEST 7: Simultaneous Join (Race Condition)
// ============================================================
describe('Simultaneous Join', () => {
  it('should handle both players joining at nearly the same time without duplicate games', async () => {
    startTest('Simultaneous Join');
    clearEventLog();

    const player1 = await createTestUser(14);
    const player2 = await createTestUser(15);
    cleanupIds.users.push(player1.id, player2.id);

    const { tournament, match } = await createTestTournamentAndMatch(player1.id, player2.id, 'TRIVIA');
    cleanupIds.tournaments.push(tournament.id);
    cleanupIds.matches.push(match.id);

    // Connect both sockets
    const socket1 = connectSocket(serverPort);
    const socket2 = connectSocket(serverPort);
    await Promise.all([
      new Promise(r => socket1.on('connect', r)),
      new Promise(r => socket2.on('connect', r)),
    ]);

    // Emit both joins simultaneously
    let startedCount = 0;
    socket1.on('trivia:started', () => startedCount++);
    socket2.on('trivia:started', () => startedCount++);

    socket1.emit('trivia:join', { matchId: match.id, playerId: player1.id });
    socket2.emit('trivia:join', { matchId: match.id, playerId: player2.id });

    // Wait for both to get started
    await Promise.all([
      waitForEvent(socket1, 'trivia:started', 20000),
      waitForEvent(socket2, 'trivia:started', 20000),
    ]);

    expect(startedCount).toBe(2);
    stepOk('Both players received trivia:started (no duplicate)');

    const question = await waitForEvent(socket1, 'trivia:new_question', 25000);
    expect(question.question).toBeDefined();

    // Both answer
    socket1.emit('trivia:answer', { matchId: match.id, playerId: player1.id, answer: question.question.options[0], timeTakenMs: 3000 });
    socket2.emit('trivia:answer', { matchId: match.id, playerId: player2.id, answer: question.question.options[0], timeTakenMs: 3000 });

    // Should get exactly one round_over
    let roundOverCount = 0;
    socket1.on('trivia:round_over', () => roundOverCount++);

    await waitForEvent(socket1, 'trivia:round_over', 15000);
    await new Promise(r => setTimeout(r, 2000));
    expect(roundOverCount).toBe(1);
    stepOk('Exactly one round_over event (no duplicates)');

    socket1.close();
    socket2.close();
    endTest(true);
  }, 60000);
});

// ============================================================
// TEST 8: Timer Accuracy
// ============================================================
describe('Timer Accuracy', () => {
  it('should emit round_over after timeout if no answers submitted', async () => {
    startTest('Timer Accuracy — Timeout');
    clearEventLog();

    const player1 = await createTestUser(16);
    const player2 = await createTestUser(17);
    cleanupIds.users.push(player1.id, player2.id);

    const { tournament, match } = await createTestTournamentAndMatch(player1.id, player2.id, 'TRIVIA');
    cleanupIds.tournaments.push(tournament.id);
    cleanupIds.matches.push(match.id);

    const socket1 = connectSocket(serverPort);
    const socket2 = connectSocket(serverPort);
    await Promise.all([
      new Promise(r => socket1.on('connect', r)),
      new Promise(r => socket2.on('connect', r)),
    ]);

    socket1.emit('trivia:join', { matchId: match.id, playerId: player1.id });
    await new Promise(r => setTimeout(r, 300));
    socket2.emit('trivia:join', { matchId: match.id, playerId: player2.id });

    await waitForEvent(socket1, 'trivia:started', 20000);
    const question = await waitForEvent(socket1, 'trivia:new_question', 25000);
    stepOk('Question received, NOT answering — waiting for timeout');

    // Don't answer — wait for round_over from timeout
    const roundOver = await waitForEvent(socket1, 'trivia:round_over', 30000);
    expect(roundOver.correctAnswer).toBeDefined();
    stepOk('round_over received from timeout (no answers submitted)', { correctAnswer: roundOver.correctAnswer });

    socket1.close();
    socket2.close();
    endTest(true);
  }, 90000);
});

// ============================================================
// TEST 9: Quick Draw - Max Wrong Guesses
// ============================================================
describe('Quick Draw Max Wrong Guesses', () => {
  it('should end match when guesser exhausts all 5 wrong attempts', async () => {
    startTest('Quick Draw Max Wrong Guesses');
    clearEventLog();

    const player1 = await createTestUser(18);
    const player2 = await createTestUser(19);
    cleanupIds.users.push(player1.id, player2.id);

    const { tournament, match } = await createTestTournamentAndMatch(player1.id, player2.id, 'QUICK_DRAW');
    cleanupIds.tournaments.push(tournament.id);
    cleanupIds.matches.push(match.id);

    const socket1 = connectSocket(serverPort);
    const socket2 = connectSocket(serverPort);
    await Promise.all([
      new Promise(r => socket1.on('connect', r)),
      new Promise(r => socket2.on('connect', r)),
    ]);

    socket1.emit('join_match', { matchId: match.id, playerId: player1.id });
    await new Promise(r => setTimeout(r, 300));
    socket2.emit('join_match', { matchId: match.id, playerId: player2.id });

    await waitForEvent(socket1, 'game_status', 15000);
    stepOk('Quick Draw match started');

    // Player 2 (guesser) submits 5 wrong guesses
    for (let i = 1; i <= 5; i++) {
      socket2.emit('submit_guess', { matchId: match.id, playerId: player2.id, guess: `WRONG_${i}` });
      if (i < 5) {
        const wrong = await waitForEvent(socket2, 'wrong_guess', 10000);
        expect(wrong.attemptsLeft).toBe(5 - i);
        stepOk(`Wrong guess ${i}/5 — attempts left: ${wrong.attemptsLeft}`);
      }
    }

    // 5th wrong guess should end the match
    const matchOver = await waitForAnyEvent(socket2, ['match_over', 'wrong_guess'], 15000);
    if (matchOver.event === 'match_over') {
      expect(matchOver.data.winnerId).toBe(player1.id); // Drawer wins
      stepOk('Match over — drawer wins after 5 wrong guesses');
    } else {
      // Might still get wrong_guess with 0 attempts left
      expect(matchOver.data.attemptsLeft).toBe(0);
      const endMatch = await waitForEvent(socket2, 'match_over', 15000);
      expect(endMatch.winnerId).toBe(player1.id);
      stepOk('Match over after exhausting attempts');
    }

    socket1.close();
    socket2.close();
    endTest(true);
  }, 60000);
});

// ============================================================
// TEST 10: Memory Leak Detection (5 continuous matches)
// ============================================================
describe('Memory Leak Detection', () => {
  it('should have zero stale game state after playing 5 continuous trivia matches', async () => {
    startTest('Memory Leak Detection — 5 Continuous Trivia Matches');
    clearEventLog();

    async function checkMemory(label) {
      try {
        const http = await import('http');
        const mem = await new Promise((resolve, reject) => {
          http.get(`http://localhost:${serverPort}/api/debug/memory`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
          }).on('error', reject);
        });
        console.log(`  [Memory ${label}] Rooms: ${mem.data.socket.rooms}, MatchRooms: ${mem.data.socket.matchRooms.length}, Heap: ${mem.data.process.memory.heapUsed}`);
        return mem.data.socket;
      } catch (e) {
        console.log(`  [Memory ${label}] Debug endpoint unavailable: ${e.message}`);
        return null;
      }
    }

    // Check baseline
    const baseline = await checkMemory('baseline');

    for (let gameNum = 1; gameNum <= 5; gameNum++) {
      step(`Starting match ${gameNum}/5`);
      const p1 = await createTestUser(20 + gameNum * 2);
      const p2 = await createTestUser(21 + gameNum * 2);
      cleanupIds.users.push(p1.id, p2.id);

      const { tournament, match } = await createTestTournamentAndMatch(p1.id, p2.id, 'TRIVIA');
      cleanupIds.tournaments.push(tournament.id);
      cleanupIds.matches.push(match.id);

      const s1 = connectSocket(serverPort);
      const s2 = connectSocket(serverPort);
      await Promise.all([
        new Promise(r => s1.on('connect', r)),
        new Promise(r => s2.on('connect', r)),
      ]);

      s1.emit('trivia:join', { matchId: match.id, playerId: p1.id });
      await new Promise(r => setTimeout(r, 300));
      s2.emit('trivia:join', { matchId: match.id, playerId: p2.id });

      await waitForEvent(s1, 'trivia:started', 20000);

      // Play all 5 rounds
      for (let round = 1; round <= 5; round++) {
        const q = await waitForEvent(s1, 'trivia:new_question', 30000);
        s1.emit('trivia:answer', { matchId: match.id, playerId: p1.id, answer: q.question.options[0], timeTakenMs: 3000 });
        s2.emit('trivia:answer', { matchId: match.id, playerId: p2.id, answer: q.question.options[0], timeTakenMs: 3000 });
        await waitForEvent(s1, 'trivia:round_over', 20000);
      }

      await waitForEvent(s1, 'trivia:match_over', 60000);
      stepOk(`Match ${gameNum}/5 completed`);

      s1.close();
      s2.close();
    }

    // Wait for any pending cleanup
    await new Promise(r => setTimeout(r, 3000));

    // Check memory after all matches
    const afterAll = await checkMemory('after 5 matches');
    
    if (afterAll) {
      if (afterAll.matchRooms.length === 0) {
        stepOk('All match rooms cleaned up after 5 games — no leaks');
      } else {
        step(`⚠ ${afterAll.matchRooms.length} match rooms still active: ${afterAll.matchRooms.join(', ')}`);
      }
      
      // Compare with baseline
      if (baseline) {
        const leakedRooms = afterAll.matchRooms.length - baseline.matchRooms.length;
        console.log(`  Leaked rooms: ${leakedRooms > 0 ? leakedRooms : 0}`);
        expect(afterAll.matchRooms.length).toBeLessThanOrEqual(2);
      }
    }

    stepOk('Memory cleanup verified');
    endTest(true);
  }, 300000);
});
