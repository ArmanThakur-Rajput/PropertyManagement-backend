import express from 'express';
import {
  captureLead,
  createListing,
  saveStep,
  getMyListings,
  getListingById,
  submitListing,
  removeListing,
  getAllSubmissions,
  updateListingStatus,
  updateListingFields,
} from '../controllers/userListingController.js';
import { protect, adminOnly, managementPlus } from '../middleware/auth.js';
import { listingCreateLimiter, listingSubmitLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Lead capture and listing creation retain their existing 20/15min protection.
const leadLimiter = listingCreateLimiter;


// ── Public / semi-public (no auth required for owner actions) ─────────────────
// We identify owners by phone number, not JWT, matching the existing auth flow.
// The frontend stores the listingId in localStorage after captureLead.

// Phase 1 — lead capture (or resume existing draft)
router.post('/lead', leadLimiter, captureLead);

// Force-create new draft (Post New Ad — never resumes existing)
router.post('/create', leadLimiter, createListing);

// Phase 2 — step auto-save
router.patch('/:id/step', saveStep);

// Owner views
router.get('/my/:phone', getMyListings);
router.get('/:id', getListingById);

// Owner actions
router.post('/:id/submit', listingSubmitLimiter, submitListing);
router.delete('/:id', removeListing);

// ── Admin routes ──────────────────────────────────────────────────────────────
// All submissions queue
router.get('/', ...managementPlus, getAllSubmissions);

// Approve / reject
router.patch('/:id/status', ...managementPlus, updateListingStatus);

// Admin edit — fix/fill listing fields (locality, coordinates, etc.)
// from the review drawer before verifying.
router.put('/:id', ...managementPlus, updateListingFields);

export default router;
