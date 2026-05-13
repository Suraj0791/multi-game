import { Router } from 'express';
import express from 'express';
import { webhookHandler } from '../controllers/paymentController.js';

const router = Router();

// Razorpay calls this endpoint after a payment is captured
// 
// WHY express.raw()? 
// Signature verification needs the EXACT bytes Razorpay sent.
// If express.json() parses it first, the raw bytes are gone — signature won't match.
// express.raw() keeps the body as a Buffer (raw bytes), not a JS object.
//
// WHY no authenticate middleware?
// Razorpay's servers are calling us, not a logged-in user.
// They don't have a JWT token. Instead, they prove identity via signature.
router.post(
  '/razorpay',
  express.raw({ type: 'application/json' }),
  webhookHandler
);

export default router;
