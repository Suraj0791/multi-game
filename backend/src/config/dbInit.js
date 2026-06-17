import { query } from './database.js';

/**
 * Runs database migrations to ensure users table has is_guest and last_login columns.
 */
export async function runMigrations() {
  console.log('🔄 Running database migrations...');
  try {
    // Add is_guest column if not exists
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE
    `);

    // Add last_login column if not exists
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    // Add performance indexes to fix full-table scans
    await query(`CREATE INDEX IF NOT EXISTS idx_users_elo_rating ON users(elo_rating DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_matches_round ON matches(tournament_id, round_number, match_number)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_tournament_players_tournament ON tournament_players(tournament_id)`);

    console.log('✅ Database migrations completed successfully.');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
  }
}

/**
 * Deletes guest users and all their dependencies if their last login was more than 24 hours ago.
 */
export async function cleanupExpiredGuests() {
  console.log('🧹 Starting guest accounts cleanup...');
  try {
    // 1. Identify guests that logged in more than 24 hours ago
    const guestsRes = await query(`
      SELECT id FROM users 
      WHERE is_guest = TRUE 
        AND last_login < NOW() - INTERVAL '24 hours'
    `);

    const guestIds = guestsRes.rows.map(row => row.id);
    if (guestIds.length === 0) {
      console.log('🧹 No expired guest accounts found.');
      return;
    }

    console.log(`🧹 Found ${guestIds.length} expired guest accounts. Deleting related records...`);

    // 2. Delete dependencies in bulk to avoid foreign key violations
    // We execute these inside a transaction
    await query('BEGIN');
    
    // Chat messages
    await query('DELETE FROM chat_messages WHERE user_id = ANY($1)', [guestIds]);
    
    // Notifications
    await query('DELETE FROM notifications WHERE user_id = ANY($1)', [guestIds]);
    
    // Rating history
    await query('DELETE FROM rating_history WHERE user_id = ANY($1)', [guestIds]);
    
    // Payments
    await query('DELETE FROM payments WHERE user_id = ANY($1)', [guestIds]);
    
    // Reports (both reporter and reported)
    await query('DELETE FROM reports WHERE reporter_id = ANY($1) OR reported_user_id = ANY($1)', [guestIds]);
    
    // Blocked users (both blocker and blocked)
    await query('DELETE FROM blocked_users WHERE blocker_id = ANY($1) OR blocked_user_id = ANY($1)', [guestIds]);
    
    // Tournament registrations (where the guest is a player)
    await query('DELETE FROM tournament_players WHERE player_id = ANY($1)', [guestIds]);
    
    // Matches where guest was player 1, player 2, or winner
    await query('DELETE FROM matches WHERE player_1_id = ANY($1) OR player_2_id = ANY($1) OR winner_id = ANY($1)', [guestIds]);
    
    // CRITICAL FIX: If the guest HOSTED a tournament, we must delete all players and matches in that tournament BEFORE deleting the tournament
    await query('DELETE FROM tournament_players WHERE tournament_id IN (SELECT id FROM tournaments WHERE host_id = ANY($1))', [guestIds]);
    await query('DELETE FROM matches WHERE tournament_id IN (SELECT id FROM tournaments WHERE host_id = ANY($1))', [guestIds]);
    
    // NOW we can safely delete tournaments hosted by the guest
    await query('DELETE FROM tournaments WHERE host_id = ANY($1)', [guestIds]);

    // 3. Delete the users themselves
    const deleteUsersRes = await query('DELETE FROM users WHERE id = ANY($1)', [guestIds]);
    
    await query('COMMIT');
    console.log(`✅ Successfully cleaned up ${deleteUsersRes.rowCount} expired guest accounts.`);
  } catch (error) {
    await query('ROLLBACK');
    console.error('❌ Failed to clean up guest users:', error);
  }
}

/**
 * Initializes the database migrations and sets up periodic cleanup tasks.
 */
export async function initDatabase() {
  await runMigrations();
  // Run initial cleanup on startup
  await cleanupExpiredGuests();
  // Schedule cleanup to run every 6 hours
  setInterval(cleanupExpiredGuests, 6 * 60 * 60 * 1000);
}
