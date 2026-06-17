import { createOrder as createPaymentOrder, handleWebhook } from '../services/paymentService.js';

// Controller 1: User clicks "Pay" → frontend calls this
// Route: POST /tournaments/:id/pay (auth required)
export async function createOrder(req, res) {
  try {
    const tournamentId = req.params.id;
    const userId = req.user.userId;
    const isGuest = req.user.isGuest;

    if (isGuest) {
      return res.status(403).json({ error: "Guest accounts cannot participate in paid tournaments. Please register a free account." });
    }

    // Service handles all guards (tournament exists, has fee, not already paid)
    const result = await createPaymentOrder(userId, tournamentId);

    // Send order details to frontend so it can open Razorpay popup
    res.status(200).json(result);
  } catch (error) {
    console.error('Payment Order Error:', error.message);
    res.status(400).json({ error: error.message });
  }
}

// Controller 2: Razorpay's servers call this after payment is captured
// Route: POST /webhooks/razorpay (NO auth — Razorpay can't send JWT!)
export async function webhookHandler(req, res) {
  try {
    // req.body is a Buffer (raw bytes) because we used express.raw()
    // Convert to string for signature verification
    const rawBody = req.body.toString();
    const signature = req.headers['x-razorpay-signature'];

    const result = await handleWebhook(rawBody, signature);

    // ALWAYS return 200 to Razorpay
    // If we return 400/500, Razorpay thinks it failed and keeps retrying
    res.status(200).json(result);
  } catch (error) {
    console.error('Webhook Error:', error.message);
    // Even on error, return 200 to stop Razorpay from retrying endlessly
    res.status(200).json({ received: true });
  }
}
