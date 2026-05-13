// Centralized error handling middleware
// This catches ALL errors thrown anywhere in the app
// Instead of try-catch in every controller, errors bubble up to HERE

export function errorHandler(err, req, res, next) {
  // Log every error for debugging
  console.error(`❌ [${req.method} ${req.path}]`, err.message);

  // If it's our custom AppError, use its status code
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
  }

  // If it's an unexpected error (bug, DB crash, etc.), return generic 500
  // Don't leak internal error details to the client
  console.error('Unexpected Error Stack:', err.stack);
  return res.status(500).json({
    success: false,
    error: 'Something went wrong. Please try again.'
  });
}

// Wrap async route handlers so they don't need try-catch
// Instead of:  router.get('/', async (req, res) => { try { ... } catch { ... } })
// Now use:     router.get('/', asyncHandler(myController))
// If myController throws, the error automatically goes to errorHandler above
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
