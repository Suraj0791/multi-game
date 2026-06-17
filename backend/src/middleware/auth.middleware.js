import jwt from 'jsonwebtoken';
import { findById } from '../models/User.js';

export async function authenticate(req, res, next) {
  // Step 1: Get token from header
  // Frontend sends: "Authorization: Bearer eyJhbG..."
  // We split on space and take the second part (the actual token)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Step 2: Verify token — jwt.verify is the OPPOSITE of jwt.sign
    // jwt.sign() CREATES a token → jwt.verify() READS and VALIDATES it
    // If the token was tampered with or expired, this throws an error
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Step 2.5: Verify user actually still exists in database
    const user = await findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    // Step 3: Attach user data to request — now every controller can use req.user
    req.user = { userId: decoded.userId, isGuest: user.is_guest };

    // Step 4: Pass to next handler (the controller)
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
