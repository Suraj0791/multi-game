import { registerUser ,loginUser, guestLogin as guestLoginService } from '../services/userService.js';

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


export async function guestLogin(req, res) {
  try {
    const result = await guestLoginService();
    res.status(201).json({
      userId: result.userId,
      token: result.token,
      username: result.username,
      message: 'Guest login successful'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    const result = await loginUser(email, password);

    res.status(200).json({       // 200 not 201 — login doesn't CREATE anything
      userId: result.userId,
      token: result.token,
      message: 'Login successful'
    });
  } catch (error) {
    res.status(401).json({       // 401 = Unauthorized (bad credentials)
      error: error.message
    });
  }
}
