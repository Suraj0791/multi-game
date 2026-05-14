import Razorpay from 'razorpay';
import crypto from 'crypto';
import { createPaymentOrder, findByRazorpayOrderId, findSucceededPayment, markPaymentSucceeded } from '../models/Payment.js';
import { getTournamentById } from '../models/Tournament.js';
import { updatePlayerPaymentStatus } from '../models/TournamentPlayer.js';

// Lazy initialization — only creates Razorpay instance when actually needed
// This prevents the app from crashing if keys aren't set (e.g., during tests)
let razorpay = null;
function getRazorpay() {
  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
  return razorpay;
}

// ============================================================
// FUNCTION 1: createOrder
// Called by: YOUR frontend → POST /tournaments/:id/pay
// Flow: Guard → Call Razorpay → Save PENDING → Return order details
// ============================================================
export async function createOrder(userId, tournamentId) {

  // GUARD — does the tournament exist?
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) throw new Error('Tournament not found');

  // GUARD — is there actually a fee?
  if (tournament.entry_fee <= 0) throw new Error('This tournament is free. No payment needed.');

  // GUARD — has this user already paid? (prevents double-paying)
  const alreadyPaid = await findSucceededPayment(userId, tournamentId);
  if (alreadyPaid) throw new Error('You have already paid for this tournament');

  // LOGIC — ask Razorpay to create an order
  // amount is in PAISE (₹200 = 20000 paise), Razorpay requires paise
  const order = await getRazorpay().orders.create({
    amount: tournament.entry_fee * 100,
    currency: 'INR',
    receipt: `tourney_${tournamentId}_user_${userId}`,
    // notes get attached to the payment — you can read them in the webhook
    notes: { userId: String(userId), tournamentId: String(tournamentId) }
  });

  // PERSIST — save PENDING payment to our database
  await createPaymentOrder(userId, tournamentId, tournament.entry_fee, order.id);

  // RETURN — frontend needs these 4 things to open Razorpay checkout popup
  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID
  };
}

// ============================================================
// FUNCTION 2: handleWebhook
// Called by: RAZORPAY'S SERVERS → POST /webhooks/razorpay
// Flow: Verify signature → Check idempotency → Update DB → Return 200
// ============================================================
export async function handleWebhook(rawBody, signature) {

  // 1. VERIFY — prove this request is actually from Razorpay, not a hacker
  //    Razorpay signs the body with your webhook secret.
  //    We recreate that signature. If they match → legit. If not → fraud.
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== signature) {
    throw new Error('Invalid webhook signature');
  }

  // 2. PARSE — the raw body is a string, parse it to read the event
  const event = JSON.parse(rawBody);

  // 3. FILTER — Razorpay sends many event types (payment.failed, refund.created, etc.)
  //    We only care about "payment.captured" (money successfully taken)
  if (event.event !== 'payment.captured') {
    return { received: true };  // acknowledge but do nothing
  }

  // 4. Extract the payment details from Razorpay's event structure
  const paymentEntity = event.payload.payment.entity;
  const razorpayOrderId = paymentEntity.order_id;
  const razorpayPaymentId = paymentEntity.id;

  // 5. IDEMPOTENCY — has this payment already been processed?
  //    Razorpay might call this webhook TWICE (network retry).
  //    We check: is this order in our DB? Is it already SUCCEEDED?
  const payment = await findByRazorpayOrderId(razorpayOrderId);
  if (!payment) return { received: true };                    // unknown order, ignore
  if (payment.status === 'SUCCESS') return { received: true };  // already done, skip

  // 6. PERSIST — everything checks out, update the database
  //    Mark payment as SUCCEEDED
  await markPaymentSucceeded(razorpayOrderId, razorpayPaymentId);
  //    Mark the player as officially paid in the tournament
  await updatePlayerPaymentStatus(payment.tournament_id, payment.user_id, 'COMPLETED');

  return { received: true };
}
