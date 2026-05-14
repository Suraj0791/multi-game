import pg from "pg";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
const databaseSsl =
  (process.env.DATABASE_SSL ?? "true").toLowerCase() !== "false";

export const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: databaseSsl ? { rejectUnauthorized: false } : undefined,
    })
  : null;

export async function query(text, params) {
  if (!pool) {
    throw new Error(
      "DATABASE_URL is not set. Create backend/.env and set DATABASE_URL from Neon."
    );
  }

  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  // Log slow queries (>100ms) for optimization
  if (duration > 100) {
    console.warn(`⚠️ SLOW QUERY [${duration}ms]: ${text.substring(0, 80)}...`);
  }

  return result;
}
