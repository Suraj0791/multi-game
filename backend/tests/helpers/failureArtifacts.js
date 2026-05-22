import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = path.resolve(__dirname, '../../test-artifacts');

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

export function saveFailureArtifact(testName, data) {
  const safeName = testName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const timestamp = Date.now();
  const dir = path.join(ARTIFACTS_DIR, `${safeName}_${timestamp}`);
  fs.mkdirSync(dir, { recursive: true });

  if (data.eventLog) {
    const logPath = path.join(dir, 'socket-events.json');
    fs.writeFileSync(logPath, JSON.stringify(data.eventLog, null, 2));
    console.log(`  📝 Socket events saved to: ${logPath}`);
  }

  if (data.stateSnapshot) {
    const statePath = path.join(dir, 'state.json');
    fs.writeFileSync(statePath, JSON.stringify(data.stateSnapshot, null, 2));
    console.log(`  📝 State snapshot saved to: ${statePath}`);
  }

  if (data.error) {
    const errPath = path.join(dir, 'error.txt');
    const errText = typeof data.error === 'string' ? data.error : `${data.error.message || data.error}\n${data.error.stack || ''}`;
    fs.writeFileSync(errPath, errText);
    console.log(`  📝 Error saved to: ${errPath}`);
  }

  if (data.logs) {
    const logPath = path.join(dir, 'logs.txt');
    fs.writeFileSync(logPath, data.logs.join('\n'));
    console.log(`  📝 Logs saved to: ${logPath}`);
  }

  const summaryPath = path.join(dir, 'summary.md');
  const summary = [
    `# Failure Artifact: ${testName}`,
    `**Time:** ${new Date(timestamp).toISOString()}`,
    '',
    data.error ? `**Error:** ${data.error.message || data.error}` : '**Error:** Unknown',
    '',
    data.eventLog ? `**Socket Events Captured:** ${data.eventLog.length}` : '',
    data.stateSnapshot ? '**State Snapshot:** Yes' : '',
    '',
    '## Event Sequence',
    ...(data.eventLog || []).map(e => {
      const ts = new Date(e.timestamp).toISOString().slice(11, 23);
      return `- [${ts}] ${e.direction} ${e.event} ${JSON.stringify(e.payload).slice(0, 150)}`;
    }),
  ].join('\n');
  fs.writeFileSync(summaryPath, summary);
  console.log(`  📝 Summary saved to: ${summaryPath}`);

  return dir;
}

export function createDebugEndpoint(io) {
  io?.engine?.on('initial_headers', (headers) => {
    headers['Access-Control-Allow-Origin'] = '*';
  });
}

export function getActiveGamesSummary(activeGames, activeTriviaGames) {
  return {
    quickDraw: Object.keys(activeGames || {}).length,
    trivia: Object.keys(activeTriviaGames || {}).length,
    total: Object.keys(activeGames || {}).length + Object.keys(activeTriviaGames || {}).length,
    quickDrawDetails: Object.entries(activeGames || {}).map(([id, g]) => ({
      matchId: id,
      started: !!g.hasStarted,
      playersJoined: g.joinedPlayerIds?.size || 0,
      timer: g.timeRemaining,
      hasTimerInterval: !!g.timerInterval,
      hasBotDraw: !!g.botDrawInterval,
      hasBotGuess: !!g.botGuessTimeout,
    })),
    triviaDetails: Object.entries(activeTriviaGames || {}).map(([id, g]) => ({
      matchId: id,
      started: !!g.hasStarted,
      playersJoined: g.joinedPlayerIds?.size || 0,
      questionIdx: g.currentQuestionIndex,
      roundEnded: g.roundEnded,
      hasTimeout: !!g.timeoutId,
      hasBotTimeout: !!g.botTimeoutId,
    })),
  };
}
