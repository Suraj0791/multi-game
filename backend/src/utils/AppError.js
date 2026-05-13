// Custom error class that carries a status code
// Instead of: throw new Error('Not found')           ← no status code
// Now use:    throw new AppError('Not found', 404)    ← error KNOWS its status

export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);         // sets this.message
    this.statusCode = statusCode;
    this.isOperational = true;  // distinguishes expected errors from bugs
  }
}

// Common error factories — convenience functions so you don't repeat status codes
export const notFound = (thing) => new AppError(`${thing} not found`, 404);
export const unauthorized = (msg = 'Unauthorized') => new AppError(msg, 401);
export const forbidden = (msg = 'Forbidden') => new AppError(msg, 403);
export const conflict = (msg) => new AppError(msg, 409);
export const badRequest = (msg) => new AppError(msg, 400);
