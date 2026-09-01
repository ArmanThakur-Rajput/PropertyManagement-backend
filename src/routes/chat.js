import express from 'express';
import rateLimit from 'express-rate-limit';
import { handleChat } from '../controllers/chatController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Rate limit the AI chat endpoint — it proxies to an expensive external API (NVIDIA).
// Allow 10 requests per IP per minute to prevent abuse.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many chat requests. Please wait a moment before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// protect ensures only logged-in users can consume the paid NVIDIA API
router.post('/', chatLimiter, protect, handleChat);

export default router;
