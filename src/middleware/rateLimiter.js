import rateLimit from 'express-rate-limit';

const limiterMessage = (message) => ({
  success: false,
  message,
});

// Light protection for every API endpoint. Route-specific limiters below are
// stricter for expensive or abuse-prone actions.
export const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: limiterMessage('Too many requests. Please try again after 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
});

// Authentication has no password flow on the public phone-login endpoint, so
// keep this endpoint stricter than the general API limit.
export const signInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: limiterMessage('Too many sign-in attempts. Please try again after 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: limiterMessage('Too many OTP requests. Please try again after 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: limiterMessage('Too many OTP verification attempts. Please try again after 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

// Uploads are authenticated but expensive because they consume memory and
// send data to R2. Keep single and bulk uploads under separate limits.
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: limiterMessage('Too many uploads. Please try again after 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

export const bulkUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: limiterMessage('Too many bulk uploads. Please try again after 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

// Listing creation/submission can create DB work and/or trigger moderation
// workflows, so keep these actions stricter than ordinary reads.
export const listingCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: limiterMessage('Too many listing creation requests. Please try again after 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

export const listingSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: limiterMessage('Too many listing submission requests. Please try again after 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});
