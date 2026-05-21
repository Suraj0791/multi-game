import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './src/config/database.js';

async function seed() {
  console.log('🌱 Starting database seeding...');

  if (!pool) {
    console.error('❌ Database connection pool is not configured. Check your DATABASE_URL in .env');
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    // Start a transaction to ensure all seed operations succeed or fail together
    await client.query('BEGIN');

    // 0. Automatically create tables if they do not exist
    console.log('🔧 Creating any missing database tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        related_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rating_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        rating_change INTEGER NOT NULL,
        new_rating INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        razorpay_order_id VARCHAR(255) NOT NULL UNIQUE,
        razorpay_payment_id VARCHAR(255),
        status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reported_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        id SERIAL PRIMARY KEY,
        blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (blocker_id, blocked_user_id)
      )
    `);

    // 1. Clean up old data
    // Query the database to find which tables actually exist in the public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const existingTables = tablesRes.rows.map(r => r.table_name);

    const tablesToTruncate = [
      'chat_messages',
      'notifications',
      'reports',
      'blocked_users',
      'rating_history',
      'payments',
      'matches',
      'tournament_players',
      'tournaments',
      'users'
    ].filter(t => existingTables.includes(t));

    if (tablesToTruncate.length > 0) {
      console.log(`🧹 Clearing old data (truncating: ${tablesToTruncate.join(', ')})...`);
      await client.query(`TRUNCATE TABLE ${tablesToTruncate.join(', ')} CASCADE`);
    } else {
      console.log('🧹 No tables exist yet to clear.');
    }

    // 2. Hash password for test users
    console.log('🔑 Hashing password for test players...');
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 3. Insert 8 players
    console.log('👤 Inserting 8 test players...');
    const users = [];
    for (let i = 1; i <= 8; i++) {
      const username = `player${i}`;
      const email = `player${i}@test.com`;
      const res = await client.query(
        `INSERT INTO users (username, email, password, elo_rating, total_wins, total_losses)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, username, email`,
        [username, email, hashedPassword, 1600, 0, 0]
      );
      users.push(res.rows[0]);
    }
    console.log(`✅ Successfully seeded 8 users: ${users.map(u => u.username).join(', ')}`);

    // 4. Create tournaments
    console.log('🏆 Creating sample tournaments...');
    
    // Trivia Tournament hosted by player1
    const triviaRes = await client.query(
      `INSERT INTO tournaments (name, game_type, host_id, max_players, entry_fee, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      ['Trivia Showdown Cup', 'TRIVIA', users[0].id, 8, 0, 'REGISTRATION']
    );
    const triviaTournament = triviaRes.rows[0];

    // Quick Draw Tournament hosted by player2
    const drawRes = await client.query(
      `INSERT INTO tournaments (name, game_type, host_id, max_players, entry_fee, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      ['Quick Draw Championship', 'QUICK_DRAW', users[1].id, 8, 0, 'REGISTRATION']
    );
    const drawTournament = drawRes.rows[0];

    console.log(`✅ Created "Trivia Showdown Cup" (ID: ${triviaTournament.id}) hosted by ${users[0].username}`);
    console.log(`✅ Created "Quick Draw Championship" (ID: ${drawTournament.id}) hosted by ${users[1].username}`);

    // 5. Register all 8 players into BOTH tournaments
    console.log('📝 Registering players into tournaments...');
    for (const user of users) {
      // Register in Trivia Tournament (marked as payment completed for simplicity)
      await client.query(
        `INSERT INTO tournament_players (tournament_id, player_id, payment_status, payment_amount)
         VALUES ($1, $2, $3, $4)`,
        [triviaTournament.id, user.id, 'COMPLETED', 0]
      );

      // Register in Quick Draw Tournament
      await client.query(
        `INSERT INTO tournament_players (tournament_id, player_id, payment_status, payment_amount)
         VALUES ($1, $2, $3, $4)`,
        [drawTournament.id, user.id, 'COMPLETED', 0]
      );
    }

    console.log('✅ Registered all 8 players in both tournaments.');

    await client.query('COMMIT');
    console.log('\n✨ Database seeding completed successfully!');
    console.log('\n🔐 Test Accounts (All use password: password123):');
    users.forEach(u => {
      console.log(`  - Username: ${u.username} (Email: ${u.email})`);
    });
    console.log('\n💡 Both tournaments are full (8/8 players) and ready to be started by their respective hosts!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed, rolled back changes:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
