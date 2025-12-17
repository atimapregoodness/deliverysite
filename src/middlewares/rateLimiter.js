// middlewares/rateLimiter.js
import rateLimit from "express-rate-limit";

/**
 * Create rate limiter instance
 */
const createLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options.max || 100, // limit each IP to 100 requests per windowMs
    message: {
      status: "error",
      message: options.message || "Too many requests, please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    ...options,
  });
};

/**
 * Different rate limiters for different scenarios
 */

// General API rate limiter
export const generalRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes
  message:
    "Too many API requests from this IP, please try again after 15 minutes.",
});

// Strict rate limiter for sensitive routes
export const strictRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per 15 minutes
  message: "Too many attempts from this IP, please try again after 15 minutes.",
});

// Auth rate limiter (login, register, password reset)
export const authRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 auth attempts per 15 minutes
  message:
    "Too many authentication attempts, please try again after 15 minutes.",
});

// Payment rate limiter
export const paymentRateLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 payment attempts per hour
  message: "Too many payment attempts, please try again after an hour.",
});

// OTP/Verification rate limiter
export const otpRateLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 OTP requests per 5 minutes
  message: "Too many OTP requests, please try again after 5 minutes.",
});

// File upload rate limiter
export const uploadRateLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 file uploads per hour
  message: "Too many file uploads, please try again after an hour.",
});

// Default export (general rate limiter)
const rateLimiter = generalRateLimiter;

export default rateLimiter;
