import { query } from '../config/database.js';

// Function 1: Save a new PENDING payment when user starts checkout
// Accepts: userId, tournamentId, amount (in rupees), razorpayOrderId
// Returns: the full payment row
export async function createPaymentOrder(userId, tournamentId, amount, razorpayOrderId) {
  const result = await query(
    `INSERT INTO payments (user_id, tournament_id, amount, razorpay_order_id, status)
     VALUES ($1, $2, $3, $4, 'PENDING')
     RETURNING *`,
    [userId, tournamentId, amount, razorpayOrderId]
  );
  return result.rows[0];
}

// Function 2: Look up a payment by Razorpay's order ID
// Used in webhook for IDEMPOTENCY — "have I already processed this?"
// Accepts: razorpayOrderId
// Returns: payment row or undefined
export async function findByRazorpayOrderId(razorpayOrderId) {
  const result = await query(
    `SELECT * FROM payments WHERE razorpay_order_id = $1`,
    [razorpayOrderId]
  );
  return result.rows[0];
}

// Function 3: Check if a user already paid for a specific tournament
// Used as a GUARD — prevents double payment
// Accepts: userId, tournamentId
// Returns: payment row if found, undefined if not
export async function findSucceededPayment(userId, tournamentId) {
  const result = await query(
    `SELECT * FROM payments 
     WHERE user_id = $1 AND tournament_id = $2 AND status = 'SUCCEEDED'`,
    [userId, tournamentId]
  );
  return result.rows[0];
}

// Function 4: Mark a payment as SUCCEEDED after webhook confirms it
// Accepts: razorpayOrderId, razorpayPaymentId (Razorpay's actual payment ID)
// Returns: updated payment row
export async function markPaymentSucceeded(razorpayOrderId, razorpayPaymentId) {
  const result = await query(
    `UPDATE payments
     SET status = 'SUCCEEDED', razorpay_payment_id = $2
     WHERE razorpay_order_id = $1
     RETURNING *`,
    [razorpayOrderId, razorpayPaymentId]
  );
  return result.rows[0];
}
