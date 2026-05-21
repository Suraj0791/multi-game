import { test, expect } from "@playwright/test";

const API_URL = process.env.E2E_BACKEND_URL || "http://localhost:3000";

async function apiLogin(request, email, password) {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  expect(res.ok()).toBeTruthy();
  return await res.json();
}

async function apiGetTournamentIdByName(request, name) {
  const res = await request.get(`${API_URL}/tournaments`);
  expect(res.ok()).toBeTruthy();
  const tournaments = await res.json();
  const t = tournaments.find((x) => x.name === name);
  if (!t) throw new Error(`Tournament not found: ${name}`);
  return t.id;
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

async function uiLogin(page, email, password) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button:has-text("Sign in")');
  await expect(page).toHaveURL(/\/tournaments/);
}

async function playTriviaToEnd(page) {
  // This assumes the backend advances to next question when both answered.
  const finished = page
    .locator("text=You Won!")
    .or(page.locator("text=Game Over"));
  for (let i = 0; i < 10; i++) {
    if (await finished.isVisible()) return;

    const answerBtn = page
      .locator("button.justify-start:not([disabled])")
      .first();
    await expect(answerBtn).toBeVisible({ timeout: 20_000 });
    await answerBtn.click();

    const feedback = page.locator("div.text-center.text-sm");
    await expect(feedback).toBeVisible({ timeout: 10_000 });
  }

  await expect(finished).toBeVisible({ timeout: 60_000 });
}

test.describe("TourneyHub Full End-to-End", () => {
  test("Login → chat → Trivia tournament completion → Quick Draw match completion", async ({
    browser,
    request,
  }) => {
    test.setTimeout(180_000); // 3 minutes — complex E2E with slow remote DB
    const triviaTournamentId = await apiGetTournamentIdByName(
      request,
      "Trivia Showdown Cup"
    );
    const drawTournamentId = await apiGetTournamentIdByName(
      request,
      "Quick Draw Championship"
    );

    // Resolve host identity via API (avoids guessing seeded IDs)
    const triviaHostAuth = await apiLogin(
      request,
      "player1@test.com",
      "password123"
    );
    const drawHostAuth = await apiLogin(
      request,
      "player2@test.com",
      "password123"
    );

    // ------------------------------
    // TRIVIA: Login + lobby chat
    // ------------------------------
    const triviaHostContext = await browser.newContext();
    const triviaOtherContext = await browser.newContext();
    const triviaHostPage = await triviaHostContext.newPage();
    const triviaOtherPage = await triviaOtherContext.newPage();

    await uiLogin(triviaHostPage, "player1@test.com", "password123");
    await uiLogin(triviaOtherPage, "player2@test.com", "password123");

    await triviaHostPage.goto(`/tournaments/${triviaTournamentId}`);
    await triviaOtherPage.goto(`/tournaments/${triviaTournamentId}`);

    const hostChatInput = triviaHostPage.locator(
      'input[placeholder="Type a message..."]'
    );
    const otherChatInput = triviaOtherPage.locator(
      'input[placeholder="Type a message..."]'
    );
    await expect(hostChatInput).toBeVisible();
    await expect(otherChatInput).toBeVisible();

    const hostChatArea = triviaHostPage.locator("div.flex-1.overflow-y-auto");
    const otherChatArea = triviaOtherPage.locator("div.flex-1.overflow-y-auto");

    // Wait for chat rooms to be joined (system messages)
    await expect(hostChatArea).toContainText("joined the chat", {
      timeout: 15_000,
    });
    await expect(otherChatArea).toContainText("joined the chat", {
      timeout: 15_000,
    });

    // Small buffer to avoid rate-limit edge cases
    await triviaHostPage.waitForTimeout(300);

    await hostChatInput.fill("Hello from Trivia host!");
    await triviaHostPage
      .locator(
        'form:has(input[placeholder="Type a message..."]) button[type="submit"]'
      )
      .click();
    await expect(otherChatArea).toContainText("Hello from Trivia host!");

    await otherChatInput.fill("Ready!");
    await triviaOtherPage
      .locator(
        'form:has(input[placeholder="Type a message..."]) button[type="submit"]'
      )
      .click();
    await expect(hostChatArea).toContainText("Ready!");

    // ------------------------------
    // TRIVIA: Start tournament
    // ------------------------------
    const startBtn = triviaHostPage.locator(
      'button:has-text("Start Tournament")'
    );
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await expect(triviaHostPage.locator("text=In Progress")).toBeVisible({
      timeout: 15_000,
    });
    await triviaOtherPage.reload();
    await expect(triviaOtherPage.locator("text=In Progress")).toBeVisible({
      timeout: 15_000,
    });

    // Find the host's actual match (bracket is randomized)
    const triviaBracket = await apiGetBracket(request, triviaTournamentId);
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

    // Ensure the second browser is logged in as the actual opponent
    await triviaOtherContext.close();
    const triviaOpponentContext = await browser.newContext();
    const triviaOpponentPage = await triviaOpponentContext.newPage();
    await uiLogin(triviaOpponentPage, opponentEmail, "password123");

    // Join the match from both players
    await triviaHostPage.goto(
      `/tournaments/${triviaTournamentId}/match/${myMatch.id}`
    );
    await triviaOpponentPage.goto(
      `/tournaments/${triviaTournamentId}/match/${myMatch.id}`
    );

    // Wait for match page to load — the game may already start before we can
    // see "Waiting for opponent...", so accept either the waiting state or the
    // game UI (question text visible).
    const hostMatchLoaded = triviaHostPage
      .locator("text=Waiting for opponent...")
      .or(triviaHostPage.locator("text=Game starting..."))
      .or(triviaHostPage.locator("h2.text-lg"));
    await expect(hostMatchLoaded).toBeVisible({ timeout: 20_000 });

    const opponentMatchLoaded = triviaOpponentPage
      .locator("text=Waiting for opponent...")
      .or(triviaOpponentPage.locator("text=Game starting..."))
      .or(triviaOpponentPage.locator("h2.text-lg"));
    await expect(opponentMatchLoaded).toBeVisible({ timeout: 20_000 });

    // Wait for first question to appear on both sides
    await expect(triviaHostPage.locator("h2.text-lg")).toBeVisible({
      timeout: 30_000,
    });
    await expect(triviaOpponentPage.locator("h2.text-lg")).toBeVisible({
      timeout: 30_000,
    });

    // Play full trivia match to completion
    await Promise.all([
      playTriviaToEnd(triviaHostPage),
      playTriviaToEnd(triviaOpponentPage),
    ]);

    // ------------------------------
    // TRIVIA: Force-complete the rest of the bracket via API
    // ------------------------------
    for (let guard = 0; guard < 20; guard++) {
      const matches = await apiGetMatches(request, triviaTournamentId);
      const incomplete = matches.filter((m) => m.status !== "COMPLETED");
      if (incomplete.length === 0) break;

      const m = incomplete[0];
      const winnerId = m.player1Id || m.player2Id;
      await apiCompleteMatch(request, m.id, winnerId, triviaHostAuth.token);
    }

    // Tournament should now show Completed
    await triviaHostPage.goto(`/tournaments/${triviaTournamentId}`);
    await expect(triviaHostPage.locator("text=Completed")).toBeVisible({
      timeout: 15_000,
    });
    await expect(triviaHostPage.locator("text=Round 3")).toBeVisible();

    await triviaOpponentContext.close();
    await triviaHostContext.close();

    // ------------------------------
    // QUICK DRAW: Start tournament + play a match to completion
    // ------------------------------
    const drawHostContext = await browser.newContext();
    const drawHostPage = await drawHostContext.newPage();
    await uiLogin(drawHostPage, "player2@test.com", "password123");
    await drawHostPage.goto(`/tournaments/${drawTournamentId}`);

    const drawStartBtn = drawHostPage.locator(
      'button:has-text("Start Tournament")'
    );
    await expect(drawStartBtn).toBeVisible();
    await drawStartBtn.click();
    await expect(drawHostPage.locator("text=In Progress")).toBeVisible({
      timeout: 15_000,
    });

    const drawBracket = await apiGetBracket(request, drawTournamentId);
    const drawMatch = (drawBracket.rounds?.round1 || [])[0];
    if (!drawMatch)
      throw new Error("No round1 match found in Quick Draw tournament");

    const drawerEmail = `${drawMatch.player1Name}@test.com`;
    const guesserEmail = `${drawMatch.player2Name}@test.com`;

    const drawerContext = await browser.newContext();
    const guesserContext = await browser.newContext();
    const drawerPage = await drawerContext.newPage();
    const guesserPage = await guesserContext.newPage();

    await uiLogin(drawerPage, drawerEmail, "password123");
    await uiLogin(guesserPage, guesserEmail, "password123");

    await drawerPage.goto(
      `/tournaments/${drawTournamentId}/match/${drawMatch.id}`
    );
    await guesserPage.goto(
      `/tournaments/${drawTournamentId}/match/${drawMatch.id}`
    );

    // Drawer must receive the secret word
    const drawWord = drawerPage.locator("text=Draw:");
    await expect(drawWord).toBeVisible({ timeout: 15_000 });
    const wordText = await drawWord.innerText();
    const word = wordText.replace(/^Draw:\s*/i, "").trim();
    expect(word.length).toBeGreaterThan(0);

    // Guesser submits the correct word
    const guessInput = guesserPage.locator(
      'input[placeholder="Type your guess..."]'
    );
    await expect(guessInput).toBeVisible({ timeout: 15_000 });
    await guessInput.fill(word);
    await guesserPage.locator('button:has-text("Guess")').click();

    await expect(guesserPage.locator("text=You Won!")).toBeVisible({
      timeout: 15_000,
    });
    await expect(drawerPage.locator("text=Game Over")).toBeVisible({
      timeout: 15_000,
    });

    await drawerContext.close();
    await guesserContext.close();
    await drawHostContext.close();
  });
});
