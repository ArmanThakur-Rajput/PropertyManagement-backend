import express from 'express';
import rateLimit from 'express-rate-limit';
import { handleChat } from '../controllers/chatController.js';

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

router.post('/', chatLimiter, handleChat);

export default router;
