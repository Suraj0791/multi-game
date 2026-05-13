import Razorpay from 'razorpay';
import crypto from 'crypto';
import { createPaymentOrder, updatePaymentSuccess } from '../models/Payment.js';
import { updatePlayerPaymentStatus } from '../models/TournamentPlayer.js'; 

// Initialize Razorpay with test keys
// In production, NEVER hardcode these. They go in your .env file!
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_123456789',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret_123456789'
});

// Step 1: Tell Razorpay we want to collect money
export async function initiatePayment(userId, tournamentId, amount) {
  const options = {
    amount: amount * 100, // Razorpay works in Paise (100 Paise = ₹1). ₹50 = 5000 paise.
    currency: "INR",
    receipt: `receipt_tourney_${tournamentId}_user_${userId}`
  };

  // Ask Razorpay for an Order ID
  const order = await razorpay.orders.create(options);

  // Save the pending order to our Database
  await createPaymentOrder(userId, tournamentId, amount, order.id);

  // Return the order to the Controller (so the frontend can pop up the UI)
  return order;
}

// Step 2: Verify the payment actually succeeded (Security Check)
export async function verifyPayment(userId, tournamentId, razorpayOrderId, razorpayPaymentId, signature) {
  
  // 1. Recreate the signature using our secret key
  const body = razorpayOrderId + "|" + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || 'secret_123456789')
    .update(body.toString())
    .digest("hex");

  // 2. If signatures don't match, someone is trying to hack us and get in for free!
  if (expectedSignature !== signature) {
    throw new Error("Invalid payment signature! Potential fraud attempt.");
  }

  // 3. Signature is valid! Update the Payments table
  await updatePaymentSuccess(razorpayOrderId, razorpayPaymentId);

  // 4. Update the Tournament_Players table so they are officially in the bracket!
  await updatePlayerPaymentStatus(tournamentId, userId, 'COMPLETED');
  
  return { success: true, message: "Payment verified successfully" };
}
