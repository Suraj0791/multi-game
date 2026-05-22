# 🎮 TourneyHub (Multi-Game Platform)

A real-time multiplayer gaming and tournament platform built with a modern web stack. Players can join tournaments, compete in live head-to-head games, climb the leaderboards, and chat in real-time.

## ✨ Features

### 🎮 Real-Time Multiplayer Games
- **Low-Latency Gameplay:** Powered by WebSocket connections via Socket.io for instant interactions.
- **🧠 Trivia Battles:** Fast-paced, synchronous trivia where players answer questions simultaneously. Includes automated timeouts, round progression, and correct-answer revealing. *(Read the in-depth architecture breakdown in [TRIVIA_ENGINE_DEEP_DIVE.md](file:///e:/BACKEND/multi-game/AI_CONTEXT/TRIVIA_ENGINE_DEEP_DIVE.md))*
- **✏️ Quick Draw:** A Pictionary-style game where one player draws on a shared HTML Canvas in real-time, and the other player attempts to guess the secret word before time runs out. *(Read the in-depth architecture breakdown in [QUICKDRAW_ENGINE_DEEP_DIVE.md](file:///e:/BACKEND/multi-game/AI_CONTEXT/QUICKDRAW_ENGINE_DEEP_DIVE.md))*

### 🏆 Tournament System
- **Create & Manage:** Users can host their own tournaments, setting the game type (Trivia or Quick Draw), entry fees, and max player limits (2, 4, 8, or 16).
- **Auto-Generated Brackets:** When a tournament fills up, the system automatically generates a single-elimination tournament bracket, matching players up in sequential rounds.
- **Match Progress:** As players win matches, the bracket visually updates and automatically advances winners to the next round until a champion is crowned.

### 💬 Live Chat & Social
- **Global Chat Lobby:** A global chat room for all users to hang out and find opponents.
- **Match Chat:** Private, isolated chat rooms for players currently facing off in a match.
- **Spectator Mode:** Users can join in-progress matches as spectators to watch the gameplay and chat with the players.

### 📈 Competitive Ranking
- **ELO Rating System:** Players gain or lose ELO points based on match outcomes, rewarding consistent performance and skill.
- **Global Leaderboard:** A dynamic leaderboard showcasing the top players, their total wins, losses, and current rank.

### 🔐 Security & Authentication
- **Guest Mode:** Frictionless onboarding using one-click guest login so users can play instantly.
- **JWT Auth:** Secure, token-based authentication for permanent accounts.
- **Rate Limiting & Security:** Built with Express Rate Limit and Helmet to prevent abuse and ensure stable server performance.

### ⚙️ Backend & Frontend Architecture Deep Dives
- **Robust Backend Systems Design:** Features PostgreSQL connection pooling, database startup migrations, lazy initialization of payments, and an automated transaction-isolated 24-hour guest cleanup sweeper. *(Read the in-depth backend architecture breakdown in [BACKEND_ENGINE_DEEP_DIVE.md](file:///e:/BACKEND/multi-game/AI_CONTEXT/BACKEND_ENGINE_DEEP_DIVE.md))*
- **Stateful Client-Side Architecture:** Powered by a lazy-initialized module-level Socket.io singleton, Zustand token state preservation, coordinate-scaled Pictionary Canvas, and connected SVG tournament brackets. *(Read the in-depth frontend architecture breakdown in [FRONTEND_ENGINE_DEEP_DIVE.md](file:///e:/BACKEND/multi-game/AI_CONTEXT/FRONTEND_ENGINE_DEEP_DIVE.md))*

## 🚀 Tech Stack

**Frontend**
- **Framework:** React (Vite)
- **Styling:** Tailwind CSS & shadcn/ui
- **State Management:** Zustand (Auth) & React Query (Data Fetching/Caching)
- **Routing:** React Router v6

**Backend**
- **Framework:** Node.js & Express
- **Real-time:** Socket.io
- **Database:** PostgreSQL (Neon DB) & `pg` driver
- **Security:** Helmet, CORS, Express Rate Limit, JWT

## 📦 Local Development Setup

### 1. Prerequisites
- Node.js (v18+ recommended)
- A PostgreSQL database (e.g., Neon DB)

### 2. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the `backend` directory:
```env
PORT=3000
DATABASE_URL=postgres://your-neon-db-url
JWT_SECRET=your_super_secret_jwt_key
```
Start the backend development server:
```bash
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```
Create a `.env` file in the `frontend` directory:
```env
VITE_API_URL=http://localhost:3000
```
Start the frontend development server:
```bash
npm run dev
```

## 🏗️ Deployment

This repository is structured as a monorepo, optimized for separated deployments:

- **Frontend:** Optimized for [Vercel](https://vercel.com). Just connect your GitHub repo, select the `frontend` framework preset as Vite, and set the Root Directory to `frontend`.
- **Backend:** Optimized for [Render](https://render.com) or Heroku. Connect your repo, set the Root Directory to `backend`, Build Command to `npm install`, and Start Command to `node server.js`. Add your environment variables in the Render dashboard.

## 📝 License
MIT License
