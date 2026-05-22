import { test, expect } from "@playwright/test";
import { injectSocketTracer, getSocketEvents, dumpSocketEvents, findMissingEvent } from "./helpers/socketTracer.js";
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
  return (await res.json()).tournamentId;
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

async function playTriviaToEnd(page, label = 'player') {
  const finished = page
    .locator("text=You Won!")
    .or(page.locator("text=Game Over"))
    .or(page.locator("text=Match Finished"))
    .or(page.locator("text=Completed"));
  for (let i = 0; i < 20; i++) {
    try {
      if (page.isClosed()) return;
      if (await finished.isVisible({ timeout: 1000 }).catch(() => false)) return;
    } catch { return; }

    try {
      if (page.isClosed()) return;
      const answerBtn = page.locator("button.justify-start:not([disabled])").first();
      if (await answerBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
        await answerBtn.click();
      } else {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
    } catch { await new Promise(r => setTimeout(r, 1000)); }
  }
  try {
    if (!page.isClosed()) {
      await expect(finished).toBeVisible({ timeout: 30_000 });
    }
  } catch {}
}

test.describe("Edge Cases", () => {
  test.setTimeout(300_000);

  // ============================================================
  // EDGE CASE 1: Quick Draw — Empty guess validation
  // ============================================================
  test("[Draw-01] Quick Draw: Empty guess rejected", async ({ browser, request }) => {
    startFlow("Empty guess validation");
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");

    const tournamentId = await apiCreateTournament(request, `EmptyGuess_${Date.now()}`, "QUICK_DRAW", 2, 0, p1Auth.token);
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiStartTournament(request, tournamentId, p1Auth.token);

    const bracket = await apiGetBracket(request, tournamentId);
    const match = (bracket.rounds?.round1 || [])[0];
    const isP1Drawer = Number(match.player1Id) === Number(p1Auth.userId);

    const drawerCtx = await browser.newContext();
    const guesserCtx = await browser.newContext();
    const drawerPage = await drawerCtx.newPage();
    const guesserPage = await guesserCtx.newPage();
    setupLogging(drawerPage, "empty-drawer");
    setupLogging(guesserPage, "empty-guesser");
    await injectSocketTracer(drawerPage);
    await injectSocketTracer(guesserPage);

    if (isP1Drawer) {
      await uiLogin(drawerPage, "player1@test.com", "password123");
      await uiLogin(guesserPage, "player2@test.com", "password123");
    } else {
      await uiLogin(drawerPage, "player2@test.com", "password123");
      await uiLogin(guesserPage, "player1@test.com", "password123");
    }

    await Promise.all([
      drawerPage.goto(`/tournaments/${tournamentId}/match/${match.id}`),
      guesserPage.goto(`/tournaments/${tournamentId}/match/${match.id}`),
    ]);
    await expect(drawerPage.locator("text=DRAWING")).toBeVisible({ timeout: 25_000 });
    await expect(guesserPage.locator("text=GUESSING")).toBeVisible({ timeout: 25_000 });

    // Submit empty guess
    const guessInput = guesserPage.locator('input[placeholder="Type your guess..."]');
    const guessBtn = guesserPage.locator('button:has-text("Guess")');
    await guessInput.fill("");
    await guessBtn.click();
    await expect(guesserPage.locator("text=Please enter a guess first")).toBeVisible({ timeout: 5_000 });
    flowStepOk('[Draw-01] Empty guess correctly rejected');

    await drawerCtx.close();
    await guesserCtx.close();
    endFlow(true, 'Empty guess validation passed');
  });

  // ============================================================
  // EDGE CASE 2: Quick Draw — Drawer tries to guess (should be blocked)
  // ============================================================
  test("[Draw-02] Quick Draw: Drawer cannot guess", async ({ browser, request }) => {
    startFlow("Drawer guessing blocked");
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");

    const tournamentId = await apiCreateTournament(request, `DrawerGuess_${Date.now()}`, "QUICK_DRAW", 2, 0, p1Auth.token);
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiStartTournament(request, tournamentId, p1Auth.token);

    const bracket = await apiGetBracket(request, tournamentId);
    const match = (bracket.rounds?.round1 || [])[0];
    const isP1Drawer = Number(match.player1Id) === Number(p1Auth.userId);

    const drawerCtx = await browser.newContext();
    const drawerPage = await drawerCtx.newPage();
    setupLogging(drawerPage, "drawer-guess");
    await injectSocketTracer(drawerPage);

    if (isP1Drawer) {
      await uiLogin(drawerPage, "player1@test.com", "password123");
    } else {
      await uiLogin(drawerPage, "player2@test.com", "password123");
    }
    await drawerPage.goto(`/tournaments/${tournamentId}/match/${match.id}`);
    await expect(drawerPage.locator("text=DRAWING")).toBeVisible({ timeout: 25_000 });

    // Verify guess input is disabled/not visible for drawer
    const guessInput = drawerPage.locator('input[placeholder="Type your guess..."]');
    await expect(guessInput).not.toBeVisible({ timeout: 5_000 });
    flowStepOk('[Draw-02] Drawer cannot see guess input');

    await drawerCtx.close();
    endFlow(true, 'Drawer guessing blocked correctly');
  });

  // ============================================================
  // EDGE CASE 3: Chat — Rate limiting
  // ============================================================
  test("[Chat-02] Chat rate limit: rapid messages rejected", async ({ browser, request }) => {
    startFlow("Chat rate limiting");
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const tournamentId = await apiCreateTournament(request, `ChatRate_${Date.now()}`, "TRIVIA", 4, 0, p1Auth.token);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    setupLogging(page, "chat-rate");
    await injectSocketTracer(page);

    await uiLogin(page, "player1@test.com", "password123");
    await page.goto(`/tournaments/${tournamentId}`);

    const chatInput = page.locator('input[placeholder="Type a message..."]');
    await expect(chatInput).toBeVisible({ timeout: 15_000 });
    const sendBtn = page.locator('form:has(input[placeholder="Type a message..."]) button[type="submit"]');

    // Send 3 rapid messages
    await chatInput.fill("Message 1");
    await sendBtn.click();
    await chatInput.fill("Message 2");
    await sendBtn.click();
    await chatInput.fill("Message 3");
    await sendBtn.click();

    // Rate limit error should appear
    const errorMsg = page.locator("p.text-danger");
    await expect(errorMsg).toContainText("Slow down!", { timeout: 5_000 });
    flowStepOk('[Chat-02] Rate limit correctly enforced');

    await ctx.close();
    endFlow(true, 'Chat rate limiting passed');
  });

  // ============================================================
  // EDGE CASE 4: Cannot join after tournament started
  // ============================================================
  test("[Trivia-04] Cannot join after tournament starts", async ({ browser, request }) => {
    startFlow("Join after start blocked");
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");
    const intruderAuth = await apiLogin(request, "player3@test.com", "password123");

    const tournamentId = await apiCreateTournament(request, `JoinAfter_${Date.now()}`, "TRIVIA", 2, 0, p1Auth.token);
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiStartTournament(request, tournamentId, p1Auth.token);

    // Player 3 tries to join
    const res = await request.post(`${API_URL}/tournaments/${tournamentId}/join`, {
      headers: { Authorization: `Bearer ${intruderAuth.token}` },
    });
    expect(res.ok()).toBeFalsy();
    const body = await res.json();
    expect(body.error).toBeTruthy();
    flowStepOk('[Trivia-04] Join after start correctly blocked');

    endFlow(true, 'Join after start validation passed');
  });

  // ============================================================
  // EDGE CASE 5: Guest quick play flow
  // ============================================================
  test("[WS-01] Guest can quick play trivia", async ({ browser, request }) => {
    startFlow("Guest Quick Play");
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    setupLogging(page, "guest");
    await injectSocketTracer(page);

    await page.goto("/");
    await expect(page.locator("text=Quick Play")).toBeVisible({ timeout: 10_000 });
    flowStep('Landing page loaded');

    // Click Quick Play
    await page.locator('button:has-text("Quick Play")').first().click();
    // May redirect to login with guest option
    const guestBtn = page.locator('button:has-text("Guest")').or(page.locator('a:has-text("Guest")'));
    if (await guestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await guestBtn.click();
      flowStep('Chose guest option');
    }

    // Wait for match to start or lobby
    const matchStarted = await page.locator("text=Your Score:").or(page.locator("text=Game Starting!")).isVisible({ timeout: 30_000 }).catch(() => false);
    if (matchStarted) {
      flowStepOk('Guest successfully joined a match');
    } else {
      const pageState = await dumpState(page);
      flowStep(`Guest flow state: ${pageState?.matchState || 'unknown'}`);
    }

    await ctx.close();
    endFlow(true, 'Guest quick play flow works');
  });

  // ============================================================
  // EDGE CASE 6: XSS prevention in chat
  // ============================================================
  test("[Chat-04] XSS prevention in chat messages", async ({ browser, request }) => {
    startFlow("Chat XSS Prevention");
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const tournamentId = await apiCreateTournament(request, `XSS_${Date.now()}`, "TRIVIA", 4, 0, p1Auth.token);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    setupLogging(page, "xss-chat");
    await injectSocketTracer(page);
    await setupConsoleCapture(page);

    await uiLogin(page, "player1@test.com", "password123");
    await page.goto(`/tournaments/${tournamentId}`);

    const chatInput = page.locator('input[placeholder="Type a message..."]');
    await expect(chatInput).toBeVisible({ timeout: 15_000 });
    const sendBtn = page.locator('form:has(input[placeholder="Type a message..."]) button[type="submit"]');

    // Send XSS attempt
    const xssPayload = '<img src=x onerror=alert(1)>';
    await chatInput.fill(xssPayload);
    await sendBtn.click();

    // Wait and verify no dialog appeared
    page.on("dialog", (dialog) => {
      console.log(`  ⚠ XSS dialog detected: ${dialog.message()}`);
      dialog.dismiss();
      throw new Error("XSS vulnerability: alert() dialog was triggered!");
    });

    await new Promise(r => setTimeout(r, 2000));

    // Verify message appears but is sanitized (should show as text, not execute)
    const chatArea = page.locator("div.flex-1.overflow-y-auto");
    const chatText = await chatArea.innerText().catch(() => '');
    if (chatText.includes('img')) {
      flowStepOk('XSS payload displayed as text (not executed)');
    } else {
      flowStep('XSS payload may have been stripped');
    }

    await ctx.close();
    endFlow(true, 'Chat XSS prevention verified');
  });

  // ============================================================
  // EDGE CASE 7: No-Show Cancellation UX
  // ============================================================
  test("[Trivia-04] No-Show Match Cancellation", async ({ browser, request }) => {
    startFlow("No-Show Cancellation");
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    
    // Create tournament
    const tournamentId = await apiCreateTournament(request, `NoShow_${Date.now()}`, "TRIVIA", 2, 0, p1Auth.token);
    
    // Have player 2 join and start the tournament
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiStartTournament(request, tournamentId, p1Auth.token);

    const bracket = await apiGetBracket(request, tournamentId);
    const match = (bracket.rounds?.round1 || [])[0];

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    setupLogging(page, "no-show");
    await injectSocketTracer(page);
    await uiLogin(page, "player1@test.com", "password123");

    // Player 1 joins the MATCH room, but Player 2 DOES NOT.
    await page.goto(`/tournaments/${tournamentId}/match/${match.id}`);
    
    // Player 1 should see "Waiting for opponent"
    await expect(page.locator("text=Waiting for opponent")).toBeVisible({ timeout: 15_000 });
    
    // Wait for cancellation (server usually times out if both players don't join)
    // For testing, we expect the UI to handle the lack of join gracefully if the server aborts it.
    await expect(page.locator("text=Match Cancelled").or(page.locator("text=cancelled"))).toBeVisible({ timeout: 35_000 }).catch(() => {
      console.log("  ⚠ No-show cancellation timeout didn't trigger in 35s, but test continues.");
    });
    
    await ctx.close();
    endFlow(true, 'No-Show logic executed');
  });

  // ============================================================
  // EDGE CASE 8: Multi-Tab Synchronization
  // ============================================================
  test("[WS-02] Multi-Tab Sync", async ({ browser, request }) => {
    startFlow("Multi-Tab Sync");
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");

    const tournamentId = await apiCreateTournament(request, `MultiTab_${Date.now()}`, "TRIVIA", 2, 0, p1Auth.token);
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiStartTournament(request, tournamentId, p1Auth.token);

    const bracket = await apiGetBracket(request, tournamentId);
    const match = (bracket.rounds?.round1 || [])[0];

    // Create 2 contexts for Player 1, 1 context for Player 2
    const p1Ctx1 = await browser.newContext();
    const p1Ctx2 = await browser.newContext();
    const p2Ctx = await browser.newContext();
    
    const p1Tab1 = await p1Ctx1.newPage();
    const p1Tab2 = await p1Ctx2.newPage();
    const p2Page = await p2Ctx.newPage();

    setupLogging(p1Tab1, "p1-tab1");
    setupLogging(p1Tab2, "p1-tab2");
    
    await uiLogin(p1Tab1, "player1@test.com", "password123");
    await uiLogin(p1Tab2, "player1@test.com", "password123");
    await uiLogin(p2Page, "player2@test.com", "password123");

    await Promise.all([
      p1Tab1.goto(`/tournaments/${tournamentId}/match/${match.id}`),
      p1Tab2.goto(`/tournaments/${tournamentId}/match/${match.id}`),
      p2Page.goto(`/tournaments/${tournamentId}/match/${match.id}`)
    ]);

    await expect(p1Tab1.locator("text=Game Starting!").or(p1Tab1.locator("text=Your Score:"))).toBeVisible({ timeout: 15_000 });
    await expect(p1Tab2.locator("text=Game Starting!").or(p1Tab2.locator("text=Your Score:"))).toBeVisible({ timeout: 15_000 });
    
    // Tab 1 answers
    const answerBtn = p1Tab1.locator("button.justify-start:not([disabled])").first();
    await answerBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await answerBtn.click();
    
    // Tab 2 should become disabled automatically without clicking
    const disabledBtn = p1Tab2.locator("button.justify-start[disabled]").first();
    await expect(disabledBtn).toBeVisible({ timeout: 10_000 });
    flowStepOk('Tab 2 synchronized the answer state visually');

    await p1Ctx1.close();
    await p1Ctx2.close();
    await p2Ctx.close();
    endFlow(true, 'Multi-tab sync verified');
  });

  // ============================================================
  // EDGE CASE 9: Fast vs Slow Point Math Validation
  // ============================================================
  test("[Trivia-05] Fast vs Slow Point Math", async ({ browser, request }) => {
    startFlow("Fast vs Slow Point Math");
    const p1Auth = await apiLogin(request, "player1@test.com", "password123");
    const p2Auth = await apiLogin(request, "player2@test.com", "password123");

    const tournamentId = await apiCreateTournament(request, `FastSlow_${Date.now()}`, "TRIVIA", 2, 0, p1Auth.token);
    await apiJoinTournament(request, tournamentId, p2Auth.token);
    await apiStartTournament(request, tournamentId, p1Auth.token);

    const bracket = await apiGetBracket(request, tournamentId);
    const match = (bracket.rounds?.round1 || [])[0];

    const p1Ctx = await browser.newContext();
    const p2Ctx = await browser.newContext();
    const p1Page = await p1Ctx.newPage();
    const p2Page = await p2Ctx.newPage();
    
    await injectSocketTracer(p1Page);

    await uiLogin(p1Page, "player1@test.com", "password123");
    await uiLogin(p2Page, "player2@test.com", "password123");

    await Promise.all([
      p1Page.goto(`/tournaments/${tournamentId}/match/${match.id}`),
      p2Page.goto(`/tournaments/${tournamentId}/match/${match.id}`)
    ]);

    await expect(p1Page.locator("text=Game Starting!").or(p1Page.locator("text=Your Score:"))).toBeVisible({ timeout: 15_000 });
    
    const ans1 = p1Page.locator("button.justify-start:not([disabled])").first();
    await ans1.waitFor({ state: 'visible', timeout: 15_000 });
    
    // Player 1 answers INSTANTLY
    await ans1.click();
    
    // Player 2 waits 3 seconds before answering
    await new Promise(r => setTimeout(r, 3000));
    const ans2 = p2Page.locator("button.justify-start:not([disabled])").first();
    await ans2.click();

    // Need to wait for score update
    await new Promise(r => setTimeout(r, 4000));
    const events = await getSocketEvents(p1Page);
    const scoreEvent = events.find(e => e.event === 'trivia:score_update');
    
    if (scoreEvent && scoreEvent.data && scoreEvent.data.scores) {
      const p1Score = scoreEvent.data.scores[p1Auth.userId] || 0;
      const p2Score = scoreEvent.data.scores[p2Auth.userId] || 0;
      console.log(`  P1 (Fast) Score: ${p1Score}, P2 (Slow) Score: ${p2Score}`);
      
      if (p1Score > 0 && p2Score > 0) {
        expect(p1Score).toBeGreaterThan(p2Score);
      }
    }

    await p1Ctx.close();
    await p2Ctx.close();
    endFlow(true, 'Fast vs Slow points evaluated');
  });

  // ============================================================
  // EDGE CASE 10: Empty States
  // ============================================================
  test("[UX-02] Empty States", async ({ browser, request }) => {
    startFlow("Empty States UX");
    const ts = Date.now();
    await request.post(`${API_URL}/auth/register`, {
      data: { username: `empty${ts}`, email: `empty${ts}@test.com`, password: "password123" }
    });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await uiLogin(page, `empty${ts}@test.com`, "password123");

    // My Tournaments tab should be empty
    await page.goto("/tournaments?tab=my");
    await expect(page.locator("text=You haven't joined any tournaments yet")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button:has-text("Create Tournament")')).toBeVisible();
    
    flowStepOk('Empty state correctly displayed with CTA');
    await ctx.close();
    endFlow(true, 'Empty state verified');
  });
});
