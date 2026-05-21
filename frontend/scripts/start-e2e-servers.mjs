import { spawn } from "node:child_process";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..", "..");
const backendDir = path.resolve(repoRoot, "backend");
const frontendDir = path.resolve(repoRoot, "frontend");

const FRONTEND_URL = process.env.E2E_FRONTEND_URL || "http://localhost:5173";
const BACKEND_URL = process.env.E2E_BACKEND_URL || "http://localhost:3000";

function spawnLogged(command, args, { cwd, env, name }) {
  const child = spawn(command, args, {
    cwd,
    env,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (d) => process.stdout.write(`[${name}] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[${name}] ${d}`));

  return child;
}

async function waitForUrl(url, timeoutMs) {
  const start = Date.now();
  // Node 18+ has fetch globally
  while (true) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch {
      // ignore
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${url}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function main() {
  console.log("[e2e] Seeding database...");
  const seed = spawnLogged("node", ["seed.js"], {
    cwd: backendDir,
    env: { ...process.env },
    name: "seed",
  });

  const seedExitCode = await new Promise((resolve) => seed.on("exit", resolve));
  if (seedExitCode !== 0) {
    process.exit(seedExitCode ?? 1);
  }

  console.log("[e2e] Starting backend...");
  const backend = spawnLogged("node", ["server.js"], {
    cwd: backendDir,
    env: { ...process.env, PORT: process.env.PORT || "3000" },
    name: "backend",
  });

  /** @type {import('node:child_process').ChildProcess | null} */
  let frontend = null;

  const killAll = () => {
    backend.kill("SIGTERM");
    frontend?.kill("SIGTERM");
  };
  process.on("SIGINT", killAll);
  process.on("SIGTERM", killAll);
  process.on("exit", killAll);

  await waitForUrl(`${BACKEND_URL}/health`, 60_000);

  console.log("[e2e] Starting frontend (Vite)...");
  frontend = spawnLogged(
    "npm",
    ["run", "dev", "--", "--port", "5173", "--strictPort"],
    {
      cwd: frontendDir,
      env: {
        ...process.env,
        VITE_API_URL: process.env.VITE_API_URL || "http://localhost:3000",
      },
      name: "frontend",
    }
  );

  await waitForUrl(FRONTEND_URL, 60_000);

  console.log("[e2e] Servers are up. Handing off to Playwright.");

  // Keep process alive until Playwright stops it
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("[e2e] Failed to start servers:", err);
  process.exit(1);
});
