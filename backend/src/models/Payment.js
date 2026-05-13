import { query } from '../config/database.js';



// Create a pending payment order when the user clicks "Join"
export async function createPaymentOrder(userId, tournamentId, amount, razorpayOrderId) {
  const result = await query(
    `INSERT INTO payments (user_id, tournament_id, amount, razorpay_order_id, status)
     VALUES ($1, $2, $3, $4, 'PENDING')
     RETURNING *`,
    [userId, tournamentId, amount, razorpayOrderId]
  );
  return result.rows[0];
}

// Update the payment status when Razorpay confirms it succeeded
export async function updatePaymentSuccess(razorpayOrderId, razorpayPaymentId) {
  const result = await query(
    `UPDATE payments
     SET status = 'SUCCESS', razorpay_payment_id = $2
     WHERE razorpay_order_id = $1
     RETURNING *`,
    [razorpayOrderId, razorpayPaymentId]
  );
  return result.rows[0];
}
