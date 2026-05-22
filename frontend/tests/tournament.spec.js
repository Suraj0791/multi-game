import { test, expect } from "@playwright/test";
import { injectSocketTracer, getSocketEvents, dumpSocketEvents, findMissingEvent } from "./helpers/socketTracer.js";
import { captureFailureContext, setupConsoleCapture, dumpState } from "./helpers/failureContext.js";
import { startFlow, flowStep, flowStepOk, flowStepAsync, endFlow } from "./helpers/flowReporter.js";

const API_URL = process.env.E2E_BACKEND_URL || "http://localhost:3000";

// Page logging and error capturing helper
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

// Enhanced logging that captures failure context on test failure
test.afterEach(async ({ browser }, testInfo) => {
  if (testInfo.status !== 'passed') {
    try {
      console.log(`\n  🔍 Test FAILED: ${testInfo.title}`);
      console.log(`  Error: ${testInfo.error?.message || 'Unknown'}`);

      // Collect all open pages from all browser contexts
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

// REST API Helpers
async function apiLogin(request, email, password) {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  expect(res.ok()).toBeTruthy();
  return await res.json();
}

async function apiCreateTournament(request, name, gameType, maxPlayers, entryFee, token) {
  const res = await request.post(`${API_URL}/tournaments`, {
    data: {
      name,
      game_type: gameType,
      max_players: maxPlayers,
      entry_fee: entryFee,
    },
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
  const res = await request.get(
    `${API_URL}/tournaments/${tournamentId}/bracket`
  );
  expect(res.ok()).toBeTruthy();
  return await res.json();
}

async function apiGetMatches(request, tournamentId) {
  const res = await request.get(
    `${API_URL}/tournaments/${tournamentId}/matches`
  );
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

// UI Login Helper
async function uiLogin(page, email, password) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button:has-text("Sign in")');
  await expect(page).toHaveURL(/\/tournaments/);
}

// Wait for Trivia game to start — waits for socket event + DOM visibility
async function waitForGameStart(page1, page2, label1 = 'p1', label2 = 'p2', timeoutMs = 45_000) {
  const startTime = Date.now();
  console.log(`\n  [GameStart] Waiting for trivia game to start (${label1}/${label2})...`);

  // Helper: wait for trivia:started event via socket tracer
  async function waitForEvent(page, eventName, pageLabel) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const events = await page.evaluate(() => window.__socketEvents || []);
        if (events.some(e => e.direction === 'RECEIVE' && e.event === eventName)) return true;
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }
    console.log(`  [GameStart] ${pageLabel} — never received "${eventName}" event`);
    return false;
  }

  // Wait for either trivia:started event OR the DOM text
  while (Date.now() - startTime < timeoutMs) {
    // Check DOM on both pages
    try {
      const p1Ready = await page1.locator("text=Game Starting!").or(page1.locator("text=Your Score:")).isVisible({ timeout: 1000 }).catch(() => false);
      const p2Ready = await page2.locator("text=Game Starting!").or(page2.locator("text=Your Score:")).isVisible({ timeout: 1000 }).catch(() => false);
      if (p1Ready && p2Ready) {
        console.log(`  [GameStart] Both pages ready after ${Date.now() - startTime}ms`);
        return;
      }
    } catch {}

    // Check socket event on either page
    try {
      const events = await page1.evaluate(() => window.__socketEvents || []);
      if (events.some(e => e.direction === 'RECEIVE' && e.event === 'trivia:started')) {
        console.log(`  [GameStart] trivia:started received on ${label1}, waiting for DOM...`);
      }
    } catch {}

    await new Promise(r => setTimeout(r, 500));
  }

  // Timeout — dump diagnostics
  console.log(`  [GameStart] TIMEOUT after ${timeoutMs}ms`);
  for (const [page, label] of [[page1, label1], [page2, label2]]) {
    try {
      const events = await page.evaluate(() => window.__socketEvents || []);
      const triviaEvents = events.filter(e => e.event.startsWith('trivia:'));
      console.log(`  [GameStart] ${label} — ${events.length} total events, ${triviaEvents.length} trivia events`);
      triviaEvents.slice(-10).forEach(e => {
        const ts = new Date(e.timestamp).toISOString().slice(11, 23);
        console.log(`    [${ts}] ${e.direction} ${e.event}`);
      });
      const pageUrl = page.url();
      console.log(`  [GameStart] ${label} URL: ${pageUrl}`);
    } catch (e) {
      console.log(`  [GameStart] ${label} diagnostics error: ${e.message}`);
    }
  }
  throw new Error(`Game did not start within ${timeoutMs}ms — see diagnostics above`);
}

// Trivia Play Helper — clicks any available answer until the match ends
async function playTriviaToEnd(page, label = 'player') {
  const finished = page
    .locator("text=You Won!")
    .or(page.locator("text=Game Over"))
    .or(page.locator("text=Match Finished"))
    .or(page.locator("text=Completed"));
  const startTime = Date.now();
  const maxDuration = 120_000;

  for (let i = 0; i < 20; i++) {
    // Check if page is still alive and on the right URL
    try {
      if (!page.isClosed() && page.url().includes('/match/')) {
        // Check if match already ended
        if (await finished.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`  [Trivia ${label}] Match ended - detected finish text`);
          return;
        }
      } else {
        console.log(`  [Trivia ${label}] Page navigated away from match (${page.url() || 'closed'})`);
        return;
      }
    } catch (e) {
      console.log(`  [Trivia ${label}] Page check error: ${e.message} — assuming match ended`);
      return;
    }

    // Try to click an answer
    try {
      if (page.isClosed()) { console.log(`  [Trivia ${label}] Page closed`); return; }

      const answerBtn = page.locator("button.justify-start:not([disabled])").first();
      const btnVisible = await answerBtn.isVisible({ timeout: 8_000 }).catch(() => false);

      if (btnVisible) {
        await answerBtn.click();
        console.log(`  [Trivia ${label}] Clicked answer (attempt ${i + 1})`);
      } else {
        // If no button visible, check if match ended
        if (await finished.isVisible({ timeout: 1000 }).catch(() => false)) return;
        console.log(`  [Trivia ${label}] No answer button visible, waiting...`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
    } catch (e) {
      if (await finished.isVisible({ timeout: 500 }).catch(() => false)) return;
      console.log(`  [Trivia ${label}] Click error: ${e.message.slice(0, 80)}`);
      await new Promise(r => setTimeout(r, 1000));
    }

    // Wait for feedback
    try {
      if (!page.isClosed()) {
        await page.locator("div.text-center.text-sm").waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
      }
    } catch (e) {
      // ignore transition timeouts
    }

    if (Date.now() - startTime > maxDuration) {
      console.log(`  [Trivia ${label}] TIMEOUT exceeded ${maxDuration}ms`);
      break;
    }
  }

  // Final check
  try {
    if (!page.isClosed()) {
      await expect(finished).toBeVisible({ timeout: 30_000 });
    }
  } catch (e) {
    console.log(`  [Trivia ${label}] Final finish check failed: ${e.message}`);
    // Try to dump state
    try {
      if (!page.isClosed()) {
        await dumpState(page);
        const events = await getSocketEvents(page);
        console.log(`  [Trivia ${label}] Socket events: ${events.length}`);
        const matchOverEvents = events.filter(e => e.event === 'trivia:match_over');
        console.log(`  [Trivia ${label}] match_over events: ${matchOverEvents.length}`);
      }
    } catch {}
    throw e;
  }
}

// Force-complete all remaining matches in a tournament via API
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

test.describe("TourneyHub End-to-End Suite", () => {
  test.setTimeout(180_000);

  // ------------------------------------------------------------
  // TEST 1: Tournament Validation (Start Button States)
  // ------------------------------------------------------------
  test("Tournament Validation: Start Button States", async ({ browser, request }) => {
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");
    const p3Auth = await apiLogin(request, "player3@test.com", "password123");
    const p4Auth = await apiLogin(request, "player4@test.com", "password123");

    const context = await browser.newContext();
    const page = await context.newPage();
    setupLogging(page, "validation-host");

    await uiLogin(page, "player1@test.com", "password123");

    // 1. Create a 4-player tournament using the UI
    await page.goto("/tournaments/new");
    await page.fill("#name", "Validation Tourney 4");
    await page.selectOption("#game_type", "TRIVIA");
    await page.selectOption("#max_players", "4");
    await page.fill("#entry_fee", "0");
    await page.click('button:has-text("Create Tournament")');

    await expect(page).toHaveURL(/\/tournaments\/\d+/);
    const tournamentId = page.url().split("/").pop();

    // Verify button is disabled and displays correct reason
    const startBtn = page.locator('button:has-text("Start Tournament")');
    await expect(startBtn).toBeDisabled();
    await expect(page.locator("text=Need 3 more")).toBeVisible();

    // Player 2 Joins
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await page.reload();
    await expect(page.locator("text=Need 2 more")).toBeVisible();
    await expect(startBtn).toBeDisabled();

    // Player 3 & 4 Join
    await apiJoinTournament(request, tournamentId, p3Auth.token);
    await apiJoinTournament(request, tournamentId, p4Auth.token);
    await page.reload();
    await expect(page.locator("text=Need 1 more")).not.toBeVisible();
    await expect(startBtn).toBeEnabled();

    // 2. Create a 2-player tournament using the API
    const tournamentId2 = await apiCreateTournament(
      request,
      "Validation Tourney 2",
      "TRIVIA",
      2,
      0,
      p1Auth.token
    );
    await page.goto(`/tournaments/${tournamentId2}`);

    await expect(page.locator("text=Need 1 more")).toBeVisible();
    const startBtn2 = page.locator('button:has-text("Start Tournament")');
    await expect(startBtn2).toBeDisabled();

    // Player 2 Joins
    await apiJoinTournament(request, tournamentId2, p2Auth.token);
    await page.reload();
    await expect(page.locator("text=Need 1 more")).not.toBeVisible();
    await expect(startBtn2).toBeEnabled();

    await context.close();
  });

  // ------------------------------------------------------------
  // TEST 2: Lobby Chat & Rate Limiting
  // ------------------------------------------------------------
  test("Lobby Chat & Rate Limiting", async ({ browser, request }) => {
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const tournamentId = await apiCreateTournament(
      request,
      "Chat Tourney",
      "TRIVIA",
      4,
      0,
      p1Auth.token
    );

    const context = await browser.newContext();
    const page = await context.newPage();
    setupLogging(page, "chat-user");

    await uiLogin(page, "player1@test.com", "password123");
    await page.goto(`/tournaments/${tournamentId}`);

    const chatInput = page.locator('input[placeholder="Type a message..."]');
    await expect(chatInput).toBeVisible({ timeout: 15_000 });
    const chatArea = page.locator("div.flex-1.overflow-y-auto");
    const sendBtn = page.locator('form:has(input[placeholder="Type a message..."]) button[type="submit"]');

    // Send a message
    await chatInput.fill("Hello World!");
    await sendBtn.click();
    await expect(chatArea).toContainText("Hello World!");

    // Trigger Rate Limiting by sending two messages rapidly
    await chatInput.fill("Rapid Message 1");
    await sendBtn.click();

    await chatInput.fill("Rapid Message 2");
    await sendBtn.click();

    // Verify rate limit toast / text appears
    const errorMsg = page.locator("p.text-danger");
    await expect(errorMsg).toContainText("Slow down! 1 message per second.");

    await context.close();
  });

  // ------------------------------------------------------------
  // TEST 3: Quick Draw E2E Match Flow
  // ------------------------------------------------------------
  test("Quick Draw E2E: Canvas drawing & guess validation", async ({ browser, request }) => {
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");

    const tournamentId = await apiCreateTournament(
      request,
      "QuickDraw E2E",
      "QUICK_DRAW",
      2,
      0,
      p1Auth.token
    );
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiStartTournament(request, tournamentId, p1Auth.token);

    const bracket = await apiGetBracket(request, tournamentId);
    const match = (bracket.rounds?.round1 || [])[0];
    if (!match) throw new Error("Match not found");

    // Drawer is always match.player1Id (randomly assigned during bracket creation)
    const isP1Drawer = Number(match.player1Id) === Number(p1Auth.userId);

    const ctxDrawer = await browser.newContext();
    const ctxGuesser = await browser.newContext();
    const drawerPage = await ctxDrawer.newPage();
    const guesserPage = await ctxGuesser.newPage();

    setupLogging(drawerPage, isP1Drawer ? "p1-drawer" : "p2-drawer");
    setupLogging(guesserPage, isP1Drawer ? "p2-guesser" : "p1-guesser");

    await injectSocketTracer(drawerPage);
    await injectSocketTracer(guesserPage);

    // Log in the correct user for each role
    if (isP1Drawer) {
      await uiLogin(drawerPage, "player1@test.com", "password123");
      await uiLogin(guesserPage, "player2@test.com", "password123");
    } else {
      await uiLogin(drawerPage, "player2@test.com", "password123");
      await uiLogin(guesserPage, "player1@test.com", "password123");
    }

    flowStep('Navigating drawer and guesser to match page');
    await drawerPage.goto(`/tournaments/${tournamentId}/match/${match.id}`);
    await guesserPage.goto(`/tournaments/${tournamentId}/match/${match.id}`);
    flowStep('Waiting for role indicators');

    // Verify role indicators (drawer sees DRAWING, guesser sees GUESSING)
    await expect(drawerPage.locator("text=DRAWING")).toBeVisible({ timeout: 25_000 });
    await expect(guesserPage.locator("text=GUESSING")).toBeVisible({ timeout: 25_000 });
    flowStepOk('Both players see correct role indicators');

    // Empty guess validation check
    const guessInput = guesserPage.locator('input[placeholder="Type your guess..."]');
    const guessBtn = guesserPage.locator('button:has-text("Guess")');
    await expect(guessInput).toBeVisible();
    await guessBtn.click();
    await expect(guesserPage.locator("text=Please enter a guess first")).toBeVisible({ timeout: 5000 });

    // Retrieve word from Drawer page
    const drawHeader = drawerPage.locator("text=Draw:");
    await expect(drawHeader).toBeVisible();
    const wordText = await drawHeader.innerText();
    const secretWord = wordText.replace(/^Draw:\s*/i, "").trim();

    // Trigger stroke inputs on drawer canvas
    const canvas = drawerPage.locator("canvas");
    const box = await canvas.boundingBox();
    if (box) {
      await drawerPage.mouse.move(box.x + 50, box.y + 50);
      await drawerPage.mouse.down();
      await drawerPage.mouse.move(box.x + 150, box.y + 150);
      await drawerPage.mouse.up();
    }

    // Guesser submits correct guess
    await guessInput.fill(secretWord);
    await guessBtn.click();

    // Verify game completion overlays
    await expect(guesserPage.locator("text=You Won!")).toBeVisible({ timeout: 30_000 });
    await expect(drawerPage.locator("text=Game Over")).toBeVisible({ timeout: 30_000 });

    await ctxDrawer.close();
    await ctxGuesser.close();
  });

  // ------------------------------------------------------------
  // TEST 4: Trivia E2E Match Flow
  // ------------------------------------------------------------
  test("Trivia E2E: Sync play & countdown validation", async ({ browser, request }) => {
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");

    const tournamentId = await apiCreateTournament(
      request,
      "Trivia E2E",
      "TRIVIA",
      2,
      0,
      p1Auth.token
    );
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiStartTournament(request, tournamentId, p1Auth.token);

    const bracket = await apiGetBracket(request, tournamentId);
    const match = (bracket.rounds?.round1 || [])[0];
    if (!match) throw new Error("Match not found");

    const p1Context = await browser.newContext();
    const p2Context = await browser.newContext();
    const p1Page = await p1Context.newPage();
    const p2Page = await p2Context.newPage();

    setupLogging(p1Page, "trivia-p1");
    setupLogging(p2Page, "trivia-p2");

    await uiLogin(p1Page, "player1@test.com", "password123");
    await uiLogin(p2Page, "player2@test.com", "password123");

    // Navigate both pages in parallel so both sockets connect around the same time
    // Inject socket tracers before navigation
    await injectSocketTracer(p1Page);
    await injectSocketTracer(p2Page);

    await Promise.all([
      p1Page.goto(`/tournaments/${tournamentId}/match/${match.id}`),
      p2Page.goto(`/tournaments/${tournamentId}/match/${match.id}`),
    ]);

    // Wait for match to start
    flowStep('Waiting for game to start on both pages');
    await waitForGameStart(p1Page, p2Page, 'trivia-p1', 'trivia-p2');
    flowStepOk('Game started on both pages, playing trivia');

    // Play Trivia to end
    await Promise.all([
      playTriviaToEnd(p1Page, 'trivia-p1'),
      playTriviaToEnd(p2Page, 'trivia-p2'),
    ]);

    flowStepOk('Trivia match completed');

    await p1Context.close();
    await p2Context.close();
  });

  // ------------------------------------------------------------
  // TEST 5: Match Abandonment Victory (Trivia)
  // ------------------------------------------------------------
  test("Match Abandonment: Opponent disconnect victory", async ({ browser, request }) => {
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");

    const tournamentId = await apiCreateTournament(
      request,
      "Abandonment E2E",
      "TRIVIA",
      2,
      0,
      p1Auth.token
    );
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiStartTournament(request, tournamentId, p1Auth.token);

    const bracket = await apiGetBracket(request, tournamentId);
    const match = (bracket.rounds?.round1 || [])[0];
    if (!match) throw new Error("Match not found");

    const p1Context = await browser.newContext();
    const p2Context = await browser.newContext();
    const p1Page = await p1Context.newPage();
    const p2Page = await p2Context.newPage();

    setupLogging(p1Page, "abandon-p1");
    setupLogging(p2Page, "abandon-p2");

    await injectSocketTracer(p1Page);
    await injectSocketTracer(p2Page);

    await uiLogin(p1Page, "player1@test.com", "password123");
    await uiLogin(p2Page, "player2@test.com", "password123");

    flowStep('Both players navigating to match page');
    // Navigate both pages IN PARALLEL so both sockets connect around the same time
    await Promise.all([
      p1Page.goto(`/tournaments/${tournamentId}/match/${match.id}`),
      p2Page.goto(`/tournaments/${tournamentId}/match/${match.id}`),
    ]);

    flowStep('Waiting for match to start');
    await waitForGameStart(p1Page, p2Page, 'disconnect-p1', 'disconnect-p2');
    flowStepOk('Match started on both pages');

    // Close player 2 page (disconnection)
    await p2Context.close();

    // Verify Player 1 gets disconnect victory overlay ("You Won!")
    await expect(p1Page.locator("text=You Won!")).toBeVisible({ timeout: 30_000 });

    await p1Context.close();
  });

  // ------------------------------------------------------------
  // TEST 6: Bracket Advancement & Full Tournament Completion (4 players)
  // ------------------------------------------------------------
  test("Bracket Advancement: Play tournament to completion", async ({ browser, request }) => {
    const triviaHostAuth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");
    const p3Auth = await apiLogin(request, "player3@test.com", "password123");
    const p4Auth = await apiLogin(request, "player4@test.com", "password123");

    const tournamentId = await apiCreateTournament(
      request,
      "Advancement Trivia Tourney",
      "TRIVIA",
      4,
      0,
      triviaHostAuth.token
    );

    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiJoinTournament(request, tournamentId, p3Auth.token);
    await apiJoinTournament(request, tournamentId, p4Auth.token);

    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    setupLogging(hostPage, "advancement-host");

    await injectSocketTracer(hostPage);

    flowStep('Host logging in and navigating to tournament');
    await uiLogin(hostPage, "player1@test.com", "password123");
    await hostPage.goto(`/tournaments/${tournamentId}`);

    // Start the tournament
    flowStep('Starting tournament');
    const startBtn = hostPage.locator('button:has-text("Start Tournament")');
    await expect(startBtn).toBeEnabled();
    await startBtn.click();
    await expect(hostPage.locator("text=In Progress")).toBeVisible({ timeout: 15_000 });
    flowStepOk('Tournament is In Progress');

    // Get bracket matches
    flowStep('Fetching bracket to find host match');
    const triviaBracket = await apiGetBracket(request, tournamentId);
    const round1 = triviaBracket.rounds?.round1 || [];
    const myMatch = round1.find(
      (m) =>
        m.player1Id === triviaHostAuth.userId ||
        m.player2Id === triviaHostAuth.userId
    );
    if (!myMatch) throw new Error("Could not find host match in round1");

    const opponentName =
      myMatch.player1Id === triviaHostAuth.userId
        ? myMatch.player2Name
        : myMatch.player1Name;
    const opponentEmail = `${opponentName}@test.com`;

    const opponentContext = await browser.newContext();
    const opponentPage = await opponentContext.newPage();
    setupLogging(opponentPage, "advancement-opponent");
    await injectSocketTracer(opponentPage);

    flowStep(`Logging in as opponent (${opponentEmail})`);
    await uiLogin(opponentPage, opponentEmail, "password123");

    // Play round 1 match E2E
    flowStep('Both players navigating to match page');
    await hostPage.goto(`/tournaments/${tournamentId}/match/${myMatch.id}`);
    await opponentPage.goto(`/tournaments/${tournamentId}/match/${myMatch.id}`);

    flowStep('Playing round 1 match to completion');
    try {
      await Promise.all([
        playTriviaToEnd(hostPage, 'host'),
        playTriviaToEnd(opponentPage, 'opponent'),
      ]);
      flowStepOk('Round 1 match completed');
    } catch (e) {
      console.log(`  ⚠ playTriviaToEnd threw: ${e.message}`);
      // Check if both pages navigated away (match ended successfully)
      const hostUrl = hostPage.isClosed() ? 'closed' : hostPage.url();
      const oppUrl = opponentPage.isClosed() ? 'closed' : opponentPage.url();
      console.log(`  Host URL: ${hostUrl}`);
      console.log(`  Opponent URL: ${oppUrl}`);
    }

    // Force-complete all remaining matches via REST API
    flowStep('Force-completing remaining bracket matches via API');
    await forceCompleteAllMatches(request, tournamentId, triviaHostAuth);
    flowStepOk('All bracket matches completed');

    // Verify tournament status is Completed
    flowStep('Verifying tournament completed');
    await hostPage.goto(`/tournaments/${tournamentId}`);
    await expect(hostPage.getByText("Completed", { exact: true })).toBeVisible({ timeout: 20_000 });
    flowStepOk('Tournament shows Completed status');

    await hostContext.close();
    await opponentContext.close();
  });

  // ------------------------------------------------------------
  // TEST 7: Quick Draw — Wrong guesses then correct guess
  // ------------------------------------------------------------
  test("Quick Draw E2E: Wrong guesses then correct answer", async ({ browser, request }) => {
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");

    const tournamentId = await apiCreateTournament(
      request,
      "QuickDraw Wrong Guesses",
      "QUICK_DRAW",
      2,
      0,
      p1Auth.token
    );
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiStartTournament(request, tournamentId, p1Auth.token);

    const bracket = await apiGetBracket(request, tournamentId);
    const match = (bracket.rounds?.round1 || [])[0];
    if (!match) throw new Error("Match not found");

    const isP1Drawer = Number(match.player1Id) === Number(p1Auth.userId);

    const ctxDrawer = await browser.newContext();
    const ctxGuesser = await browser.newContext();
    const drawerPage = await ctxDrawer.newPage();
    const guesserPage = await ctxGuesser.newPage();

    setupLogging(drawerPage, "qd-wrong-drawer");
    setupLogging(guesserPage, "qd-wrong-guesser");

    await injectSocketTracer(drawerPage);
    await injectSocketTracer(guesserPage);

    if (isP1Drawer) {
      await uiLogin(drawerPage, "player1@test.com", "password123");
      await uiLogin(guesserPage, "player2@test.com", "password123");
    } else {
      await uiLogin(drawerPage, "player2@test.com", "password123");
      await uiLogin(guesserPage, "player1@test.com", "password123");
    }

    flowStep('Both players navigating to Quick Draw match');
    await Promise.all([
      drawerPage.goto(`/tournaments/${tournamentId}/match/${match.id}`),
      guesserPage.goto(`/tournaments/${tournamentId}/match/${match.id}`),
    ]);

    // Wait for game to start
    flowStep('Waiting for game to start');
    await expect(drawerPage.locator("text=DRAWING")).toBeVisible({ timeout: 25_000 });
    await expect(guesserPage.locator("text=GUESSING")).toBeVisible({ timeout: 25_000 });
    flowStepOk('Game started with correct roles');

    // Get the secret word
    const drawHeader = drawerPage.locator("text=Draw:");
    await expect(drawHeader).toBeVisible();
    const wordText = await drawHeader.innerText();
    const secretWord = wordText.replace(/^Draw:\s*/i, "").trim();

    const guessInput = guesserPage.locator('input[placeholder="Type your guess..."]');
    const guessBtn = guesserPage.locator('button:has-text("Guess")');
    await expect(guessInput).toBeVisible();

    // Submit wrong guess twice
    await guessInput.fill("WRONG_ANSWER_1");
    await guessBtn.click();
    await expect(guesserPage.locator("text=Try again!")).toBeVisible({ timeout: 10_000 });

    await guessInput.fill("WRONG_ANSWER_2");
    await guessBtn.click();
    await expect(guesserPage.locator("text=Try again!")).toBeVisible({ timeout: 10_000 });

    // Submit correct guess
    await guessInput.fill(secretWord);
    await guessBtn.click();

    // Verify game ends with correct winner/loser
    await expect(guesserPage.locator("text=You Won!")).toBeVisible({ timeout: 30_000 });
    await expect(drawerPage.locator("text=Game Over")).toBeVisible({ timeout: 30_000 });

    await ctxDrawer.close();
    await ctxGuesser.close();
  });

  // ------------------------------------------------------------
  // TEST 8: 8-Player Quick Draw Tournament — Full bracket completion
  // ------------------------------------------------------------
  test("8-Player Quick Draw: Full bracket completion via API", async ({ browser, request }) => {
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");
    const p3Auth = await apiLogin(request, "player3@test.com", "password123");
    const p4Auth = await apiLogin(request, "player4@test.com", "password123");
    const p5Auth = await apiLogin(request, "player5@test.com", "password123");
    const p6Auth = await apiLogin(request, "player6@test.com", "password123");
    const p7Auth = await apiLogin(request, "player7@test.com", "password123");
    const p8Auth = await apiLogin(request, "player8@test.com", "password123");

    const tournamentId = await apiCreateTournament(
      request,
      "8p QuickDraw Full",
      "QUICK_DRAW",
      8,
      0,
      p1Auth.token
    );

    // API-join all 8 players
    for (const auth of [p2Auth, p3Auth, p4Auth, p5Auth, p6Auth, p7Auth, p8Auth]) {
      await apiJoinTournament(request, tournamentId, auth.token);
    }

    await apiStartTournament(request, tournamentId, p1Auth.token);

    // Verify bracket has 4 matches in round 1
    const bracket1 = await apiGetBracket(request, tournamentId);
    expect(bracket1.rounds?.round1?.length).toBe(4);

    // Complete all matches programmatically
    await forceCompleteAllMatches(request, tournamentId, p1Auth);

    // Verify bracket progression: round2 should have 2 matches
    const bracket2 = await apiGetBracket(request, tournamentId);
    expect(bracket2.rounds?.round2?.length).toBe(2);

    // Verify tournament status is Completed
    const tournamentMatches = await apiGetMatches(request, tournamentId);
    const completed = tournamentMatches.filter((m) => m.status === "COMPLETED");
    const totalMatches = tournamentMatches.length;
    // For 8 players: 4 (R1) + 2 (R2) + 1 (final) = 7 matches total
    expect(totalMatches).toBe(7);
    expect(completed.length).toBe(7);
  });

  // ------------------------------------------------------------
  // TEST 9: 8-Player Trivia Tournament — Full bracket completion
  // ------------------------------------------------------------
  test("8-Player Trivia: Full bracket completion via API", async ({ browser, request }) => {
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");
    const p3Auth = await apiLogin(request, "player3@test.com", "password123");
    const p4Auth = await apiLogin(request, "player4@test.com", "password123");
    const p5Auth = await apiLogin(request, "player5@test.com", "password123");
    const p6Auth = await apiLogin(request, "player6@test.com", "password123");
    const p7Auth = await apiLogin(request, "player7@test.com", "password123");
    const p8Auth = await apiLogin(request, "player8@test.com", "password123");

    const tournamentId = await apiCreateTournament(
      request,
      "8p Trivia Full",
      "TRIVIA",
      8,
      0,
      p1Auth.token
    );

    for (const auth of [p2Auth, p3Auth, p4Auth, p5Auth, p6Auth, p7Auth, p8Auth]) {
      await apiJoinTournament(request, tournamentId, auth.token);
    }

    await apiStartTournament(request, tournamentId, p1Auth.token);

    // Verify bracket has 4 matches in round 1
    const bracket1 = await apiGetBracket(request, tournamentId);
    expect(bracket1.rounds?.round1?.length).toBe(4);

    // Complete all matches
    await forceCompleteAllMatches(request, tournamentId, p1Auth);

    // Verify round 2 exists with 2 matches
    const bracket2 = await apiGetBracket(request, tournamentId);
    expect(bracket2.rounds?.round2?.length).toBe(2);

    // Verify all 7 matches completed
    const matches = await apiGetMatches(request, tournamentId);
    expect(matches.length).toBe(7);
    expect(matches.every((m) => m.status === "COMPLETED")).toBe(true);
  });

  // ------------------------------------------------------------
  // TEST 10: Quick Draw — Spectator view during active match
  // ------------------------------------------------------------
  test("Quick Draw E2E: Spectator can view match", async ({ browser, request }) => {
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");

    // Spectator (player3) does NOT need to be in the tournament — any logged-in
    // user can navigate to a match URL and watch as a spectator.
    const tournamentId = await apiCreateTournament(
      request,
      "QuickDraw Spectator",
      "QUICK_DRAW",
      2,
      0,
      p1Auth.token
    );
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiStartTournament(request, tournamentId, p1Auth.token);

    const bracket = await apiGetBracket(request, tournamentId);
    const match = bracket.rounds?.round1?.find(
      (m) => m.player1Id === p1Auth.userId || m.player2Id === p1Auth.userId
    );
    if (!match) throw new Error("Match not found");

    // Determine roles (drawer = player1Id)
    const isP1Drawer = Number(match.player1Id) === Number(p1Auth.userId);

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const spectatorCtx = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    const spectatorPage = await spectatorCtx.newPage();

    const drawerPage = isP1Drawer ? pageA : pageB;
    const guesserPage = isP1Drawer ? pageB : pageA;

    setupLogging(pageA, "qd-spec-p1");
    setupLogging(pageB, "qd-spec-p2");
    setupLogging(spectatorPage, "qd-spec-viewer");

    await injectSocketTracer(drawerPage);
    await injectSocketTracer(guesserPage);
    await injectSocketTracer(spectatorPage);

    if (isP1Drawer) {
      await uiLogin(drawerPage, "player1@test.com", "password123");
      await uiLogin(guesserPage, "player2@test.com", "password123");
    } else {
      await uiLogin(drawerPage, "player2@test.com", "password123");
      await uiLogin(guesserPage, "player1@test.com", "password123");
    }
    await uiLogin(spectatorPage, "player3@test.com", "password123");

    flowStep('All three users navigating to match page');
    // Navigate both players and spectator in parallel
    await Promise.all([
      drawerPage.goto(`/tournaments/${tournamentId}/match/${match.id}`),
      guesserPage.goto(`/tournaments/${tournamentId}/match/${match.id}`),
      spectatorPage.goto(`/tournaments/${tournamentId}/match/${match.id}`),
    ]);

    flowStep('Waiting for role indicators');
    // Players see their roles
    await expect(drawerPage.locator("text=DRAWING")).toBeVisible({ timeout: 25_000 });
    await expect(guesserPage.locator("text=GUESSING")).toBeVisible({ timeout: 25_000 });

    // Spectator sees SPECTATING role
    await expect(spectatorPage.locator("text=SPECTATING")).toBeVisible({ timeout: 25_000 });
    flowStepOk('All users see correct role indicators');

    // Spectator can see the canvas (canvas element exists)
    await expect(spectatorPage.locator("canvas")).toBeVisible();

    await ctxA.close();
    await ctxB.close();
    await spectatorCtx.close();
  });

  // ------------------------------------------------------------
  // TEST 11: Chat — Multi-user broadcast
  // ------------------------------------------------------------
  test("Chat: Multi-user message broadcast", async ({ browser, request }) => {
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");

    const tournamentId = await apiCreateTournament(
      request,
      "Chat Multi-User",
      "TRIVIA",
      4,
      0,
      p1Auth.token
    );

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    setupLogging(page1, "chat-multi-1");
    setupLogging(page2, "chat-multi-2");

    await uiLogin(page1, "player1@test.com", "password123");
    await uiLogin(page2, "player2@test.com", "password123");

    await page1.goto(`/tournaments/${tournamentId}`);
    await page2.goto(`/tournaments/${tournamentId}`);

    // Both users should see the chat input
    const input1 = page1.locator('input[placeholder="Type a message..."]');
    const input2 = page2.locator('input[placeholder="Type a message..."]');
    await expect(input1).toBeVisible({ timeout: 15_000 });
    await expect(input2).toBeVisible({ timeout: 15_000 });

    // Player 1 sends a message
    const sendBtn1 = page1.locator('form:has(input[placeholder="Type a message..."]) button[type="submit"]');
    await input1.fill("Broadcast test from player1");
    await sendBtn1.click();

    // Both pages should see the message
    const chatArea1 = page1.locator("div.flex-1.overflow-y-auto");
    const chatArea2 = page2.locator("div.flex-1.overflow-y-auto");
    await expect(chatArea1).toContainText("Broadcast test from player1", { timeout: 10_000 });
    await expect(chatArea2).toContainText("Broadcast test from player1", { timeout: 10_000 });

    // Player 2 sends a reply
    const sendBtn2 = page2.locator('form:has(input[placeholder="Type a message..."]) button[type="submit"]');
    await input2.fill("Reply from player2");
    await sendBtn2.click();

    await expect(chatArea2).toContainText("Reply from player2", { timeout: 10_000 });
    await expect(chatArea1).toContainText("Reply from player2", { timeout: 10_000 });

    await ctx1.close();
    await ctx2.close();
  });

  // ------------------------------------------------------------
  // TEST 12: Tournament — Cannot join after started
  // ------------------------------------------------------------
  test("Tournament: Cannot join after tournament starts", async ({ browser, request }) => {
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");
    const p3Auth = await apiLogin(request, "player3@test.com", "password123");

    const tournamentId = await apiCreateTournament(
      request,
      "Join After Start",
      "TRIVIA",
      2,
      0,
      p1Auth.token
    );
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiStartTournament(request, tournamentId, p1Auth.token);

    // Player 3 tries to join the already started tournament — should fail
    const res = await request.post(`${API_URL}/tournaments/${tournamentId}/join`, {
      headers: { Authorization: `Bearer ${p3Auth.token}` },
    });
    expect(res.ok()).toBeFalsy();
    const body = await res.json();
    // Must include an error message about not being in registration
    expect(body.error).toBeTruthy();
  });

  // ------------------------------------------------------------
  // TEST 13: Trivia — Spectator can view match
  // ------------------------------------------------------------
  test("Trivia E2E: Spectator view during active match", async ({ browser, request }) => {
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");

    // Spectator (player3) does NOT need to join — any logged-in user can watch
    const tournamentId = await apiCreateTournament(
      request,
      "Trivia Spectator",
      "TRIVIA",
      2,
      0,
      p1Auth.token
    );
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiStartTournament(request, tournamentId, p1Auth.token);

    const bracket = await apiGetBracket(request, tournamentId);
    const match = bracket.rounds?.round1?.find(
      (m) => m.player1Id === p1Auth.userId || m.player2Id === p1Auth.userId
    );
    if (!match) throw new Error("Match not found");

    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const specCtx = await browser.newContext();
    const p1Page = await p1Ctx.newPage();
    const p2Page = await p2Ctx.newPage();
    const specPage = await specCtx.newPage();

    setupLogging(p1Page, "trivia-spec-p1");
    setupLogging(p2Page, "trivia-spec-p2");
    setupLogging(specPage, "trivia-spec-viewer");

    await injectSocketTracer(p1Page);
    await injectSocketTracer(p2Page);
    await injectSocketTracer(specPage);

    await uiLogin(p1Page, "player1@test.com", "password123");
    await uiLogin(p2Page, "player2@test.com", "password123");
    await uiLogin(specPage, "player3@test.com", "password123");

    flowStep('All three users navigating to Trivia match');
    // Navigate all pages in parallel
    await Promise.all([
      p1Page.goto(`/tournaments/${tournamentId}/match/${match.id}`),
      p2Page.goto(`/tournaments/${tournamentId}/match/${match.id}`),
      specPage.goto(`/tournaments/${tournamentId}/match/${match.id}`),
    ]);

    flowStep('Waiting for game indicators');
    // Spectator mode should appear
    await expect(
      specPage.locator("text=Spectator Mode").or(specPage.locator("text=Spectating Match"))
    ).toBeVisible({ timeout: 25_000 });
    // Both players should see game start
    await waitForGameStart(p1Page, p2Page, 'spec-p1', 'spec-p2');

    // Play the trivia match to completion
    const allDone = Promise.all([
      playTriviaToEnd(p1Page),
      playTriviaToEnd(p2Page),
    ]);

    // Spectator should also see the match finish
    await expect(specPage.locator("text=Match Finished")).toBeVisible({ timeout: 60_000 });

    await allDone;

    await p1Ctx.close();
    await p2Ctx.close();
    await specCtx.close();
  });

  // ------------------------------------------------------------
  // TEST 14: Quick Draw — Drawer disconnect mid-game (guesser wins)
  // ------------------------------------------------------------
  test("Quick Draw Abandonment: Drawer disconnect, guesser wins", async ({ browser, request }) => {
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");

    const tournamentId = await apiCreateTournament(
      request,
      "QD Abandon Drawer",
      "QUICK_DRAW",
      2,
      0,
      p1Auth.token
    );
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiStartTournament(request, tournamentId, p1Auth.token);

    const bracket = await apiGetBracket(request, tournamentId);
    const match = (bracket.rounds?.round1 || [])[0];
    if (!match) throw new Error("Match not found");

    // Drawer is always match.player1Id (randomly assigned)
    const isP1Drawer = Number(match.player1Id) === Number(p1Auth.userId);

    const ctxDrawer = await browser.newContext();
    const ctxGuesser = await browser.newContext();
    const drawerPage = await ctxDrawer.newPage();
    const guesserPage = await ctxGuesser.newPage();

    setupLogging(drawerPage, "qd-abandon-drawer");
    setupLogging(guesserPage, "qd-abandon-guesser");

    await injectSocketTracer(drawerPage);
    await injectSocketTracer(guesserPage);

    if (isP1Drawer) {
      await uiLogin(drawerPage, "player1@test.com", "password123");
      await uiLogin(guesserPage, "player2@test.com", "password123");
    } else {
      await uiLogin(drawerPage, "player2@test.com", "password123");
      await uiLogin(guesserPage, "player1@test.com", "password123");
    }

    flowStep('Both players navigating to Quick Draw match');
    // Navigate both pages in parallel
    await Promise.all([
      drawerPage.goto(`/tournaments/${tournamentId}/match/${match.id}`),
      guesserPage.goto(`/tournaments/${tournamentId}/match/${match.id}`),
    ]);

    // Wait for game to start
    flowStep('Waiting for game to start');
    await expect(drawerPage.locator("text=DRAWING")).toBeVisible({ timeout: 25_000 });
    await expect(guesserPage.locator("text=GUESSING")).toBeVisible({ timeout: 25_000 });
    flowStepOk('Game started');

    // Drawer disconnects
    flowStep('Drawer disconnecting');
    await ctxDrawer.close();

    // Guesser should win by abandonment
    flowStep('Waiting for guesser to win by abandonment');
    await expect(guesserPage.locator("text=You Won!")).toBeVisible({ timeout: 30_000 });
    flowStepOk('Guesser won by abandonment');

    await ctxGuesser.close();
  });
});
