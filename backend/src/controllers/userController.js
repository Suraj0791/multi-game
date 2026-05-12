import { registerUser } from '../services/userService.js';

export async function register(req, res) {
  try {
    const { username, email, password } = req.body;

    const result = await registerUser(username, email, password);

    res.status(201).json({
      userId: result.userId,
      token: result.token,
      message: 'User registered'
    });
  } catch (error) {
    res.status(400).json({
      error: error.message    // "Email already exists" or whatever went wrong
    });
  }
}


