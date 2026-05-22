# Session Context — TourneyHub

## Last Session Goal
Fix demo tournament, add bot play for Trivia and Quick Draw, add Quick Match for two-player real-time testing, fix all WebSocket real-time sync bugs.

## Architecture Overview

```
backend/
  src/
    app.js                          — Express + Socket.IO server entry
    config/database.js              — PostgreSQL pool
    models/
      User.js                      — createUser, findByEmail, findById
      Match.js                     — createMatch, getMatchById (JOINs users for emails), getMatchesByTournament, updateMatchWinner
      Tournament.js                — insertTournament, getTournamentById, updateTournamentStatus
      TournamentPlayer.js          — addPlayer, getPlayersByTournament, updatePlayerPaymentStatus
    services/
      userService.js               — guestLogin (creates guest user + JWT), registerUser, loginUser
      tournamentService.js         — createTournament, startTournament, createDemoTournament, BOT_CREDENTIALS, getOrCreateBotUser
      matchService.js              — completeMatch (updates match + bracket progression)
      notificationService.js       — socket-based notifications
      chatService.js               — sendMessage
    controllers/
      matchController.js           — createQuickMatch (public), createVsBotMatch (auth), completeMatch
      tournamentController.js      — CRUD + start + demo + bracket
    routes/
      matches.routes.js            — /matches/quick (no auth), /matches/vs-bot (auth), /matches/:id/complete
      tournaments.routes.js        — CRUD + start + bracket + demo + join/leave
    socket/
      socketEvents.js              — ALL game socket logic (trivia, quickdraw, chat, notifications, disconnect cleanup)
    games/
      TriviaGame.js                — TriviaGame class (questions, submitAnswer, scores, getWinner)
      BotPlayer.js                 — isBotByEmail, checkBotOpponent, pickBotTriviaAnswer, botQuickDrawGuess, generateBotStroke
      gameConstants.js             — WORD_POOL, getRandomWord
      questionPool.js              — TRIVIA_QUESTIONS, getRandomQuestions

frontend/
  src/
    pages/
      LandingPage.jsx              — Main menu (Demo, Play vs Bot, Quick Match buttons)
      TournamentDetailPage.jsx     — Tournament view + bracket + join/leave/start/pay + chat
      MatchPage.jsx                — Fetches bracket, renders TriviaGame or QuickDrawGame
      LoginPage.jsx                — Login form + "Continue as Guest" with ?redirect= support
    components/
      games/
        TriviaGame.jsx             — Real-time trivia game component
        QuickDrawGame.jsx          — Real-time drawing/guessing game component
      layout/
        ProtectedRoute.jsx         — Auth guard, redirects to /login?redirect=...
    hooks/
      useSocket.js                 — Global singleton socket.io-client
    stores/
      authStore.js                 — Zustand store for token + userId + login/logout
    api/
      tournamentApi.js             — All tournament + match HTTP calls (getTournaments, createQuickMatch, etc.)
```

## Bot Detection System

- **Bot emails:** `bot_alice@tourneyhub.demo`, `bot_bob@tourneyhub.demo`, `bot_charlie@tourneyhub.demo`
- **Guest emails:** `guest_xxx_timestamp@tourneyhub.guest` (changed FROM `@tourneyhub.demo` TO `@tourneyhub.guest` in this session)
- **Detection:** `isBotByEmail(email)` checks if email ends with `@tourneyhub.demo`
- **Sockets:** `trivia:join` and `join_match` handlers set `game.playerBotMap` for any player whose email matches bot domain

## Game Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /matches/quick` | None | Creates guest user + 2-player tournament, returns token. Player 2 joins later via invite. |
| `POST /matches/vs-bot` | JWT | Creates tournament + match vs bot, returns tournamentId + matchId |
| `POST /tournaments/demo` | JWT | Creates a 4-player tournament with 3 bots, pre-completes all matches |

## Socket Event Flow

### Trivia (`trivia:join`, `trivia:answer`, etc.)
1. Player emits `trivia:join { matchId, playerId }` → server creates or joins `activeTriviaGames[matchId]`
2. Bot auto-join: if any player's email matches `@tourneyhub.demo`, they are added to `joinedPlayerIds` + `playerBotMap`
3. When `joinedPlayerIds.size === 2` → emit `trivia:started` → 3s delay → `sendNextTriviaQuestion()`
4. `sendNextTriviaQuestion()` emits question + `questionStartTime` (timestamp), schedules 10s timeout
5. If bot player, schedules bot answer via `pickBotTriviaAnswer()` after 2-7s delay
6. Player answers via `trivia:answer` → `checkTriviaBothAnswered()` checks if both answered → advance or wait
7. When `isGameOver()` → `completeMatch()` → emit `trivia:match_over`

### Quick Draw (`join_match`, `draw_stroke`, `submit_guess`)
1. Player emits `join_match { matchId, playerId }` → server creates or joins `activeGames[matchId]`
2. Bot auto-join same as trivia (email-based)
3. When both joined → emit `game_status` with `startTime` + 60s timer
4. Timer emits `quickdraw:timer { timeRemaining, startTime, timeLimit }` every second
5. Drawer sends strokes via `draw_stroke`, broadcast to room via `receive_stroke`
6. Guesser sends `submit_guess` → server checks against `wordToDraw`
7. Correct guess or time-up or 5 wrong attempts → `completeMatch()` → emit `match_over`

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| Game state in server memory (`activeTriviaGames`, `activeGames`) | No DB writes during gameplay — low latency |
| Bot runs on backend via `setTimeout` | Proves socket architecture works, visible on frontend as real events |
| Socket global singleton in frontend (`useSocket`) | Single connection shared across components |
| `socket.data` for tracking (not bare properties) | Prevents property collisions with Socket.IO internals |
| Guest email domain different from bot domain (`@tourneyhub.guest` vs `@tourneyhub.demo`) | Prevents false bot detection for human players |
| Server-authoritative timer (send timestamp, client calculates) | Eliminates timer drift from network latency |
| Idempotent join check (`socket.data.matchId`) | Prevents React StrictMode double-mount from breaking game state |

## Bug Fixes Applied This Session

1. **Guest users detected as bots** — Changed guest email from `@tourneyhub.demo` to `@tourneyhub.guest` (`userService.js:66`)
2. **Unified round-end logic** — `trivia:answer` handler now calls `checkTriviaBothAnswered()` instead of duplicating logic (`socketEvents.js:321-341`)
3. **Server-authoritative timer** — Server sends `questionStartTime` timestamp, client calculates `Math.max(0, (10000 - (Date.now() - startTime)) / 1000)` every 500ms (`socketEvents.js` + `TriviaGame.jsx`)
4. **Idempotent socket join** — Both `trivia:join` and `join_match` return early if this socket already joined this match (`socketEvents.js`)
5. **Quick Draw timer sync** — Server emits `startTime` + `timeLimit` with timer events, client calculates remaining time locally (`socketEvents.js` + `QuickDrawGame.jsx`)
6. **Reconnect state** — Enhanced both trivia and quickdraw reconnect handlers to send full game state (`socketEvents.js`)
7. **Fixed `socket.playerId` → `socket.data.playerId`** — All answer/guess/disconnect handlers now use `socket.data.playerId` (was broken when switching from direct property to `socket.data` namespace)

## Files Changed This Session

| File | Changes |
|------|---------|
| `backend/src/services/userService.js:66` | `@tourneyhub.demo` → `@tourneyhub.guest` |
| `backend/src/socket/socketEvents.js` | Unified round-end, idempotent join, questionStartTime, startTime, reconnect state, socket.data migration |
| `frontend/src/components/games/TriviaGame.jsx` | Server-authoritative timer, hasAnswered state |
| `frontend/src/components/games/QuickDrawGame.jsx` | startTime/timeLimit state, local timer calc |
| `frontend/src/pages/LoginPage.jsx:39` | Added `decodeURIComponent()` for redirect |

## Testing Flow (Two Browsers)

### Quick Match (Human vs Human)
```
Browser A: Click "Quick Match (Trivia)" → token saved → navigated to tournament
Browser A: Copy invite URL from tournament page
Browser B (incognito): Paste URL → redirected to login
Browser B: Click "Continue as Guest" → redirected to tournament
Browser B: Click "Join Tournament"
Browser A: See 2/2 players → click "Start Tournament"
Both: Click match in bracket → MatchPage opens → socket connects → 3-2-1 → play
```

### Play vs Bot
```
Click "Play vs Bot (Trivia)" → tournament + match created → navigated to match page
Socket connects → bot auto-joins → game starts → bot answers in 2-7s → play through 5 questions
```

### Demo Tournament
```
Click "See Demo Tournament" → 4-player tournament pre-created with 3 bots
All matches pre-completed → bracket shows winner progression
No real-time socket interaction
```

## Critical Known Issues (Not Fixed)

- **Chat timestamps in UTC** — displayed in UTC, not IST. Frontend needs `toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })` in `ChatPanel.jsx`
- **Vite frontend dev server URL** — hardcoded in multiple places, should use env var

## Immediate Next Steps

1. **Restart backend** — `node src/app.js` (required for email domain fix to take effect)
2. Test Quick Match two-browser flow end-to-end
3. Test Play vs Bot flow for both Trivia and Quick Draw
4. Test Quick Draw timer, guess attempts (5 max), and time-up scenarios
5. Verify demo tournament shows completed bracket without errors
