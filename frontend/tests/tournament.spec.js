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

// Trivia Play Helper
async function playTriviaToEnd(page) {
  const finished = page
    .locator("text=You Won!")
    .or(page.locator("text=Game Over"));
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

test.describe("TourneyHub End-to-End Suite", () => {
  // Set default timeout for E2E tests in this suite
  test.setTimeout(120_000);

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

    // Verify host is joined and button is disabled with "Need 1 more"
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

    // Verify role indicators
    await expect(drawerPage.locator("text=You are DRAWING")).toBeVisible({ timeout: 15_000 });
    await expect(guesserPage.locator("text=You are GUESSING")).toBeVisible({ timeout: 15_000 });

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
    await expect(guesserPage.locator("text=You Won!")).toBeVisible({ timeout: 15_000 });
    await expect(drawerPage.locator("text=Game Over")).toBeVisible({ timeout: 15_000 });

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

    // Verify starting countdown
    await expect(p1Page.locator("text=Game Starting!")).toBeVisible({ timeout: 15_000 });
    await expect(p2Page.locator("text=Game Starting!")).toBeVisible({ timeout: 15_000 });

    // Play Trivia to end
    await Promise.all([
      playTriviaToEnd(p1Page),
      playTriviaToEnd(p2Page),
    ]);

    await p1Context.close();
    await p2Context.close();
  });

  // ------------------------------------------------------------
  // TEST 5: Match Abandonment Victory
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

    // Wait for match starting state
    await expect(p1Page.locator("text=Game Starting!")).toBeVisible({ timeout: 15_000 });
    await expect(p2Page.locator("text=Game Starting!")).toBeVisible({ timeout: 15_000 });

    // Close player 2 page (disconnection)
    await p2Context.close();

    // Verify Player 1 gets disconnect victory overlay ("You Won!")
    await expect(p1Page.locator("text=You Won!")).toBeVisible({ timeout: 15_000 });

    await p1Context.close();
  });

  // ------------------------------------------------------------
  // TEST 6: Bracket Advancement & Full Tournament Completion
  // ------------------------------------------------------------
  test("Bracket Advancement: Play tournament to completion", async ({ browser, request }) => {
    const triviaHostAuth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");
    const p3Auth = await apiLogin(request, "player3@test.com", "password123");
    const p4Auth = await apiLogin(request, "player4@test.com", "password123");

    // Create a 4-player Trivia tournament
    const tournamentId = await apiCreateTournament(
      request,
      "Advancement Trivia Tourney",
      "TRIVIA",
      4,
      0,
      triviaHostAuth.token
    );

    // Register players 2, 3, and 4
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

    // Opponent log in & play
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

    // Force-complete all remaining matches in the bracket via REST API
    for (let guard = 0; guard < 20; guard++) {
      const matches = await apiGetMatches(request, tournamentId);
      const incomplete = matches.filter((m) => m.status !== "COMPLETED");
      if (incomplete.length === 0) break;

      const m = incomplete[0];
      const winnerId = m.player1Id || m.player2Id;
      await apiCompleteMatch(request, m.id, winnerId, triviaHostAuth.token);
    }

    // Go back to details page and verify status is Completed
    await hostPage.goto(`/tournaments/${tournamentId}`);
    await expect(hostPage.getByText("Completed", { exact: true })).toBeVisible({ timeout: 20_000 });

    await hostContext.close();
    await opponentContext.close();
  });
});
