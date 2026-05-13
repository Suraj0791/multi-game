import { Router } from 'express';
import { register, login } from '../controllers/authController.js';
import { validate, registerRules, loginRules } from '../middleware/validate.middleware.js';

const router = Router();

// validate() runs BEFORE the controller
// If validation fails → 400 with error messages, controller never runs
// If validation passes → next() → controller runs
router.post('/register', validate(registerRules), register);
router.post('/login', validate(loginRules), login);

export default router;
