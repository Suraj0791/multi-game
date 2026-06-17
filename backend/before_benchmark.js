/**
 * BEFORE/AFTER BENCHMARK — Slow Endpoint Edition
 * 
 * Purpose: Measure UNCACHED endpoints BEFORE we optimize them.
 * After adding indexes + caching, run this again to get the AFTER numbers.
 * The delta = your resume bullet.
 *
 * Run: node before_benchmark.js
 */

import http from 'http';
import { exec } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const BASE_URL = 'http://localhost:3000';

// ─────────────────────────────────────────────
// HELPER: single HTTP GET, returns ms + status
// ─────────────────────────────────────────────
function httpGet(path) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ ms: Date.now() - start, status: res.statusCode, data }));
    });
    req.on('error', () => resolve({ ms: Date.now() - start, status: 0, data: '' }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ ms: 15000, status: 0, data: '' }); });
  });
}

// ─────────────────────────────────────────────
// HELPER: run same endpoint N times, get stats
// ─────────────────────────────────────────────
async function measureEndpoint(label, path, runs = 5) {
  console.log(`\n  Testing: ${label} (${runs} runs)...`);
  const results = [];

  for (let i = 0; i < runs; i++) {
    const r = await httpGet(path);
    results.push(r.ms);
    process.stdout.write(`    Run ${i+1}: ${r.ms}ms (HTTP ${r.status})\n`);
    await sleep(200); // small gap between runs
  }

  const avg = Math.round(results.reduce((a,b) => a+b, 0) / results.length);
  const min = Math.min(...results);
  const max = Math.max(...results);
  const sorted = [...results].sort((a,b) => a-b);
  const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1];

  console.log(`  ─── RESULT: avg=${avg}ms  min=${min}ms  max=${max}ms  p95=${p95}ms`);
  return { avg, min, max, p95, label, path };
}

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────
function startServer() {
  return new Promise((resolve) => {
    const server = exec('node server.js', { cwd: process.cwd() });
    let ready = false;
    const tryResolve = () => { if (!ready) { ready = true; resolve(server); } };
    server.stdout.on('data', d => { if (d.includes('3000') || d.includes('listening')) tryResolve(); });
    server.stderr.on('data', d => { if (d.includes('3000') || d.includes('listening')) tryResolve(); });
    setTimeout(tryResolve, 5000);
  });
}

// ─────────────────────────────────────────────
// DISCOVER REAL IDs FROM THE DATABASE
// ─────────────────────────────────────────────
async function discoverIds() {
  // Hit the tournaments list to find a real tournament ID
  const r = await httpGet('/tournaments');
  try {
    const data = JSON.parse(r.data);
    const tournaments = Array.isArray(data) ? data : (data.data || data.tournaments || []);
    if (tournaments.length > 0) {
      const t = tournaments[0];
      const id = t.id || t.tournamentId;
      console.log(`  Found tournament ID: ${id} — "${t.name || 'unnamed'}"`);
      return { tournamentId: id };
    }
  } catch(e) {}
  console.log('  ⚠️  No tournaments found in DB. Bracket/match tests will be skipped.');
  return { tournamentId: null };
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  console.log('═'.repeat(60));
  console.log('  🔍 BEFORE BENCHMARK — Uncached Endpoints');
  console.log('  Run this BEFORE adding indexes/caching.');
  console.log('  Run again AFTER to measure improvement.');
  console.log('═'.repeat(60));

  const server = await startServer();
  console.log('\n✅ Server started. Warming up Neon (5 seconds)...');
  await sleep(5000);

  // One warmup hit to wake Neon — don't count this
  await httpGet('/health');
  await httpGet('/leaderboard');
  await sleep(2000);

  console.log('\n📊 MEASURING UNCACHED ENDPOINTS (Neon is now warm)');
  console.log('─'.repeat(60));

  const allResults = [];

  // ── Test 1: Leaderboard (most important — full table sort, no index, no cache)
  const r1 = await measureEndpoint(
    'GET /leaderboard (full table scan, ORDER BY elo_rating, no cache)',
    '/leaderboard'
  );
  allResults.push(r1);

  // ── Test 2: Tournaments list (has cache — should be fast, sanity check)
  const r2 = await measureEndpoint(
    'GET /tournaments (has cache — sanity check, should be ~1ms)',
    '/tournaments'
  );
  allResults.push(r2);

  // ── Test 3: Discover a real tournament ID then hit bracket/matches
  console.log('\n  Discovering real tournament IDs from database...');
  const { tournamentId } = await discoverIds();

  if (tournamentId) {
    const r3 = await measureEndpoint(
      `GET /tournaments/${tournamentId}/bracket (triple JOIN, no cache)`,
      `/tournaments/${tournamentId}/bracket`
    );
    allResults.push(r3);

    const r4 = await measureEndpoint(
      `GET /tournaments/${tournamentId} (single tournament, no cache)`,
      `/tournaments/${tournamentId}`
    );
    allResults.push(r4);

    const r5 = await measureEndpoint(
      `GET /tournaments/${tournamentId}/matches (triple JOIN, no cache)`,
      `/tournaments/${tournamentId}/matches`
    );
    allResults.push(r5);
  }

  // ─────────────────────────────────────────────
  // FINAL REPORT
  // ─────────────────────────────────────────────
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  📋 BEFORE NUMBERS — SAVE THESE');
  console.log('═'.repeat(60));

  let hasProblems = false;
  for (const r of allResults) {
    const flag = r.avg > 100 ? '🔴 SLOW' : r.avg > 30 ? '🟡 OKAY' : '✅ FAST';
    console.log(`\n  ${flag}  ${r.label}`);
    console.log(`         avg: ${r.avg}ms  |  p95: ${r.p95}ms  |  max: ${r.max}ms`);
    if (r.avg > 100) hasProblems = true;
  }

  console.log('\n');
  console.log('═'.repeat(60));
  if (hasProblems) {
    console.log('  🔴 SLOW ENDPOINTS FOUND — optimization needed!');
    console.log('  Next steps:');
    console.log('  1. Note these BEFORE numbers carefully');
    console.log('  2. Add database indexes');
    console.log('  3. Add caching to slow endpoints');
    console.log('  4. Run this benchmark again to get AFTER numbers');
    console.log('  5. Calculate improvement % → write resume bullet');
  } else {
    console.log('  ✅ All endpoints are fast — good baseline!');
  }
  console.log('═'.repeat(60));

  server.kill();
  process.exit(0);
}

main();
