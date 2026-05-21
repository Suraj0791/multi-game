import { test, expect } from "@playwright/test";

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

// Trivia Play Helper — clicks any available answer until the match ends
async function playTriviaToEnd(page) {
  const finished = page
    .locator("text=You Won!")
    .or(page.locator("text=Game Over"))
    .or(page.locator("text=Match Finished"));
  for (let i = 0; i < 15; i++) {
    if (await finished.isVisible()) return;

    const answerBtn = page
      .locator("button.justify-start:not([disabled])")
      .first();
    try {
      await expect(answerBtn).toBeVisible({ timeout: 15_000 });
      await answerBtn.click();
    } catch (e) {
      if (await finished.isVisible()) return;
    }

    const feedback = page.locator("div.text-center.text-sm");
    try {
      await expect(feedback).toBeVisible({ timeout: 10_000 });
    } catch (e) {
      // ignore transition timeouts
    }
  }

  await expect(finished).toBeVisible({ timeout: 45_000 });
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

    const drawerContext = await browser.newContext();
    const guesserContext = await browser.newContext();
    const drawerPage = await drawerContext.newPage();
    const guesserPage = await guesserContext.newPage();

    setupLogging(drawerPage, "drawer-p1");
    setupLogging(guesserPage, "guesser-p2");

    await uiLogin(drawerPage, "player1@test.com", "password123");
    await uiLogin(guesserPage, "player2@test.com", "password123");

    await drawerPage.goto(`/tournaments/${tournamentId}/match/${match.id}`);
    await guesserPage.goto(`/tournaments/${tournamentId}/match/${match.id}`);

    // Verify role indicators (they should appear once the game starts)
    await expect(drawerPage.locator("text=You are DRAWING")).toBeVisible({ timeout: 25_000 });
    await expect(guesserPage.locator("text=You are GUESSING")).toBeVisible({ timeout: 25_000 });

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

    await drawerContext.close();
    await guesserContext.close();
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

    await p1Page.goto(`/tournaments/${tournamentId}/match/${match.id}`);
    await p2Page.goto(`/tournaments/${tournamentId}/match/${match.id}`);

    // Verify starting countdown on both pages
    await expect(p1Page.locator("text=Game Starting!")).toBeVisible({ timeout: 25_000 });
    await expect(p2Page.locator("text=Game Starting!")).toBeVisible({ timeout: 25_000 });

    // Play Trivia to end
    await Promise.all([
      playTriviaToEnd(p1Page),
      playTriviaToEnd(p2Page),
    ]);

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

    await uiLogin(p1Page, "player1@test.com", "password123");
    await uiLogin(p2Page, "player2@test.com", "password123");

    await p1Page.goto(`/tournaments/${tournamentId}/match/${match.id}`);
    await p2Page.goto(`/tournaments/${tournamentId}/match/${match.id}`);

    // Wait for match starting state on BOTH pages
    await expect(p1Page.locator("text=Game Starting!")).toBeVisible({ timeout: 25_000 });
    await expect(p2Page.locator("text=Game Starting!")).toBeVisible({ timeout: 25_000 });

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

    await uiLogin(hostPage, "player1@test.com", "password123");
    await hostPage.goto(`/tournaments/${tournamentId}`);

    // Start the tournament
    const startBtn = hostPage.locator('button:has-text("Start Tournament")');
    await expect(startBtn).toBeEnabled();
    await startBtn.click();
    await expect(hostPage.locator("text=In Progress")).toBeVisible({ timeout: 15_000 });

    // Get bracket matches
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

    await uiLogin(opponentPage, opponentEmail, "password123");

    // Play round 1 match E2E
    await hostPage.goto(`/tournaments/${tournamentId}/match/${myMatch.id}`);
    await opponentPage.goto(`/tournaments/${tournamentId}/match/${myMatch.id}`);

    await Promise.all([
      playTriviaToEnd(hostPage),
      playTriviaToEnd(opponentPage),
    ]);

    // Force-complete all remaining matches via REST API
    await forceCompleteAllMatches(request, tournamentId, triviaHostAuth);

    // Verify tournament status is Completed
    await hostPage.goto(`/tournaments/${tournamentId}`);
    await expect(hostPage.getByText("Completed", { exact: true })).toBeVisible({ timeout: 20_000 });

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

    const drawerCtx = await browser.newContext();
    const guesserCtx = await browser.newContext();
    const drawerPage = await drawerCtx.newPage();
    const guesserPage = await guesserCtx.newPage();

    setupLogging(drawerPage, "qd-wrong-drawer");
    setupLogging(guesserPage, "qd-wrong-guesser");

    await uiLogin(drawerPage, "player1@test.com", "password123");
    await uiLogin(guesserPage, "player2@test.com", "password123");

    await drawerPage.goto(`/tournaments/${tournamentId}/match/${match.id}`);
    await guesserPage.goto(`/tournaments/${tournamentId}/match/${match.id}`);

    // Wait for game to start
    await expect(drawerPage.locator("text=You are DRAWING")).toBeVisible({ timeout: 25_000 });
    await expect(guesserPage.locator("text=You are GUESSING")).toBeVisible({ timeout: 25_000 });

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

    await drawerCtx.close();
    await guesserCtx.close();
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
    const spectatorAuth = await apiLogin(request, "player3@test.com", "password123");

    const tournamentId = await apiCreateTournament(
      request,
      "QuickDraw Spectator",
      "QUICK_DRAW",
      4,
      0,
      p1Auth.token
    );
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiJoinTournament(request, tournamentId, spectatorAuth.token);
    await apiStartTournament(request, tournamentId, p1Auth.token);

    const bracket = await apiGetBracket(request, tournamentId);
    // Find a match involving player1 and player2
    const match = bracket.rounds?.round1?.find(
      (m) => m.player1Id === p1Auth.userId || m.player2Id === p1Auth.userId
    );
    if (!match) throw new Error("Match not found");

    const drawerCtx = await browser.newContext();
    const guesserCtx = await browser.newContext();
    const spectatorCtx = await browser.newContext();
    const drawerPage = await drawerCtx.newPage();
    const guesserPage = await guesserCtx.newPage();
    const spectatorPage = await spectatorCtx.newPage();

    setupLogging(drawerPage, "qd-spec-drawer");
    setupLogging(guesserPage, "qd-spec-guesser");
    setupLogging(spectatorPage, "qd-spec-viewer");

    await uiLogin(drawerPage, "player1@test.com", "password123");
    await uiLogin(guesserPage, "player2@test.com", "password123");
    await uiLogin(spectatorPage, "player3@test.com", "password123");

    await drawerPage.goto(`/tournaments/${tournamentId}/match/${match.id}`);
    await guesserPage.goto(`/tournaments/${tournamentId}/match/${match.id}`);
    await spectatorPage.goto(`/tournaments/${tournamentId}/match/${match.id}`);

    // Spectator sees SPECTATING role
    await expect(spectatorPage.locator("text=You are SPECTATING")).toBeVisible({ timeout: 25_000 });

    // Players see their roles
    await expect(drawerPage.locator("text=You are DRAWING")).toBeVisible({ timeout: 25_000 });
    await expect(guesserPage.locator("text=You are GUESSING")).toBeVisible({ timeout: 25_000 });

    // Spectator can see the canvas (canvas element exists)
    await expect(spectatorPage.locator("canvas")).toBeVisible();

    await drawerCtx.close();
    await guesserCtx.close();
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
    const spectatorAuth = await apiLogin(request, "player3@test.com", "password123");

    const tournamentId = await apiCreateTournament(
      request,
      "Trivia Spectator",
      "TRIVIA",
      4,
      0,
      p1Auth.token
    );
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiJoinTournament(request, tournamentId, spectatorAuth.token);
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

    await uiLogin(p1Page, "player1@test.com", "password123");
    await uiLogin(p2Page, "player2@test.com", "password123");
    await uiLogin(specPage, "player3@test.com", "password123");

    await p1Page.goto(`/tournaments/${tournamentId}/match/${match.id}`);
    await p2Page.goto(`/tournaments/${tournamentId}/match/${match.id}`);
    await specPage.goto(`/tournaments/${tournamentId}/match/${match.id}`);

    // Spectator sees Spectator Mode badge
    await expect(specPage.locator("text=Spectator Mode")).toBeVisible({ timeout: 25_000 });

    // Players see Game Starting!
    await expect(p1Page.locator("text=Game Starting!")).toBeVisible({ timeout: 25_000 });
    await expect(p2Page.locator("text=Game Starting!")).toBeVisible({ timeout: 25_000 });

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

    const drawerCtx = await browser.newContext();
    const guesserCtx = await browser.newContext();
    const drawerPage = await drawerCtx.newPage();
    const guesserPage = await guesserCtx.newPage();

    setupLogging(drawerPage, "qd-abandon-drawer");
    setupLogging(guesserPage, "qd-abandon-guesser");

    await uiLogin(drawerPage, "player1@test.com", "password123");
    await uiLogin(guesserPage, "player2@test.com", "password123");

    await drawerPage.goto(`/tournaments/${tournamentId}/match/${match.id}`);
    await guesserPage.goto(`/tournaments/${tournamentId}/match/${match.id}`);

    // Wait for game to start
    await expect(drawerPage.locator("text=You are DRAWING")).toBeVisible({ timeout: 25_000 });
    await expect(guesserPage.locator("text=You are GUESSING")).toBeVisible({ timeout: 25_000 });

    // Drawer disconnects
    await drawerCtx.close();

    // Guesser should win by abandonment
    await expect(guesserPage.locator("text=You Won!")).toBeVisible({ timeout: 30_000 });

    await guesserCtx.close();
  });
});
