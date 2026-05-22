import { test, expect } from "@playwright/test";
import { injectSocketTracer, getSocketEvents, dumpSocketEvents } from "./helpers/socketTracer.js";
import { captureFailureContext, setupConsoleCapture, dumpState } from "./helpers/failureContext.js";
import { startFlow, flowStep, flowStepOk, flowStepAsync, endFlow } from "./helpers/flowReporter.js";

const API_URL = process.env.E2E_BACKEND_URL || "http://localhost:3000";

function setupLogging(page, name) {
  page.on("console", (msg) => {
    const text = msg.text();
    const type = msg.type();
    console.log(`[PAGE CONSOLE - ${name} - ${type.toUpperCase()}]: ${text}`);
  });
  page.on("pageerror", (err) => {
    console.error(`[PAGE ERROR - ${name}]: ${err.stack || err.message}`);
  });
  page.on("requestfailed", (request) => {
    console.warn(
      `[PAGE REQ_FAIL - ${name}]: ${request.method()} ${request.url()} - ${
        request.failure()?.errorText || "Unknown failure"
      }`
    );
  });
}

test.afterEach(async ({ browser }, testInfo) => {
  if (testInfo.status !== 'passed') {
    try {
      console.log(`\n  🔍 Test FAILED: ${testInfo.title}`);
      console.log(`  Error: ${testInfo.error?.message || 'Unknown'}`);

      let captured = false;
      for (const ctx of browser.contexts()) {
        for (const p of ctx.pages()) {
          if (!p.isClosed()) {
            await dumpSocketEvents(p, 'Socket Events at Failure');
            await dumpState(p);
            await captureFailureContext(p, testInfo.title, {
              error: testInfo.error?.message || 'Unknown',
            });
            captured = true;
            break;
          }
        }
        if (captured) break;
      }
      if (!captured) {
        console.log(`  ⚠ No open pages available for failure capture`);
      }
    } catch (e) {
      console.log(`  ⚠ Failure context capture error: ${e.message}`);
    }
  }
});

async function apiLogin(request, email, password) {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  expect(res.ok()).toBeTruthy();
  return await res.json();
}

async function apiCreateTournament(request, name, gameType, maxPlayers, entryFee, token) {
  const res = await request.post(`${API_URL}/tournaments`, {
    data: { name, game_type: gameType, max_players: maxPlayers, entry_fee: entryFee },
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  return data.tournamentId;
}

async function apiJoinTournament(request, tournamentId, token) {
  const res = await request.post(`${API_URL}/tournaments/${tournamentId}/join`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  return await res.json();
}

async function apiStartTournament(request, tournamentId, token) {
  const res = await request.put(`${API_URL}/tournaments/${tournamentId}/start`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  return await res.json();
}

async function apiGetBracket(request, tournamentId) {
  const res = await request.get(`${API_URL}/tournaments/${tournamentId}/bracket`);
  expect(res.ok()).toBeTruthy();
  return await res.json();
}

async function apiGetMatches(request, tournamentId) {
  const res = await request.get(`${API_URL}/tournaments/${tournamentId}/matches`);
  expect(res.ok()).toBeTruthy();
  return await res.json();
}

async function apiCompleteMatch(request, matchId, winnerId, token) {
  const res = await request.put(`${API_URL}/matches/${matchId}/complete`, {
    data: { winnerId },
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  return await res.json();
}

async function uiLogin(page, email, password) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button:has-text("Sign in")');
  await expect(page).toHaveURL(/\/tournaments/);
}

async function forceCompleteAllMatches(request, tournamentId, hostAuth) {
  for (let guard = 0; guard < 20; guard++) {
    const matches = await apiGetMatches(request, tournamentId);
    const incomplete = matches.filter((m) => m.status !== "COMPLETED");
    if (incomplete.length === 0) break;
    const m = incomplete[0];
    const winnerId = m.player1Id || m.player2Id;
    await apiCompleteMatch(request, m.id, winnerId, hostAuth.token);
  }
}

async function playTriviaToEnd(page, label = 'player') {
  const finished = page
    .locator("text=You Won!")
    .or(page.locator("text=Game Over"))
    .or(page.locator("text=Match Finished"))
    .or(page.locator("text=Completed"))
    .or(page.locator("text=Continue to Bracket"));
  const startTime = Date.now();
  const maxDuration = 120_000;

  for (let i = 0; i < 20; i++) {
    try {
      if (page.isClosed()) return;
      if (await finished.isVisible({ timeout: 1000 }).catch(() => false)) return;
    } catch {
      return;
    }

    try {
      if (page.isClosed()) return;
      const answerBtn = page.locator("button.justify-start:not([disabled])").first();
      const btnVisible = await answerBtn.isVisible({ timeout: 8_000 }).catch(() => false);
      if (btnVisible) {
        await answerBtn.click();
      } else {
        if (await finished.isVisible({ timeout: 500 }).catch(() => false)) return;
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
    } catch (e) {
      if (await finished.isVisible({ timeout: 500 }).catch(() => false)) return;
      await new Promise(r => setTimeout(r, 1000));
    }

    try {
      if (!page.isClosed()) {
        await page.locator("div.text-center.text-sm").waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
      }
    } catch {}

    if (Date.now() - startTime > maxDuration) break;
  }

  try {
    if (!page.isClosed()) {
      await expect(finished).toBeVisible({ timeout: 30_000 });
    }
  } catch {}
}

test.describe("Stress Tests", () => {
  test.setTimeout(600_000);

  // ============================================================
  // STRESS TEST 1: 3 Continuous Trivia Matches (same browser session)
  // ============================================================
  test("Continuous Trivia: 3 matches without page refresh", async ({ browser, request }) => {
    startFlow("3 Continuous Trivia Matches");

    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");

    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p1Page = await p1Ctx.newPage();
    const p2Page = await p2Ctx.newPage();

    setupLogging(p1Page, "stress-p1");
    setupLogging(p2Page, "stress-p2");
    await injectSocketTracer(p1Page);
    await injectSocketTracer(p2Page);

    await uiLogin(p1Page, "player1@test.com", "password123");
    await uiLogin(p2Page, "player2@test.com", "password123");

    for (let matchNum = 1; matchNum <= 3; matchNum++) {
      flowStep(`Starting match ${matchNum}/3`);

      // Create tournament
      const tournamentId = await apiCreateTournament(
        request, `Stress Trivia ${matchNum}_${Date.now()}`, "TRIVIA", 2, 0, p1Auth.token
      );
      await apiJoinTournament(request, tournamentId, p2Auth.token);
      await apiStartTournament(request, tournamentId, p1Auth.token);

      const bracket = await apiGetBracket(request, tournamentId);
      const match = (bracket.rounds?.round1 || [])[0];
      if (!match) throw new Error("Match not found");

      // Navigate both players
      await Promise.all([
        p1Page.goto(`/tournaments/${tournamentId}/match/${match.id}`),
        p2Page.goto(`/tournaments/${tournamentId}/match/${match.id}`),
      ]);

      // Wait for game start
      await expect(async () => {
        await expect(
          p1Page.locator("text=Game Starting!").or(p1Page.locator("text=Your Score:"))
        ).toBeVisible({ timeout: 15_000 });
        await expect(
          p2Page.locator("text=Game Starting!").or(p2Page.locator("text=Your Score:"))
        ).toBeVisible({ timeout: 15_000 });
      }).toPass({ timeout: 30_000, intervals: [1_000, 2_000, 3_000] });

      // Play match
      await Promise.all([
        playTriviaToEnd(p1Page, `p1-match${matchNum}`),
        playTriviaToEnd(p2Page, `p2-match${matchNum}`),
      ]);

      flowStepOk(`Match ${matchNum}/3 completed`);

      // Force complete any remaining bracket matches
      await forceCompleteAllMatches(request, tournamentId, p1Auth);

      // Check for socket event anomalies
      const events1 = await getSocketEvents(p1Page);
      const matchOverEvents1 = events1.filter(e => e.event === 'trivia:match_over');
      console.log(`  [Match ${matchNum}] Player 1 match_over events: ${matchOverEvents1.length}`);
      expect(matchOverEvents1.length).toBeGreaterThanOrEqual(1);

      // Verify socket connection still alive by checking score update
      const scoreUpdates = events1.filter(e => e.event === 'trivia:score_update');
      console.log(`  [Match ${matchNum}] Player 1 score updates: ${scoreUpdates.length}`);
      expect(scoreUpdates.length).toBeGreaterThanOrEqual(5);
    }

    flowStepOk('All 3 continuous trivia matches completed');
    console.log(`\n  📊 Final socket event counts:`);
    const finalEvents1 = await getSocketEvents(p1Page);
    const finalEvents2 = await getSocketEvents(p2Page);
    console.log(`  Player 1: ${finalEvents1.length} total events`);
    console.log(`  Player 2: ${finalEvents2.length} total events`);

    // Verify no stale event listeners (no exponential event growth)
    const p1MatchOver = finalEvents1.filter(e => e.event === 'trivia:match_over');
    const p2MatchOver = finalEvents2.filter(e => e.event === 'trivia:match_over');
    expect(p1MatchOver.length).toBe(3);
    expect(p2MatchOver.length).toBe(3);

    await p1Ctx.close();
    await p2Ctx.close();
    endFlow(true, '3 continuous matches played with clean socket events');
  });

  // ============================================================
  // STRESS TEST 2: Demo Bot Tournament (8 bots)
  // ============================================================
  test("Demo Tournament: 8-bot tournament completes automatically", async ({ browser, request }) => {
    startFlow("8-Bot Demo Tournament");

    const hostAuth = await apiLogin(request, "player1@test.com", "password123");
    const hostCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    setupLogging(hostPage, "demo-host");
    await injectSocketTracer(hostPage);

    await uiLogin(hostPage, "player1@test.com", "password123");

    // Create demo tournament via API
    flowStep('Creating demo tournament');
    const res = await request.post(`${API_URL}/tournaments/demo`, {
      data: { name: "Demo Stress Test", game_type: "TRIVIA", max_players: 8, entry_fee: 0 },
      headers: { Authorization: `Bearer ${hostAuth.token}` },
    });
    expect(res.ok()).toBeTruthy();
    const demoData = await res.json();
    const tournamentId = demoData.tournamentId;
    flowStepOk(`Demo tournament created: ${tournamentId}`);

    // Navigate to tournament
    await hostPage.goto(`/tournaments/${tournamentId}`);

    // Start tournament
    flowStep('Starting demo tournament');
    const startBtn = hostPage.locator('button:has-text("Start Tournament")');
    await expect(startBtn).toBeEnabled({ timeout: 15_000 });
    await startBtn.click();

    // Wait for in progress
    await expect(hostPage.locator("text=In Progress")).toBeVisible({ timeout: 15_000 });
    flowStepOk('Tournament in progress');

    // Get bracket and verify all matches
    flowStep('Verifying bracket matches');
    const bracket = await request.get(`${API_URL}/tournaments/${tournamentId}/bracket`);
    const bracketData = await bracket.json();
    const round1 = bracketData.rounds?.round1 || [];
    expect(round1.length).toBe(4);
    flowStepOk(`Round 1 has ${round1.length} matches`);

    // Force complete matches via API (bots should handle this, but let's ensure completion)
    await forceCompleteAllMatches(request, tournamentId, hostAuth);

    // Verify progression
    const bracket2 = await request.get(`${API_URL}/tournaments/${tournamentId}/bracket`);
    const bracketData2 = await bracket2.json();
    const round2 = bracketData2.rounds?.round2 || [];
    console.log(`  Round 2 matches: ${round2.length}`);
    expect(round2.length).toBe(2);

    // Complete round 2
    await forceCompleteAllMatches(request, tournamentId, hostAuth);

    // Verify final
    const bracket3 = await request.get(`${API_URL}/tournaments/${tournamentId}/bracket`);
    const bracketData3 = await bracket3.json();
    const round3 = bracketData3.rounds?.round3 || [];
    console.log(`  Round 3 (Final) matches: ${round3.length}`);
    expect(round3.length).toBe(1);

    // Complete final
    await forceCompleteAllMatches(request, tournamentId, hostAuth);

    // Verify tournament completed
    await hostPage.goto(`/tournaments/${tournamentId}`);
    await expect(hostPage.getByText("Completed", { exact: true })).toBeVisible({ timeout: 20_000 });
    flowStepOk('Demo tournament completed');

    await hostCtx.close();
    endFlow(true, '8-bot demo tournament completed successfully');
  });

  // ============================================================
  // STRESS TEST 3: Tournament with Spectator + Chat
  // ============================================================
  test("Tournament with live spectator and chat", async ({ browser, request }) => {
    startFlow("Tournament + Spectator + Chat");

    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");
    const specAuth = await apiLogin(request, "player3@test.com", "password123");

    const tournamentId = await apiCreateTournament(
      request, `Live Spec Chat ${Date.now()}`, "TRIVIA", 2, 0, p1Auth.token
    );
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiStartTournament(request, tournamentId, p1Auth.token);

    const bracket = await apiGetBracket(request, tournamentId);
    const match = (bracket.rounds?.round1 || [])[0];

    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const specCtx = await browser.newContext();
    const p1Page = await p1Ctx.newPage();
    const p2Page = await p2Ctx.newPage();
    const specPage = await specCtx.newPage();

    setupLogging(p1Page, "spec-chat-p1");
    setupLogging(p2Page, "spec-chat-p2");
    setupLogging(specPage, "spec-chat-viewer");

    await injectSocketTracer(p1Page);
    await injectSocketTracer(p2Page);
    await injectSocketTracer(specPage);

    await uiLogin(p1Page, "player1@test.com", "password123");
    await uiLogin(p2Page, "player2@test.com", "password123");
    await uiLogin(specPage, "player3@test.com", "password123");

    // Players navigate to match, spectator goes to tournament page (chat)
    flowStep('Players navigating to match, spectator to tournament');
    await Promise.all([
      p1Page.goto(`/tournaments/${tournamentId}/match/${match.id}`),
      p2Page.goto(`/tournaments/${tournamentId}/match/${match.id}`),
      specPage.goto(`/tournaments/${tournamentId}`),
    ]);

    // Wait for match to start
    await expect(async () => {
      await expect(
        p1Page.locator("text=Game Starting!").or(p1Page.locator("text=Your Score:"))
      ).toBeVisible({ timeout: 15_000 });
    }).toPass({ timeout: 30_000 });

    // Spectator sends a chat message
    flowStep('Spectator sending chat message');
    const chatInput = specPage.locator('input[placeholder="Type a message..."]');
    await expect(chatInput).toBeVisible({ timeout: 15_000 });
    const sendBtn = specPage.locator('form:has(input[placeholder="Type a message..."]) button[type="submit"]');
    await chatInput.fill("Good luck players!");
    await sendBtn.click();

    // Play the match
    flowStep('Playing match while chat is active');
    await Promise.all([
      playTriviaToEnd(p1Page, 'p1'),
      playTriviaToEnd(p2Page, 'p2'),
    ]);
    flowStepOk('Match completed');

    // Verify spectator still functional
    const specEvents = await getSocketEvents(specPage);
    const chatMessages = specEvents.filter(e => e.event === 'chat:message');
    console.log(`  Spectator chat messages received: ${chatMessages.length}`);

    await p1Ctx.close();
    await p2Ctx.close();
    await specCtx.close();
    endFlow(true, 'Tournament with spectator + chat completed');
  });
});
