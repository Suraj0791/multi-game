// Input validation middleware factory
// Creates a middleware that validates req.body against rules you define
//
// USAGE:
//   router.post('/register', validate(registerRules), registerController);
//
// If validation fails → responds with 400 + clear error messages
// If validation passes → calls next() → request continues to controller

import { AppError } from '../utils/AppError.js';

// The middleware factory — takes an array of field rules, returns middleware
export function validate(rules) {
  return (req, res, next) => {
    const errors = [];

    for (const rule of rules) {
      const value = req.body[rule.field];

      // Required check
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${rule.field} is required`);
        continue; // skip other checks if missing
      }

      // Skip further validation if field is optional and not provided
      if (value === undefined || value === null) continue;

      // Type check
      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push(`${rule.field} must be a string`);
        continue;
      }
      if (rule.type === 'number' && typeof value !== 'number') {
        errors.push(`${rule.field} must be a number`);
        continue;
      }

      // String-specific validations
      if (typeof value === 'string') {
        if (rule.minLength && value.trim().length < rule.minLength) {
          errors.push(`${rule.field} must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength && value.trim().length > rule.maxLength) {
          errors.push(`${rule.field} must be at most ${rule.maxLength} characters`);
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(rule.patternMsg || `${rule.field} format is invalid`);
        }
      }

      // Number-specific validations
      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${rule.field} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${rule.field} must be at most ${rule.max}`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: errors
      });
    }

    next();
  };
}

// ============================================================
// Pre-built validation rules for each endpoint
// ============================================================

export const registerRules = [
  { field: 'username', required: true, type: 'string', minLength: 3, maxLength: 30 },
  {
    field: 'email', required: true, type: 'string',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    patternMsg: 'email must be a valid email address'
  },
  { field: 'password', required: true, type: 'string', minLength: 6, maxLength: 100 }
];

export const loginRules = [
  { field: 'email', required: true, type: 'string' },
  { field: 'password', required: true, type: 'string' }
];

export const createTournamentRules = [
  { field: 'name', required: true, type: 'string', minLength: 3, maxLength: 100 },
  { field: 'game_type', required: true, type: 'string' },
  { field: 'max_players', required: true, type: 'number', min: 2, max: 64 },
  { field: 'entry_fee', required: false, type: 'number', min: 0 }
];
