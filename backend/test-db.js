import dotenv from "dotenv";
dotenv.config({ path: "e:\\BACKEND\\multi-game\\backend\\.env" });
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runTest() {
  console.log("Connecting to Neon Database...");
  
  // 1. First query to "warm up" the database connection (pay the TLS/Cold Start penalty)
  const t0 = Date.now();
  await pool.query("SELECT 1");
  console.log(`Warmup query (Network + DB + TLS): ${Date.now() - t0}ms\n`);

  // 2. The slow query we saw in the logs
  const queryText = `
    SELECT m.*, u1.email AS player_1_email, u2.email AS player_2_email
    FROM matches m
    LEFT JOIN users u1 ON m.player_1_id = u1.id
    LEFT JOIN users u2 ON m.player_2_id = u2.id
    WHERE m.id = 1
  `;

  // 3. Measure Node.js perceived time (Network + DB)
  const t1 = Date.now();
  await pool.query(queryText);
  const nodeDuration = Date.now() - t1;

  // 4. Ask Postgres how long IT actually took (Execution Time)
  const explainResult = await pool.query("EXPLAIN ANALYZE " + queryText);
  const explainOutput = explainResult.rows.map(r => Object.values(r)[0]).join('\n');
  
  // Extract Execution Time from explain output
  const executionMatch = explainOutput.match(/Execution Time: (\d+\.\d+) ms/);
  const dbDuration = executionMatch ? executionMatch[1] : "Unknown";

  console.log("=== RESULTS ===");
  console.log(`Node.js Perceived Time (What you see in logs): ${nodeDuration} ms`);
  console.log(`Actual DB Execution Time (What Postgres reports): ${dbDuration} ms`);
  console.log(`Network Overhead / Travel Time: ~${(nodeDuration - parseFloat(dbDuration)).toFixed(2)} ms`);
  
  console.log("\n--- Full EXPLAIN ANALYZE ---");
  console.log(explainOutput);

  await pool.end();
}

runTest().catch(console.error);
