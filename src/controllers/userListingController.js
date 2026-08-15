/**
 * userListingController.js
 *
 * Handles the "Post Free Property Ad" flow:
 *
 * PHASE 1 — Lead Capture
 *   POST /api/user-listings/lead
 *   → Creates a new 'draft' UserListing with owner info + propertyType + adType.
 *   → If the same phone already has an unfinished draft, returns that draft's ID
 *     instead of creating a new one (so user resumes from where they left off).
 *
 * PHASE 2 — Wizard Steps (auto-save per step)
 *   PATCH /api/user-listings/:id/step
 *   → Merges the current step's data into the draft.
 *
 * OWNER ACTIONS
 *   GET  /api/user-listings/my/:phone   → list all drafts/submissions for a phone
 *   GET  /api/user-listings/:id         → get single listing (for resume)
 *   POST /api/user-listings/:id/submit  → finalise & send for admin review
 *   DELETE /api/user-listings/:id       → soft-delete (mark removed)
 *
 * ADMIN ACTIONS
 *   GET    /api/user-listings            → all submitted listings (queue)
 *   PATCH  /api/user-listings/:id/status → approve / reject
 */

import UserListing from '../models/UserListing.js';
import Property from '../models/Property.js';
import { invalidateCache } from '../middleware/cache.js';

// Fields allowed in step patch (whitelist to prevent injecting status etc.)
const STEP_FIELDS = [
  'currentStep', 'completedSteps',
  'apartmentType', 'bhkType', 'ownershipType', 'floorType',
  'floor', 'totalFloor', 'propertyAge', 'facing',
  'area', 'carpetArea', 'furnishing',
  'pgRooms', 'roomType', 'tenantType',
  'commercialPropertyType', 'buildingType', 'otherFeatures',
  'plotLength', 'plotWidth', 'boundaryWall', 'cornerPlot',
  'floorsAllowed', 'gatedProject',
  'city', 'locality', 'society', 'flatNo', 'landmark',
  'price', 'deposit', 'pricePerSqft', 'maintenance', 'availableFrom',
  'preferredTenant', 'pgFood', 'pgGender', 'pgNotice', 'pgName',
  'loanAvailable', 'transactionType', 'underLoan',
  'balconies', 'bathrooms', 'parking', 'additionalNotes',
  'description', 'amenities',
  'images', 'videos',
  'visitTime', 'visitDays', 'scheduleNotes',
];

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — POST /api/user-listings/lead
// Creates a draft OR returns existing draft for the same phone.
// ─────────────────────────────────────────────────────────────────────────────
export const captureLead = async (req, res) => {
  try {
    const { ownerName, ownerPhone, ownerEmail, propertyType, adType, city } = req.body;

    if (!ownerName || !ownerPhone || !propertyType || !adType) {
      return res.status(400).json({
        success: false,
        message: 'ownerName, ownerPhone, propertyType and adType are required',
      });
    }

    const phone = ownerPhone.replace(/\D/g, '').slice(-10);
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number' });
    }

    // ── Check for existing active draft for this phone ────────────────────────
    const existingDraft = await UserListing.findOne({
      ownerPhone: phone,
      status: 'draft',
    }).sort({ updatedAt: -1 }).lean();

    if (existingDraft) {
      // Return the existing draft so frontend can resume the wizard
      return res.status(200).json({
        success: true,
        isReturning: true,
        message: 'You have an unfinished listing. Resuming from where you left off.',
        listing: existingDraft,
      });
    }

    // ── Create a fresh draft ──────────────────────────────────────────────────
    const listing = await UserListing.create({
      ownerName:    ownerName.trim(),
      ownerPhone:   phone,
      ownerEmail:   (ownerEmail || '').trim().toLowerCase(),
      propertyType,
      adType,
      city:         city || '',
      status:       'draft',
      currentStep:  0,
    });

    return res.status(201).json({
      success: true,
      isReturning: false,
      message: 'Draft created. Start filling in your listing details.',
      listing,
    });
  } catch (err) {
    console.error('captureLead error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FORCE CREATE — POST /api/user-listings/create
// Always creates a brand-new draft, never resumes existing.
// Used when user explicitly clicks "Post New Ad".
// ─────────────────────────────────────────────────────────────────────────────
export const createListing = async (req, res) => {
  try {
    const { ownerName, ownerPhone, ownerEmail, propertyType, adType, city } = req.body;

    if (!ownerName || !ownerPhone || !propertyType || !adType) {
      return res.status(400).json({
        success: false,
        message: 'ownerName, ownerPhone, propertyType and adType are required',
      });
    }

    const phone = ownerPhone.replace(/\D/g, '').slice(-10);
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number' });
    }

    // Always create fresh — no existing draft check
    const listing = await UserListing.create({
      ownerName:   ownerName.trim(),
      ownerPhone:  phone,
      ownerEmail:  (ownerEmail || '').trim().toLowerCase(),
      propertyType,
      adType,
      city:        city || '',
      status:      'draft',
      currentStep: 0,
    });

    return res.status(201).json({
      success: true,
      isReturning: false,
      message: 'New draft created.',
      listing,
    });
  } catch (err) {
    console.error('createListing error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — PATCH /api/user-listings/:id/step
// Auto-saves the current wizard step data into the draft.
// ownerPhone must be passed in body to verify ownership (no JWT needed).
// ─────────────────────────────────────────────────────────────────────────────
export const saveStep = async (req, res) => {
  try {
    const { id } = req.params;
    const { ownerPhone, ...rest } = req.body;

    // Verify ownership via phone
    const phone = (ownerPhone || '').replace(/\D/g, '').slice(-10);
    if (!phone) {
      return res.status(400).json({ success: false, message: 'ownerPhone is required' });
    }

    // Build update object from whitelisted fields only
    const update = {};
    for (const field of STEP_FIELDS) {
      if (field in rest) update[field] = rest[field];
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    // Match on both _id AND ownerPhone — prevents anyone else from patching
    const listing = await UserListing.findOneAndUpdate(
      { _id: id, ownerPhone: phone, status: 'draft' },
      { $set: update },
      { new: true, runValidators: false }
    );

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Draft not found, already submitted, or phone mismatch',
      });
    }

    return res.status(200).json({ success: true, listing });
  } catch (err) {
    console.error('saveStep error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user-listings/my/:phone
// Returns all listings (draft + submitted + active) for an owner's phone.
// Used to show "Your properties" dashboard (like the NoBroker reference image).
// ─────────────────────────────────────────────────────────────────────────────
export const getMyListings = async (req, res) => {
  try {
    const phone = req.params.phone.replace(/\D/g, '').slice(-10);

    const listings = await UserListing.find({
      ownerPhone: phone,
      status: { $ne: 'removed' },
    })
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({ success: true, count: listings.length, listings });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user-listings/:id
// Single listing detail (for resuming wizard or owner preview).
// ─────────────────────────────────────────────────────────────────────────────
export const getListingById = async (req, res) => {
  try {
    const listing = await UserListing.findById(req.params.id).lean();
    if (!listing || listing.status === 'removed') {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    return res.status(200).json({ success: true, listing });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user-listings/:id/submit
// Owner finalises — changes status from 'draft' → 'submitted'.
// ownerPhone in body verifies ownership (no JWT needed).
// ─────────────────────────────────────────────────────────────────────────────
export const submitListing = async (req, res) => {
  try {
    const phone = (req.body.ownerPhone || '').replace(/\D/g, '').slice(-10);
    if (!phone) {
      return res.status(400).json({ success: false, message: 'ownerPhone is required' });
    }

    const listing = await UserListing.findOneAndUpdate(
      { _id: req.params.id, ownerPhone: phone, status: 'draft' },
      { $set: { status: 'submitted' } },
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Draft not found, already submitted, or already removed',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Listing submitted for review. Our team will contact you within 24 hours.',
      listing,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/user-listings/:id
// Owner removes their own draft/listing (soft delete → status: 'removed').
// ownerPhone in body verifies ownership — no JWT needed.
// ─────────────────────────────────────────────────────────────────────────────
export const removeListing = async (req, res) => {
  try {
    const phone = (req.body?.ownerPhone || '').replace(/\D/g, '').slice(-10);
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'ownerPhone is required to remove a listing',
      });
    }

    // Match on both _id AND ownerPhone — only the actual owner can delete
    const listing = await UserListing.findOneAndUpdate(
      { _id: req.params.id, ownerPhone: phone },
      { $set: { status: 'removed' } },
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found or phone number does not match',
      });
    }

    return res.status(200).json({ success: true, message: 'Listing removed successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — GET /api/user-listings
// All submitted (pending review) listings, newest first, with pagination.
// ─────────────────────────────────────────────────────────────────────────────
export const getAllSubmissions = async (req, res) => {
  try {
    const {
      status = 'submitted',
      page = 1,
      limit = 20,
      phone,
    } = req.query;

    const filter = { status };
    if (phone) filter.ownerPhone = phone.replace(/\D/g, '').slice(-10);

    const skip = (Number(page) - 1) * Number(limit);

    const [total, listings] = await Promise.all([
      UserListing.countDocuments(filter),
      UserListing.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      listings,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — PATCH /api/user-listings/:id/status
// Approve (active) or reject (rejected) a submission.
// ─────────────────────────────────────────────────────────────────────────────
export const updateListingStatus = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const allowed = ['active', 'rejected'];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${allowed.join(', ')}`,
      });
    }

    const listing = await UserListing.findByIdAndUpdate(
      req.params.id,
      { $set: { status, adminNote: adminNote || '' } },
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    // ── Auto-create Property when admin approves ───────────────────────────────
    if (status === 'active') {
      try {
        // Map UserListing propertyType → Property type enum
        const typeMap = {
          'Residential':  listing.bhkType ? 'Apartment' : 'Apartment',
          'Commercial':   'Commercial',
          'Plot/Villa':   'Villa',
          'Plot':         'Plot',
          'Villa':        'Villa',
        };
        const mappedType = typeMap[listing.propertyType] || 'Apartment';

        // Build a human-readable title
        const titleParts = [
          listing.bhkType || listing.apartmentType || listing.propertyType,
          listing.adType === 'Rent' ? 'for Rent' : listing.adType === 'Resale' ? 'for Resale' : 'for Sale',
          listing.locality ? `in ${listing.locality}` : listing.city ? `in ${listing.city}` : '',
        ].filter(Boolean);
        const title = titleParts.join(' ');

        // Parse price — strip commas/currency symbols, convert to number
        const rawPrice = String(listing.price || '0').replace(/[₹,\s]/g, '');
        const price = parseFloat(rawPrice) || 0;

        // Parse numeric fields safely
        const toNum = (v) => { const n = parseFloat(String(v || '0').replace(/[^\d.]/g, '')); return isNaN(n) ? 0 : n; };

        await Property.create({
          title,
          type:        mappedType,
          price,
          priceLabel:  listing.price || '',
          location:    listing.locality || listing.city || 'Pune',
          city:        listing.city || 'Pune',
          bedrooms:    toNum(listing.bhkType),   // e.g. "3 BHK" → 3
          bathrooms:   toNum(listing.bathrooms),
          area:        toNum(listing.area || listing.carpetArea),
          parking:     toNum(listing.parking),
          image:       (listing.images && listing.images.length > 0) ? listing.images[0] : '',
          images:      listing.images || [],
          amenities:   listing.amenities || [],
          description: listing.description || listing.additionalNotes || '',
          furnishing:  listing.furnishing || '',
          facing:      listing.facing || '',
          status:      'Ready to Move',
          isActive:    true,
          badge:       'New',
          badgeColor:  'green',
          addedBy: {
            role: 'user',
            name: listing.ownerName || '',
          },
        });

        // Bust the properties cache so new property shows immediately
        invalidateCache('/api/properties');
      } catch (propErr) {
        // Don't fail the approval if Property creation fails — log and continue
        console.error('Auto Property creation failed:', propErr.message);
      }
    }

    return res.status(200).json({ success: true, listing });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
