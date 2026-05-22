export function snapshot(activeGames, activeTriviaGames, label = 'Current State') {
  const games = { ...(activeGames || {}) };
  const triviaGames = { ...(activeTriviaGames || {}) };

  const sanitizedGames = {};
  for (const [matchId, game] of Object.entries(games)) {
    sanitizedGames[matchId] = sanitizeGame(game);
  }

  const sanitizedTrivia = {};
  for (const [matchId, game] of Object.entries(triviaGames)) {
    sanitizedTrivia[matchId] = sanitizeTriviaGame(game);
  }

  console.log(`\n  ── State Snapshot: ${label} ──`);
  console.log(`  Active QuickDraw Games: ${Object.keys(sanitizedGames).length}`);
  console.log(`  Active Trivia Games:    ${Object.keys(sanitizedTrivia).length}`);
  console.log(`  Total active:           ${Object.keys(sanitizedGames).length + Object.keys(sanitizedTrivia).length}`);
  console.log(`\n  QuickDraw Games:`);
  if (Object.keys(sanitizedGames).length === 0) {
    console.log('    (none)');
  } else {
    for (const [id, g] of Object.entries(sanitizedGames)) {
      console.log(`    Match ${id}: ${g.players} | ${g.state} | Timer: ${g.timer}s | Strokes: ${g.strokes}`);
    }
  }
  console.log(`\n  Trivia Games:`);
  if (Object.keys(sanitizedTrivia).length === 0) {
    console.log('    (none)');
  } else {
    for (const [id, g] of Object.entries(sanitizedTrivia)) {
      console.log(`    Match ${id}: ${g.players} | Q${g.questionIdx}/${g.totalQuestions} | ${g.state} | Scores: ${g.scores}`);
    }
  }
  console.log(`  ────────────────────────────\n`);
}

function sanitizeGame(game) {
  if (!game) return '(null)';
  return {
    players: `${Object.keys(game.playerBotMap || {}).length > 0 ? '(bot) ' : ''}${(game.joinedPlayerIds?.size || 0)}/2 joined`,
    state: game.hasStarted ? 'STARTED' : 'WAITING',
    timer: game.timeRemaining ?? '?',
    strokes: game.strokes?.length ?? 0,
    drawerId: game.drawerId,
    wordToDraw: game.wordToDraw,
  };
}

function sanitizeTriviaGame(game) {
  if (!game) return '(null)';
  return {
    players: `${Object.keys(game.playerBotMap || {}).length > 0 ? '(bot) ' : ''}${(game.joinedPlayerIds?.size || 0)}/2 joined`,
    questionIdx: `${(game.currentQuestionIndex ?? 0) + 1}`,
    totalQuestions: game.questions?.length ?? '?',
    state: game.roundEnded ? 'ROUND_OVER' : game.hasStarted ? 'ACTIVE' : 'WAITING',
    scores: game.scores ? `${Object.values(game.scores).join(' vs ')}` : '?',
    hasAnswered: game.hasAnsweredCurrent ? Object.values(game.hasAnsweredCurrent).filter(Boolean).length + '/2' : '?',
  };
}

export function triviaGameDeepDump(game) {
  if (!game) return console.log('  Trivia Game: null');
  console.log(`\n  ── Trivia Game Deep Dump ──`);
  console.log(`  matchId:            ${game.matchId}`);
  console.log(`  player1Id:          ${game.player1Id}`);
  console.log(`  player2Id:          ${game.player2Id}`);
  console.log(`  currentQuestionIdx: ${game.currentQuestionIndex}`);
  console.log(`  totalQuestions:     ${game.questions?.length}`);
  console.log(`  roundEnded:         ${game.roundEnded}`);
  console.log(`  hasStarted:         ${game.hasStarted}`);
  console.log(`  joinedPlayerIds:    ${[...(game.joinedPlayerIds || [])].join(', ')}`);
  console.log(`  hasBot:             ${!!game.playerBotMap}`);
  console.log(`  scores:             ${JSON.stringify(game.scores)}`);
  console.log(`  hasAnsweredCurrent: ${JSON.stringify(game.hasAnsweredCurrent)}`);
  console.log(`  has timeoutId:      ${!!game.timeoutId}`);
  console.log(`  has botTimeoutId:   ${!!game.botTimeoutId}`);
  console.log(`  has waitingTimeoutId: ${!!game.waitingTimeoutId}`);
  console.log(`  questionStartTime:  ${game.questionStartTime ? new Date(game.questionStartTime).toISOString() : 'null'}`);
  if (game.questions && game.questions[game.currentQuestionIndex]) {
    const q = game.questions[game.currentQuestionIndex];
    console.log(`  currentQuestion:    ${q.question?.slice(0, 50)}`);
    console.log(`  correctAnswer:      ${q.correctAnswer}`);
  }
  console.log(`  ────────────────────────────\n`);
}

export function quickDrawGameDeepDump(game) {
  if (!game) return console.log('  QuickDraw Game: null');
  console.log(`\n  ── QuickDraw Game Deep Dump ──`);
  console.log(`  wordToDraw:         ${game.wordToDraw}`);
  console.log(`  drawerId:           ${game.drawerId}`);
  console.log(`  player1Id:          ${game.player1Id}`);
  console.log(`  player2Id:          ${game.player2Id}`);
  console.log(`  hasStarted:         ${game.hasStarted}`);
  console.log(`  joinedPlayerIds:    ${[...(game.joinedPlayerIds || [])].join(', ')}`);
  console.log(`  hasBot:             ${!!game.playerBotMap}`);
  console.log(`  timeRemaining:      ${game.timeRemaining}s`);
  console.log(`  timeLimit:          ${game.timeLimit}s`);
  console.log(`  startTime:          ${game.startTime ? new Date(game.startTime).toISOString() : 'null'}`);
  console.log(`  strokes:            ${game.strokes?.length || 0}`);
  console.log(`  wrongAttempts:      ${JSON.stringify(game.wrongAttempts)}`);
  console.log(`  maxAttempts:        ${game.maxAttempts}`);
  console.log(`  has timerInterval:  ${!!game.timerInterval}`);
  console.log(`  has botDrawInterval: ${!!game.botDrawInterval}`);
  console.log(`  has botGuessTimeout: ${!!game.botGuessTimeout}`);
  console.log(`  has waitingTimeoutId: ${!!game.waitingTimeoutId}`);
  console.log(`  _botGuessStopped:   ${!!game._botGuessStopped}`);
  console.log(`  ────────────────────────────\n`);
}
