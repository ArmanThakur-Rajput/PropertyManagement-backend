import express from 'express';
import {
  captureLead,
  saveStep,
  getMyListings,
  getListingById,
  submitListing,
  removeListing,
  getAllSubmissions,
  updateListingStatus,
} from '../controllers/userListingController.js';
import { protect, adminOnly, managementPlus } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate-limit lead capture to prevent spam (20 per 15 min per IP)
const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many requests. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Public / semi-public (no auth required for owner actions) ─────────────────
// We identify owners by phone number, not JWT, matching the existing auth flow.
// The frontend stores the listingId in localStorage after captureLead.

// Phase 1 — lead capture (or resume existing draft)
router.post('/lead', leadLimiter, captureLead);

// Phase 2 — step auto-save
router.patch('/:id/step', saveStep);

// Owner views
router.get('/my/:phone', getMyListings);
router.get('/:id', getListingById);

// Owner actions
router.post('/:id/submit', submitListing);
router.delete('/:id', removeListing);

// ── Admin routes ──────────────────────────────────────────────────────────────
// All submissions queue
router.get('/', ...managementPlus, getAllSubmissions);

// Approve / reject
router.patch('/:id/status', ...managementPlus, updateListingStatus);

export default router;
