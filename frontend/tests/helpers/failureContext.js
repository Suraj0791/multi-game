import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = path.resolve(__dirname, '../../test-artifacts');

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

export async function captureFailureContext(page, testName, extraData = {}) {
  const safeName = testName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const timestamp = Date.now();
  const dir = path.join(ARTIFACTS_DIR, `${safeName}_${timestamp}`);
  fs.mkdirSync(dir, { recursive: true });

  const artifacts = {};

  try {
    artifacts.screenshot = await page.screenshot({ path: path.join(dir, 'failure.png'), fullPage: true });
    console.log(`  📸 Screenshot saved`);
  } catch (e) {
    console.log(`  ⚠ Screenshot failed: ${e.message}`);
  }

  try {
    const consoleLogs = await page.evaluate(() => window.__consoleLogs || []);
    if (consoleLogs.length > 0) {
      fs.writeFileSync(path.join(dir, 'console.txt'), consoleLogs.join('\n'));
      artifacts.consoleLogs = consoleLogs;
      console.log(`  📝 Console logs saved (${consoleLogs.length} lines)`);
    }
  } catch (e) {
    console.log(`  ⚠ Console log capture failed: ${e.message}`);
  }

  try {
    const socketEvents = await page.evaluate(() => window.__socketEvents || []);
    if (socketEvents.length > 0) {
      fs.writeFileSync(path.join(dir, 'socket-events.json'), JSON.stringify(socketEvents, null, 2));
      artifacts.socketEvents = socketEvents;
      console.log(`  📝 Socket events saved (${socketEvents.length} events)`);
    }
  } catch (e) {
    console.log(`  ⚠ Socket event capture failed: ${e.message}`);
  }

  try {
    const url = page.url();
    fs.writeFileSync(path.join(dir, 'url.txt'), url);
    console.log(`  📝 URL: ${url}`);
  } catch (e) {
    console.log(`  ⚠ URL capture failed`);
  }

  const summary = [
    `# Failure Context: ${testName}`,
    `**Time:** ${new Date(timestamp).toISOString()}`,
    '',
    `**Error:** ${extraData.error || 'Unknown'}`,
    '',
    artifacts.socketEvents ? `**Socket Events:** ${artifacts.socketEvents.length}` : '**Socket Events:** none captured',
    artifacts.consoleLogs ? `**Console Logs:** ${artifacts.consoleLogs.length} lines` : '**Console Logs:** none captured',
    extraData.currentState ? `**State:** ${JSON.stringify(extraData.currentState).slice(0, 500)}` : '',
    '',
    '## Last 20 Socket Events',
    ...(artifacts.socketEvents || []).slice(-20).map(e => {
      const ts = new Date(e.timestamp).toISOString().slice(11, 23);
      return `- [${ts}] ${e.direction} ${e.event} ${JSON.stringify(e.payload).slice(0, 100)}`;
    }),
    '',
    '## Console Errors',
    ...(artifacts.consoleLogs || []).filter(l => l.includes('ERROR') || l.includes('error') || l.includes('Error')).slice(-20),
  ].join('\n');

  fs.writeFileSync(path.join(dir, 'summary.md'), summary);
  console.log(`  📝 Failure summary saved to: ${path.join(dir, 'summary.md')}`);

  return dir;
}

export function setupConsoleCapture(page) {
  return page.evaluate(() => {
    if (window.__consoleLogs) return;
    window.__consoleLogs = [];
    const methods = ['log', 'warn', 'error', 'info', 'debug'];
    methods.forEach(method => {
      const orig = console[method];
      console[method] = function(...args) {
        window.__consoleLogs.push(`[${new Date().toISOString().slice(11, 23)}] [${method.toUpperCase()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`);
        if (window.__consoleLogs.length > 500) window.__consoleLogs.shift();
        return orig.apply(console, args);
      };
    });
  });
}

export async function dumpState(page) {
  try {
    const state = await page.evaluate(() => {
      const matchEl = document.querySelector('[data-testid="match-state"]');
      const scoreEls = document.querySelectorAll('[data-testid="score"]');
      const timerEl = document.querySelector('[data-testid="timer"]');
      const questionEl = document.querySelector('[data-testid="question"]');
      return {
        matchState: matchEl?.textContent || null,
        scores: Array.from(scoreEls).map(el => el.textContent),
        timer: timerEl?.textContent || null,
        question: questionEl?.textContent?.slice(0, 100) || null,
        url: window.location.href,
        title: document.title,
      };
    });
    console.log(`\n  ── Page State Dump ──`);
    console.log(`  URL:    ${state.url}`);
    console.log(`  Title:  ${state.title}`);
    console.log(`  Match:  ${state.matchState}`);
    console.log(`  Scores: ${state.scores.join(' | ')}`);
    console.log(`  Timer:  ${state.timer}`);
    console.log(`  Question: ${state.question}`);
    console.log(`  ─────────────────────\n`);
    return state;
  } catch (e) {
    console.log(`  ⚠ State dump failed: ${e.message}`);
    return null;
  }
}
